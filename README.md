# TurtlePay™ Blockchain Data Collection Agent (BDCA)

#### Master Build Status
[![Build Status](https://travis-ci.org/TurtlePay/blockchain-data-collection-agent.svg?branch=master)](https://travis-ci.org/TurtlePay/blockchain-data-collection-agent) [![Build status](https://ci.appveyor.com/api/projects/status/github/TurtlePay/blockchain-data-collection-agent?branch=master&svg=true)](https://ci.appveyor.com/project/brandonlehmann/blockchain-data-collection-agent/branch/master)

## Prerequisites

* [TurtleCoin](https://github.com/turtlecoin/turtlecoin) (development branch)
* MariaDB/MySQL with InnoDB support
* [Node.js](https://nodejs.org/) LTS

## Foreword

We know that this documentation needs cleaned up and made easier to read. We'll compile it as part of the full documentation as the project works forward.

## Setup

1) Clone this repository to wherever you'd like the API to run:

```bash
git clone https://github.com/TurtlePay/blockchain-data-collection-agent
```

2) Install the required Node.js modules

```bash
cd blockchain-data-collection-agent && npm install
```

3) Use your favorite text editor to change the values as necessary in `config.json`

**Note:** Make sure you use a limited database user for security reasons

```javascript
{
  "mysql": {
    "host": "localhost",
    "port": 3306,
    "username": "root",
    "password": "password",
    "database": "turtlecoin",
    "connectionLimit": 10
  },
  "node": {
    "host": "localhost",
    "port": 11898
  }
}
```

4) Load the database schema from `schema.sql` into your configured database.

5) Fire up the script

```bash
node index.js
```

6) Optionally, install PM2 or another process manager to keep the service running.

```bash
npm install -g pm2@latest
pm2 startup
pm2 start index.js --name blockchain-data-collection-agent
pm2 save
```

6) Wait to build your database cache (this is likely to take days)

###### (c) 2018 TurtlePay™ Development Team
