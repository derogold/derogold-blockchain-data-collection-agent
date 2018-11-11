// Copyright (c) 2018, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const Config = require('./config.json')
const BlockChainMonitor = require('./lib/blockchainMonitor')
const BlockChainCollector = require('./lib/blockchainCollector')
const DatabaseBackend = require('./lib/databaseBackend')
const Metronome = require('./lib/metronome')
const util = require('util')

const monitor = new BlockChainMonitor({
  host: Config.node.host,
  port: Config.node.port
})

/* Set up our blockchain collector so that we can actually query
   the daemon and go get block details. The timeout is adjusted
   dynamically based on the amount of blocks we're going to try
   to get at one time. This is because the more blocks we request,
   the longer the daemon takes to respond with those blocks. It's
   not a linear relation by any means but the method below seems
   to provide at least a semi-reliable way to figure out the timeout
   we need to use */
const collector = new BlockChainCollector({
  host: Config.node.host,
  port: Config.node.port,
  timeout: ((Config.catchUpBlockIncrement * 500) >= 5000) ? Config.catchUpBlockIncrement * 500 : 5000
})

const database = new DatabaseBackend({
  host: Config.mysql.host,
  port: Config.mysql.port,
  username: Config.mysql.username,
  password: Config.mysql.password,
  database: Config.mysql.database,
  connectionLimit: Config.mysql.connectionLimit
})

function log (message) {
  console.log(util.format('%s: %s', (new Date()).toUTCString(), message))
}

monitor.on('update', (block) => {
  /* Every time the blockchain monitor tells us there's a new top block,
     let's go out and collect it */
  collectBlocks(block.height).then(() => {
    log('Collected block: ' + block.height)
  }).catch(() => {
    log('Could not collect block: ' + block.height)
  })
})

monitor.on('fork', () => {
  // fork?
})

monitor.on('error', () => {
  // for now we are suppressing errors because we'll just try again later
})

database.haveGenesis().then((haveGenesis) => {
  /* Check to see if the database has the genesis block, if it
     doesn't then go get it and store it. If this ever says it
     could not collect the genesis block, we've got big problems */
  if (haveGenesis) {
    log('Genesis block found in database')
  } else {
    collectBlocks(0).then(() => {
      log('Collected block: 0')
    }).catch(() => {
      log('Could not collect genesis block')
    })
  }
}).catch(() => {
  log('Could not check for genesis block in database')
})

const catchupTimer = new Metronome(Config.catchUpInterval)

catchupTimer.on('tick', () => {
  /* Every tick, check to see if we're missing any blocks in the
     database, if we are, we have some work to do */
  database.detectMissingBlocks().then(async (results) => {
    if (results.length > 0) {
      /* Pause the timer as we don't want to overrun ourselves later
         and overload the daemon as it does NOT care for that at all... */
      catchupTimer.pause = true
      const result = results[0]
      var increment = Config.catchUpBlockIncrement
      var passCount = 0

      var min = result.lowerBound
      var max = result.upperBound
      var done = false
      var lastCallSuccess = true

      do {
        /* If our last attempt to get collect blocks failed its likely
           due to hitting the RPC timeout -- the only way to handle this
           is to back off a bit and request half the blocks we did on the lass
           pass. If we keep failing, we'll step all the way back down to 1
           block at a time if we have to */
        if (!lastCallSuccess) {
          increment = Math.floor(increment / 2)
        }

        if (increment < 1) increment = 1
        var diff = max - min

        /* Sometimes weird things happen. Weird things need accounted for */
        max = (diff > increment) ? min + increment : max
        if (max < min) max = min
        if (max === min) max++

        log('Requesting blocks: ' + min + ' -> ' + max + ' (' + (max - min) + ')')
        try {
          var collected = await collectBlocks(min, max)

          // Awesome, we collected some blocks
          if (collected.min && collected.max) {
            log('Collected blocks: ' + min + ' -> ' + max + ' (' + (max - min) + ')')
            if (max === result.upperBound) done = true

            /* Here's where we increase where we're currently at in the missing
               blocks range */
            min = collected.max
            max = result.upperBound
            lastCallSuccess = true
            passCount++

            /* If we've been able to collect blocks at a decreased count value
               for the last 10 passes, let's try increasing how many we're grabbing
               so that we can work our way back up to the value specified in our config */
            if (passCount > 10 && increment < Config.catchUpBlockIncrement) {
              increment = increment * 2
              if (increment > Config.catchUpBlockIncrement) increment = Config.catchUpBlockIncrement
            }
          }
        } catch (err) {
          passCount = 0
          lastCallSuccess = false
        }
      } while (!done)

      catchupTimer.pause = false
    }
  }).catch((error) => {
    catchupTimer.pause = false
    log(error)
  })
})

function collectBlocks (min, max) {
  return new Promise((resolve, reject) => {
    /* Try to retrieve all of the block details from the daemon
       for the blocks between min and max */
    collector.get(min, max).then((blocks) => {
      if (blocks.blocks && blocks.blocks.length >= 1) {
        var promises = []
        for (var i = 0; i < blocks.blocks.length; i++) {
          promises.push(database.saveBlock(blocks.blocks[i]))
        }

        /* Wait to see if we were able to save all of the block details
           that we collected */
        Promise.all(promises).then(() => {
          if (typeof max === 'undefined') {
            return resolve({ min, max: min })
          } else {
            return resolve({ min, max })
          }
        })
      }
    }).catch((error) => {
      return reject(error)
    })
  })
}
