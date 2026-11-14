'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('node:child_process');

module.exports = function createAvatarStudioRouter(billing) {
  const router = express.Router();
  const root = path.resolve(__dirname, '..');
  const outputDir = path.join(root, 'outputs');
  const tempDir = path.join(root, 'temp');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  let ffmpegPath;
  try { ffmpegPath = require('ffmpeg-static'); } catch (_) { ffmpegPath = null; }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, tempDir),
      filename: (_req, file, cb) => cb(null, 'avatar-render-' + crypto.randomUUID() + path.extname(file.originalname || '.webm').toLowerCase())
    }),
    limits: { fileSize: 250 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const valid = file.fieldname === 'renderedVideo' &&
        ['video/webm', 'video/mp4', 'application/octet-stream'].includes(file.mimetype);
      cb(valid ? null : new Error('Envie o vídeo renderizado pelo estúdio (WebM ou MP4).'), valid);
    }
  });

  function convertToMp4(input, output) {
    return new Promise((resolve, reject) => {
      if (!ffmpegPath) return reject(new Error('FFmpeg não está disponível neste servidor.'));
      const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
        '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast',
        '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart', output];
      const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let detail = '';
      let settled = false;
      const timer = setTimeout(() => {
        detail += '\\nTempo limite de 10 minutos excedido.';
        child.kill('SIGKILL');
      }, 10 * 60 * 1000);
      child.stderr.on('data', chunk => { detail = (detail + chunk.toString()).slice(-3000); });
      child.once('error', error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', code => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error('FFmpeg não conseguiu finalizar o vídeo: ' + detail.slice(-700)));
      });
    });
  }

  // A geração é feita no navegador do cliente. O servidor apenas finaliza o arquivo
  // e aplica a cobrança interna; não utiliza provedores externos de geração.
  router.post('/render', billing.requireAuth, upload.single('renderedVideo'), async (req, res) => {
    const input = req.file?.path;
    let reservation = null;
    let completed = false;
    let output = null;
    try {
      if (!input) return res.status(400).json({ error: 'O navegador não enviou o vídeo renderizado.' });
      if (!ffmpegPath) return res.status(503).json({ error: 'FFmpeg não está instalado no servidor.' });
      reservation = await billing.reserveVideoCredit(req.user.id);
      output = path.join(outputDir, 'avatar-studio-' +
        String(req.user.id).replace(/[^a-zA-Z0-9_-]/g, '') + '-' + crypto.randomUUID() + '.mp4');
      await convertToMp4(input, output);
      const stat = await fs.promises.stat(output);
      if (!stat.size) throw new Error('O arquivo MP4 foi gerado vazio.');
      await billing.completeVideoCredit(reservation, path.basename(output), 'Avatar Studio - renderização local');
      completed = true;
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'inline; filename="avatar-studio.mp4"');
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(output);
    } catch (error) {
      console.error('Avatar Studio local render error:', error);
      if (!res.headersSent) res.status(error.status || 500).json({
        error: error.status === 402 ? error.message : 'Não foi possível finalizar o vídeo: ' + String(error.message || 'erro interno').slice(0, 300)
      });
    } finally {
      if (input) fs.promises.unlink(input).catch(() => {});
      if (reservation && !completed) {
        try { await billing.refundVideoCredit(reservation); }
        catch (error) { console.error('Avatar Studio credit refund error:', error); }
      }
      if (output && !completed) fs.promises.unlink(output).catch(() => {});
    }
  });

  // Bloqueia clientes antigos: não deixa uma chamada legada consumir créditos
  // nem encaminhar mídia para o provedor externo descontinuado.
  router.post('/generate', billing.requireAuth, (_req, res) => res.status(410).json({
    error: 'A geração externa foi desativada. Atualize a página para usar o novo renderizador local do Avatar Studio.'
  }));

  return router;
};
