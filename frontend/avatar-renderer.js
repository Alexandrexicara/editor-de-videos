const $ = (id) => document.getElementById(id);
let ttsPromise = null;
let activeAudioUrl = null;

function status(message, type = '') {
  const el = $('status');
  el.textContent = message;
  el.className = 'status show ' + type;
}
async function loadLocalTTS() {
  if (!ttsPromise) {
    status('Baixando o modelo de voz local na primeira utilização. Isso pode levar alguns minutos...');
    ttsPromise = (async () => {
      const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
      try {
        return await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
          dtype: navigator.gpu ? 'fp32' : 'q8',
          device: navigator.gpu ? 'webgpu' : 'wasm'
        });
      } catch (error) {
        ttsPromise = null;
        throw error;
      }
    })();
  }
  return ttsPromise;
}
function rawAudioToBuffer(raw, context) {
  const samples = raw.audio;
  const buffer = context.createBuffer(1, samples.length, raw.sampling_rate);
  buffer.copyToChannel(samples, 0);
  return buffer;
}
function drawAvatar(canvas, image, analyser, duration, backgroundTransparent) {
  const ctx = canvas.getContext('2d');
  const started = performance.now();
  const width = canvas.width, height = canvas.height;
  const frame = () => {
    const elapsed = (performance.now() - started) / 1000;
    ctx.clearRect(0, 0, width, height);
    if (!backgroundTransparent) {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#202b49');
      gradient.addColorStop(1, '#101827');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    const bob = Math.sin(elapsed * 2.2) * height * 0.008;
    const maxW = width * 0.88, maxH = height * 0.94;
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const w = image.width * scale, h = image.height * scale;
    const x = (width - w) / 2, y = (height - h) / 2 + bob;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.3)';
    ctx.shadowBlur = 24;
    ctx.drawImage(image, x, y, w, h);
    ctx.restore();

    // Movimento sutil de apresentação para imagens 2D. Não simula articulações 3D.
    const bins = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(bins);
    const level = bins.reduce((sum, n) => sum + n, 0) / Math.max(1, bins.length) / 255;
    const pulse = Math.min(1, level * 2.8);
    const cx = width / 2, mouthY = y + h * 0.39;
    if (pulse > 0.06) {
      ctx.fillStyle = 'rgba(35,12,20,.62)';
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, Math.max(3, w * .018), 2 + pulse * h * .012, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (elapsed < duration + .2) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
async function renderVideo() {
  const text = $('scriptText').value.trim();
  const own = document.querySelector('input[name="voiceMode"]:checked').value === 'own';
  const voiceFile = $('audioFile').files[0];
  const previewImage = $('avatarPreview').querySelector('img');
  if (!previewImage && !window.avatarStudioCanvas) throw new Error('Crie ou envie uma imagem ou modelo 3D primeiro.');
  if (own && !voiceFile) throw new Error('Envie sua gravação de voz.');
  if (!own && !text) throw new Error('Digite o texto que o avatar deverá falar.');
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('Este navegador não oferece gravação de vídeo. Use Chrome ou Edge atualizado.');
  }

  let audioBuffer;
  if (own) {
    const context = new AudioContext();
    const bytes = await voiceFile.arrayBuffer();
    audioBuffer = await context.decodeAudioData(bytes);
    return await recordAndUpload(previewImage, audioBuffer, context);
  }

  const tts = await loadLocalTTS();
  status('Gerando a voz no próprio dispositivo. Nenhum texto será enviado a um serviço de voz...');
  const selected = $('voiceSelect').value || 'pf_dora';
  const raw = await tts.generate(text, { voice: selected });
  const context = new AudioContext();
  audioBuffer = rawAudioToBuffer(raw, context);
  await recordAndUpload(previewImage, audioBuffer, context);
}
async function recordAndUpload(imageElement, audioBuffer, context) {
  const ratio = $('aspectRatio').value;
  const quality = $('resolution').value;
  const dimensionsByQuality = {
    '540p': { '16:9': [960,540], '1:1': [720,720], '9:16': [540,960] },
    '720p': { '16:9': [1280,720], '1:1': [900,900], '9:16': [720,1280] },
    '1080p': { '16:9': [1920,1080], '1:1': [1080,1080], '9:16': [1080,1920] }
  };
  const dimensions = (dimensionsByQuality[quality] || dimensionsByQuality['720p'])[ratio] || [720,1280];
  const canvas = window.avatarStudioCanvas || document.createElement('canvas');
  if (!window.avatarStudioCanvas) { canvas.width = dimensions[0]; canvas.height = dimensions[1]; }
  else if (window.avatarStudioResizeCanvas) window.avatarStudioResizeCanvas(dimensions[0], dimensions[1]);

  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  const destination = context.createMediaStreamDestination();
  let canvasStream = null;
  let recorder = null;
  let recordingStarted = false;
  try {
    source.connect(analyser);
    analyser.connect(destination);
    canvasStream = canvas.captureStream(30);
    destination.stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    recorder = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: 5000000 });
    const chunks = [];
    const finished = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error('Falha ao gravar a animação no navegador.'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    });

    if (window.avatarStudioCanvas && window.avatarStudioStartAnimation) window.avatarStudioStartAnimation(analyser);
    else {
      if (!imageElement) throw new Error('A prévia da imagem do avatar não está disponível.');
      drawAvatar(canvas, imageElement, analyser, audioBuffer.duration, false);
    }
    await context.resume();
    recorder.start(1000);
    recordingStarted = true;
    source.start();
    status('Renderizando no seu dispositivo. Mantenha esta aba aberta até terminar...');
    await new Promise(resolve => { source.onended = resolve; });
    await new Promise(resolve => setTimeout(resolve, 350));
    if (recorder.state !== 'inactive') recorder.stop();
    const webm = await finished;
    if (!webm.size) throw new Error('A gravação ficou vazia. Tente novamente.');

    status('Enviando o vídeo para conversão MP4 e confirmação do crédito...');
    const form = new FormData();
    form.append('renderedVideo', webm, 'avatar-render.webm');
    const response = await fetch('/api/avatar-studio/render', {
      method: 'POST', body: form, credentials: 'same-origin'
    });
    if (!response.ok) {
      let message = 'Não foi possível finalizar o MP4.';
      try { message = (await response.json()).error || message; } catch (_) {}
      throw new Error(message);
    }
    const mp4 = await response.blob();
    if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = URL.createObjectURL(mp4);
    $('resultVideo').src = activeAudioUrl;
    $('download').href = activeAudioUrl;
    $('result').style.display = 'block';
    status('Vídeo MP4 finalizado. Um crédito foi consumido.', 'ok');
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } finally {
    if (recordingStarted && recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch (_) {}
    }
    if (canvasStream) canvasStream.getTracks().forEach(track => track.stop());
    try { source.stop(); } catch (_) {}
    try { source.disconnect(); } catch (_) {}
    try { analyser.disconnect(); } catch (_) {}
    if (window.avatarStudioStartAnimation) window.avatarStudioStartAnimation(null);
    if (context.state !== 'closed') await context.close();
  }
}
window.avatarStudioRender = { renderVideo, recordAndUpload, status };
const oldButton = $('generate');
if (oldButton) {
  const freshButton = oldButton.cloneNode(true);
  oldButton.replaceWith(freshButton);
  freshButton.addEventListener('click', async () => {
    freshButton.disabled = true;
    $('result').style.display = 'none';
    try { await renderVideo(); }
    catch (error) { status(error.message || 'Erro na renderização.', 'error'); }
    finally { freshButton.disabled = false; }
  });
}
const voiceSelect = $('voiceSelect');
if (voiceSelect) {
  voiceSelect.innerHTML = '';
  [['pf_dora','Dora — feminina (PT-BR)'],['pm_alex','Alex — masculina (PT-BR)'],['pm_santa','Santa — masculina (PT-BR)']].forEach(([id,label]) => {
    const option = document.createElement('option');
    option.value = id; option.textContent = label + ' (modelo local)';
    voiceSelect.appendChild(option);
  });
}
const testButton = $('testVoice');
if (testButton) testButton.addEventListener('click', async () => {
  try {
    const text = $('scriptText').value.trim();
    if (!text) throw new Error('Digite um texto curto para testar.');
    const tts = await loadLocalTTS();
    const audio = await tts.generate(text.slice(0, 250), { voice: voiceSelect.value || 'pf_dora' });
    const context = new AudioContext();
    const source = context.createBufferSource();
    source.buffer = rawAudioToBuffer(audio, context);
    source.connect(context.destination); source.start();
    status('Reproduzindo voz sintetizada localmente.', 'ok');
    source.onended = () => context.close();
  } catch (error) { status(error.message, 'error'); }
});
