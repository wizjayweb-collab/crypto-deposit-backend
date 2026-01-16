const pool = require('../config/database');
const blockchainService = require('./blockchain');
const walletService = require('./wallet.service');
const hotWalletService = require('./hotWallet.service');
require('dotenv').config();

class DepositService {

  async processDeposit(txHash, toAddress, amount, blockNumber) {
    const wallet = await walletService.getWalletByAddress(toAddress);
    if (!wallet) return;

    // Prevent duplicate tx
    const existing = await pool.query(
      'SELECT id FROM transactions WHERE tx_hash = $1',
      [txHash]
    );
    if (existing.rowCount > 0) return;

    if (Number(amount) < Number(process.env.MIN_DEPOSIT_USDT)) {
      console.log(`⛔ Deposit below minimum: ${amount}`);
      return;
    }

    const result = await pool.query(
      `INSERT INTO transactions
       (tx_hash, wallet_id, amount, block_number, status, confirmations)
       VALUES ($1,$2,$3,$4,'pending',0)
       RETURNING *`,
      [txHash, wallet.id, amount, blockNumber]
    );

    console.log(`📥 Deposit detected | tx=${txHash} amount=${amount}`);
    return result.rows[0];
  }

  async updateConfirmations(txId, confirmations) {
    await pool.query(
      `UPDATE transactions
       SET confirmations=$1, updated_at=NOW()
       WHERE id=$2`,
      [confirmations, txId]
    );
  }

  async confirmDeposit(txId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // LOCK ROW
      const txRes = await client.query(
        `SELECT * FROM transactions
         WHERE id=$1
         FOR UPDATE`,
        [txId]
      );

      if (txRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return;
      }

      const tx = txRes.rows[0];
      if (tx.status === 'confirmed') {
        await client.query('ROLLBACK');
        return;
      }

      // Confirm tx
      await client.query(
        `UPDATE transactions
         SET status='confirmed', updated_at=NOW()
         WHERE id=$1`,
        [txId]
      );

      // Credit user balance (ONCE)
      await client.query(
        `UPDATE wallets
         SET balance = balance + $1,
             updated_at = NOW()
         WHERE id=$2`,
        [tx.amount, tx.wallet_id]
      );

      await client.query('COMMIT');
      console.log(`✅ Deposit confirmed | txId=${txId} amount=${tx.amount}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ confirmDeposit error:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  async getDepositsToSweep() {
    const result = await pool.query(
      `SELECT id FROM transactions
       WHERE status='confirmed'
       AND swept=false
       ORDER BY created_at ASC`
    );
    return result.rows;
  }

  async sweepToHotWallet(txId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const txRes = await client.query(
        `SELECT t.*, w.address, w.private_key
         FROM transactions t
         JOIN wallets w ON t.wallet_id = w.id
         WHERE t.id=$1
         FOR UPDATE`,
        [txId]
      );

      if (txRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return;
      }

      const tx = txRes.rows[0];
      if (tx.swept || tx.status !== 'confirmed') {
        await client.query('ROLLBACK');
        return;
      }

      const hotWallet = await hotWalletService.getHotWallet();

      // Ensure gas
      const bnbBalance = await blockchainService.getBNBBalance(tx.address);
      const gasNeeded = await blockchainService.estimateGasCost();

      if (Number(bnbBalance) < Number(gasNeeded)) {
        await blockchainService.transferBNB(
          hotWallet.privateKey,
          tx.address,
          (gasNeeded * 1.5).toFixed(18)
        );
        await new Promise(r => setTimeout(r, 5000));
      }

      // Sweep FULL wallet balance (safer)
      const usdtBalance = await blockchainService.getUSDTBalance(tx.address);
      if (Number(usdtBalance) <= 0) {
        await client.query('ROLLBACK');
        return;
      }

      const sweepTx = await blockchainService.transferUSDT(
        tx.private_key,
        hotWallet.address,
        usdtBalance
      );

      await client.query(
        `UPDATE transactions
         SET swept=true,
             sweep_tx_hash=$1,
             updated_at=NOW()
         WHERE id=$2`,
        [sweepTx, txId]
      );

      await client.query('COMMIT');
      console.log(`💸 Swept txId=${txId} hash=${sweepTx}`);
      return sweepTx;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ sweepToHotWallet error txId=${txId}`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  async getTransactionsByWallet(walletId) {
    const result = await pool.query(
      `SELECT tx_hash, amount, status, confirmations, created_at
       FROM transactions
       WHERE wallet_id=$1
       ORDER BY created_at DESC
       LIMIT 20`,
      [walletId]
    );
    return result.rows;
  }
}

module.exports = new DepositService();
