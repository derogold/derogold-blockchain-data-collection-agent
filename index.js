// Copyright (c) 2018, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const Config = require('./config.json')
const BlockChainCollector = require('./lib/blockchainCollector')
const DatabaseBackend = require('./lib/databaseBackend')
const Metronome = require('./lib/metronome')
const util = require('util')

/* Let's set up a standard logger. Sure it looks cheap but it's
   reliable and won't crash */
function log (message) {
  console.log(util.format('%s: %s', (new Date()).toUTCString(), message))
}

/* We're going to go ahead and create our timer but pause it until
   we know that we have the genesis hash in the database */
const timer = new Metronome(2000)
timer.pause = true

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
  database.getLastKnownBlockHashes().then((lastKnownHashes) => {
    return collector.queryBlocks(lastKnownHashes)
  }).then((results) => {
    return database.saveBlocks(results.blocks, results.height)
  }).then((results) => {
    for (var i = 0; i < results.blocks.length; i++) {
      log('Saved block #' + results.blocks[i].height + ' (' + results.blocks[i].hash + ')')
    }
    log('============   ' + results.deletes + ' Delete Statements  ============')
    log('============   Stored ' + results.inserts + ' Objects   ============')

    /* Allow our timer to fire again */
    timer.pause = false
  }).catch((error) => {
    log(error)

    /* Allow our timer to fire again */
    timer.pause = false
  })
})
