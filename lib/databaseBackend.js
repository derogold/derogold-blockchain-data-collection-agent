// Copyright (c) 2018, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const MySQL = require('mysql')
const BigInt = require('big-integer')

const blockInsert = 'REPLACE INTO `blocks` (`hash`, `prevHash`, `height`, `baseReward`, `difficulty`, `majorVersion`, `minorVersion`, `nonce`, `size`, `timestamp`) VALUES (?,?,?,?,?,?,?,?,?,?)'
const txnInsert = 'REPLACE INTO `transactions` (`txnHash`, `blockHash`, `mixin`, `timestamp`, `paymentId`, `unlockTime`, `publicKey`, `fee`, `size`, `nonce`, `extra`) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
const txnInputInsert = 'REPLACE INTO `transaction_inputs` (`txnHash`, `keyImage`, `amount`, `type`) VALUES (?,?,?,?)'
const txnOutputInsert = 'REPLACE INTO `transaction_outputs` (`txnHash`, `outputIndex`, `globalIndex`, `amount`, `key`, `type`) VALUES (?,?,?,?,?,?)'
const missingBlocksSelect = 'SELECT z.expected AS `lowerBound`, IF(z.got-1>z.expected, z.got-1, z.expected) AS `upperBound` FROM ( SELECT @rownum:=@rownum+1 AS expected, IF(@rownum=height, 0, @rownum:=height) AS got FROM (SELECT @rownum:=0) AS a JOIN blocks ORDER BY height ) AS z WHERE z.got!=0;'

const Self = function (opts) {
  opts = opts || {}
  if (!(this instanceof Self)) return new Self(opts)
  this.host = opts.host || '127.0.0.1'
  this.port = opts.port || 3306
  this.username = opts.username || ''
  this.password = opts.password || ''
  this.database = opts.database || ''
  this.socketPath = opts.socketPath || false
  this.connectionLimit = opts.connectionLimit || 10

  this.db = MySQL.createPool({
    connectionLimit: this.connectionLimit,
    host: this.host,
    port: this.port,
    user: this.username,
    password: this.password,
    database: this.database,
    socketPath: this.socketPath
  })
}

Self.prototype.detectMissingBlocks = function () {
  /* Run some magic select statements to determine what range(s) of blocks are missing
     from the database. This allows us to work through those ranges and fill in the blanks
     so to speak */
  return new Promise((resolve, reject) => {
    var connection
    this._connection().then((dbConnection) => {
      connection = dbConnection
      return this._query(connection, missingBlocksSelect, [])
    }).then((results, fields) => {
      connection.release()
      return resolve(results)
    }).catch((error) => {
      if (typeof connection !== 'undefined') {
        connection.release()
      }
      return reject(error)
    })
  })
}

Self.prototype.haveGenesis = function () {
  /* Our actual logic in detecting gaps in the blocks doesn't account for a block
     at the height of 0. As a result, we explicity check the database for the existence
     of a block at height 0 and say yes/no */
  return new Promise((resolve, reject) => {
    var connection
    this._connection().then((dbConnection) => {
      connection = dbConnection
      return this._query(connection, 'SELECT COUNT(*) as `cnt` FROM `blocks` WHERE `height` = 0', [])
    }).then((results, fields) => {
      connection.release()
      if (results[0].cnt === 0) {
        return resolve(false)
      } else {
        return resolve(true)
      }
    }).catch((error) => {
      if (typeof connection !== 'undefined') {
        connection.release()
      }
      console.log(error)
      return reject(error)
    })
  })
}

Self.prototype.saveBlock = function (block) {
  /* What we're doing here is building our sets of queries
     for each block, transactions, inputs, and outputs to send down
     to the _insertTransaction method as part of saving the block
     information to the database */
  var queries = []
  queries.push({ query: blockInsert,
    args: [
      block.hash,
      block.prevBlockHash,
      block.index,
      block.baseReward,
      block.difficulty,
      block.majorVersion,
      block.minorVersion,
      block.nonce,
      block.blockSize,
      block.timestamp
    ] })

  for (var i = 0; i < block.transactions.length; i++) {
    var transaction = block.transactions[i]

    /* The JSON serialization library used by the Daemon is broken and will wrap around a value
       to an int64_t as explained at https://github.com/turtlecoin/turtlecoin/issues/603
       the value is actually max(uint64_t) minus the value. */
    if (transaction.unlockTime < 0) {
      var realUnlockTime = BigInt('18446744073709551615').plus(transaction.unlockTime).toString()
      transaction.unlockTime = realUnlockTime
      console.log('Transaction has invalid unlock_time: ' + transaction.hash + ' adjusted to: ' + realUnlockTime)
    }

    /* Storing a paymentId of 0000000000000000000000000000000000000000000000000000000000000000
       is wasteful, we're going to consider this empty for now */
    if (transaction.paymentId === '0000000000000000000000000000000000000000000000000000000000000000') {
      transaction.paymentId = ''
    }

    /* For reference, nonce that comes back from the daemon in the request is an array of values
       as can be raw. To work around trying to store a serialized object in the columns, we
       turn the information into a buffer and encode it to hex. This just makes it a bit easier
       to store in the database */
    queries.push({ query: txnInsert,
      args: [
        transaction.hash,
        transaction.blockHash,
        transaction.mixin,
        transaction.timestamp,
        transaction.paymentId,
        transaction.unlockTime,
        transaction.extra.publicKey,
        transaction.fee,
        transaction.size,
        Buffer.from(transaction.extra.nonce).toString('hex'),
        Buffer.from(transaction.extra.raw).toString('hex')
      ] })

    for (var j = 0; j < transaction.inputs.length; j++) {
      var input = transaction.inputs[j]

      /* To explain the logic below: the a key_image does not exist on a coinbase (miner)
         transaction. These are magic funds that just appear. As for the amount, depending
         on if it is a 'normal' transaction or a coinbase (miner) transaction, the location
         of the input amount changes slightly. Thanks CryptoNote developers! */
      queries.push({ query: txnInputInsert,
        args: [
          transaction.hash,
          (input.type.toLowerCase() !== 'ff') ? input.data.input.k_image : '',
          (input.type.toLowerCase() === 'ff') ? input.data.amount : input.data.input.amount,
          parseInt(input.type, 16)
        ] })
    }

    for (var k = 0; k < transaction.outputs.length; k++) {
      var output = transaction.outputs[k]
      queries.push({ query: txnOutputInsert,
        args: [
          transaction.hash,
          k,
          output.globalIndex,
          output.output.amount,
          output.output.target.data.key,
          parseInt(output.output.target.type, 16)
        ] })
    }
  }

  return this._insertTransaction(queries)
}

Self.prototype._query = function (connection, query, args) {
  return new Promise((resolve, reject) => {
    connection.query(query, args, (error, results, fields) => {
      if (error) {
        return reject(error)
      }
      return resolve(results, fields)
    })
  })
}

Self.prototype._beginTransaction = function (connection) {
  return new Promise((resolve, reject) => {
    connection.beginTransaction((error) => {
      if (error) {
        return reject(error)
      }
      return resolve()
    })
  })
}

Self.prototype._commit = function (connection) {
  return new Promise((resolve, reject) => {
    connection.commit((error) => {
      if (error) {
        return reject(error)
      }
      return resolve()
    })
  })
}

Self.prototype._rollback = function (connection) {
  return new Promise((resolve, reject) => {
    connection.rollback(() => {
      return resolve()
    })
  })
}

Self.prototype._connection = function () {
  return new Promise((resolve, reject) => {
    this.db.getConnection((error, connection) => {
      if (error) {
        return reject(error)
      }
      return resolve(connection)
    })
  })
}

Self.prototype._insertTransaction = function (queries) {
  /* This will run a set of insert queries as a SQL transaction
     such that if any of the queries failed, the entire transaction
     will roll back. This greatly reduces the risk of having incomplete
     data regarding each block as the block, transactions, inputs, and outputs
     must all make it into the database for it to be a valid insert */
  return new Promise((resolve, reject) => {
    var results
    var connection

    this._connection().then((dbConnection) => {
      connection = dbConnection
      return this._beginTransaction(connection)
    }).then(() => {
      var promises = []
      for (var i = 0; i < queries.length; i++) {
        promises.push(this._query(connection, queries[i].query, queries[i].args))
      }
      return Promise.all(promises)
    }).then((promiseResults) => {
      results = promiseResults
      return this._commit(connection)
    }).then(() => {
      connection.release()
      return resolve(results)
    }).catch((error) => {
      if (connection) {
        this._rollback(connection).then(() => {
          connection.release()
          return reject(error)
        }).catch((error) => {
          connection.release()
          return reject(error)
        })
      } else {
        return reject(new Error('An error occurred'))
      }
    })
  })
}

module.exports = Self
