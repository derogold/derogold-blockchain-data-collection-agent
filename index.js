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
  timeout: Config.catchUpBlockIncrement * 120
})

const database = new DatabaseBackend({
  host: Config.mysql.host,
  port: Config.mysql.port,
  username: Config.mysql.username,
  password: Config.mysql.password,
  database: Config.mysql.database
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
  // yeah, I don't care about this
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

      do {
        var diff = max - min
        max = (diff > increment) ? min + increment : max
        if (max === min) max++
        var collected = await collectBlocks(min, max)
        if (collected.min && collected.max) {
          log('Collected blocks: ' + min + ' -> ' + max + ' (' + (max - min) + ')')
          min = collected.max
          max = result.upperBound
        }
        if (max === result.upperBound) done = true
      } while (!done)
    }

    catchupTimer.pause = false
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
