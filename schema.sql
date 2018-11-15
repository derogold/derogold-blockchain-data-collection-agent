CREATE TABLE `blocks` (
  `hash` varchar(64) NOT NULL,
  `prevHash` varchar(64) NOT NULL,
  `height` bigint(20) unsigned NOT NULL,
  `baseReward` bigint(20) unsigned NOT NULL,
  `difficulty` bigint(20) unsigned NOT NULL,
  `majorVersion` int(10) unsigned NOT NULL,
  `minorVersion` int(10) unsigned NOT NULL,
  `nonce` bigint(20) NOT NULL,
  `size` int(10) unsigned NOT NULL,
  `timestamp` bigint(20) unsigned NOT NULL,
  `alreadyGeneratedCoins` bigint(20) unsigned NOT NULL,
  `alreadyGeneratedTransactions` bigint(20) unsigned NOT NULL,
  `reward` bigint(20) unsigned NOT NULL,
  `sizeMedian` int(10) unsigned NOT NULL,
  `totalFeeAmount` bigint(20) unsigned NOT NULL,
  `transactionsCumulativeSize` int(10) unsigned NOT NULL,
  PRIMARY KEY (`height`),
  KEY `timestamp` (`timestamp`),
  KEY `prevHash` (`prevHash`),
  KEY `hash` (`hash`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1
 PARTITION BY KEY (`height`)
PARTITIONS 100;

CREATE TABLE `transaction_inputs` (
  `txnHash` varchar(64) NOT NULL,
  `keyImage` varchar(64) NOT NULL,
  `amount` bigint(20) unsigned NOT NULL,
  `type` int(10) unsigned NOT NULL,
  PRIMARY KEY (`txnHash`,`keyImage`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1
 PARTITION BY KEY ()
PARTITIONS 100;

CREATE TABLE `transaction_outputs` (
  `txnHash` varchar(64) NOT NULL,
  `outputIndex` int(10) unsigned NOT NULL,
  `globalIndex` bigint(20) unsigned NOT NULL,
  `amount` bigint(20) unsigned NOT NULL,
  `key` varchar(64) NOT NULL,
  `type` int(10) unsigned NOT NULL,
  PRIMARY KEY (`txnHash`,`outputIndex`),
  KEY `globalIndex` (`globalIndex`,`amount`),
  KEY `amount` (`amount`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1
 PARTITION BY KEY ()
PARTITIONS 100;

CREATE TABLE `transactions` (
  `txnHash` varchar(64) NOT NULL,
  `blockHash` varchar(64) NOT NULL,
  `mixin` int(10) unsigned NOT NULL,
  `timestamp` bigint(20) unsigned NOT NULL,
  `paymentId` varchar(64) DEFAULT NULL,
  `unlockTime` bigint(20) unsigned NOT NULL,
  `publicKey` varchar(64) NOT NULL,
  `fee` bigint(20) unsigned NOT NULL,
  `size` int(10) unsigned NOT NULL,
  `nonce` text DEFAULT NULL,
  `extra` blob DEFAULT NULL,
  `totalInputsAmount` bigint(20) unsigned NOT NULL,
  `totalOutputsAmount` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`txnHash`),
  KEY `blockHash` (`blockHash`),
  KEY `timestamp` (`timestamp`),
  KEY `paymentId` (`paymentId`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1
 PARTITION BY KEY (`txnHash`)
PARTITIONS 100;

CREATE TABLE `transaction_pool` (
  `txnHash` varchar(64) NOT NULL,
  `fee` bigint(20) unsigned NOT NULL,
  `size` int(10) unsigned NOT NULL,
  `amount` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`txnHash`),
  KEY `fee` (`fee`),
  KEY `amount` (`amount`),
  KEY `size` (`size`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
