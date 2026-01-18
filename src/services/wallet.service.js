const { ethers } = require('ethers');
const crypto = require('crypto');
const pool = require('../config/database');

/* ===============================
   ENCRYPTION CONFIG
================================ */
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
const IV_LENGTH = 16;

if (!ENCRYPTION_SECRET) {
  throw new Error('❌ ENCRYPTION_SECRET is missing');
}

const KEY = crypto
  .createHash('sha256')
  .update(ENCRYPTION_SECRET)
  .digest();

/* ===============================
   ENCRYPT / DECRYPT
================================ */
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(payload) {
  const [ivHex, encryptedHex] = payload.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);

  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/* ===============================
   WALLET SERVICE
================================ */
class WalletService {
  /** Create wallet if not exists */
  async createWallet(userId) {
    // Check existing wallet
    const existing = await pool.query(
      'SELECT id, user_id, address, balance FROM wallets WHERE user_id = $1',
      [userId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Create new wallet
    const wallet = ethers.Wallet.createRandom();
    const encryptedKey = encrypt(wallet.privateKey);

    const result = await pool.query(
      `INSERT INTO wallets (user_id, address, private_key)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, address, balance`,
      [userId, wallet.address, encryptedKey]
    );

    return result.rows[0];
  }

  async getWalletByUserId(userId) {
    const result = await pool.query(
      'SELECT id, user_id, address, balance FROM wallets WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  }

  async getWalletById(walletId) {
    const result = await pool.query(
      'SELECT * FROM wallets WHERE id = $1',
      [walletId]
    );

    if (!result.rows[0]) return null;

    return {
      ...result.rows[0],
      private_key: decrypt(result.rows[0].private_key),
    };
  }

  /** ✅ REQUIRED BY DEPOSIT WATCHER */
  async getAllWalletAddresses() {
    const result = await pool.query(
      'SELECT address FROM wallets'
    );
    return result.rows.map(r => r.address.toLowerCase());
  }
}

module.exports = new WalletService();
