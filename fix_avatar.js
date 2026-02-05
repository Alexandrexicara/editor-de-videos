const fs = require('fs');

// Read the processVideo.js file
let content = fs.readFileSync('backend/processVideo.js', 'utf8');

// Remove the problematic chromakey sections
content = content.replace(
    /\} else if \(isAvatarVideo && !isAlreadyProcessed\) \{[\s\S]*?\} else if \(isAvatarVideo && isAlreadyProcessed\) \{[\s\S]*?\}/,
    '} else if (isAvatarVideo) {\n' +
    '                    // Para vídeo de avatar - usar diretamente sem chroma key\n' +
    '                    // Assumimos que o usuário já removeu o fundo conforme desejava\n' +
    '                    filterComplex = `[1:v]scale=iw*${sizePercent}:ih*${sizePercent}[avatar_scaled];` +\n' +
    '                                   `[0:v][avatar_scaled]overlay=${overlayX}:${overlayY}[out]`;\n' +
    '                    console.log("🎥 Vídeo de avatar - usando diretamente sem chroma key");'
);

// Write the fixed content back
fs.writeFileSync('backend/processVideo.js', content);
console.log('✅ Correção aplicada com sucesso!');
console.log('📁 Arquivo processVideo.js atualizado');