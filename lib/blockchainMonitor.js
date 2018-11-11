// Copyright (c) 2018, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const TurtleCoindRPC = require('turtlecoin-rpc').TurtleCoind
const inherits = require('util').inherits
const EventEmitter = require('events').EventEmitter
const Metronome = require('./metronome')

const Self = function (opts) {
  opts = opts || {}
  if (!(this instanceof Self)) return new Self(opts)

  opts.host = opts.host || '127.0.0.1'
  opts.port = opts.port || 11898
  opts.timeout = opts.timeout || 2000
  opts.ssl = opts.ssl || false
  this.scanInterval = opts.scanInterval || 5
  this.scanInterval = this.scanInterval * 1000
  this.rpc = new TurtleCoindRPC(opts)
  this._hash = opts.lastHash || null
  this.timer = new Metronome(this.scanInterval)

  this.timer.on('tick', () => {
    this._scan()
  })
}
inherits(Self, EventEmitter)

Self.prototype._scan = function () {
  /* Go get the latest blockheader and if it has changed from the
     last block header that we received, then emit an 'update' event.
     If for some reason, the prev_hash of the new block does not match
     the hash of the last block we found, we'll emit a 'fork' event
     which typically means that the chain resolved and there was a changed
     in the blockchain. This is **really** basic fork detection but it
     is better than nothing right now. */
  this.rpc.getLastBlockHeader().then((header) => {
    if (this._hash !== header.hash) {
      if (this._hash && header.prev_hash !== this._hash) {
        this.emit('fork')
      }
      this._hash = header.hash
      this.emit('update', header)
    }
  }).catch((err) => {
    this.emit('error', err)
  })
}

module.exports = Self
