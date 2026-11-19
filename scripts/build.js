const { spawnSync } = require('node:child_process');

// Render hosts the Node.js API, not the Electron desktop application.
if (process.env.RENDER === 'true') {
  console.log('Render backend detected: skipping Electron desktop packaging.');
  process.exit(0);
}

const result = spawnSync('electron-builder', [], { stdio: 'inherit', shell: true });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
