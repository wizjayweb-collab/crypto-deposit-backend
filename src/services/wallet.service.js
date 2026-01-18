const { ethers } = require('ethers');
const crypto = require('crypto');
const pool = require('../config/database');

/* ===============================
   ENCRYPTION CONFIG
================================ */
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET;
const IV_LENGTH = 16; // AES block size

// Must be 32 bytes = 64 hex characters
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('❌ ENCRYPTION_SECRET must be 32 bytes (64 hex characters)');
}

const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'hex');

/* ===============================
   ENCRYPT / DECRYPT
================================ */
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    KEY_BUFFER,
    iv
  );

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // iv:encrypted
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(payload) {
  const [ivHex, encryptedHex] = payload.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    KEY_BUFFER,
    iv
  );

  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/* ===============================
   WALLET SERVICE
================================ */
class WalletService {

  // CREATE ONE WALLET PER USER
  async createWallet(userId) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existing = await client.query(
        'SELECT id, user_id, address, balance FROM wallets WHERE user_id = $1',
        [userId]
      );

      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return existing.rows[0];
      }

      const wallet = ethers.Wallet.createRandom();
      const encryptedKey = encrypt(wallet.privateKey);

      const result = await client.query(
        `
        INSERT INTO wallets (user_id, address, private_key)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, address, balance, created_at
        `,
        [userId, wallet.address, encryptedKey]
      );

      await client.query('COMMIT');
      return result.rows[0];

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // GET WALLET (SAFE – NO PRIVATE KEY)
  async getWalletByUserId(userId) {
    const result = await pool.query(
      'SELECT id, user_id, address, balance FROM wallets WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  }

  // ADMIN / INTERNAL USE ONLY
  async getWalletById(walletId) {
    const result = await pool.query(
      'SELECT * FROM wallets WHERE id = $1',
      [walletId]
    );

    if (!result.rows[0]) return null;

    return {
      ...result.rows[0],
      private_key: decrypt(result.rows[0].private_key)
    };
  }

  async getWalletByAddress(address) {
    const result = await pool.query(
      'SELECT * FROM wallets WHERE address = $1',
      [address]
    );

    if (!result.rows[0]) return null;

    return {
      ...result.rows[0],
      private_key: decrypt(result.rows[0].private_key)
    };
  }

  async getAllWalletAddresses() {
    const result = await pool.query('SELECT address FROM wallets');
    return result.rows.map(r => r.address);
  }

  // DEMO BALANCE UPDATE
  async updateBalance(walletId, amount) {
    await pool.query(
      `
      UPDATE wallets
      SET balance = balance + $1
      WHERE id = $2
      `,
      [amount, walletId]
    );
  }
}

module.exports = new WalletService();
