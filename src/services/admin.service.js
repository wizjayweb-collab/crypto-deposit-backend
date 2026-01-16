const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AdminService {

  // ===============================
  // ADMIN LOGIN
  // ===============================
  async login(username, password) {
    const result = await pool.query(
      'SELECT id, username, password_hash FROM admin_users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const admin = result.rows[0];

    const isValid = await bcrypt.compare(password, admin.password_hash);

    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      token,
      admin: {
        id: admin.id,
        username: admin.username
      }
    };
  }

  // ===============================
  // DASHBOARD STATS
  // ===============================
  async getDashboardStats() {
    const [
      usersResult,
      balancesResult,
      depositsResult,
      pendingResult,
      withdrawalsResult
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COALESCE(SUM(balance), 0) FROM wallets'),
      pool.query(
        `SELECT COUNT(*), COALESCE(SUM(amount), 0)
         FROM transactions WHERE status = 'confirmed'`
      ),
      pool.query(
        `SELECT COUNT(*), COALESCE(SUM(amount), 0)
         FROM transactions WHERE status = 'pending'`
      ),
      pool.query(
        `SELECT COUNT(*), COALESCE(SUM(amount), 0)
         FROM withdrawals WHERE status = 'completed'`
      )
    ]);

    return {
      totalUsers: Number(usersResult.rows[0].count),
      totalUserBalances: Number(balancesResult.rows[0].coalesce),

      totalDeposits: Number(depositsResult.rows[0].count),
      totalDepositAmount: Number(depositsResult.rows[0].coalesce),

      pendingDeposits: Number(pendingResult.rows[0].count),
      pendingAmount: Number(pendingResult.rows[0].coalesce),

      totalWithdrawals: Number(withdrawalsResult.rows[0].count),
      totalWithdrawalAmount: Number(withdrawalsResult.rows[0].coalesce)
    };
  }

  // ===============================
  // ALL USERS (ADMIN VIEW)
  // ===============================
  async getAllUsers(limit = 100, offset = 0) {
    const result = await pool.query(
      `SELECT 
          u.id,
          u.email,
          u.created_at,
          w.address,
          COALESCE(w.balance, 0) AS balance,
          COUNT(t.id) AS total_deposits,
          COALESCE(SUM(
            CASE WHEN t.status = 'confirmed' THEN t.amount ELSE 0 END
          ), 0) AS total_deposited
       FROM users u
       LEFT JOIN wallets w ON u.id = w.user_id
       LEFT JOIN transactions t ON w.id = t.wallet_id
       GROUP BY u.id, u.email, u.created_at, w.address, w.balance
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows;
  }

  // ===============================
  // ALL DEPOSITS
  // ===============================
  async getAllDeposits(limit = 100, offset = 0) {
    const result = await pool.query(
      `SELECT 
          t.*,
          w.address AS wallet_address,
          u.email AS user_email
       FROM transactions t
       JOIN wallets w ON t.wallet_id = w.id
       JOIN users u ON w.user_id = u.id
       ORDER BY t.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows;
  }

  // ===============================
  // PENDING DEPOSITS
  // ===============================
  async getPendingDeposits() {
    const result = await pool.query(
      `SELECT 
          t.*,
          w.address AS wallet_address,
          u.email AS user_email
       FROM transactions t
       JOIN wallets w ON t.wallet_id = w.id
       JOIN users u ON w.user_id = u.id
       WHERE t.status = 'pending'
       ORDER BY t.created_at DESC`
    );

    return result.rows;
  }
}

module.exports = new AdminService();
