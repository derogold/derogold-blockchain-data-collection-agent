// Copyright (c) 2018, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const Config = require('./config.json')
const BlockChainCollector = require('./lib/blockchainCollector')
const DatabaseBackend = require('./lib/databaseBackend')
const Metronome = require('./lib/metronome')
const util = require('util')

const enableDebugging = !!((process.env.TURTLEPAY_DEBUG.toUpperCase() === 'ON' || parseInt(process.env.TURTLEPAY_DEBUG) === 1))

/* Let's set up a standard logger. Sure it looks cheap but it's
   reliable and won't crash */
function log (message) {
  console.log(util.format('%s: %s', (new Date()).toUTCString(), message))
}

/* We're going to go ahead and create our timer but pause it until
   we know that we have the genesis hash in the database */
const timer = new Metronome(2000)
timer.pause = true

/* Timer to fire to get the transaction pool information */
const transactionPoolTimer = new Metronome(5000)

/* Timer to fire to get the network information */
const informationTimer = new Metronome(5000)

/* Set up our database connection */
const database = new DatabaseBackend({
  host: Config.mysql.host,
  port: Config.mysql.port,
  username: Config.mysql.username,
  password: Config.mysql.password,
  database: Config.mysql.database,
  connectionLimit: Config.mysql.connectionLimit
})

/* Set up our blockchain collector so that we can actually query
   the daemon and go get block details. The timeout is set
   statically to 60s for the time being so that we can monitor
   performance as it plays catch up */
const collector = new BlockChainCollector({
  host: Config.node.host,
  port: Config.node.port,
  timeout: 120000
})

if (enableDebugging) {
  collector.on('debug', (message) => {
    log(util.format('[DEBUG] %s', message))
  })
}

database.haveGenesis().then((haveGenesis) => {
  /* Check to see if the database has the genesis block, if it
     doesn't then go get it and store it. If this ever says it
     could not collect the genesis block, we've got big problems */
  if (haveGenesis) {
    log('Genesis block found in database')
    timer.pause = false
  } else {
    collector.getGenesis().then((genesis) => {
      return database.saveBlock(genesis)
    }).then(() => {
      log('Collected genesis block')
      timer.pause = false
    }).catch((error) => {
      log('Could not collect genesis block: ' + error)
    })
  }
}).catch(() => {
  log('Could not check for genesis block in database')
})

timer.on('tick', () => {
  timer.pause = true // let's not tick again we're ready

  /* We define this here as a method to catch a break in the chained
     promises to allow us to exit the chain without generating an
     error that gets dumped to the screen erroneously */
  function BreakSignal () {}

  /* Let's go grab the transaction hashes that we know about */
  database.getLastKnownBlockHashes().then((lastKnownHashes) => {
    return collector.queryBlocks(lastKnownHashes)
  }).then((results) => {
    if (results.blocks.length === 1) {
      /* If we only got one block back, then we are already at the top */
      throw new BreakSignal()
    }

    /* Try to save what we've collected */
    return database.saveBlocks(results.blocks, results.height)
  }).then((results) => {
    /* Great, we saved them, let's tell print out some information about
       what we managed to collect */
    for (var i = 0; i < results.blocks.length; i++) {
      log('Saved block #' + results.blocks[i].height + ' (' + results.blocks[i].hash + ')')
    }
    log('============   ' + results.deletes + ' Delete Statements  ============')
    log('============   Stored ' + results.inserts + ' Objects   ============')

    /* Allow our timer to fire again */
    timer.pause = false
  }).catch((error) => {
    /* If we threw because we exited the promise chain early,
       that's okay and we don't need to log an event */
    if (!(error instanceof BreakSignal)) {
      log(error)
    }

    /* Allow our timer to fire again */
    timer.pause = false
  })
})

/* Let's go grab the transaction pool from the daemon and save
   it in the database */
transactionPoolTimer.on('tick', () => {
  transactionPoolTimer.pause = true
  var txnCount
  collector.getTransactionPool().then((transactions) => {
    txnCount = transactions.length
    return database.saveTransactionPool(transactions)
  }).then(() => {
    log('Saved current transaction pool (' + txnCount + ' transactions)')
    transactionPoolTimer.pause = false
  }).catch((error) => {
    log('Could not save transaction pool: ' + error)
    transactionPoolTimer.pause = false
  })
})

/* Let's go get the daemon information to store in the database */
informationTimer.on('tick', () => {
  informationTimer.pause = true
  collector.getInfo().then((info) => {
    return database.saveInfo('getinfo', JSON.stringify(info))
  }).then(() => {
    log('Saved daemon information')
    informationTimer.pause = false
  }).catch((error) => {
    log('Could not save daemon information: ' + error)
    informationTimer.pause = false
  })
})
