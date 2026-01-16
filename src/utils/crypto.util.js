// src/utils/crypto.util.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const SECRET = process.env.ENCRYPTION_SECRET;

if (!SECRET || SECRET.length < 32) {
  throw new Error('❌ ENCRYPTION_SECRET must be at least 32 characters');
}

const KEY = crypto.createHash('sha256').update(SECRET).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(payload) {
  if (!payload.startsWith('enc:v1:')) {
    throw new Error('Invalid encrypted payload');
  }

  const [, , ivHex, tagHex, encrypted] = payload.split(':');

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = { encrypt, decrypt };
