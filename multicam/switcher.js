const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const config = require("./config");

console.log("🔄 MultiCam Music Studio - Iniciando corte automático de clipes...");

// Garantir que diretório de clipes exista
if (!fs.existsSync("clips")) {
  fs.mkdirSync("clips");
}

// Array para armazenar os clipes criados
let clips = [];


// Função para criar cada clipe conforme a timeline
function createClip(scene, index) {
  const inputFile = config.cameras[scene.camera];
  const outputFile = `clips/clip${index}.mp4`;
  const duration = scene.end - scene.start;
  
  console.log(`📹 Criando clipe ${index + 1}:`);
  console.log(`   📂 Entrada: ${inputFile}`);
  console.log(`   ⏰ Início: ${scene.start}s`);
  console.log(`   ⏰ Fim: ${scene.end}s`);
  console.log(`   ⏱️  Duração: ${duration}s`);
  console.log(`   💾 Saída: ${outputFile}`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .setStartTime(scene.start)
      .setDuration(duration)
      .videoCodec('libx264')
      .audioCodec('aac')
      .videoBitrate(config.recording.bitrate)
      .audioBitrate(config.audio.bitrate)
      .size(config.recording.resolution)
      .fps(config.recording.fps)
      .on('start', (commandLine) => {
        console.log(`🚀 Processando clipe ${index + 1}...`);
      })
      .on('progress', (progress) => {
        console.log(`📊 Clipe ${index + 1}: ${Math.round(progress.percent)}% completo`);
      })
      .on('end', () => {
        console.log(`✅ Clipe ${index + 1} criado com sucesso!`);
        clips.push(outputFile);
        resolve(outputFile);
      })
      .on('error', (err) => {
        console.error(`❌ Erro ao criar clipe ${index + 1}:`, err.message);
        reject(err);
      })
      .save(outputFile);
  });
}

// Função para criar arquivo clips.txt para o merge
function createClipsFile() {
  const clipsContent = clips.map(clip => `file '${clip}'`).join('\n');
  
  fs.writeFileSync('clips.txt', clipsContent);
  console.log('📄 Arquivo clips.txt criado com sucesso!');
  console.log('📋 Conteúdo:');
  console.log(clipsContent);
}

// Função para verificar se os arquivos de câmera existem
function getAvailableScenes() {
  const manifestPath = 'recording-manifest.json';
  if (!fs.existsSync(manifestPath)) throw new Error('Manifesto de gravação não encontrado. Faça uma nova gravação antes de editar.');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (_) { throw new Error('Manifesto de gravação inválido. Faça uma nova gravação antes de editar.'); }
  const recordedIndexes = new Set((Array.isArray(manifest.cameras) ? manifest.cameras : []).map(camera => Number(camera.index) - 1));
  const available = [];
  config.timeline.forEach((scene, index) => {
    const cameraFile = config.cameras[scene.camera];
    if (!recordedIndexes.has(scene.camera)) {
      console.warn(`⚠️ Cena ${index + 1} ignorada: câmera ${scene.camera + 1} não pertence à gravação atual.`);
      return;
    }
    if (!cameraFile || !fs.existsSync(cameraFile)) {
      console.warn(`⚠️ Cena ${index + 1} ignorada: arquivo da câmera ${scene.camera + 1} não foi gravado.`);
      return;
    }
    if (!Number.isFinite(scene.start) || !Number.isFinite(scene.end) || scene.start < 0 || scene.end <= scene.start) {
      console.warn(`⚠️ Cena ${index + 1} ignorada: intervalo de tempo inválido.`);
      return;
    }
    available.push({ scene, originalIndex: index });
  });
  return available;
}

// Executar o processo
async function processTimeline() {
  try {
    console.log('🔍 Verificando arquivos de câmera...');
    const availableScenes = getAvailableScenes();
    if (availableScenes.length === 0) {
      throw new Error('Nenhuma cena pode ser processada. Grave ao menos uma câmera e confira a timeline.');
    }

    console.log(`📋 Processando ${availableScenes.length} cenas válidas da timeline...`);
    clips = [];
    for (let i = 0; i < availableScenes.length; i++) {
      await createClip(availableScenes[i].scene, i);
    }
    createClipsFile();
    console.log(`🎉 ${clips.length} clipe(s) criado(s) com sucesso!`);
    console.log("🔄 Próximo passo: execute 'npm run merge' para juntar os clipes no vídeo final");
    
  } catch (error) {
    console.error('❌ Erro no processamento:', error.message);
    process.exit(1);
  }
}

// Iniciar o processo
processTimeline();

// Tratamento de erros globais
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não tratado:', error);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Interrompendo processo...');
  process.exit(0);
});
