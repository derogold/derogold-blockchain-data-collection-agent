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
  PRIMARY KEY (`hash`),
  KEY `height` (`height`),
  KEY `timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1
 PARTITION BY KEY (`hash`)
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
  PRIMARY KEY (`globalIndex`,`amount`),
  KEY `composite` (`txnHash`,`outputIndex`),
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
  PRIMARY KEY (`txnHash`),
  KEY `blockHash` (`blockHash`),
  KEY `paymentId` (`paymentId`),
  KEY `timestamp` (`timestamp`),
  KEY `publicKey` (`publicKey`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1
 PARTITION BY KEY (`txnHash`)
PARTITIONS 100;

