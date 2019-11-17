// Copyright (c) 2018-2019, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const badBlockStart = 1015250
const DatabaseBackend = require('./lib/databaseBackend')
const Config = require('./config.json')

const database = new DatabaseBackend({
  host: Config.mysql.host,
  port: Config.mysql.port,
  username: Config.mysql.username,
  password: Config.mysql.password,
  database: Config.mysql.database,
  connectionLimit: Config.mysql.connectionLimit
})

database.buildDeleteBlocksFromHeightQueries(badBlockStart)
  .then(queries => { return database._insertTransaction(queries) })
  .then(results => console.log(results))
  .catch(error => console.error(error))
