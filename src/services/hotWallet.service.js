const pool = require('../config/database');
const blockchainService = require('./blockchain');
const { ethers } = require('ethers');

class HotWalletService {

  // ===============================
  // GET HOT WALLET CONFIG
  // ===============================
  async getHotWallet() {
    const result = await pool.query(
      `SELECT key, value FROM system_config 
       WHERE key IN ('hot_wallet_address', 'hot_wallet_private_key')`
    );

    const config = {
      address: null,
      privateKey: null
    };

    for (const row of result.rows) {
      if (row.key === 'hot_wallet_address') {
        config.address = row.value;
      }
      if (row.key === 'hot_wallet_private_key') {
        config.privateKey = row.value;
      }
    }

    return config;
  }

  // ===============================
  // INITIALIZE HOT WALLET (DEV ONLY)
  // ===============================
  async initializeHotWallet() {
    const existing = await this.getHotWallet();

    if (existing.address && existing.privateKey) {
      console.log('✅ Hot wallet already exists:', existing.address);
      return existing;
    }

    const wallet = ethers.Wallet.createRandom();

    await pool.query(
      `UPDATE system_config 
       SET value = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE key = 'hot_wallet_address'`,
      [wallet.address]
    );

    await pool.query(
      `UPDATE system_config 
       SET value = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE key = 'hot_wallet_private_key'`,
      [wallet.privateKey]
    );

    console.log('🔥 Hot wallet created:', wallet.address);
    console.log('⚠️ FUND THIS ADDRESS WITH BNB FOR GAS');

    return {
      address: wallet.address,
      privateKey: wallet.privateKey
    };
  }

  // ===============================
  // HOT WALLET BALANCE (ADMIN VIEW)
  // ===============================
  async getHotWalletBalance() {
    const hotWallet = await this.getHotWallet();

    if (!hotWallet.address) {
      throw new Error('Hot wallet not initialized');
    }

    const usdtBalance = await blockchainService.getUSDTBalance(hotWallet.address);
    const bnbBalance = await blockchainService.getBNBBalance(hotWallet.address);

    return {
      address: hotWallet.address,
      usdtBalance: Number(usdtBalance),
      bnbBalance: Number(bnbBalance)
    };
  }

  // ===============================
  // ADMIN WITHDRAWAL
  // ===============================
  async withdrawFromHotWallet(toAddress, amount, adminUserId, notes = '') {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const hotWallet = await this.getHotWallet();

      if (!hotWallet.address || !hotWallet.privateKey) {
        throw new Error('Hot wallet not configured');
      }

      // Check USDT balance
      const usdtBalance = await blockchainService.getUSDTBalance(hotWallet.address);

      if (Number(usdtBalance) < Number(amount)) {
        throw new Error(`Insufficient USDT balance (${usdtBalance})`);
      }

      // Create withdrawal record
      const { rows } = await client.query(
        `INSERT INTO withdrawals 
         (to_address, amount, status, notes, admin_user_id)
         VALUES ($1, $2, 'pending', $3, $4)
         RETURNING id`,
        [toAddress, amount, notes, adminUserId]
      );

      const withdrawalId = rows[0].id;

      // Check BNB gas
      const bnbBalance = await blockchainService.getBNBBalance(hotWallet.address);
      const estimatedGas = await blockchainService.estimateGasCost();

      if (Number(bnbBalance) < Number(estimatedGas)) {
        await client.query(
          `UPDATE withdrawals 
           SET status = 'failed', notes = $1 
           WHERE id = $2`,
          [`Insufficient BNB for gas`, withdrawalId]
        );

        await client.query('COMMIT');
        throw new Error('Hot wallet needs BNB for gas');
      }

      // Send USDT
      const txHash = await blockchainService.transferUSDT(
        hotWallet.privateKey,
        toAddress,
        amount
      );

      // Mark completed
      await client.query(
        `UPDATE withdrawals 
         SET tx_hash = $1, status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [txHash, withdrawalId]
      );

      await client.query('COMMIT');

      return {
        id: withdrawalId,
        txHash,
        amount,
        toAddress,
        status: 'completed'
      };

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ===============================
  // ADMIN WITHDRAWAL HISTORY
  // ===============================
  async getWithdrawalHistory(limit = 50) {
    const result = await pool.query(
      `SELECT w.*, a.username AS admin_username
       FROM withdrawals w
       LEFT JOIN admin_users a ON w.admin_user_id = a.id
       ORDER BY w.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }
}

module.exports = new HotWalletService();
