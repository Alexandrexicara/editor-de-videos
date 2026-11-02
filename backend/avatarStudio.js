const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const billing = require('./billing');
const cineVoiceCatalog = require('./cineVoiceCatalog');
const { generateTalkingAvatar } = require('./processVideo');

const router = express.Router();
const root = path.resolve(__dirname, '..');
const avatarDir = path.join(root, 'avatars');
const audioDir = path.join(root, 'audios');
const outputDir = path.join(root, 'outputs');
const tempDir = path.join(root, 'temporarios');
[avatarDir, audioDir, outputDir, tempDir].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, file.fieldname === 'customAudio' ? audioDir : avatarDir),
    filename: (req, file, cb) => cb(null, 'studio-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + path.extname(file.originalname).toLowerCase())
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    const valid = file.fieldname === 'avatar'
      ? ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)
      : file.fieldname === 'customAudio' && file.mimetype.startsWith('audio/');
    cb(valid ? null : new Error('Envie uma imagem PNG/JPG/WEBP e um áudio válido.'), valid);
  }
});

router.post('/generate', billing.requireAuth, upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'customAudio', maxCount: 1 }
]), async (req, res) => {
  let generatedAudioPath = null;
  try {
    const avatarPath = req.files?.avatar?.[0]?.path;
    const customAudioPath = req.files?.customAudio?.[0]?.path;
    if (!avatarPath) return res.status(400).json({ error: 'Envie a imagem do avatar.' });

    let audioPath = customAudioPath;
    if (!audioPath) {
      const text = String(req.body?.text || '').trim();
      if (!text) return res.status(400).json({ error: 'Digite o texto ou envie sua própria gravação.' });
      if (text.length > 500) return res.status(400).json({ error: 'O texto pode ter no máximo 500 caracteres nesta versão.' });
      const requestedVoiceId = String(req.body?.voiceId || process.env.ELEVENLABS_VOICE_ID || 'GIuLCSVfgJaUuh7hYOY8');
      const voiceId = cineVoiceCatalog.some(voice => voice.id === requestedVoiceId && voice.language === 'pt')
        ? requestedVoiceId : 'GIuLCSVfgJaUuh7hYOY8';
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'A biblioteca de voz precisa da chave ELEVENLABS_API_KEY configurada no servidor.' });
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId) + '?output_format=mp3_44100_128', {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.48, similarity_boost: 0.78, style: 0.25, use_speaker_boost: true }
        }),
        signal: AbortSignal.timeout(90000)
      });
      if (!response.ok) {
        const detail = await response.text();
        console.error('Avatar Studio ElevenLabs error:', response.status, detail.slice(0, 400));
        return res.status(response.status === 401 ? 503 : 502).json({ error: 'A ElevenLabs não conseguiu gerar o áudio. Confira a chave, os créditos e os limites da conta.' });
      }
      generatedAudioPath = path.join(tempDir, 'studio-voice-' + Date.now() + '.mp3');
      fs.writeFileSync(generatedAudioPath, Buffer.from(await response.arrayBuffer()));
      audioPath = generatedAudioPath;
    }

    const checkpoint = path.join(__dirname, '..', 'Wav2Lip', 'checkpoints', 'wav2lip.pth');
    if (!process.env.SYNC_API_KEY && !fs.existsSync(checkpoint)) {
      return res.status(503).json({ error: 'A animação ainda não está ativada. Configure SYNC_API_KEY no Render para sincronizar a boca do personagem.' });
    }

    const outputPath = path.join(outputDir, 'avatar-studio-' + String(req.user.id).replace(/[^a-zA-Z0-9_-]/g, '') + '-' + Date.now() + '.mp4');
    const generatedPath = await generateTalkingAvatar(avatarPath, audioPath, outputPath);
    if (!generatedPath || path.extname(generatedPath).toLowerCase() !== '.mp4' || !fs.existsSync(generatedPath)) {
      return res.status(503).json({ error: 'A animação de vídeo não foi concluída. Verifique a configuração do SyncLabs.' });
    }
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'inline; filename="avatar-falante.mp4"');
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => {
      [avatarPath, customAudioPath].filter(Boolean).forEach(file => fs.promises.unlink(file).catch(() => {}));
    });
    res.sendFile(generatedPath);
  } catch (error) {
    console.error('Avatar Studio generation error:', error);
    if (!res.headersSent) res.status(error.status || 500).json({
      error: error.name === 'TimeoutError' ? 'A geração demorou demais. Tente novamente.' : 'Erro ao gerar o avatar falante: ' + String(error.message || 'falha interna').slice(0, 220)
    });
  } finally {
    if (generatedAudioPath) setTimeout(() => fs.promises.unlink(generatedAudioPath).catch(() => {}), 60000);
  }
});

module.exports = router;
