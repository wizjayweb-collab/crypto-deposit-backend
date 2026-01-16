const express = require('express');
const router = express.Router();
const walletService = require('../services/wallet.service');
const depositService = require('../services/deposit.service');
const db = require('../config/database');

/*
  DEMO WALLET ROUTES
  - One wallet per user
  - Auto-create wallet if missing
*/

/* ===============================
   GET OR CREATE WALLET
=============================== */
router.get('/', async (req, res) => {
  try {
    const userId = parseInt(req.query.userId);

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

    let wallet = await walletService.getWalletByUserId(userId);

    if (!wallet) {
      wallet = await walletService.createWallet(userId);
    }

    res.json({
      success: true,
      data: {
        walletId: wallet.id,
        address: wallet.address,
        balance: parseFloat(wallet.balance),
        network: 'BEP20 (BSC)'
      }
    });

  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get wallet'
    });
  }
});

/* ===============================
   GET WALLET TRANSACTIONS
=============================== */
router.get('/transactions', async (req, res) => {
  try {
    const userId = parseInt(req.query.userId);

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

    const transactions = await depositService.getTransactionsByWallet(wallet.id);

    res.json({
      success: true,
      data: transactions.map(tx => ({
        txHash: tx.tx_hash,
        amount: parseFloat(tx.amount),
        status: tx.status,
        confirmations: tx.confirmations,
        createdAt: tx.created_at
      }))
    });

  } catch (error) {
    console.error('Transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
});

/* ===============================
   GET DEPOSIT ADDRESS
=============================== */
router.get('/deposit-address', async (req, res) => {
  try {
    const userId = parseInt(req.query.userId);

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

    res.json({
      success: true,
      data: {
        address: wallet.address,
        network: 'BEP20 (BSC)',
        token: 'USDT',
        contract: process.env.USDT_CONTRACT_ADDRESS,
        minDeposit: parseFloat(process.env.MIN_DEPOSIT_USDT),
        warning:
          'Send only USDT on BEP20 network. Wrong network or token will result in loss of funds.'
      }
    });

  } catch (error) {
    console.error('Deposit address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get deposit address'
    });
  }
});

module.exports = router;
