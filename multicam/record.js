'use strict';

const config = require('./config');
const manager = require('./record-manager');

async function main() {
  const devices = Array.isArray(config.devices) ? config.devices : [];
  if (devices.length !== 4 || devices.some((device) => typeof device !== 'string' || !device.trim())) {
    throw new Error('Para gravar pelo terminal, configure quatro dispositivos diferentes em config.js (devices). Para selecionar câmeras pela interface, execute npm run gui.');
  }

  const cameras = devices.map((device, index) => ({ index: index + 1, method: 'usb', device, duration: Number(config.recording?.duration || 10) }));
  const audioDevice = config.audio?.device || '';
  const audioDuration = audioDevice ? config.timeline.reduce((total, scene) => {
    const cameraDuration = cameras[scene.camera]?.duration;
    return cameraDuration && cameraDuration > scene.start ? total + Math.max(0, Math.min(scene.end, cameraDuration) - scene.start) : total;
  }, 0) : 0;
  const result = await manager.start({ cameras, duration: Number(config.recording?.duration || 10), audioDevice, audioDuration });
  console.log(result.message);
  console.log('Gravação em andamento. Pressione Ctrl+C para parar.');

  const timer = setInterval(() => {
    const status = manager.status();
    if (!status.recording) {
      clearInterval(timer);
      console.log('Gravação finalizada.');
      process.exit(0);
    }
  }, 1000);

  process.once('SIGINT', async () => {
    clearInterval(timer);
    await manager.stop();
    setTimeout(() => process.exit(0), 1500);
  });
}

main().catch((error) => {
  console.error('Não foi possível iniciar a gravação:', error.message);
  process.exitCode = 1;
});
