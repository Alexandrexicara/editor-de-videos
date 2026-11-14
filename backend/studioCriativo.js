'use strict';

const crypto = require('crypto');
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: true },
      max: Number(process.env.PG_POOL_MAX || 10),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    })
  : null;

let schemaPromise;

async function ensureSchema() {
  if (!pool) throw new Error('PostgreSQL não configurado: falta DATABASE_URL.');
  if (!schemaPromise) {
    schemaPromise = pool.query(
      "CREATE TABLE IF NOT EXISTS studio_projects (" +
      "id UUID PRIMARY KEY, " +
      "user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, " +
      "name TEXT NOT NULL CHECK (char_length(name) <= 120), " +
      "document JSONB NOT NULL, " +
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), " +
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()" +
      ");" +
      "CREATE INDEX IF NOT EXISTS studio_projects_user_updated_idx ON studio_projects(user_id, updated_at DESC);"
    ).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

function validId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function registerStudioCriativo(app, billing) {
  app.get('/api/studio/projects', billing.requireAuth, async (req, res) => {
    try {
      await ensureSchema();
      const result = await pool.query(
        'SELECT id, name, updated_at FROM studio_projects WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100',
        [req.user.id]
      );
      res.json({ success: true, projects: result.rows });
    } catch (error) {
      console.error('Studio Criativo list projects:', error);
      res.status(503).json({ success: false, error: error.message || 'Não foi possível carregar os projetos.' });
    }
  });

  app.get('/api/studio/projects/:id', billing.requireAuth, async (req, res) => {
    try {
      await ensureSchema();
      if (!validId(req.params.id)) return res.status(400).json({ success: false, error: 'Identificador de projeto inválido.' });
      const result = await pool.query(
        'SELECT id, name, document, updated_at FROM studio_projects WHERE id=$1 AND user_id=$2',
        [req.params.id, req.user.id]
      );
      if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Projeto não encontrado.' });
      res.json({ success: true, project: result.rows[0] });
    } catch (error) {
      console.error('Studio Criativo open project:', error);
      res.status(503).json({ success: false, error: 'Não foi possível abrir o projeto.' });
    }
  });

  app.post('/api/studio/projects', billing.requireAuth, async (req, res) => {
    try {
      await ensureSchema();
      const name = String(req.body?.name || 'Projeto sem título').trim().slice(0, 120);
      const document = req.body?.document;
      if (!document || typeof document !== 'object' || Array.isArray(document) || !document.canvas) {
        return res.status(400).json({ success: false, error: 'O conteúdo do projeto está incompleto.' });
      }
      const serialized = JSON.stringify(document);
      if (Buffer.byteLength(serialized, 'utf8') > 18 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: 'O projeto ultrapassou o limite de 18 MB.' });
      }
      if (req.body?.id) {
        if (!validId(req.body.id)) return res.status(400).json({ success: false, error: 'Identificador de projeto inválido.' });
        const result = await pool.query(
          'UPDATE studio_projects SET name=$1, document=$2::jsonb, updated_at=NOW() WHERE id=$3 AND user_id=$4 RETURNING id, name, updated_at',
          [name, serialized, req.body.id, req.user.id]
        );
        if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Projeto não encontrado para esta conta.' });
        return res.json({ success: true, project: result.rows[0] });
      }
      const id = crypto.randomUUID();
      const result = await pool.query(
        'INSERT INTO studio_projects (id,user_id,name,document) VALUES ($1,$2,$3,$4::jsonb) RETURNING id,name,updated_at',
        [id, req.user.id, name, serialized]
      );
      res.status(201).json({ success: true, project: result.rows[0] });
    } catch (error) {
      console.error('Studio Criativo save project:', error);
      res.status(503).json({ success: false, error: 'Não foi possível salvar o projeto na nuvem.' });
    }
  });

  app.delete('/api/studio/projects/:id', billing.requireAuth, async (req, res) => {
    try {
      await ensureSchema();
      if (!validId(req.params.id)) return res.status(400).json({ success: false, error: 'Identificador de projeto inválido.' });
      const result = await pool.query(
        'DELETE FROM studio_projects WHERE id=$1 AND user_id=$2 RETURNING id',
        [req.params.id, req.user.id]
      );
      if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Projeto não encontrado.' });
      res.json({ success: true });
    } catch (error) {
      console.error('Studio Criativo delete project:', error);
      res.status(503).json({ success: false, error: 'Não foi possível excluir o projeto.' });
    }
  });
}

module.exports = { registerStudioCriativo };
