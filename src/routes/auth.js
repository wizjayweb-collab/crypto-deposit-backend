const express = require('express');
const router = express.Router();
const db = require('../config/database');

/*
  DEMO AUTH ONLY
  - No passwords
  - Email acts as identity
  - Returns userId for frontend storage
*/

/* ===============================
   REGISTER
=============================== */
router.post('/register', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }

    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        message: 'User already exists',
        userId: existing.rows[0].id
      });
    }

    const result = await db.query(
      'INSERT INTO users (email) VALUES ($1) RETURNING id',
      [email.toLowerCase()]
    );

    res.json({
      success: true,
      message: 'User registered',
      userId: result.rows[0].id
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

/* ===============================
   LOGIN
=============================== */
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }

    const result = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      userId: result.rows[0].id
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

module.exports = router;
