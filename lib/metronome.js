// Copyright (c) 2018, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits

const Self = function (interval) {
  interval = interval || 0
  if (!(this instanceof Self)) return new Self(interval)
  this.pause = false

  const that = this
  ;(function () {
    function tick (ms) {
      setTimeout(() => {
        if (!that.pause) that.emit('tick')
        tick(ms)
      }, ms)
    }
    tick(interval)
  }())
}
inherits(Self, EventEmitter)

module.exports = Self
