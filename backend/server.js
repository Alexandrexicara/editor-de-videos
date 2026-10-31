// server.js - Servidor Express para processamento de vídeos

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { processVideo } = require('./processVideo');
const config = require('./config');
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
    await billing.recordProcessedVideo(req.user.id, path.basename(resultPath), videoFile.originalname);
    await billing.completeVideoCredit(creditReservation);
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
app.use('/outputs', billing.requireAuth, express.static(path.join(__dirname, '../outputs')));
app.use(express.static(path.join(__dirname, '../frontend')));

// Cadastro, login, sessão, carteira e pagamentos são registrados em backend/billing.js.

// Rotas

// Rota principal - servir o frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/avatar-config.html'));
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

// Rota para verificar status do servidor
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Servidor Rolezando Avatar funcionando!',
    config: {
      usarAudioDoVideo: config.usarAudioDoVideo,
      porta: config.porta,
      host: config.host
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
app.get('/api/storage-stats', (req, res) => {
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
app.post('/api/cleanup', (req, res) => {
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
  ║  Host: ${config.host}                  ║
  ║  Áudio do vídeo: ${config.usarAudioDoVideo ? 'ATIVADO 🔥' : 'DESATIVADO'} ║
  ╚══════════════════════════════════════╝
  `);
  
  console.log(`📁 Diretórios configurados:`);
  console.log(`   Uploads: ${config.diretorios.uploads}`);
  console.log(`   Outputs: ${config.diretorios.outputs}`);
  console.log(`   Temp: ${config.diretorios.temporarios}`);
});