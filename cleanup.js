const fs = require('fs');
const path = require('path');

const dirs = [
  { path: './outputs', label: 'Outputs' },
  { path: './temp', label: 'Temp' },
  { path: './uploads', label: 'Uploads' },
  { path: './audios', label: 'Audios' },
  { path: './avatars', label: 'Avatars' }
];

let totalFreedMB = 0;
let totalDeleted = 0;

console.log('\n🧹 LIMPEZA AGRESSIVA DE DISCO INICIADA...\n');

dirs.forEach(dir => {
  if (!fs.existsSync(dir.path)) {
    console.log(`📁 ${dir.label}: diretório não existe`);
    return;
  }

  const files = fs.readdirSync(dir.path);
  let dirFreed = 0;
  let dirDeleted = 0;

  files.forEach(file => {
    const filePath = path.join(dir.path, file);
    try {
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        const sizeMB = stats.size / 1024 / 1024;
        fs.unlinkSync(filePath);
        dirFreed += sizeMB;
        dirDeleted++;
        totalFreedMB += sizeMB;
        totalDeleted++;
        console.log(`  ✓ Deletado: ${file} (${sizeMB.toFixed(2)}MB)`);
      }
    } catch (err) {
      console.warn(`⚠️  Erro ao deletar ${file}: ${err.message}`);
    }
  });

  if (dirDeleted > 0) {
    console.log(`\n✅ ${dir.label}: ${dirDeleted} arquivo(s) removido(s) - ${dirFreed.toFixed(2)}MB liberado\n`);
  }
});

console.log('\n🎉 LIMPEZA CONCLUÍDA!');
console.log(`📊 Total: ${totalDeleted} arquivo(s) deletado(s)`);
console.log(`💾 Total liberado: ${totalFreedMB.toFixed(2)}MB`);
console.log(`\n✅ Disco agora tem espaço! Execute: npm start\n`);
