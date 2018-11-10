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

const catchupTimer = new Metronome(Config.catchUpInterval)

catchupTimer.on('tick', () => {
  database.detectMissingBlocks().then(async (results) => {
    if (results.length > 0) {
      catchupTimer.pause = true // pause our timer, as we're ready to rumble
      const result = results[0]
      var increment = Config.catchUpBlockIncrement

      var min = result.lowerBound
      var max = result.upperBound
      var done = false
      var lastCallSuccess = true

      do {
        if (!lastCallSuccess) {
          increment = Math.floor(increment / 2)
        }
        if (increment < 1) increment = 1
        var diff = max - min
        max = (diff > increment) ? min + increment : max
        if (max < min) max = min
        if (max === min) max++
        log('Requesting blocks: ' + min + ' -> ' + max + ' (' + (max - min) + ')')
        try {
          var collected = await collectBlocks(min, max)
          if (collected.min && collected.max) {
            log('Collected blocks: ' + min + ' -> ' + max + ' (' + (max - min) + ')')
            if (max === result.upperBound) done = true
            min = collected.max
            max = result.upperBound
            lastCallSuccess = true
          }
        } catch (err) {
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
    collector.get(min, max).then((blocks) => {
      if (blocks.blocks && blocks.blocks.length >= 1) {
        var promises = []
        for (var i = 0; i < blocks.blocks.length; i++) {
          promises.push(database.saveBlock(blocks.blocks[i]))
        }

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
