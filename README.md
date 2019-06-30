# TurtlePay™ Blockchain Data Collection Agent (BDCA)

#### Master Build Status
[![Build Status](https://travis-ci.org/TurtlePay/blockchain-data-collection-agent.svg?branch=master)](https://travis-ci.org/TurtlePay/blockchain-data-collection-agent) [![Build status](https://ci.appveyor.com/api/projects/status/github/TurtlePay/blockchain-data-collection-agent?branch=master&svg=true)](https://ci.appveyor.com/project/brandonlehmann/blockchain-data-collection-agent/branch/master)

## Prerequisites

* [TurtleCoin](https://github.com/turtlecoin/turtlecoin)
* MariaDB/MySQL with InnoDB support
* [Node.js](https://nodejs.org/) LTS

## Hardware Requirements

For the best performance when using this package (as of June 30, 2019), your Database server must have a minimum of the following:

* 32GB RAM
  * 30GB dedicated to MariaDB/MySQL
* 2 CPU Cores (4 Recommended)
* SSD Storage

***Warning***: Running the DB on system(s) with less than the minimum hardware requirements above will cause performance issues. If you are experiencing issues please verify that the system you are using meets the minimum requirements above. We cannot assist with performance issues with implementations that do not meet the above minimum requirements.

## Recommended Reading

The help tune your selected DBMS, we recommend that you read the following documents, at a minimum, to tune your DBMS installation for the dataset this package manages.

This list is by no means comprehensive nor do we guarantee the information or suggestions provided in the articles below are accurate. These links are provided solely as a jumping off point to get you started.

* [MySQL 5.7 Performance Tuning After Installation](https://www.percona.com/blog/2016/10/12/mysql-5-7-performance-tuning-immediately-after-installation/)
* [InnoDB Performance Optimization Basics](https://www.percona.com/blog/2013/09/20/innodb-performance-optimization-basics-updated/)
* [Optimizing InnoDB Disk I/O](https://dev.mysql.com/doc/refman/8.0/en/optimizing-innodb-diskio.html)
* [https://dev.mysql.com/doc/refman/8.0/en/optimizing-innodb-configuration-variables.html](https://dev.mysql.com/doc/refman/8.0/en/optimizing-innodb-configuration-variables.html)
* [15 Useful MySQL/MariaDB Performance Tuning and Optimization Tips](https://www.tecmint.com/mysql-mariadb-performance-tuning-and-optimization/)
* [InnoDB Performance Optimisation](https://www.slideshare.net/MyDBOPS/innodb-performance-optimisation)

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
