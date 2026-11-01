require('dotenv').config();

// server.js - Servidor Express para processamento de vídeos

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { processVideo } = require('./processVideo');
const config = require('./config');
const cineVoiceCatalog = require('./cineVoiceCatalog');
const StorageManager = require('./storageManager');
const { registerBilling } = require('./billing');

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determinar diretório baseado no tipo de arquivo
    if (file.fieldname === 'avatar1' || file.fieldname === 'avatar2') {
      cb(null, './avatars');
    } else if (file.fieldname === 'customAudio') {
      cb(null, './audios'); // Novo diretório para áudios personalizados
    } else {
      cb(null, config.diretorios.uploads);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // Limite de 100MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar vídeos, áudios e avatares personalizados
    if (file.fieldname === 'video' && file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else if (file.fieldname === 'customAudio' && file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else if ((file.fieldname === 'avatar1' || file.fieldname === 'avatar2') && 
               (file.mimetype.startsWith('image/') || 
                file.mimetype.startsWith('video/') ||
                file.mimetype === 'model/gltf-binary' ||
                file.mimetype === 'application/octet-stream')) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido!')); 
    }
  }
});

// Inicializar Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const billing = registerBilling(app);

// Rotas de upload (antes do static para evitar conflitos)
app.post('/upload', billing.requireAuth, upload.fields([
  { name: 'video', maxCount: 1 }, 
  { name: 'customAudio', maxCount: 1 },
  { name: 'avatar1', maxCount: 1 },
  { name: 'avatar2', maxCount: 1 }
 ]), async (req, res) => {
  let creditReservation = null;
  try {
    const videoFile = req.files?.video?.[0];
    const audioFile = req.files?.customAudio?.[0];
    const avatarFile1 = req.files?.avatar1?.[0];
    const avatarFile2 = req.files?.avatar2?.[0];
    
    if (!videoFile) {
      return res.status(400).json({ 
        error: 'Nenhum vídeo enviado!' 
      });
    }

    console.log('📥 Arquivo(s) recebido(s):');
    if (videoFile) console.log('  Vídeo:', videoFile.originalname);
    if (audioFile) console.log('  Áudio:', audioFile.originalname);
    if (avatarFile1) console.log('  Avatar 1:', avatarFile1.originalname);
    if (avatarFile2) console.log('  Avatar 2:', avatarFile2.originalname);
    
    // Obter configurações dos avatares
    const avatarConfigs = [];
    
    // Configuração do Avatar 1
    avatarConfigs.push({
      size: parseInt(req.body.avatarSize1) || 35,
      position: req.body.avatarPosition1 || 'top-right',
      margin: parseInt(req.body.avatarMargin1) || 15,
      offsetX: parseInt(req.body.avatarOffsetX1) || 0,
      offsetY: parseInt(req.body.avatarOffsetY1) || 0,
      useChromaKey: req.body.useChromaKey1 === 'true' || req.body.useChromaKey1 === true,
      chromaColor: req.body.chromaColor1 || 'green',
      chromaThreshold: parseFloat(req.body.chromaThreshold1) || 0.1,
      enableTiming: 'first' // Avatar 1 aparece na primeira metade
    });
    
    // Configuração do Avatar 2
    avatarConfigs.push({
      size: parseInt(req.body.avatarSize2) || 25,
      position: req.body.avatarPosition2 || 'bottom-left',
      margin: parseInt(req.body.avatarMargin2) || 15,
      offsetX: parseInt(req.body.avatarOffsetX2) || 0,
      offsetY: parseInt(req.body.avatarOffsetY2) || 0,
      useChromaKey: req.body.useChromaKey2 === 'true' || req.body.useChromaKey2 === true,
      chromaColor: req.body.chromaColor2 || 'green',
      chromaThreshold: parseFloat(req.body.chromaThreshold2) || 0.1,
      enableTiming: 'second' // Avatar 2 aparece na segunda metade
    });

    console.log('⚙️  Configurações dos Avatares:');
    avatarConfigs.forEach((config, index) => {
      console.log(`  Avatar ${index + 1}:`, config);
      console.log(`    Offset: X=${config.offsetX}px, Y=${config.offsetY}px`);
      console.log(`    Chroma Key: ${config.useChromaKey ? `SIM (${config.chromaColor}, threshold: ${config.chromaThreshold})` : 'NÃO'}`);
      console.log(`    Timing: ${config.enableTiming === 'first' ? 'PRIMEIRA METADE' : 'SEGUNDA METADE'}`);
    });
    
    // Verificar espaço em disco antes de processar
    try {
      storageManager.validateFileSize(videoFile.path);
    } catch (err) {
      return res.status(400).json({
        error: 'Arquivo muito grande',
        message: err.message
      });
    }
    
    // Checar espaço e reservar um crédito antes de iniciar o processamento.
    storageManager.checkAndCleanup();
    creditReservation = await billing.reserveVideoCredit(req.user.id);
    
    // Preparar lista de avatares
    const avatarPaths = [];
    if (avatarFile1) avatarPaths.push(avatarFile1.path);
    if (avatarFile2) avatarPaths.push(avatarFile2.path);
    
    // Processar o arquivo (vídeo ou áudio)
    const resultPath = await processVideo(
      videoFile.path, 
      audioFile?.path,
      avatarPaths,
      avatarConfigs
    );
    await billing.completeVideoCredit(creditReservation, path.basename(resultPath), videoFile.originalname);
    creditReservation = null;
    
    // Retornar sucesso com informações do arquivo processado
    res.json({
      status: 'processado',
      message: 'Arquivo processado com sucesso!',
      fileName: videoFile.filename,
      originalName: videoFile.originalname,
      outputPath: resultPath,
      downloadUrl: `/download/${path.basename(resultPath)}`
    });

  } catch (error) {
    if (creditReservation) {
      try { await billing.refundVideoCredit(creditReservation); }
      catch (refundError) { console.error('❌ Falha ao devolver crédito:', refundError); }
    }
    console.error('❌ Erro no processamento:', error);
    res.status(error.status || 500).json({
      error: 'Erro no processamento do arquivo',
      message: error.message
    });
  }
});

// Rota para upload de avatar personalizado 📤
app.post('/upload-avatar', billing.requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Nenhum avatar enviado!' 
      });
    }

    console.log('📤 Avatar personalizado recebido:', req.file.originalname);
    
    // Garantir diretório de avatares existe
    const avatarsDir = './avatars';
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }
    
    // Mover arquivo para diretório de avatares
    const avatarPath = path.join(avatarsDir, req.file.filename);
    fs.renameSync(req.file.path, avatarPath);
    
    res.json({
      status: 'avatar_recebido',
      message: 'Avatar personalizado enviado com sucesso!',
      fileName: req.file.filename,
      originalName: req.file.originalname,
      avatarPath: avatarPath
    });

  } catch (error) {
    console.error('❌ Erro no upload do avatar:', error);
    res.status(500).json({
      error: 'Erro no upload do avatar',
      message: error.message
    });
  }
});

// Servir arquivos estáticos
app.get('/outputs/:filename', billing.requireAuth, async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    if (filename !== req.params.filename || !(await billing.userOwnsVideo(req.user.id, filename))) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }
    res.sendFile(path.resolve(config.diretorios.outputs, filename));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao acessar vídeo.' });
  }
});
app.use(express.static(path.join(__dirname, '../frontend'), { index: false }));

// Cadastro, login, sessão, carteira e pagamentos são registrados em backend/billing.js.

// Rotas

// Rota principal - servir o frontend
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Rota para página antiga (compatibilidade)
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Rota para download do vídeo processado
app.get('/download/:filename', billing.requireAuth, async (req, res) => {
  try {
    const filename = req.params.filename;
    if (!(await billing.userOwnsVideo(req.user.id, filename))) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }
    const filePath = path.join(config.diretorios.outputs, filename);
    
    console.log(`📥 Requisição de download: ${filename}`);
    console.log(`📁 Caminho completo: ${filePath}`);
    console.log(`✅ Arquivo existe: ${fs.existsSync(filePath)}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Arquivo não encontrado: ${filePath}`);
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    console.log(`📦 Tamanho do arquivo: ${Math.round(fileSize / 1024 / 1024)} MB`);
    
    // Suportar range requests (para streaming melhorado)
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      if (start >= fileSize) {
        res.status(416).send('Range Not Satisfiable');
        return;
      }
      
      const chunksize = (end - start) + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunksize);
      res.setHeader('Content-Type', 'video/mp4');
      
      console.log(`📡 Streaming com range: ${start}-${end}/${fileSize}`);
      
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
      
      stream.on('error', (err) => {
        console.error('❌ Erro ao ler arquivo (range):', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Erro ao ler arquivo' });
        }
      });
    } else {
      // Resposta normal sem range
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Accept-Ranges', 'bytes');
      
      console.log(`📦 Enviando arquivo completo: ${filename}`);
      
      const fileStream = fs.createReadStream(filePath);
      
      fileStream.on('error', (err) => {
        console.error('❌ Erro ao ler arquivo:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Erro ao ler arquivo' });
        }
      });
      
      res.on('error', (err) => {
        console.error('❌ Erro ao enviar arquivo:', err);
        fileStream.destroy();
      });
      
      fileStream.pipe(res);
      
      fileStream.on('end', () => {
        console.log(`✅ Download concluído: ${filename}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao processar download:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro ao processar download', message: error.message });
    }
  }
});


/* Cine Séries — narração com voz pública ElevenLabs (PT-BR). */
const CINE_DEFAULT_VOICE_ID = 'GIuLCSVfgJaUuh7hYOY8';
const CINE_DEFAULT_VOICE_NAME = 'Lucas - Deep & Profound Narrator';

app.get('/api/cine/voices', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({ count: cineVoiceCatalog.length, voices: cineVoiceCatalog });
});

app.get('/api/cine/voice-config', (req, res) => {
  res.json({
    provider: 'ElevenLabs',
    voiceId: process.env.ELEVENLABS_VOICE_ID || CINE_DEFAULT_VOICE_ID,
    voiceName: CINE_DEFAULT_VOICE_NAME,
    language: 'pt-BR',
    configured: Boolean(process.env.ELEVENLABS_API_KEY)
  });
});

app.post('/api/cine/voice', billing.requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Configure ELEVENLABS_API_KEY nas variáveis privadas do servidor.' });
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Digite o texto que deseja transformar em voz.' });
    if (text.length > 5000) return res.status(400).json({ error: 'O texto pode ter no máximo 5.000 caracteres por geração.' });

    const requestedVoiceId = String(req.body?.voiceId || process.env.ELEVENLABS_VOICE_ID || CINE_DEFAULT_VOICE_ID);
    const voiceId = cineVoiceCatalog.some(voice => voice.id === requestedVoiceId) ? requestedVoiceId : CINE_DEFAULT_VOICE_ID;
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId) + '?output_format=mp3_44100_128', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.48, similarity_boost: 0.78, style: 0.25, use_speaker_boost: true }
      }),
      signal: AbortSignal.timeout(90000)
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error('ElevenLabs TTS error:', response.status, detail.slice(0, 500));
      return res.status(response.status === 401 ? 503 : 502).json({
        error: response.status === 401
          ? 'A chave da ElevenLabs foi recusada. Confira ELEVENLABS_API_KEY no servidor.'
          : 'A ElevenLabs não conseguiu gerar o áudio. Verifique os créditos e os limites da conta.'
      });
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Cine-Voice-Id', voiceId);
    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Length', audio.length);
    res.send(audio);
  } catch (error) {
    console.error('Cine Séries voice generation error:', error);
    res.status(error.name === 'TimeoutError' ? 504 : 500).json({
      error: error.name === 'TimeoutError' ? 'A geração de voz demorou demais. Tente novamente.' : 'Erro ao gerar a narração.'
    });
  }
});


app.post('/api/cine/sound-effect', billing.requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Configure ELEVENLABS_API_KEY nas variáveis privadas do servidor.' });
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'Descreva o som que deseja gerar.' });
    if (prompt.length > 1000) return res.status(400).json({ error: 'A descrição pode ter no máximo 1.000 caracteres.' });
    const duration = Math.min(30, Math.max(0.5, Number(req.body?.durationSeconds) || 5));
    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({
        text: prompt,
        model_id: 'eleven_text_to_sound_v2',
        duration_seconds: duration,
        prompt_influence: 0.45,
        loop: req.body?.loop === true
      }),
      signal: AbortSignal.timeout(90000)
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error('ElevenLabs SFX error:', response.status, detail.slice(0, 500));
      return res.status(response.status === 401 ? 503 : 502).json({
        error: response.status === 401 ? 'A chave da ElevenLabs foi recusada.' : 'A ElevenLabs não conseguiu gerar o efeito. Verifique os créditos e limites da conta.'
      });
    }
    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Content-Length', audio.length);
    res.setHeader('Cache-Control', 'no-store');
    res.send(audio);
  } catch (error) {
    console.error('Cine Séries sound effect error:', error);
    res.status(error.name === 'TimeoutError' ? 504 : 500).json({ error: error.name === 'TimeoutError' ? 'A geração do efeito demorou demais.' : 'Erro ao gerar o efeito sonoro.' });
  }
});


/* Cine Séries — geração de imagens e continuidade visual com NVIDIA NIM. */
app.get('/api/cine/image-config', (req, res) => {
  res.json({ provider: 'NVIDIA NIM', model: process.env.NVIDIA_IMAGE_MODEL || 'black-forest-labs/flux.2-klein-4b', configured: Boolean(process.env.NVIDIA_API_KEY) });
});

app.post('/api/cine/image', billing.requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Configure NVIDIA_API_KEY nas variáveis privadas do servidor para ativar a geração de imagens.' });
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'A descrição da cena está vazia.' });
    if (prompt.length > 10000) return res.status(400).json({ error: 'A descrição pode ter no máximo 10.000 caracteres.' });

    const rawImages = Array.isArray(req.body?.referenceImages) ? req.body.referenceImages : [];
    if (rawImages.length > 8) return res.status(400).json({ error: 'Use no máximo 8 imagens de referência por cena.' });
    const images = rawImages.map((value) => {
      const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(value || ''));
      if (!match) throw Object.assign(new Error('Uma imagem de referência está em formato inválido.'), { status: 400 });
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw Object.assign(new Error('Cada imagem de referência deve ter até 5 MB.'), { status: 400 });
      return { mime: match[1], bytes };
    });

    const model = process.env.NVIDIA_IMAGE_MODEL || 'black-forest-labs/flux.2-klein-4b';
    const endpoint = images.length
      ? 'https://ai.api.nvidia.com/v1/images/edits'
      : 'https://ai.api.nvidia.com/v1/images/generations';
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('n', '1');
    form.append('response_format', 'b64_json');
    images.forEach((item, index) => {
      const ext = item.mime === 'image/png' ? 'png' : item.mime === 'image/webp' ? 'webp' : 'jpg';
      form.append('image', new Blob([item.bytes], { type: item.mime }), 'reference-' + (index + 1) + '.' + ext);
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
      body: form,
      signal: AbortSignal.timeout(180000)
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error('NVIDIA image generation error:', response.status, detail.slice(0, 700));
      return res.status(response.status === 401 || response.status === 403 ? 503 : 502).json({
        error: response.status === 401 || response.status === 403
          ? 'A NVIDIA recusou a chave ou o acesso ao modelo. Confira NVIDIA_API_KEY e a disponibilidade do modelo na sua conta.'
          : 'A NVIDIA não conseguiu gerar a imagem. Confira os limites, créditos e disponibilidade do modelo.'
      });
    }
    const result = await response.json();
    const encoded = result?.data?.[0]?.b64_json || result?.artifacts?.[0]?.base64;
    if (!encoded) {
      console.error('NVIDIA image response missing image data:', JSON.stringify(result).slice(0, 700));
      return res.status(502).json({ error: 'A NVIDIA respondeu, mas não retornou os dados da imagem.' });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ image: 'data:image/png;base64,' + encoded, model, provider: 'NVIDIA NIM' });
  } catch (error) {
    console.error('Cine Séries NVIDIA image error:', error);
    res.status(error.status || (error.name === 'TimeoutError' ? 504 : 500)).json({
      error: error.status ? error.message : error.name === 'TimeoutError' ? 'A geração da imagem demorou demais. Tente novamente.' : 'Erro ao gerar a imagem da cena.'
    });
  }
});

// Rota para verificar status do servidor
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Servidor Rolezando Avatar funcionando!',
    config: {
      usarAudioDoVideo: config.usarAudioDoVideo,
      porta: Number(process.env.PORT || config.porta),
      host: process.env.HOST || '0.0.0.0'
    }
  });
});

// Rota para listar vídeos processados
app.get('/videos', billing.requireAuth, async (req, res) => {
  try {
    const videos = await billing.listUserVideos(req.user.id);
    res.json({ videos, count: videos.length });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar vídeos', message: error.message });
  }
});

// Rota para monitorar espaço em disco e estatísticas de armazenamento
app.get('/api/storage-stats', billing.requireAuth, (req, res) => {
  try {
    const stats = storageManager.getStorageStats();
    res.json({
      status: 'ok',
      storage: stats,
      settings: {
        maxOutputAgeDays: storageManager.settings.MAX_OUTPUT_AGE_DAYS,
        maxTempAgeHours: storageManager.settings.MAX_TEMP_AGE_HOURS,
        minFreeSpaceMB: storageManager.settings.MIN_FREE_SPACE_MB,
        maxVideoSizeMB: storageManager.settings.MAX_VIDEO_SIZE_MB
      }
    });
  } catch (err) {
    res.status(500).json({
      error: 'Erro ao obter estatísticas',
      message: err.message
    });
  }
});

// Rota para triggerar limpeza manual
app.post('/api/cleanup', billing.requireAdmin, (req, res) => {
  try {
    console.log('🧹 Limpeza manual iniciada');
    storageManager.performPreventiveCleanup();
    
    const stats = storageManager.getStorageStats();
    res.json({
      status: 'limpeza_concluida',
      message: 'Limpeza de arquivos antigos concluída',
      storage: stats
    });
  } catch (err) {
    res.status(500).json({
      error: 'Erro ao executar limpeza',
      message: err.message
    });
  }
});


// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Arquivo muito grande!',
        message: 'O tamanho máximo permitido é 100MB.'
      });
    }
  }
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: error.message
  });
});

// Iniciar servidor
const PORT = Number(process.env.PORT || config.porta || 3000);

// Inicializar Storage Manager para gerenciar espaço em disco
const storageManager = new StorageManager(config);
storageManager.startMonitoring(30); // Verificar a cada 30 minutos

app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║    🚀 SERVIDOR ROLEZANDO AVATAR     ║
  ║                                     ║
  ║  Status: ONLINE                     ║
  ║  Porta: ${PORT}                           ║
  ║  Host: ${process.env.HOST || '0.0.0.0'}                  ║
  ║  Áudio do vídeo: ${config.usarAudioDoVideo ? 'ATIVADO 🔥' : 'DESATIVADO'} ║
  ╚══════════════════════════════════════╝
  `);
  
  console.log(`📁 Diretórios configurados:`);
  console.log(`   Uploads: ${config.diretorios.uploads}`);
  console.log(`   Outputs: ${config.diretorios.outputs}`);
  console.log(`   Temp: ${config.diretorios.temporarios}`);
});