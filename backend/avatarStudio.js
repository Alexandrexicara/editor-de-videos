const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetchTTS = require('node-fetch');
const cineVoiceCatalog = require('./cineVoiceCatalog');

module.exports = function createAvatarStudioRouter(billing) {
  const router = express.Router();
  const root = path.resolve(__dirname, '..');
  const avatarDir = path.join(root, 'avatars');
  const audioDir = path.join(root, 'audios');
  const outputDir = path.join(root, 'outputs');
  const tempDir = path.join(root, 'temp');
  [avatarDir, audioDir, outputDir, tempDir].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, file.fieldname === 'customAudio' ? audioDir : avatarDir),
      filename: (req, file, cb) => cb(null, 'studio-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + path.extname(file.originalname).toLowerCase())
    }),
    limits: { fileSize: 105 * 1024 * 1024, files: 2 },
    fileFilter: (req, file, cb) => {
      const valid = file.fieldname === 'avatar'
        ? ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)
        : file.fieldname === 'customAudio' && file.mimetype.startsWith('audio/');
      cb(valid ? null : new Error('Envie uma imagem PNG/JPG/WEBP e um áudio válido.'), valid);
    }
  });

  async function hedraRequest(url, options, timeout = 60000) {
    const response = await globalThis.fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: 'Key ' + process.env.HEDRA_API_KEY },
      signal: AbortSignal.timeout(timeout)
    });
    if (!response.ok) {
      const detail = await response.text();
      let message = detail.slice(0, 500);
      try { message = JSON.parse(detail)?.error?.message || JSON.parse(detail)?.message || message; } catch (_) {}
      const error = new Error(message || 'Hedra recusou a solicitação.');
      error.status = response.status === 402 ? 402 : response.status === 401 ? 503 : 502;
      throw error;
    }
    return response;
  }

  async function uploadMediaToHedra(filePath, mimeType, filename) {
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(filePath)], { type: mimeType }), filename);
    const response = await hedraRequest('https://api.hedra.com/v3/files', { method: 'POST', body: form }, 120000);
    const data = await response.json();
    if (!data.url) throw new Error('Hedra não retornou o endereço do arquivo enviado.');
    return data.url;
  }

  async function waitForHedraVideo(jobId) {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      const statusResponse = await hedraRequest('https://api.hedra.com/v3/jobs/' + encodeURIComponent(jobId) + '/status', { method: 'GET' }, 30000);
      const statusData = await statusResponse.json();
      if (statusData.status === 'FAILED') {
        const error = new Error(statusData.error?.message || 'Hedra não conseguiu animar o personagem.');
        error.providerFailed = true;
        throw error;
      }
      if (statusData.status === 'COMPLETED') {
        const resultResponse = await hedraRequest('https://api.hedra.com/v3/jobs/' + encodeURIComponent(jobId), { method: 'GET' }, 30000);
        const result = await resultResponse.json();
        const output = (result.outputs || []).find(item => item.status === 'COMPLETED' && item.url);
        if (!output) throw new Error('Hedra concluiu o trabalho, mas não forneceu o vídeo para download.');
        return output.url;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    const error = new Error('O avatar ainda está sendo processado pela Hedra. O crédito ficou reservado para evitar cobrança duplicada; aguarde antes de tentar novamente.');
    error.providerPending = true;
    throw error;
  }

  router.post('/generate', billing.requireAuth, upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'customAudio', maxCount: 1 }
  ]), async (req, res) => {
    let generatedAudioPath = null;
    let creditReservation = null;
    let creditCompleted = false;
    let providerJobAccepted = false;
    let providerFailed = false;
    const uploadedPaths = [req.files?.avatar?.[0]?.path, req.files?.customAudio?.[0]?.path].filter(Boolean);
    res.on('finish', () => uploadedPaths.forEach(file => fs.promises.unlink(file).catch(() => {})));

    try {
      const avatar = req.files?.avatar?.[0];
      const customAudio = req.files?.customAudio?.[0];
      if (!avatar) return res.status(400).json({ error: 'Envie a imagem do avatar.' });
      if (avatar.size > 10 * 1024 * 1024) return res.status(400).json({ error: 'A imagem do avatar deve ter no máximo 10 MB.' });
      if (customAudio && customAudio.size > 100 * 1024 * 1024) return res.status(400).json({ error: 'O áudio deve ter no máximo 100 MB.' });

      const apiKey = process.env.HEDRA_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'Configure HEDRA_API_KEY nas variáveis privadas do Render para ativar gestos, expressões e animação do avatar.' });

      let audioPath = customAudio?.path || null;
      if (!audioPath) {
        const text = String(req.body?.text || '').trim();
        if (!text) return res.status(400).json({ error: 'Digite o texto ou envie sua própria gravação.' });
        if (text.length > 5000) return res.status(400).json({ error: 'O texto pode ter no máximo 5.000 caracteres.' });
        const requestedVoiceId = String(req.body?.voiceId || process.env.ELEVENLABS_VOICE_ID || 'GIuLCSVfgJaUuh7hYOY8');
        const voiceId = cineVoiceCatalog.some(voice => voice.id === requestedVoiceId && voice.language === 'pt')
          ? requestedVoiceId : 'GIuLCSVfgJaUuh7hYOY8';
        if (!process.env.ELEVENLABS_API_KEY) return res.status(503).json({ error: 'Configure ELEVENLABS_API_KEY para gerar a voz escolhida.' });
      }

      creditReservation = await billing.reserveVideoCredit(req.user.id);

      if (!audioPath) {
        const text = String(req.body.text).trim();
        const requestedVoiceId = String(req.body?.voiceId || process.env.ELEVENLABS_VOICE_ID || 'GIuLCSVfgJaUuh7hYOY8');
        const voiceId = cineVoiceCatalog.some(voice => voice.id === requestedVoiceId && voice.language === 'pt')
          ? requestedVoiceId : 'GIuLCSVfgJaUuh7hYOY8';
        const ttsResponse = await fetchTTS('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId) + '?output_format=mp3_44100_128', {
          method: 'POST',
          headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.48, similarity_boost: 0.78, style: 0.25, use_speaker_boost: true }
          }),
          signal: AbortSignal.timeout(90000)
        });
        if (!ttsResponse.ok) {
          const detail = await ttsResponse.text();
          console.error('Avatar Studio ElevenLabs error:', ttsResponse.status, detail.slice(0, 400));
          const error = new Error('A ElevenLabs não conseguiu gerar o áudio. Confira a chave, os créditos e os limites da conta.');
          error.status = ttsResponse.status === 401 ? 503 : 502;
          throw error;
        }
        generatedAudioPath = path.join(tempDir, 'studio-voice-' + Date.now() + '.mp3');
        fs.writeFileSync(generatedAudioPath, Buffer.from(await ttsResponse.arrayBuffer()));
        audioPath = generatedAudioPath;
      }

      const imageMime = avatar.mimetype;
      const imageUrl = await uploadMediaToHedra(avatar.path, imageMime, path.basename(avatar.path));
      const audioMime = customAudio?.mimetype || 'audio/mpeg';
      const audioUrl = await uploadMediaToHedra(audioPath, audioMime, path.basename(audioPath));

      const resolution = ['540p', '720p', '1080p'].includes(req.body?.resolution) ? req.body.resolution : '540p';
      const aspectRatio = ['9:16', '16:9', '1:1'].includes(req.body?.aspectRatio) ? req.body.aspectRatio : '9:16';
      const behavior = String(req.body?.behavior || 'Gesticula naturalmente com as mãos, mantém contato visual com a câmera, sorri de forma espontânea e usa expressões faciais naturais.').slice(0, 1200);
      const prompt = 'A personagem fala diretamente para a câmera, com sincronização labial precisa. ' + behavior + ' Preserve a identidade visual, o rosto, as roupas e a aparência da imagem de referência durante todo o vídeo.';

      const submitResponse = await hedraRequest('https://api.hedra.com/v3/models/hedra-character-3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio: aspectRatio,
            resolution,
            start_image: { source: 'url', url: imageUrl },
            audio: { source: 'url', url: audioUrl },
            num_outputs: 1
          }
        })
      }, 60000);
      const acknowledgement = await submitResponse.json();
      if (!acknowledgement.job_id) throw new Error('Hedra não retornou o identificador da geração.');
      providerJobAccepted = true;

      const videoUrl = await waitForHedraVideo(acknowledgement.job_id);
      const videoResponse = await globalThis.fetch(videoUrl, { signal: AbortSignal.timeout(120000) });
      if (!videoResponse.ok) throw new Error('Não foi possível baixar o vídeo final da Hedra.');
      const outputPath = path.join(outputDir, 'avatar-studio-' + String(req.user.id).replace(/[^a-zA-Z0-9_-]/g, '') + '-' + Date.now() + '.mp4');
      fs.writeFileSync(outputPath, Buffer.from(await videoResponse.arrayBuffer()));

      await billing.completeVideoCredit(creditReservation, path.basename(outputPath), 'Avatar Falante 3D');
      creditCompleted = true;
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'inline; filename="avatar-falante.mp4"');
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(outputPath);
    } catch (error) {
      providerFailed = error.providerFailed === true;
      console.error('Avatar Studio generation error:', error);
      if (!res.headersSent) res.status(error.status || (error.providerPending ? 202 : 500)).json({
        error: error.providerPending
          ? error.message
          : error.status === 402
            ? 'A carteira da Hedra está sem saldo. Adicione fundos à carteira de API da Hedra e tente novamente.'
            : error.name === 'TimeoutError'
              ? 'A geração demorou demais. Se o trabalho já foi enviado à Hedra, aguarde antes de tentar novamente.'
              : 'Erro ao gerar o avatar falante: ' + String(error.message || 'falha interna').slice(0, 220)
      });
    } finally {
      if (creditReservation && !creditCompleted && (!providerJobAccepted || providerFailed)) {
        try { await billing.refundVideoCredit(creditReservation); }
        catch (refundError) { console.error('Avatar Studio credit refund error:', refundError); }
      }
      if (generatedAudioPath) setTimeout(() => fs.promises.unlink(generatedAudioPath).catch(() => {}), 60000);
    }
  });

  return router;
};
