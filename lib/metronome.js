// Copyright (c) 2018-2019, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits

/* This is a voodoo pausable timer that simply
   emits a 'tick' event every interval unless paused */
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
