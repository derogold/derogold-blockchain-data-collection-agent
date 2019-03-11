# TurtlePay™ Blockchain Data Collection Agent (BDCA)

#### Master Build Status
[![Build Status](https://travis-ci.org/TurtlePay/blockchain-data-collection-agent.svg?branch=master)](https://travis-ci.org/TurtlePay/blockchain-data-collection-agent) [![Build status](https://ci.appveyor.com/api/projects/status/github/TurtlePay/blockchain-data-collection-agent?branch=master&svg=true)](https://ci.appveyor.com/project/brandonlehmann/blockchain-data-collection-agent/branch/master)

## Prerequisites

* [TurtleCoin](https://github.com/turtlecoin/turtlecoin)
* MariaDB/MySQL with InnoDB support
* [Node.js](https://nodejs.org/) LTS

## Setup

1) Clone this repository to wherever you'd like as long as it can communicate with your SQL server to run:

```bash
git clone https://github.com/TurtlePay/blockchain-data-collection-agent
```

2) Install the required Node.js modules

```bash
cd blockchain-data-collection-agent && npm install
```

3) Load the database schema from `schema.sql` into your configured database.

4) Fire up the script

```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USERNAME=yourdbusername
export MYSQL_PASSWORD=yourdbpassword
export MYSQL_DATABASE=yourdbname
export NODE_HOST=localhost
export NODE_PORT=11898
node index.js
```

5) Optionally, install PM2 or another process manager to keep the service running.

```bash
npm install -g pm2@latest
pm2 startup
pm2 start index.js --name blockchain-data-collection-agent
pm2 save
```

6) Wait to build your database cache (this is likely to take days depending on the size of your chain)

###### (c) 2018-2019 TurtlePay™ Development Team
