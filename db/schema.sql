-- ==========================================
-- DROP OLD TABLES (SAFE RESET FOR DEV)
-- ==========================================
DROP TABLE IF EXISTS withdrawals CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;

-- ==========================================
-- USERS (PLATFORM USERS)
-- ==========================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- WALLETS (USER DEPOSIT ADDRESSES)
-- ==========================================
CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(42) UNIQUE NOT NULL,
    private_key TEXT NOT NULL,
    balance DECIMAL(36, 18) DEFAULT 0, -- DATABASE BALANCE (SOURCE OF TRUTH)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- TRANSACTIONS (USER DEPOSITS ONLY)
-- ==========================================
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,

    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,

    amount DECIMAL(36, 18) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending | confirmed | failed
    confirmations INTEGER DEFAULT 0,
    block_number BIGINT,

    swept BOOLEAN DEFAULT false,
    sweep_tx_hash VARCHAR(66),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- WITHDRAWALS (ADMIN → EXTERNAL WALLET)
-- ==========================================
CREATE TABLE withdrawals (
    id SERIAL PRIMARY KEY,

    to_address VARCHAR(42) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,

    tx_hash VARCHAR(66) UNIQUE,
    status VARCHAR(20) DEFAULT 'pending', -- pending | completed | failed

    admin_user_id INTEGER,
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ==========================================
-- ADMIN USERS
-- ==========================================
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- SYSTEM CONFIG (HOT WALLET, WATCHER STATE)
-- ==========================================
CREATE TABLE system_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- DEFAULT SYSTEM CONFIG VALUES
-- ==========================================
INSERT INTO system_config (key, value) VALUES
    ('hot_wallet_address', ''),
    ('hot_wallet_private_key', ''),
    ('last_processed_block', '0')
ON CONFLICT (key) DO NOTHING;

-- ==========================================
-- DEFAULT ADMIN USER (DEV ONLY)
-- username: admin
-- password: admin123
-- ==========================================
INSERT INTO admin_users (username, password_hash) VALUES
(
    'admin',
    '$2b$10$rKqF9xO7l3LZGxW6y1J7iOYxYvH5hZPxZGHPQXqXqXqXqXqXqXqXq'
)
ON CONFLICT DO NOTHING;

-- ==========================================
-- INDEXES (PERFORMANCE)
-- ==========================================
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_address ON wallets(address);

CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_swept ON transactions(swept);

CREATE INDEX idx_withdrawals_status ON withdrawals(status);
