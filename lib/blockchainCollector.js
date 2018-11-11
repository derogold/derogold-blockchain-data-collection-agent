// Copyright (c) 2018, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const Client = require('turtlecoin-rpc').Client

const Self = function (opts) {
  opts = opts || {}
  if (!(this instanceof Self)) return new Self(opts)

  opts.host = opts.host || '127.0.0.1'
  opts.port = opts.port || 11898
  opts.timeout = opts.timeout || 2000
  opts.ssl = opts.ssl || false
  this.rpc = new Client(opts)
}

Self.prototype.get = function (min, max) {
  /* Here we're simplying setting up a query that we send
     to the underlying daemon to give us all of the details
     for blocks between 'min' and 'max' */
  if (typeof max === 'undefined') {
    max = min + 1
  }
  var arr = []
  for (var i = min; i < max; i++) {
    arr.push(i)
  }
  return this.rpc.getBlocksDetailsByHeights({
    blockHeights: arr
  })
}

module.exports = Self
