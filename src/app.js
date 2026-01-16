const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const adminRoutes = require('./routes/admin');

const app = express();

// ===============================
// GLOBAL MIDDLEWARE
// ===============================
app.use(cors({
  origin: '*', // OK for testing; restrict in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ===============================
// STATIC FILES (FRONTEND)
// ===============================
app.use(express.static(path.join(__dirname, '../public')));

// ===============================
// API ROUTES
// ===============================
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);

// ===============================
// HEALTH CHECK
// ===============================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Crypto Deposit Platform',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

// ===============================
// ROOT REDIRECT
// ===============================
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ===============================
// 404 HANDLER (API + STATIC)
// ===============================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// ===============================
// GLOBAL ERROR HANDLER
// ===============================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

module.exports = app;
