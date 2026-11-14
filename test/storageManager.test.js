'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const StorageManager = require('../backend/storageManager');

test('preserva vídeos finais por padrão e remove temporários expirados', () => {
  const previousRetention = process.env.MAX_OUTPUT_AGE_DAYS;
  process.env.MAX_OUTPUT_AGE_DAYS = '0';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cine-storage-test-'));
  const directories = {
    uploads: path.join(root, 'uploads'),
    outputs: path.join(root, 'outputs'),
    temporarios: path.join(root, 'temp')
  };

  try {
    Object.values(directories).forEach((directory) => fs.mkdirSync(directory, { recursive: true }));
    const finalVideo = path.join(directories.outputs, 'video-final.mp4');
    const temporaryFile = path.join(directories.temporarios, 'render.tmp');
    fs.writeFileSync(finalVideo, 'video');
    fs.writeFileSync(temporaryFile, 'temporary');

    const expired = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    fs.utimesSync(finalVideo, expired, expired);
    fs.utimesSync(temporaryFile, expired, expired);

    const manager = new StorageManager({ diretorios: directories });
    manager.performPreventiveCleanup();

    assert.equal(fs.existsSync(finalVideo), true, 'o vídeo final deve continuar disponível');
    assert.equal(fs.existsSync(temporaryFile), false, 'o temporário expirado deve ser removido');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    if (previousRetention === undefined) delete process.env.MAX_OUTPUT_AGE_DAYS;
    else process.env.MAX_OUTPUT_AGE_DAYS = previousRetention;
  }
});

test('retorna estatísticas reais e numéricas do filesystem', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cine-disk-test-'));
  try {
    const manager = new StorageManager({
      diretorios: { uploads: root, outputs: root, temporarios: root }
    });
    const stats = manager.getDiskSpace();
    assert.ok(Number.isFinite(stats.freeMB) && stats.freeMB >= 0);
    assert.ok(Number.isFinite(stats.usedPercent) && stats.usedPercent >= 0 && stats.usedPercent <= 100);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
