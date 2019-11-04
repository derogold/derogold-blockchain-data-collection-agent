// Copyright (c) 2018-2019, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const Client = require('turtlecoin-rpc').Client
const TurtleCoind = require('turtlecoin-rpc').TurtleCoind
const EventEmitter = require('events').EventEmitter
const util = require('util')

class Collector extends EventEmitter {
  constructor (opts) {
    super()
    opts = opts || {}

    opts.host = opts.host || '127.0.0.1'
    opts.port = opts.port || 11898
    opts.timeout = opts.timeout || 2000
    opts.ssl = opts.ssl || false
    this.rpc = new Client(opts)
    this.daemon = new TurtleCoind(opts)
  }

  getGenesis () {
    this.emit('debug', 'Attempting to retrieve the genesis block from the daemon...')
    return this.rpc.getBlockDetailsByHeight({ blockHeight: '0' })
      .then(result => {
        if (result.status.toUpperCase() === 'OK') {
          return result.block
        } else {
          throw new Error('Received invalid response from daemon')
        }
      })
  }

  queryBlocks (blockHashes) {
    return new Promise((resolve, reject) => {
      var blockCount = 100

      function tryFetch () {
        return this.rpc.queryBlocksDetailed({ blockHashes: blockHashes, blockCount: blockCount })
          .then(results => {
            if (results.status.toUpperCase() === 'OK') {
              return { blocks: results.blocks, height: (results.startHeight) }
            } else {
              throw new Error('Received invalid response from daemon')
            }
          })
      }

      (async function () {
        var error

        while (blockCount >= 2) {
          try {
            const blocks = await tryFetch()
            return resolve(blocks)
          } catch (e) {
            this.emit('debug', util.format('Failed to retrieve %s blocks', blockCount))
            blockCount = Math.floor(blockCount / 2)
            error = e
          }
        }

        return reject(new Error('queryBlocksDetailed failed: ' + error.toString()))
      })()
    })
  }

  getTransactionPool () {
    this.emit('debug', 'Attempting to retrieve the current transaction pool...')

    return this.daemon.getTransactionPool()
      .catch(error => { throw new Error('Could not collected transaction pool from daemon: ' + error.message) })
  }

  getInfo () {
    this.emit('debug', 'Attempting to retrieve the current daemon information...')

    this.daemon.info()
      .catch(error => { throw new Error('Could not collect daemon information from daemon: ' + error.message) })
  }
}

module.exports = Collector
