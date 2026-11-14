'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let active = null;

function validateCameras(cameras, duration) {
  if (!Array.isArray(cameras) || cameras.length < 1 || cameras.length > 4) {
    throw new Error('Configure pelo menos uma câmera (máximo de quatro) antes de gravar.');
  }
  if (!Number.isFinite(duration) || duration < 1 || duration > 3600) {
    throw new Error('Duração inválida. Use entre 1 e 3600 segundos.');
  }

  const usbNames = new Set();
  const slots = new Set();
  return cameras.map((camera, index) => {
    if (!camera || typeof camera !== 'object') throw new Error('Configuração inválida para a câmera ' + (index + 1));
    const slot = Number(camera.index || index + 1);
    if (!Number.isInteger(slot) || slot < 1 || slot > 4 || slots.has(slot)) throw new Error('Número de posição de câmera inválido ou repetido.');
    slots.add(slot);
    const method = camera.method === 'ip' ? 'ip' : 'usb';
    const source = method === 'ip' ? String(camera.ip || '').trim() : String(camera.device || '').trim();
    if (!source) throw new Error('Selecione ou informe a fonte da câmera ' + (index + 1) + '.');

    if (method === 'ip') {
      let parsed;
      try { parsed = new URL(source); } catch (_) { throw new Error('URL inválida na câmera ' + (index + 1)); }
      if (!['http:', 'https:', 'rtsp:'].includes(parsed.protocol)) {
        throw new Error('A câmera ' + (index + 1) + ' deve usar HTTP, HTTPS ou RTSP.');
      }
    } else {
      if (/[\r\n\0]/.test(source)) throw new Error('Nome de dispositivo inválido.');
      const key = source.toLocaleLowerCase();
      if (usbNames.has(key)) throw new Error('O mesmo dispositivo USB foi selecionado mais de uma vez. Cada posição precisa de uma fonte independente.');
      usbNames.add(key);
    }
    const cameraDuration = Number(camera.duration === undefined ? duration : camera.duration);
    if (!Number.isFinite(cameraDuration) || cameraDuration < 1 || cameraDuration > 3600) throw new Error('Duração inválida para a câmera ' + slot + '. Use entre 1 e 3600 segundos.');
    return { index: slot, method, source, duration: cameraDuration };
  });
}

async function start({ cameras, duration, audioDevice, audioDuration }) {
  if (active) throw new Error('Já existe uma gravação em andamento.');
  const inputs = validateCameras(cameras, Number(duration));
  const selectedAudioDevice = String(audioDevice || '').trim();
  const selectedAudioDuration = Number(audioDuration || duration);
  if (selectedAudioDevice && (!Number.isFinite(selectedAudioDuration) || selectedAudioDuration < 1 || selectedAudioDuration > 14400)) throw new Error('Duração do áudio inválida. Use entre 1 e 14400 segundos.');
  if ([10, 13, 0].some(code => selectedAudioDevice.includes(String.fromCharCode(code)))) throw new Error('Nome de microfone inválido.');
  fs.mkdirSync(path.join(__dirname, 'cameras'), { recursive: true });
  const outputDir = path.join(__dirname, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  const audioOutput = path.join(outputDir, 'audio.wav');
  if (fs.existsSync(audioOutput)) fs.unlinkSync(audioOutput);

  await new Promise((resolve, reject) => {
    const probe = spawn('ffmpeg', ['-version'], { cwd: __dirname, windowsHide: true, stdio: 'ignore' });
    probe.once('error', () => reject(new Error('FFmpeg não encontrado. Instale o FFmpeg e adicione a pasta bin ao PATH do Windows.')));
    probe.once('close', (code) => code === 0 ? resolve() : reject(new Error('Não foi possível executar o FFmpeg.')));
  });

  const manifestPath = path.join(__dirname, 'recording-manifest.json');
  if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
  const session = { processes: [], finished: 0, errors: [], stopped: false, startedAt: Date.now(), manifestPath, recordedCameras: inputs.map(x => ({ index: x.index, duration: x.duration })), audioDevice: selectedAudioDevice };
  active = session;
  const spawnChecks = [];

  for (const input of inputs) {
    const output = path.join(__dirname, 'cameras', 'cam' + input.index + '.mp4');
    if (fs.existsSync(output)) fs.unlinkSync(output);
    const recording = config.recording || {};
    const resolution = /^\d{2,5}x\d{2,5}$/.test(String(recording.resolution || '')) ? String(recording.resolution) : '';
    const fps = Number(recording.fps) > 0 && Number(recording.fps) <= 120 ? String(Number(recording.fps)) : '30';
    const bitrate = /^\d+k$/i.test(String(recording.bitrate || '')) ? String(recording.bitrate) : '5000k';
    const videoOptions = ['-t', String(input.duration), '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', bitrate, '-r', fps, '-pix_fmt', 'yuv420p'];
    if (resolution) videoOptions.push('-s', resolution);
    videoOptions.push('-movflags', '+faststart', output);
    const args = input.method === 'usb'
      ? ['-hide_banner', '-y', '-f', 'dshow', '-i', 'video=' + input.source, ...videoOptions]
      : ['-hide_banner', '-y', '-i', input.source, ...videoOptions];

    const child = spawn('ffmpeg', args, { cwd: __dirname, windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    const item = { child, index: input.index, output, closed: false };
    session.processes.push(item);
    spawnChecks.push(new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    }));

    child.stderr.on('data', (chunk) => {
      const line = chunk.toString();
      if (/error|failed|could not/i.test(line)) console.error('[MultiCam câmera ' + input.index + '] ' + line.trim());
    });
    child.once('error', (error) => {
      session.errors.push('Câmera ' + input.index + ': ' + error.message);
      finishItem(session, item, -1);
    });
    child.once('close', (code) => finishItem(session, item, code));
  }

  if (selectedAudioDevice) {
    const audioArgs = ['-hide_banner', '-y', '-f', 'dshow', '-i', 'audio=' + selectedAudioDevice,
      '-t', String(selectedAudioDuration), '-c:a', 'pcm_s16le', '-ar', String(config.audio?.sampleRate || 44100), '-ac', String(config.audio?.channels || 2), audioOutput];
    const child = spawn('ffmpeg', audioArgs, { cwd: __dirname, windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    const item = { child, index: 'audio', output: audioOutput, closed: false };
    session.processes.push(item);
    spawnChecks.push(new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    }));
    child.stderr.on('data', chunk => {
      const line = chunk.toString();
      if (/error|failed|could not/i.test(line)) console.error('[MultiCam áudio] ' + line.trim());
    });
    child.once('error', error => {
      session.errors.push('Áudio: ' + error.message);
      finishItem(session, item, -1);
    });
    child.once('close', code => finishItem(session, item, code));
  }

  try {
    await Promise.all(spawnChecks);
    await new Promise(resolve => setTimeout(resolve, 500));
    if (session.errors.length) throw new Error(session.errors.join(' '));
  } catch (error) {
    session.stopped = true;
    for (const item of session.processes) if (!item.closed) item.child.kill();
    if (active === session) active = null;
    throw new Error('Falha ao iniciar FFmpeg: ' + error.message);
  }

  session.recordedCameras = session.processes.filter(item => !item.closed && typeof item.index === 'number').map(item => ({ index: item.index, duration: inputs.find(input => input.index === item.index).duration }));
  fs.writeFileSync(manifestPath, JSON.stringify({ createdAt: new Date().toISOString(), cameras: session.recordedCameras, audioDevice: selectedAudioDevice || null, audioDuration: selectedAudioDevice ? selectedAudioDuration : null }, null, 2));
  return { success: true, message: inputs.length + ' fonte(s) de câmera iniciada(s).', cameras: inputs.map(x => x.index), duration: Number(duration), audioDuration: selectedAudioDevice ? selectedAudioDuration : 0, recordingDuration: Math.max(Number(duration), selectedAudioDevice ? selectedAudioDuration : 0), cameraDurations: inputs.map(x => ({ camera: x.index, duration: x.duration })) };
}

function finishItem(session, item, code) {
  if (item.closed) return;
  item.closed = true;
  session.finished++;
  if (code !== 0 && !session.stopped) {
    session.errors.push((item.index === 'audio' ? 'Áudio' : 'Câmera ' + item.index) + ' encerrou com código ' + code + '.');
    if (typeof item.index === 'number') {
      session.recordedCameras = session.recordedCameras.filter(camera => camera.index !== item.index);
      try { fs.writeFileSync(session.manifestPath, JSON.stringify({ createdAt: new Date(session.startedAt).toISOString(), cameras: session.recordedCameras, audioDevice: session.audioDevice || null }, null, 2)); } catch (_) {}
    }
  }
  if (session.finished >= session.processes.length && active === session) active = null;
}

async function stop() {
  if (!active) return { success: false, message: 'Não existe gravação ativa.' };
  const session = active;
  session.stopped = true;
  const pending = session.processes.filter(item => !item.closed);
  if (pending.length === 0) return { success: true, message: 'Gravação já finalizada.' };

  for (const item of pending) {
    if (item.child.stdin && !item.child.stdin.destroyed) {
      try { item.child.stdin.write('q\n'); } catch (_) { item.child.kill(); }
    }
  }

  let stopTimeout;
  const completed = await Promise.race([
    Promise.all(pending.map(item => new Promise(resolve => {
      if (item.closed) return resolve(true);
      item.child.once('close', () => resolve(true));
    }))).then(() => true),
    new Promise(resolve => { stopTimeout = setTimeout(() => resolve(false), 10000); })
  ]);
  clearTimeout(stopTimeout);

  if (!completed) {
    pending.filter(item => !item.closed).forEach(item => item.child.kill());
    return { success: false, message: 'Algumas câmeras não finalizaram no prazo. Verifique os arquivos antes de editar.' };
  }
  return { success: true, message: 'Todas as câmeras finalizaram e fecharam os arquivos.' };
}

function status() {
  return active ? {
    recording: true,
    cameras: active.processes.filter(p => !p.closed && typeof p.index === 'number').map(p => p.index),
    audio: active.processes.some(p => !p.closed && p.index === 'audio'),
    elapsedSeconds: Math.floor((Date.now() - active.startedAt) / 1000),
    errors: active.errors
  } : { recording: false, cameras: [], audio: false, errors: [] };
}

module.exports = { start, stop, status, validateCameras };
