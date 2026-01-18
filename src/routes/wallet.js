const express = require('express');
const router = express.Router();

const walletService = require('../services/wallet.service');
const depositService = require('../services/deposit.service');
const db = require('../config/database');

/*
  WALLET RULES
  - One wallet per user
  - Auto-create if missing
*/

/* ===============================
   GET OR CREATE WALLET
   GET /api/wallet?userId=1
=============================== */
router.get('/', async (req, res) => {
  try {
    const userId = Number(req.query.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    // Ensure user exists
    const user = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get or create wallet
    let wallet = await walletService.getWalletByUserId(userId);

    if (!wallet) {
      wallet = await walletService.createWallet(userId);
    }

    return res.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        balance: Number(wallet.balance || 0),
        network: 'BEP20 (BSC)'
      }
    });

  } catch (err) {
    console.error('Get wallet error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get wallet'
    });
  }
});

/* ===============================
   GET WALLET TRANSACTIONS
   GET /api/wallet/transactions
=============================== */
router.get('/transactions', async (req, res) => {
  try {
    const userId = Number(req.query.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const wallet = await walletService.getWalletByUserId(userId);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    const transactions =
      await depositService.getTransactionsByWallet(wallet.id);

    return res.json({
      success: true,
      transactions: transactions.map(tx => ({
        tx_hash: tx.tx_hash,
        amount: Number(tx.amount),
        status: tx.status,
        confirmations: tx.confirmations,
        created_at: tx.created_at
      }))
    });

  } catch (err) {
    console.error('Transactions error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
});

/* ===============================
   GET DEPOSIT ADDRESS
   GET /api/wallet/deposit-address
=============================== */
router.get('/deposit-address', async (req, res) => {
  try {
    const userId = Number(req.query.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    let wallet = await walletService.getWalletByUserId(userId);

    if (!wallet) {
      wallet = await walletService.createWallet(userId);
    }

    return res.json({
      success: true,
      wallet: {
        address: wallet.address,
        network: 'BEP20 (BSC)',
        token: 'USDT',
        contract: process.env.USDT_CONTRACT_ADDRESS,
        minDeposit: Number(process.env.MIN_DEPOSIT_USDT)
      }
    });

  } catch (err) {
    console.error('Deposit address error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get deposit address'
    });
  }
});

module.exports = router;
