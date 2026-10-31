-- Rolezando Avatar Editor: PostgreSQL wallet schema.
-- backend/billing.js also creates these tables automatically.
CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE, first_name TEXT NOT NULL,
 last_name TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
 credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payments (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id), provider TEXT NOT NULL DEFAULT 'sumup',
 checkout_reference TEXT NOT NULL UNIQUE, provider_checkout_id TEXT UNIQUE, package_id TEXT NOT NULL,
 amount_minor INTEGER NOT NULL CHECK (amount_minor > 0), currency CHAR(3) NOT NULL CHECK (currency IN ('BRL','USD')),
 credits INTEGER NOT NULL CHECK (credits > 0), status TEXT NOT NULL DEFAULT 'creating'
 CHECK (status IN ('creating','pending','paid','failed','expired')), checkout_url TEXT, provider_payload JSONB,
 paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payments_user_created_idx ON payments(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS wallet_ledger (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id), amount INTEGER NOT NULL,
 entry_type TEXT NOT NULL CHECK (entry_type IN ('purchase','video_debit','video_refund')),
 status TEXT NOT NULL CHECK (status IN ('reserved','completed','refunded')),
 reference TEXT NOT NULL UNIQUE, description TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wallet_ledger_user_created_idx ON wallet_ledger(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS processed_videos (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id), filename TEXT NOT NULL,
 original_name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id, filename)
);
