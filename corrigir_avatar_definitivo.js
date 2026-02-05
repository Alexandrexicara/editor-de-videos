// Script para corrigir o problema do avatar não aparecendo
const fs = require('fs');

console.log('🔧 Iniciando correção do problema do avatar...');

try {
    // Ler o arquivo original
    let content = fs.readFileSync('backend/processVideo.js', 'utf8');
    
    console.log('📄 Arquivo lido com sucesso');
    
    // Encontrar e substituir a seção problemática
    const problematicSection = /\} else if \(isAvatarVideo && !isAlreadyProcessed\) \{[\s\S]*?\} else if \(isAvatarVideo && isAlreadyProcessed\) \{/;
    
    const replacement = '} else if (isAvatarVideo) {\n' +
                       '                    // PARA VÍDEO DE AVATAR - USAR DIRETAMENTE SEM CHROMA KEY\n' +
                       '                    // Correção definitiva para o problema do avatar não aparecendo\n' +
                       '                    filterComplex = `[1:v]scale=iw*${sizePercent}:ih*${sizePercent}[avatar_scaled];` +\n' +
                       '                                   `[0:v][avatar_scaled]overlay=${overlayX}:${overlayY}[out]`;\n' +
                       '                    console.log("🎥 Vídeo de avatar - CORRIGIDO: usando diretamente sem chroma key");';
    
    // Aplicar a substituição
    const newContent = content.replace(problematicSection, replacement);
    
    // Verificar se a substituição foi bem sucedida
    if (newContent === content) {
        console.log('⚠️  Nenhuma substituição foi feita - padrão não encontrado');
        // Tentar uma abordagem alternativa
        const alternativePattern = /chromakey=color=0xFFFFFF:similarity=0\.12:blend=0\.08\[avatar_nobg\];/;
        const newContent2 = content.replace(alternativePattern, '');
        if (newContent2 !== content) {
            fs.writeFileSync('backend/processVideo.js', newContent2);
            console.log('✅ Correção alternativa aplicada com sucesso!');
        } else {
            console.log('❌ Não foi possível encontrar o padrão para substituir');
        }
    } else {
        // Escrever o conteúdo corrigido
        fs.writeFileSync('backend/processVideo.js', newContent);
        console.log('✅ Correção principal aplicada com sucesso!');
    }
    
    console.log('✅ Correção concluída! O avatar deve aparecer corretamente agora.');
    
} catch (error) {
    console.error('❌ Erro durante a correção:', error.message);
}