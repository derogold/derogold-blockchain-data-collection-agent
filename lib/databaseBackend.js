// Copyright (c) 2018-2019, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const BigInt = require('big-integer')
const Logger = require('./logger')
const MySQL = require('mysql')

const blockInsert = [
  'INSERT INTO `blocks` (',
  '`hash`, `prevHash`, `height`, `baseReward`, `difficulty`, `majorVersion`, ',
  '`minorVersion`, `nonce`, `size`, `timestamp`, `alreadyGeneratedCoins`, ',
  '`alreadyGeneratedTransactions`, `reward`, `sizeMedian`, `totalFeeAmount`, ',
  '`transactionsCumulativeSize`, `transactionCount`',
  ') VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
].join('')

const txnInsert = [
  'INSERT INTO `transactions` (',
  '`txnHash`, `blockHash`, `mixin`, `timestamp`, `paymentId`, `unlockTime`, ',
  '`publicKey`, `fee`, `size`, `nonce`, `extra`, `totalInputsAmount`, ',
  '`totalOutputsAmount`',
  ') VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
].join('')

const txnInputInsert = [
  'INSERT INTO `transaction_inputs` (',
  '`txnHash`, `keyImage`, `amount`, `type`',
  ') VALUES (?,?,?,?)'
].join('')

const txnOutputInsert = [
  'INSERT INTO `transaction_outputs` (',
  '`txnHash`, `outputIndex`, `globalIndex`, `amount`, `key`, `type`',
  ') VALUES (?,?,?,?,?,?)'
].join('')

const txnPoolInsert = [
  'INSERT INTO `transaction_pool` (',
  '`txnHash`, `fee`, `size`, `amount`',
  ') VALUES (?,?,?,?)'
].join('')

const informationInsert = [
  'REPLACE INTO `information` (',
  '`key`, `payload`) VALUES (?,?)'
].join('')

const EmptyString = ''

class DatabaseBackend {
  constructor (opts) {
    opts = opts || {}

    this.host = opts.host || '127.0.0.1'
    this.port = opts.port || 3306
    this.username = opts.username || ''
    this.password = opts.password || ''
    this.database = opts.database || ''
    this.socketPath = opts.socketPath || false
    this.connectionLimit = opts.connectionLimit || 10
    this.storeRawTransactionExtra = opts.storeRawTransactionExtra || false

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

  buildSaveBlockQueries (block) {
    /* What we're doing here is building our sets of queries
       for each block, transactions, inputs, and outputs to send down
       to the _insertTransaction method as part of saving the block
       information to the database */
    const queries = []

    /* Then we can insert our block information */
    queries.push({
      query: blockInsert,
      args: [
        block.hash,
        block.prevBlockHash,
        block.index,
        block.baseReward,
        block.difficulty,
        (typeof block.majorVersion !== 'undefined') ? block.majorVersion : block.major_version,
        (typeof block.minorVersion !== 'undefined') ? block.minorVersion : block.minor_version,
        block.nonce,
        block.blockSize,
        block.timestamp,
        block.alreadyGeneratedCoins,
        block.alreadyGeneratedTransactions,
        block.reward,
        block.sizeMedian,
        block.totalFeeAmount,
        block.transactionsCumulativeSize,
        block.transactions.length
      ]
    })

    for (var i = 0; i < block.transactions.length; i++) {
      const transaction = block.transactions[i]

      /* The JSON serialization library used by the Daemon is broken and will wrap around a value
       to an int64_t as explained at https://github.com/turtlecoin/turtlecoin/issues/603
       the value is actually max(uint64_t) minus the value. */
      if (transaction.unlockTime < 0) {
        const realUnlockTime = BigInt('18446744073709551616').plus(transaction.unlockTime).toString()
        transaction.unlockTime = realUnlockTime
        Logger.warning('Transaction has invalid unlock_time: ' + transaction.hash + ' adjusted to: ' + realUnlockTime)
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
      queries.push({
        query: txnInsert,
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
          (this.storeRawTransactionExtra) ? Buffer.from(transaction.extra.raw).toString('hex') : EmptyString,
          transaction.totalInputsAmount,
          transaction.totalOutputsAmount
        ]
      })

      for (var j = 0; j < transaction.inputs.length; j++) {
        const input = transaction.inputs[j]

        /* To explain the logic below: the a key_image does not exist on a coinbase (miner)
         transaction. These are magic funds that just appear. As for the amount, depending
         on if it is a 'normal' transaction or a coinbase (miner) transaction, the location
         of the input amount changes slightly. Thanks CryptoNote developers! */
        queries.push({
          query: txnInputInsert,
          args: [
            transaction.hash,
            (input.type.toLowerCase() !== 'ff') ? input.data.input.k_image : '',
            (input.type.toLowerCase() === 'ff') ? input.data.amount : input.data.input.amount,
            parseInt(input.type, 16)
          ]
        })
      }

      for (var k = 0; k < transaction.outputs.length; k++) {
        const output = transaction.outputs[k]
        queries.push({
          query: txnOutputInsert,
          args: [
            transaction.hash,
            k,
            output.globalIndex,
            output.output.amount,
            output.output.target.data.key,
            parseInt(output.output.target.type, 16)
          ]
        })
      }
    }

    return queries.reverse()
  }

  buildDeleteBlocksFromHeightQueries (height) {
    /* This may seem like a mess, but we actually need to make sure that we clean up
       all parts of the database when we delete a block. Leaving anything behind
       will definitely cause problems down the road */
    return new Promise((resolve, reject) => {
      const queries = []

      /* We need to go figure out all of the blocks that we need to delete */
      this.query('SELECT `hash` FROM `blocks` WHERE `height` >= ?', [height])
        .then(rows => {
          /* If there are no blocks to delete, get out of here as quickly as possible */
          if (rows.length === 0) {
            return resolve([])
          }

          /* Let's loop through the block hashes and start building stuff out */
          const hashes = []
          for (var i = 0; i < rows.length; i++) {
            queries.push({ query: 'DELETE FROM `blocks` WHERE `hash` = ?', args: [rows[i].hash] })
            hashes.push('\'' + rows[i].hash + '\'')
          }
          const hashBlob = hashes.join()

          /* Now we need to go get all the transactions for those hashes */
          return this.query('SELECT `txnHash` FROM `transactions` WHERE `blockHash` IN (' + hashBlob + ')', [])
        })
        .then(rows => {
          /* Let's loop through what we found and toss those on the list to delete */
          for (var i = 0; i < rows.length; i++) {
            queries.push({ query: 'DELETE FROM `transaction_inputs` WHERE `txnHash` = ?', args: [rows[i].txnHash] })
            queries.push({ query: 'DELETE FROM `transaction_outputs` WHERE `txnHash` = ?', args: [rows[i].txnHash] })
            queries.push({ query: 'DELETE FROM `transactions` WHERE `txnHash` = ?', args: [rows[i].txnHash] })
          }

          /* That should be all of it, let's get out of here */
          return resolve(queries)
        })
        .catch(error => { return reject(error) })
    })
  }

  buildSaveTransactionPoolQueries (transactions) {
    const queries = []
    queries.push({ query: 'TRUNCATE `transaction_pool`', args: [] })

    for (var i = 0; i < transactions.length; i++) {
      const transaction = transactions[i]
      queries.push({
        query: txnPoolInsert,
        args: [
          transaction.hash,
          transaction.fee,
          transaction.size,
          transaction.amount_out
        ]
      })
    }

    return queries
  }

  connection () {
    return new Promise((resolve, reject) => {
      this.db.getConnection((error, connection) => {
        if (error) {
          return reject(error)
        }
        return resolve(connection)
      })
    })
  }

  getLastKnownBlockHeight () {
    /* We need to go get the last known block from the database so that we can let
       the daemon know where we are at so it can tell us how much we have to get */
    return this.query('SELECT MAX(`height`) AS `topBlock` FROM `blocks`')
      .then(results => {
        if (results.length === 0) throw new Error('No known blocks')

        return results[0].topBlock
      })
  }

  getGenesisHash () {
    return this.query('SELECT `hash` FROM `blocks` WHERE `height` = 0')
      .then(results => {
        if (results.length === 0) throw new Error('Could not retrieve genesis hash from database')

        return results[0].hash
      })
  }

  getLastKnownBlockHashes () {
    /* Things are about to get weird here, so hang on tight. We'll try to explain this as we go */
    return new Promise((resolve, reject) => {
      const hashes = []
      var topBlocks

      /* This is used largely because we don't want the same hash twice */
      function insert (hash) {
        if (hashes.indexOf(hash) === -1) {
          hashes.unshift(hash)
        }
      }

      this.getGenesisHash()
        .then(hash => {
          // We need the genesis hash at the bottom
          insert(hash)

          return this.getLastKnownBlockHeight()
        })
        .then(height => {
          if (height === 0) {
            return resolve(hashes)
          }

          return this.query('SELECT `hash`, `height` FROM `blocks` WHERE `height` <= ? ORDER BY `height` DESC LIMIT 11', [height])
        })
        .then(rows => {
          /* If we got back less than 11 rows for the query, then that's all there is so we might as well return */
          if (rows.length < 11) {
            for (var i = 0; i < rows.length; i++) {
              insert(rows[i].hash)
            }
            return resolve(hashes)
          }

          // We're just going to store these for later
          topBlocks = rows

          /* For the best coverage of finding differences in the chain we need to report
             block hashes in descending order by in powers of 2. This allows us to get
             back to the beginning of the chain and helps us minimize how many blocks
             we may need to resync */
          var bottomHeight = topBlocks[topBlocks.length - 1].height
          var n = 1
          const promises = []
          do {
            const diff = Math.pow(2, n)
            bottomHeight = bottomHeight - diff
            if (bottomHeight > 0) {
              n++
              promises.push(this.query('SELECT `hash`, `height` FROM `blocks` WHERE `height` = ?', [bottomHeight]))
            }
          } while (bottomHeight > 0)

          return Promise.all(promises)
        })
        .then(results => {
          /* the promises are nested, that doesn't work for me */
          const temp = []
          results.forEach((elem) => {
            temp.push(elem[0])
          })
          results = temp

          /* Now make sure that we have valid data in our results */
          results.forEach((elem) => {
            if (typeof elem.height === 'undefined' || typeof elem.hash === 'undefined') {
              throw new Error('Invalid block selected')
            }
          })

          /* We are going to get the promises back in some random order, let's sort em by height */
          results.sort((a, b) => {
            if (a.height < b.height) return -1
            if (a.height > b.height) return 1
            return 0
          })

          /* Let's toss those hashes on to our resulting array */
          for (var i = 0; i < results.length; i++) {
            insert(results[i].hash)
          }

          /* Then we need to toss on the top hashes that we got but in reverse order */
          topBlocks = topBlocks.reverse()
          for (var j = 0; j < topBlocks.length; j++) {
            insert(topBlocks[j].hash)
          }

          /* Finally, we should be ready to send this back to whoever asked for it */
          return resolve(hashes)
        })
        .catch(error => { return reject(error) })
    })
  }

  haveGenesis () {
    /* Our actual logic in detecting gaps in the blocks doesn't account for a block
       at the height of 0. As a result, we explicity check the database for the existence
       of a block at height 0 and say yes/no */
    var connection

    return this.connection()
      .then(dbConnection => { connection = dbConnection })
      .then(() => { return query(connection, 'SELECT COUNT(*) as `cnt` FROM `blocks` WHERE `height` = 0', []) })
      .then(results => {
        connection.release()
        if (results[0].cnt === 0) return false
        return true
      })
      .catch(error => {
        if (typeof connection !== 'undefined') connection.release()

        throw error
      })
  }

  reset () {
    const queries = []
    const tables = [
      'blocks',
      'information',
      'transaction_inputs',
      'transaction_outputs',
      'transaction_outputs_index_maximums',
      'transaction_pool',
      'transactions']

    tables.forEach(table => {
      queries.push({
        query: 'TRUNCATE ' + table,
        args: []
      })
    })

    return this._insertTransaction(queries)
      .then(() => { return queries.length })
  }

  saveBlock (block) {
    const queries = this.buildSaveBlockQueries(block)

    return this._insertTransaction(queries)
      .then(() => { return queries.length })
  }

  saveBlocks (blocks, startHeight) {
    const queries = []
    const savedBlocks = []

    for (var i = 0; i < blocks.length; i++) {
      /* Block zero has a timestamp of zero, not a failure in this case */
      if (blocks[i].difficulty === 0 || blocks[i].blockSize === 0 || (blocks[i].timestamp === 0 && blocks[i].index !== 0)) {
        /* If we receive a block with one of these things missing, something bad
           happened and to prevent corruption of the DB we need to bail out */
        throw new Error('Malformed block data detected, refusing to save batches of blocks starting from ' + startHeight)
      }

      const saveBlockQueries = this.buildSaveBlockQueries(blocks[i])

      saveBlockQueries.forEach((elem) => {
        queries.push(elem)
      })

      savedBlocks.push({ height: blocks[i].index, hash: blocks[i].hash })
    }

    const newCount = queries.length
    var delCount

    /* Find out what deletes we need to run at the start of the transaction */
    return this.buildDeleteBlocksFromHeightQueries(startHeight)
      .then(deletes => {
        deletes.forEach((elem) => {
          /* We need to push the delete statements to the front to make sure
             they are processed before the inserts */
          queries.unshift(elem)
        })
        delCount = deletes.length

        /* Fire up the massive transaction and get work done */
        return this._insertTransaction(queries)
      })
      .then(() => { return { blocks: savedBlocks, inserts: newCount, deletes: delCount } })
  }

  saveInfo (key, payload) {
    const queries = [{
      query: informationInsert,
      args: [
        key,
        payload
      ]
    }]

    return this._insertTransaction(queries)
  }

  saveTransactionPool (transactions) {
    const queries = this.buildSaveTransactionPoolQueries(transactions)

    return this._insertTransaction(queries)
  }

  query (query, args) {
    return new Promise((resolve, reject) => {
      this.db.query(query, args, (error, results, fields) => {
        if (error) return reject(error)

        return resolve(results)
      })
    })
  }

  _insertTransaction (queries) {
    /* This will run a set of insert queries as a SQL transaction
       such that if any of the queries failed, the entire transaction
       will roll back. This greatly reduces the risk of having incomplete
       data regarding each block as the block, transactions, inputs, and outputs
       must all make it into the database for it to be a valid insert */
    var results
    var connection

    return this.connection()
      .then(dbConnection => { connection = dbConnection })
      .then(() => { return beginTransaction(connection) })
      .then(() => {
        const promises = []

        for (var i = 0; i < queries.length; i++) {
          promises.push(query(connection, queries[i].query, queries[i].args))
        }

        return Promise.all(promises)
      })
      .then(promiseResults => { results = promiseResults })
      .then(() => { return commit(connection) })
      .then(() => { return connection.release() })
      .then(() => { return results })
      .catch(error => {
        if (connection) {
          return rollback(connection)
            .then(() => { return connection.release() })
            .then(() => { throw error })
            .catch(() => { throw error })
        } else {
          throw new Error('An error occurred attempting a SQL transaction')
        }
      })
  }

  _insertTransactionWithLock (queries, tablesToLock) {
    /* This will run a set of insert queries as a SQL transaction with a WRITE LOCK
       such that if any of the queries failed, the entire transaction
       will roll back. This greatly reduces the risk of having incomplete
       data regarding each block as the block, transactions, inputs, and outputs
       must all make it into the database for it to be a valid insert */

    var results
    var connection

    return this.connection()
      .then(dbConnection => { connection = dbConnection })
      .then(() => { return query(connection, 'SET autocommit = 0') })
      .then(() => {
        const locks = []

        tablesToLock.forEach((table) => {
          locks.push(table + ' WRITE')
        })

        return query(connection, 'LOCK TABLES ' + locks.join(', '))
      })
      .then(() => {
        const promises = []

        for (var i = 0; i < queries.length; i++) {
          promises.push(query(connection, queries[i].query, queries[i].args))
        }

        return Promise.all(promises)
      })
      .then(promiseResults => { results = promiseResults })
      .then(() => { return query(connection, 'commit') })
      .then(() => { return query(connection, 'UNLOCK TABLES') })
      .then(() => { return connection.release() })
      .then(() => { return results })
      .catch(error => {
        if (connection) {
          return rollback(connection)
            .then(() => { return connection.release() })
            .then(() => { throw error })
            .catch(() => {
              connection.release()
              throw error
            })
        } else {
          throw new Error('An error occurred attempting a SQL transaction')
        }
      })
  }
}

function beginTransaction (connection) {
  return new Promise((resolve, reject) => {
    connection.beginTransaction(error => {
      if (error) return reject(error)

      return resolve()
    })
  })
}

function commit (connection) {
  return new Promise((resolve, reject) => {
    connection.commit(error => {
      if (error) return reject(error)

      return resolve()
    })
  })
}

function query (connection, query, args) {
  args = args || []
  return new Promise((resolve, reject) => {
    connection.query(query, args, (error, results, fields) => {
      if (error) return reject(error)

      return resolve(results, fields)
    })
  })
}

function rollback (connection) {
  return new Promise((resolve, reject) => {
    connection.rollback(error => {
      if (error) return reject(error)

      return resolve()
    })
  })
}

module.exports = DatabaseBackend
