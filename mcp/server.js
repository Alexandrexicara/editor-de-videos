'use strict';

// MCP local do Rolezando Avatar Editor.
// O protocolo MCP usa stdout; logs do editor/FFmpeg devem ir para stderr.
console.log = (...args) => process.stderr.write(args.map(String).join(' ') + '\n');
console.info = console.log;
console.warn = (...args) => process.stderr.write('[WARN] ' + args.map(String).join(' ') + '\n');

const fs = require('fs');
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const PROJECT_ROOT = path.resolve(process.env.AVATAR_EDITOR_ROOT || path.join(__dirname, '..'));
process.chdir(PROJECT_ROOT);

const config = require('../backend/config');
const StorageManager = require('../backend/storageManager');

const resolveDir = (configuredPath) => path.resolve(PROJECT_ROOT, configuredPath);
const DIRS = {
  uploads: resolveDir(config.diretorios.uploads),
  outputs: resolveDir(config.diretorios.outputs),
  temp: resolveDir(config.diretorios.temporarios),
  avatars: path.join(PROJECT_ROOT, 'avatars'),
  audios: path.join(PROJECT_ROOT, 'audios')
};

function textResult(value) {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

function safeFile(directory, fileName, label) {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    throw new Error(label + ': informe o nome do arquivo.');
  }
  if (fileName !== path.basename(fileName) || fileName.includes('/') || fileName.includes('\\') || fileName === '.' || fileName === '..') {
    throw new Error(label + ': use somente o nome do arquivo, sem caminhos ou subpastas.');
  }

  const candidate = path.resolve(directory, fileName);
  const relative = path.relative(directory, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(label + ': caminho fora da pasta permitida.');
  }
  if (!fs.existsSync(candidate)) throw new Error(label + ': arquivo não encontrado na pasta permitida.');
  const realPath = fs.realpathSync(candidate);
  const realDirectory = fs.realpathSync(directory);
  const realRelative = path.relative(realDirectory, realPath);
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error(label + ': arquivo aponta para fora da pasta permitida.');
  }
  const stat = fs.statSync(realPath);
  if (!stat.isFile()) throw new Error(label + ': o caminho informado não é um arquivo.');
  return { path: realPath, size: stat.size };
}

function listMp4Files() {
  if (!fs.existsSync(DIRS.outputs)) return [];
  return fs.readdirSync(DIRS.outputs, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp4') && entry.name.includes('_final'))
    .map((entry) => {
      const fullPath = path.join(DIRS.outputs, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        file: entry.name,
        sizeMB: Number((stat.size / 1024 / 1024).toFixed(2)),
        modifiedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

const server = new McpServer({ name: 'rolezando-avatar-editor', version: '1.0.0' });

server.registerTool(
  'avatar_status',
  {
    description: 'Verifica o estado do MCP local, a configuração do editor e a existência das pastas de trabalho.',
    inputSchema: {}
  },
  async () => textResult({
    status: 'online',
    application: 'Rolezando Avatar Editor',
    mcp: 'stdio',
    projectRoot: PROJECT_ROOT,
    portConfigured: config.porta,
    audioFromVideoEnabled: Boolean(config.usarAudioDoVideo),
    directories: Object.fromEntries(Object.entries(DIRS).map(([name, dir]) => [name, { path: dir, exists: fs.existsSync(dir) }]))
  })
);

server.registerTool(
  'avatar_list_videos',
  {
    description: 'Lista vídeos finais MP4 já gerados na pasta outputs, sem alterar arquivos.',
    inputSchema: {}
  },
  async () => {
    const videos = listMp4Files();
    return textResult({ count: videos.length, videos });
  }
);

server.registerTool(
  'avatar_storage_stats',
  {
    description: 'Mostra estatísticas dos arquivos nas pastas de upload, saída e temporários. Não executa limpeza.',
    inputSchema: {}
  },
  async () => {
    const manager = new StorageManager(config);
    return textResult({
      storage: manager.getStorageStats(),
      retention: {
        maxOutputAgeDays: manager.settings.MAX_OUTPUT_AGE_DAYS,
        maxTempAgeHours: manager.settings.MAX_TEMP_AGE_HOURS,
        maxVideoSizeMB: manager.settings.MAX_VIDEO_SIZE_MB
      }
    });
  }
);

server.registerTool(
  'avatar_process_video',
  {
    description: 'Processa um vídeo que já esteja na pasta uploads usando o pipeline atual do editor. A execução pode consumir bastante CPU e disco. Informe apenas nomes de arquivos existentes; não aceita caminhos arbitrários. Arquivos de áudio devem estar em audios e avatares em avatars.',
    inputSchema: {
      video_file: z.string().min(1).describe('Nome do vídeo existente dentro de uploads.'),
      audio_file: z.string().optional().describe('Nome opcional do áudio dentro de audios.'),
      avatar_files: z.array(z.string().min(1)).max(2).optional().describe('Até dois nomes de imagens/vídeos de avatar dentro de avatars.'),
      avatar_position: z.enum([
        'top-left', 'top-center', 'top-right',
        'middle-left', 'middle-center', 'middle-right',
        'bottom-left', 'bottom-center', 'bottom-right'
      ]).optional().default('top-right'),
      avatar_size: z.number().int().min(5).max(80).optional().default(35)
    }
  },
  async ({ video_file, audio_file, avatar_files = [], avatar_position, avatar_size }) => {
    try {
      const video = safeFile(DIRS.uploads, video_file, 'Vídeo');
      const manager = new StorageManager(config);
      manager.validateFileSize(video.path);

      let audioPath;
      if (audio_file) {
        const audio = safeFile(DIRS.audios, audio_file, 'Áudio');
        if (audio.size > 100 * 1024 * 1024) throw new Error('Áudio excede o limite de 100 MB.');
        audioPath = audio.path;
      }

      const avatarPaths = avatar_files.map((name, index) => {
        const avatar = safeFile(DIRS.avatars, name, 'Avatar ' + (index + 1));
        if (avatar.size > 100 * 1024 * 1024) throw new Error('Avatar ' + (index + 1) + ' excede o limite de 100 MB.');
        return avatar.path;
      });

      const avatarConfigs = avatarPaths.map((_, index) => ({
        size: avatar_size,
        position: avatar_position,
        margin: 15,
        offsetX: 0,
        offsetY: 0,
        useChromaKey: false,
        chromaColor: 'green',
        chromaThreshold: 0.1,
        enableTiming: index === 0 ? 'first' : 'second'
      }));

      const { processVideo } = require('../backend/processVideo');
      const outputPath = await processVideo(video.path, audioPath, avatarPaths, avatarConfigs);
      const outputName = path.basename(outputPath);
      const finalFile = safeFile(DIRS.outputs, outputName, 'Vídeo final');

      return textResult({
        status: 'processed',
        message: 'Vídeo processado com sucesso.',
        file: outputName,
        sizeMB: Number((finalFile.size / 1024 / 1024).toFixed(2)),
        downloadPath: '/download/' + encodeURIComponent(outputName)
      });
    } catch (error) {
      return { ...textResult({ status: 'error', message: error.message }), isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('Rolezando Avatar Editor MCP conectado via stdio.\n');
}

main().catch((error) => {
  process.stderr.write('Falha ao iniciar MCP: ' + (error.stack || error.message) + '\n');
  process.exitCode = 1;
});
