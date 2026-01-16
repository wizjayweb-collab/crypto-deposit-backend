require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // REQUIRED for Supabase
  },
  max: 10,
});

pool.on('connect', () => {
  console.log('✅ PostgreSQL connected (Supabase)');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err);
  process.exit(1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
