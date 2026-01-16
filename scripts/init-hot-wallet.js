require('dotenv').config();
const { ethers } = require('ethers');
const pool = require('../src/config/database');
const { encrypt } = require('../src/utils/crypto.util');

(async () => {
  console.log('==============================================');
  console.log(' 🔐 SECURE HOT WALLET INITIALIZATION');
  console.log('==============================================');

  const existing = await pool.query(`
    SELECT value
    FROM system_config
    WHERE key = 'hot_wallet_private_key'
    AND value IS NOT NULL
    AND value <> ''
  `);

  if (existing.rows.length > 0) {
    console.log('⚠️ Hot wallet already exists. Aborting.');
    process.exit(0);
  }

  const wallet = ethers.Wallet.createRandom();
  const encryptedPrivateKey = encrypt(wallet.privateKey);

  await pool.query(
    `
    INSERT INTO system_config (key, value)
    VALUES
      ('hot_wallet_address', $1),
      ('hot_wallet_private_key', $2)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value
    `,
    [wallet.address, encryptedPrivateKey]
  );

  console.log('✅ Hot wallet created and encrypted');
  console.log('Address:', wallet.address);
  console.log('⚠️ Private key is encrypted and stored securely');

  process.exit(0);
})();
