// Copyright (c) 2018, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const Client = require('turtlecoin-rpc').Client
const TurtleCoind = require('turtlecoin-rpc').TurtleCoind

const Self = function (opts) {
  opts = opts || {}
  if (!(this instanceof Self)) return new Self(opts)

  opts.host = opts.host || '127.0.0.1'
  opts.port = opts.port || 11898
  opts.timeout = opts.timeout || 2000
  opts.ssl = opts.ssl || false
  this.rpc = new Client(opts)
  this.daemon = new TurtleCoind(opts)
}

Self.prototype.getGenesis = function () {
  return new Promise((resolve, reject) => {
    this.rpc.getBlockDetailsByHeight({ blockHeight: '0' }).then((result) => {
      if (result.status === 'OK') {
        return resolve(result.block)
      } else {
        return reject(new Error(result.status))
      }
    }).catch((error) => {
      return reject(error)
    })
  })
}

Self.prototype.queryBlocks = function (blockHashes) {
  return new Promise(async (resolve, reject) => {
    var blockCount = 100
    var error

    while (blockCount > 2) {
      try {
        var results = await this.rpc.queryBlocksDetailed({ blockHashes: blockHashes })
        if (results.status === 'OK') {
          return resolve({ blocks: results.blocks, height: (results.startHeight) })
        }
      } catch (e) {
        blockCount = Math.floor(blockCount / 2)
        error = e
      }
    }

    return reject(new Error('queryBlocksDetailed failed: ' + error.message))
  })
}

Self.prototype.getTransactionPool = function () {
  return new Promise((resolve, reject) => {
    this.daemon.getTransactionPool().then((result) => {
      return resolve(result)
    }).catch((error) => {
      return reject(new Error('Could not collected transaction pool from daemon: ' + error.message))
    })
  })
}

Self.prototype.getInfo = function () {
  return new Promise((resolve, reject) => {
    this.daemon.info().then((result) => {
      return resolve(result)
    }).catch((error) => {
      return reject(new Error('Could not collect daemon information from daemon: ' + error.message))
    })
  })
}

module.exports = Self
