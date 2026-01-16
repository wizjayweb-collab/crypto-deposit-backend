const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const adminService = require('../services/admin.service');
const hotWalletService = require('../services/hotWallet.service');

// ===============================
// ADMIN AUTH MIDDLEWARE
// ===============================
const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ===============================
// ADMIN LOGIN
// ===============================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await adminService.login(username, password);

    res.json({
      success: true,
      token: result.token,
      admin: result.admin
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// ===============================
// DASHBOARD STATS
// ===============================
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    const hotWallet = await hotWalletService.getHotWalletBalance();

    res.json({
      success: true,
      stats,
      hotWallet
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// USERS LIST
// ===============================
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const users = await adminService.getAllUsers(limit, offset);

    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// ALL DEPOSITS
// ===============================
router.get('/deposits', verifyAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const deposits = await adminService.getAllDeposits(limit, offset);

    res.json({ success: true, deposits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// PENDING DEPOSITS
// ===============================
router.get('/deposits/pending', verifyAdmin, async (req, res) => {
  try {
    const deposits = await adminService.getPendingDeposits();
    res.json({ success: true, deposits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// HOT WALLET INFO
// ===============================
router.get('/hot-wallet', verifyAdmin, async (req, res) => {
  try {
    const hotWallet = await hotWalletService.getHotWalletBalance();
    res.json({ success: true, hotWallet });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// WITHDRAW FROM HOT WALLET
// ===============================
router.post('/withdraw', verifyAdmin, async (req, res) => {
  try {
    const { toAddress, amount, notes } = req.body;

    if (!toAddress || !amount) {
      return res.status(400).json({ error: 'toAddress and amount required' });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Very basic address sanity check
    if (toAddress.length < 20) {
      return res.status(400).json({ error: 'Invalid destination address' });
    }

    const withdrawal = await hotWalletService.withdrawFromHotWallet(
      toAddress,
      numericAmount,
      req.admin.id,
      notes || null
    );

    res.json({
      success: true,
      withdrawal
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// WITHDRAWAL HISTORY
// ===============================
router.get('/withdrawals', verifyAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const withdrawals = await hotWalletService.getWithdrawalHistory(limit);

    res.json({ success: true, withdrawals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
