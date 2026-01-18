const blockchainService = require('../services/blockchain');
const depositService = require('../services/deposit.service');
const walletService = require('../services/wallet.service');
const { ethers } = require('ethers');
const pool = require('../config/database');

class DepositWatcher {
  constructor() {
    this.lastProcessedBlock = null;
    this.interval = Number(process.env.WATCHER_INTERVAL_MS) || 15000;
    this.blockBatch = 500;
    this.requiredConfirmations =
      Number(process.env.REQUIRED_CONFIRMATIONS) || 12;
  }

  async start() {
    console.log('🔍 Deposit watcher started');

    if (!this.lastProcessedBlock) {
      const current = await blockchainService.getCurrentBlock();
      this.lastProcessedBlock = current - this.requiredConfirmations;
      console.log(`Starting from block ${this.lastProcessedBlock}`);
    }

    setInterval(async () => {
      await this.scanBlocks();
      await this.updateConfirmations();
      await this.processSweeps();
    }, this.interval);
  }

  async scanBlocks() {
    try {
      const currentBlock = await blockchainService.getCurrentBlock();
      const safeBlock = currentBlock - this.requiredConfirmations;

      if (safeBlock <= this.lastProcessedBlock) return;

      const fromBlock = this.lastProcessedBlock + 1;
      const toBlock = Math.min(
        fromBlock + this.blockBatch - 1,
        safeBlock
      );

      const wallets = await walletService.getAllWalletAddresses();
      if (wallets.length === 0) return;

      console.log(`⛓ Scanning blocks ${fromBlock} → ${toBlock}`);

      const events = await blockchainService.getTransferEvents(
        fromBlock,
        toBlock,
        wallets
      );

      for (const event of events) {
        const to = event.args.to.toLowerCase();
        const amount = ethers.utils.formatUnits(
          event.args.value,
          18
        );

        await depositService.processDeposit(
          event.transactionHash,
          to,
          amount,
          event.blockNumber
        );
      }

      this.lastProcessedBlock = toBlock;
    } catch (err) {
      console.error('scanBlocks error:', err.message);
    }
  }

  async updateConfirmations() {
    try {
      const result = await pool.query(`
        SELECT id, tx_hash, confirmations
        FROM transactions
        WHERE status = 'pending'
      `);

      for (const tx of result.rows) {
        const confirmations =
          await blockchainService.getTransactionConfirmations(
            tx.tx_hash
          );

        if (confirmations !== tx.confirmations) {
          await depositService.updateConfirmations(
            tx.id,
            confirmations
          );
        }

        if (confirmations >= this.requiredConfirmations) {
          await depositService.confirmDeposit(tx.id);
        }
      }
    } catch (err) {
      console.error('updateConfirmations error:', err.message);
    }
  }

  async processSweeps() {
    try {
      const deposits = await depositService.getDepositsToSweep();

      for (const d of deposits) {
        try {
          await depositService.sweepToHotWallet(d.id);
        } catch (err) {
          console.error(`Sweep failed txId=${d.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('processSweeps error:', err.message);
    }
  }
}

module.exports = new DepositWatcher();
