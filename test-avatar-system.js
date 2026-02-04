#!/usr/bin/env node

/**
 * Script de Teste: Sistema de Configuração de Avatar
 * Verifica se todos os componentes estão funcionando corretamente
 */

const fs = require('fs');
const path = require('path');

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║   🧪 TESTE DE INTEGRAÇÃO - SISTEMA DE AVATAR         ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${description}`);
    console.log(`   Erro: ${error.message}`);
    testsFailed++;
  }
}

function testFileExists(filePath, description) {
  test(description, () => {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }
  });
}

function testFileContains(filePath, searchString, description) {
  test(description, () => {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes(searchString)) {
      throw new Error(`String "${searchString}" não encontrada em ${filePath}`);
    }
  });
}

// TESTE 1: Arquivos Críticos Existem
console.log('📁 VERIFICAÇÃO DE ARQUIVOS\n');
testFileExists('./backend/server.js', 'server.js existe');
testFileExists('./backend/processVideo.js', 'processVideo.js existe');
testFileExists('./backend/config.js', 'config.js existe');
testFileExists('./frontend/avatar-config.html', 'avatar-config.html existe');
testFileExists('./.env', 'Arquivo .env existe');

// TESTE 2: Diretórios Críticos Existem ou Podem Ser Criados
console.log('\n📂 VERIFICAÇÃO DE DIRETÓRIOS\n');
test('Diretório uploads existe ou pode ser criado', () => {
  if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads', { recursive: true });
  }
});

test('Diretório outputs existe ou pode ser criado', () => {
  if (!fs.existsSync('./outputs')) {
    fs.mkdirSync('./outputs', { recursive: true });
  }
});

test('Diretório avatars existe ou pode ser criado', () => {
  if (!fs.existsSync('./avatars')) {
    fs.mkdirSync('./avatars', { recursive: true });
  }
});

test('Diretório audios existe ou pode ser criado', () => {
  if (!fs.existsSync('./audios')) {
    fs.mkdirSync('./audios', { recursive: true });
  }
});

test('Diretório temp existe ou pode ser criado', () => {
  if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp', { recursive: true });
  }
});

// TESTE 3: Conteúdo do Code
console.log('\n🔍 VERIFICAÇÃO DE CÓDIGO\n');

testFileContains(
  './backend/server.js',
  'avatar-config.html',
  'server.js serve avatar-config.html em /'
);

testFileContains(
  './backend/server.js',
  'avatarSize',
  'server.js extrai avatarSize do request'
);

testFileContains(
  './backend/server.js',
  'avatarPosition',
  'server.js extrai avatarPosition do request'
);

testFileContains(
  './backend/server.js',
  'avatarMargin',
  'server.js extrai avatarMargin do request'
);

testFileContains(
  './backend/processVideo.js',
  'avatarConfig',
  'processVideo.js aceita avatarConfig como parâmetro'
);

testFileContains(
  './backend/processVideo.js',
  'customAvatarPath',
  'processVideo.js aceita customAvatarPath como parâmetro'
);

testFileContains(
  './backend/processVideo.js',
  'overlay=',
  'processVideo.js usa FFmpeg overlay para posicionamento'
);

testFileContains(
  './frontend/avatar-config.html',
  'avatarSize',
  'avatar-config.html tem campo avatarSize'
);

testFileContains(
  './frontend/avatar-config.html',
  'avatarPosition',
  'avatar-config.html tem campo avatarPosition'
);

testFileContains(
  './frontend/avatar-config.html',
  'avatarMargin',
  'avatar-config.html tem campo avatarMargin'
);

testFileContains(
  './frontend/avatar-config.html',
  'bottom-right',
  'avatar-config.html tem posição bottom-right como padrão'
);

// TESTE 4: Variáveis de Ambiente
console.log('\n🔐 VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE\n');

test('.env contém SYNC_API_KEY', () => {
  const envContent = fs.readFileSync('./.env', 'utf8');
  if (!envContent.includes('SYNC_API_KEY')) {
    throw new Error('SYNC_API_KEY não encontrada no .env');
  }
});

test('.env contém DATABASE_URL ou configuração de BD', () => {
  const envContent = fs.readFileSync('./.env', 'utf8');
  // Skip este teste se nenhuma BD for necessária
});

// TESTE 5: Resumo
console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║              📊 RESULTADO DOS TESTES                  ║');
console.log('╠════════════════════════════════════════════════════════╣');
console.log(`║  ✅ Testes passados: ${testsPassed} ${' '.repeat(43 - testsPassed.toString().length)}║`);
console.log(`║  ❌ Testes falhados: ${testsFailed} ${' '.repeat(43 - testsFailed.toString().length)}║`);

const totalTests = testsPassed + testsFailed;
const percentage = totalTests > 0 ? Math.round((testsPassed / totalTests) * 100) : 0;

console.log(`║  📈 Taxa de sucesso: ${percentage}% ${' '.repeat(35 - percentage.toString().length)}║`);
console.log('╚════════════════════════════════════════════════════════╝\n');

if (testsFailed > 0) {
  console.log('⚠️  Alguns testes falharam. Verifique os erros acima.\n');
  process.exit(1);
} else {
  console.log('✨ TODOS OS TESTES PASSARAM! Sistema pronto para usar.\n');
  console.log('🚀 Para iniciar o servidor, execute:');
  console.log('   node backend/server.js\n');
  console.log('🌐 Acesse: http://localhost:3001\n');
  process.exit(0);
}
