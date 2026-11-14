const { exec } = require("child_process");
const fs = require("fs");
const config = require("./config");

console.log("🎬 MultiCam Music Studio - Juntando clipes no vídeo final...");

// Verificar se o arquivo clips.txt existe
if (!fs.existsSync("clips.txt")) {
  console.error("❌ Arquivo clips.txt não encontrado!");
  console.error("💡 Execute primeiro 'npm run switch' para criar os clipes");
  process.exit(1);
}

// Verificar se o diretório de saída existe
if (!fs.existsSync("output")) {
  fs.mkdirSync("output");
}

// Função para juntar os clipes com áudio
function mergeClipsWithAudio() {
  const outputFile = `${config.output.directory}/${config.output.finalVideo}`;
  
  console.log("🔄 Juntando clipes de vídeo...");
  console.log("🎤 Adicionando áudio sincronizado...");
  
  // Primeiro: juntar os clipes de vídeo
  const tempVideoFile = "output/temp_video.mp4";
  const mergeCommand = `ffmpeg -y -f concat -safe 0 -i clips.txt -c copy "${tempVideoFile}"`;
  
  console.log(`📹 Executando: ${mergeCommand}`);
  
  exec(mergeCommand, (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Erro ao juntar clipes de vídeo:", error.message);
      process.exitCode = 1;
      return;
    }
    
    console.log("✅ Clipes de vídeo juntados com sucesso!");
    
    // Segundo: adicionar áudio ao vídeo final
    if (fs.existsSync("output/audio.wav")) {
      console.log("🎤 Adicionando áudio ao vídeo final...");
      
      const finalCommand = `ffmpeg -y -i "${tempVideoFile}" -i "output/audio.wav" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${outputFile}"`;
      
      console.log(`🎵 Executando: ${finalCommand}`);
      
      exec(finalCommand, (error, stdout, stderr) => {
        if (error) {
          console.error("❌ Erro ao adicionar áudio:", error.message);
          process.exitCode = 1;
          return;
        }
        
        console.log("✅ Áudio adicionado com sucesso!");
        cleanup(tempVideoFile);
      });
    } else {
      console.log("⚠️ Arquivo de áudio não encontrado. Usando apenas vídeo...");
      
      // Mover o vídeo temporário para o arquivo final
      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      fs.renameSync(tempVideoFile, outputFile);
      console.log("✅ Vídeo final criado sem áudio!");
      showResults(outputFile);
    }
  });
}

// Função para limpar arquivos temporários
function cleanup(tempFile) {
  try {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
      console.log("🧹 Arquivo temporário removido");
    }
    
    const outputFile = `${config.output.directory}/${config.output.finalVideo}`;
    showResults(outputFile);
    
  } catch (error) {
    console.error("⚠️ Erro ao limpar arquivos temporários:", error.message);
  }
}

// Função para mostrar resultados finais
function showResults(outputFile) {
  console.log("\n🎉 VÍDEO FINAL CRIADO COM SUCESSO!");
  console.log("📁 Arquivo:", outputFile);
  
  // Verificar tamanho do arquivo
  const stats = fs.statSync(outputFile);
  const fileSize = (stats.size / (1024 * 1024)).toFixed(2);
  console.log("💾 Tamanho:", fileSize, "MB");
  
  console.log("\n📋 Resumo do processo:");
  console.log("   ✅ Gravação das câmeras");
  console.log("   ✅ Corte automático por timeline");
  console.log("   ✅ Junção dos clipes");
  console.log("   ✅ Sincronização de áudio");
  
  console.log("\n🎬 Seu clipe musical está pronto!");
  console.log("💡 Dica: Você pode editar ainda mais no DaVinci Resolve ou Premiere Pro");
  
  // Mostrar comandos úteis
  console.log("\n🔧 Comandos úteis:");
  console.log("   npm run record  - Gravar novamente");
  console.log("   npm run switch  - Recortar clipes");
  console.log("   npm run merge   - Juntar vídeo final");
  console.log("   npm run start   - Executar tudo sequencialmente");
}

// Função alternativa: merge direto sem áudio separado
function mergeClipsDirect() {
  const outputFile = `${config.output.directory}/${config.output.finalVideo}`;
  
  console.log("🔄 Juntando clipes diretamente...");
  
  const command = `ffmpeg -y -f concat -safe 0 -i clips.txt -c:v libx264 -c:a aac -b:v ${config.recording.bitrate} -b:a ${config.audio.bitrate} -s ${config.recording.resolution} -r ${config.recording.fps} "${outputFile}"`;
  
  console.log(`📹 Executando: ${command}`);
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Erro ao juntar clipes:", error.message);
      process.exitCode = 1;
      return;
    }
    
    console.log("✅ Vídeo final criado com sucesso!");
    showResults(outputFile);
  });
}

// Verificar se existe áudio separado para decidir o método
if (fs.existsSync("output/audio.wav")) {
  console.log("🎤 Áudio separado encontrado. Usando método avançado...");
  mergeClipsWithAudio();
} else {
  console.log("📹 Nenhum áudio separado encontrado. Usando método direto...");
  mergeClipsDirect();
}

// Tratamento de erros globais
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não tratado:', error);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Interrompendo processo...');
  process.exit(0);
});
