'use strict';
const crypto = require('crypto');
const { Pool } = require('pg');

const COOKIE = 'rolezando_session';
const SESSION_SECONDS = 604800;
const CATALOG = {
  BRL: [
    { id: 'credits_10', minor: 100, credits: 10 },
    { id: 'credits_50', minor: 500, credits: 50 },
    { id: 'credits_100', minor: 1000, credits: 100 },
    { id: 'credits_500', minor: 5000, credits: 500 }
  ],
  USD: [
    { id: 'credits_10', minor: 100, credits: 10 },
    { id: 'credits_50', minor: 500, credits: 50 },
    { id: 'credits_100', minor: 1000, credits: 100 },
    { id: 'credits_500', minor: 5000, credits: 500 }
  ]
};
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX || 10),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
}) : null;
let schemaPromise;

function env(name) {
  if (!process.env[name]) throw new Error('Configure a variável ' + name + ' no servidor.');
  return process.env[name];
}
async function ensureSchema() {
  if (!pool) throw new Error('PostgreSQL não configurado: falta DATABASE_URL.');
  if (!schemaPromise) {
    schemaPromise = pool.query(
      "CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE, first_name TEXT NOT NULL, last_name TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" +
      "CREATE TABLE IF NOT EXISTS payments (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id), provider TEXT NOT NULL DEFAULT 'sumup', checkout_reference TEXT NOT NULL UNIQUE, provider_checkout_id TEXT UNIQUE, package_id TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK (amount_minor > 0), currency CHAR(3) NOT NULL CHECK (currency IN ('BRL','USD')), credits INTEGER NOT NULL CHECK (credits > 0), status TEXT NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','pending','paid','failed','expired')), checkout_url TEXT, provider_payload JSONB, paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" +
      "CREATE INDEX IF NOT EXISTS payments_user_created_idx ON payments(user_id, created_at DESC);" +
      "CREATE TABLE IF NOT EXISTS wallet_ledger (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id), amount INTEGER NOT NULL, entry_type TEXT NOT NULL CHECK (entry_type IN ('purchase','video_debit','video_refund')), status TEXT NOT NULL CHECK (status IN ('reserved','completed','refunded')), reference TEXT NOT NULL UNIQUE, description TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" +
      "CREATE INDEX IF NOT EXISTS wallet_ledger_user_created_idx ON wallet_ledger(user_id, created_at DESC);" +
      "CREATE TABLE IF NOT EXISTS processed_videos (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id), filename TEXT NOT NULL, original_name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id, filename));"
    ).catch((error) => { schemaPromise = null; throw error; });
  }
  await schemaPromise;
}
function passwordHash(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, key) => {
    if (err) reject(err); else resolve(key.toString('hex'));
  }));
}
async function checkPassword(password, salt, expected) {
  const actual = Buffer.from(await passwordHash(password, salt), 'hex');
  const wanted = Buffer.from(expected, 'hex');
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}
function signSession(user) {
  const body = Buffer.from(JSON.stringify({
    sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', env('SESSION_SECRET')).update(body).digest('base64url');
  return body + '.' + sig;
}
function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac('sha256', env('SESSION_SECRET')).update(parts[0]).digest();
  const received = Buffer.from(parts[1], 'base64url');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return p.sub && p.exp > Math.floor(Date.now() / 1000) ? { id: p.sub, email: p.email } : null;
  } catch (_) { return null; }
}
function cookieValue(req) {
  const parts = (req.headers.cookie || '').split(';');
  for (const part of parts) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === COOKIE) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}
function setCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', COOKIE + '=' + encodeURIComponent(token) + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + SESSION_SECONDS + secure);
}
function clearCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', COOKIE + '=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' + secure);
}
async function sumup(url, options) {
  const response = await fetch(url, {
    ...(options || {}),
    headers: {
      Authorization: 'Bearer ' + env('SUMUP_API_KEY'),
      Accept: 'application/json',
      ...((options && options.body) ? { 'Content-Type': 'application/json' } : {}),
      ...((options && options.headers) || {})
    }
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { message: raw }; }
  if (!response.ok) {
    const error = new Error(data.message || data.error_message || ('SumUp HTTP ' + response.status));
    error.status = response.status;
    throw error;
  }
  return data;
}
async function creditPaidCheckout(checkout) {
  if (!checkout || checkout.status !== 'PAID' || !checkout.checkout_reference) return false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM payments WHERE checkout_reference = $1 FOR UPDATE', [checkout.checkout_reference]);
    const payment = result.rows[0];
    if (!payment) throw new Error('Cobrança não encontrada no Rolezando.');
    if (payment.currency !== checkout.currency ||
        payment.amount_minor !== Math.round(Number(checkout.amount) * 100) ||
        checkout.merchant_code !== env('SUMUP_MERCHANT_CODE')) {
      throw new Error('Valor, moeda ou estabelecimento divergente na confirmação SumUp.');
    }
    if (payment.status !== 'paid') {
      await client.query("UPDATE payments SET status='paid', provider_payload=$2::jsonb, paid_at=NOW(), updated_at=NOW() WHERE id=$1", [payment.id, JSON.stringify(checkout)]);
      await client.query('UPDATE users SET credits=credits+$2 WHERE id=$1', [payment.user_id, payment.credits]);
      await client.query(
        "INSERT INTO wallet_ledger (id,user_id,amount,entry_type,status,reference,description) VALUES ($1,$2,$3,'purchase','completed',$4,$5) ON CONFLICT (reference) DO NOTHING",
        [crypto.randomUUID(), payment.user_id, payment.credits, 'sumup:' + payment.id, 'Compra confirmada: ' + payment.credits + ' créditos']
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
async function refreshPayment(reference) {
  const result = await pool.query('SELECT * FROM payments WHERE checkout_reference=$1', [reference]);
  const payment = result.rows[0];
  if (!payment) { const e = new Error('Pagamento não encontrado.'); e.status = 404; throw e; }
  if (!payment.provider_checkout_id) return { status: payment.status, credited: false };
  const checkout = await sumup('https://api.sumup.com/v0.1/checkouts/' + encodeURIComponent(payment.provider_checkout_id));
  if (checkout.checkout_reference !== payment.checkout_reference) throw new Error('Referência SumUp divergente.');
  if (checkout.status === 'PAID') {
    await creditPaidCheckout(checkout);
    return { status: 'PAID', credited: true };
  }
  if (checkout.status === 'FAILED' || checkout.status === 'EXPIRED') {
    await pool.query("UPDATE payments SET status=$2, provider_payload=$3::jsonb, updated_at=NOW() WHERE id=$1 AND status <> 'paid'",
      [payment.id, checkout.status.toLowerCase(), JSON.stringify(checkout)]);
  }
  return { status: checkout.status || payment.status, credited: false };
}

function registerBilling(app) {
  const requireAuth = async (req, res, next) => {
    try {
      await ensureSchema();
      const user = verifySession(cookieValue(req));
      if (!user) return res.status(401).json({ success: false, message: 'Faça login para continuar.' });
      req.user = user;
      next();
    } catch (error) { res.status(503).json({ success: false, message: error.message }); }
  };

  app.post('/api/signup', async (req, res) => {
    try {
      await ensureSchema();
      const body = req.body || {};
      const first = String(body.firstName || '').trim().slice(0, 80);
      const last = String(body.lastName || '').trim().slice(0, 100);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!first || !last || !email || !password || !body.terms) return res.status(400).json({ success: false, message: 'Preencha os campos e aceite os termos.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'E-mail inválido.' });
      if (password.length < 8) return res.status(400).json({ success: false, message: 'A senha precisa ter pelo menos 8 caracteres.' });
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = await passwordHash(password, salt);
      const user = { id: crypto.randomUUID(), email, firstName: first, lastName: last };
      await pool.query('INSERT INTO users (id,email,first_name,last_name,password_salt,password_hash) VALUES ($1,$2,$3,$4,$5,$6)',
        [user.id, email, first, last, salt, hash]);
      setCookie(res, signSession(user));
      res.status(201).json({ success: true, user });
    } catch (error) {
      res.status(error.code === '23505' ? 409 : 503).json({ success: false, message: error.code === '23505' ? 'Este e-mail já está cadastrado.' : error.message });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      await ensureSchema();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const result = await pool.query('SELECT id,email,first_name,last_name,password_salt,password_hash FROM users WHERE email=$1', [email]);
      const user = result.rows[0];
      if (!user || !(await checkPassword(password, user.password_salt, user.password_hash))) {
        return res.status(401).json({ success: false, message: 'E-mail ou senha inválidos.' });
      }
      setCookie(res, signSession({ id: user.id, email: user.email }));
      res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name } });
    } catch (error) { res.status(503).json({ success: false, message: error.message }); }
  });

  app.post('/api/logout', (req, res) => { clearCookie(res); res.json({ success: true }); });

  app.get('/api/me', requireAuth, async (req, res) => {
    const result = await pool.query('SELECT id,email,first_name,last_name,credits,created_at FROM users WHERE id=$1', [req.user.id]);
    const u = result.rows[0];
    if (!u) return res.status(401).json({ success: false });
    res.json({ success: true, user: { id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name, credits: u.credits, createdAt: u.created_at } });
  });

  app.get('/api/credits/packages', (req, res) => {
    res.json({ pricePerVideo: { BRL: 0.10, USD: 0.10 }, packages: Object.fromEntries(
      Object.entries(CATALOG).map(([currency, list]) => [currency, list.map((p) => ({ id: p.id, credits: p.credits, amount: p.minor / 100, currency }))])
    ) });
  });

  app.get('/api/credits/balance', requireAuth, async (req, res) => {
    const result = await pool.query('SELECT credits FROM users WHERE id=$1', [req.user.id]);
    res.json({ credits: result.rows[0]?.credits || 0 });
  });

  app.get('/api/credits/history', requireAuth, async (req, res) => {
    const ledger = await pool.query('SELECT id,amount,entry_type AS type,status,description,created_at FROM wallet_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [req.user.id]);
    const payments = await pool.query('SELECT id,package_id,amount_minor,currency,credits,status,created_at,paid_at FROM payments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json({ ledger: ledger.rows, payments: payments.rows });
  });

  app.post('/api/credits/checkout', requireAuth, async (req, res) => {
    let id;
    try {
      const currency = String(req.body?.currency || 'BRL').toUpperCase();
      const item = (CATALOG[currency] || []).find((p) => p.id === req.body?.packageId);
      if (!item) return res.status(400).json({ success: false, message: 'Pacote ou moeda inválidos.' });
      const base = env('PUBLIC_BASE_URL').replace(/\/+$/, '');
      const reference = crypto.randomUUID();
      id = crypto.randomUUID();
      await pool.query('INSERT INTO payments (id,user_id,checkout_reference,package_id,amount_minor,currency,credits) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, req.user.id, reference, item.id, item.minor, currency, item.credits]);
      const checkout = await sumup('https://api.sumup.com/v0.1/checkouts', {
        method: 'POST',
        body: JSON.stringify({
          checkout_reference: reference, amount: item.minor / 100, currency,
          merchant_code: env('SUMUP_MERCHANT_CODE'),
          description: 'Rolezando Avatar - ' + item.credits + ' créditos',
          return_url: base + '/api/payments/sumup/notify',
          redirect_url: base + '/conta.html?reference=' + encodeURIComponent(reference),
          hosted_checkout: { enabled: true }
        })
      });
      if (!checkout.id || !checkout.hosted_checkout_url) throw new Error('SumUp não retornou o link de pagamento.');
      await pool.query("UPDATE payments SET provider_checkout_id=$2,checkout_url=$3,status='pending',provider_payload=$4::jsonb,updated_at=NOW() WHERE id=$1",
        [id, checkout.id, checkout.hosted_checkout_url, JSON.stringify(checkout)]);
      res.status(201).json({ success: true, checkoutUrl: checkout.hosted_checkout_url, reference, credits: item.credits, amount: item.minor / 100, currency });
    } catch (error) {
      if (id) await pool.query("UPDATE payments SET status='failed',updated_at=NOW() WHERE id=$1 AND status='creating'", [id]).catch(() => {});
      res.status(error.status || 503).json({ success: false, message: error.message });
    }
  });

  app.post('/api/payments/sumup/notify', async (req, res) => {
    try {
      await ensureSchema();
      const id = req.body?.id || req.body?.checkout_id;
      if (!id) return res.status(400).json({ received: false });
      const checkout = await sumup('https://api.sumup.com/v0.1/checkouts/' + encodeURIComponent(String(id)));
      if (checkout.status === 'PAID') await creditPaidCheckout(checkout);
      else if (checkout.checkout_reference) await refreshPayment(checkout.checkout_reference);
      res.json({ received: true });
    } catch (error) { res.status(400).json({ received: false, message: error.message }); }
  });

  app.get('/api/payments/:reference/status', requireAuth, async (req, res) => {
    try {
      const owned = await pool.query('SELECT id FROM payments WHERE checkout_reference=$1 AND user_id=$2', [req.params.reference, req.user.id]);
      if (!owned.rows[0]) return res.status(404).json({ success: false, message: 'Pagamento não encontrado.' });
      const payment = await refreshPayment(req.params.reference);
      const balance = await pool.query('SELECT credits FROM users WHERE id=$1', [req.user.id]);
      res.json({ success: true, payment, credits: balance.rows[0]?.credits || 0 });
    } catch (error) { res.status(error.status || 503).json({ success: false, message: error.message }); }
  });

  async function reserveVideoCredit(userId) {
    const client = await pool.connect();
    const id = crypto.randomUUID();
    try {
      await client.query('BEGIN');
      const result = await client.query('UPDATE users SET credits=credits-1 WHERE id=$1 AND credits>0 RETURNING id', [userId]);
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        const error = new Error('Você está sem créditos. Compre um pacote para processar vídeos.');
        error.status = 402;
        throw error;
      }
      await client.query("INSERT INTO wallet_ledger (id,user_id,amount,entry_type,status,reference,description) VALUES ($1,$2,-1,'video_debit','reserved',$3,'Crédito reservado para processamento')",
        [id, userId, 'video:' + id]);
      await client.query('COMMIT');
      return { id, userId };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw error;
    } finally { client.release(); }
  }

  async function completeVideoCredit(reservation, filename, originalName) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO processed_videos (id,user_id,filename,original_name) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,filename) DO NOTHING',
        [crypto.randomUUID(), reservation.userId, filename, originalName || null]
      );
      const result = await client.query(
        "UPDATE wallet_ledger SET status='completed',description='Vídeo concluído; 1 crédito consumido' WHERE id=$1 AND user_id=$2 AND status='reserved' RETURNING id",
        [reservation.id, reservation.userId]
      );
      if (!result.rows[0]) throw new Error('Não foi possível confirmar o consumo do crédito reservado.');
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async function refundVideoCredit(reservation) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query("UPDATE wallet_ledger SET status='refunded',description='Falha no processamento; crédito devolvido' WHERE id=$1 AND user_id=$2 AND status='reserved' RETURNING id", [reservation.id, reservation.userId]);
      if (result.rows[0]) {
        await client.query('UPDATE users SET credits=credits+1 WHERE id=$1', [reservation.userId]);
        await client.query("INSERT INTO wallet_ledger (id,user_id,amount,entry_type,status,reference,description) VALUES ($1,$2,1,'video_refund','completed',$3,'Estorno automático de processamento') ON CONFLICT (reference) DO NOTHING",
          [crypto.randomUUID(), reservation.userId, 'refund:' + reservation.id]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async function recordProcessedVideo(userId, filename, originalName) {
    await pool.query('INSERT INTO processed_videos (id,user_id,filename,original_name) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,filename) DO NOTHING',
      [crypto.randomUUID(), userId, filename, originalName || null]);
  }
  async function userOwnsVideo(userId, filename) {
    const result = await pool.query('SELECT 1 FROM processed_videos WHERE user_id=$1 AND filename=$2', [userId, filename]);
    return Boolean(result.rows[0]);
  }
  async function listUserVideos(userId) {
    const result = await pool.query('SELECT filename FROM processed_videos WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [userId]);
    return result.rows.map((row) => row.filename);
  }

  return { requireAuth, reserveVideoCredit, completeVideoCredit, refundVideoCredit, recordProcessedVideo, userOwnsVideo, listUserVideos };
}
module.exports = { registerBilling };
