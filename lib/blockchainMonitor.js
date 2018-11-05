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
