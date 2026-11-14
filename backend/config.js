// config.js - Configurações do sistema

module.exports = {
  // Configurações de áudio 🔥
  usarAudioDoVideo: true,   // Usa o áudio original do vídeo
  usarAudioExterno: false,  // Opção para áudio externo
  
  // Configurações de processamento
  qualidadeVideo: 'high',     // 'low', 'medium', 'high'
  fps: 30,                   // Frames por segundo
  resolucao: '1080p',        // Resolução do vídeo final
  
  // Configurações do avatar
  avatar: {
    tipo: 'default',         // 'default', 'robot', 'human', 'cartoon'
    animacao: true,          // Habilita animações
    expressoes: true         // Habilita expressões faciais
  },
  
  // Diretórios
  diretorios: {
    uploads: './uploads',
    outputs: './outputs',
    temporarios: './temp'
  },
  
  // API
  porta: Number(process.env.PORT) || 3001,
  host: process.env.HOST || '0.0.0.0'
}