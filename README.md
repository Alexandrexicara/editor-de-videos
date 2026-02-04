# Rolezando Avatar Editor 🎬🤖

Sistema completo de edição de vídeo com avatar interativo 3D que extrai o áudio do vídeo original e cria um avatar animado que fala sincronizado.

## 🔥 Recursos Principais

- **Extração de áudio automática** do vídeo enviado 🔥
- **Avatar 3D interativo** com animações em tempo real
- **Processamento completo** de vídeo com avatar falante
- **Interface moderna** e responsiva
- **Download do vídeo final** processado

## 📁 Estrutura do Projeto

```
editor-video/
├── backend/
│   ├── server.js          # Servidor Express
│   ├── processVideo.js    # Processamento principal
│   └── config.js          # Configurações do sistema
├── frontend/
│   ├── index.html         # Interface principal
│   └── main.js            # Lógica frontend + Three.js
├── uploads/               # Arquivos enviados
├── outputs/               # Vídeos processados
├── temp/                  # Arquivos temporários
├── package.json           # Dependências
└── README.md              # Esta documentação
```

## 🚀 Como Usar

### 1. Instalação

```bash
# Clonar ou baixar o projeto
cd editor-video

# Instalar dependências
npm install
```

### 2. Configuração

Edite `backend/config.js` para ajustar as configurações:

```javascript
module.exports = {
  usarAudioDoVideo: true,   // 🔥 Extrai áudio do vídeo original
  usarAudioExterno: false,  // Usa áudio externo (opcional)
  qualidadeVideo: 'high',   // Qualidade do processamento
  porta: 3000               // Porta do servidor
}
```

### 3. Executar

```bash
# Iniciar servidor
npm start

# Ou em modo desenvolvimento
npm run dev
```

### 4. Acessar

Abra seu navegador em: `http://localhost:3000`

## 🎯 Funcionalidades

### Frontend (frontend/)
- Interface moderna com Three.js para avatar 3D
- Preview de vídeos em tempo real
- Seleção de diferentes tipos de avatar
- Barra de progresso do processamento
- Download do vídeo final

### Backend (backend/)
- Upload de vídeos via Multer
- Processamento automático com FFmpeg
- Extração de áudio 🔥
- Transcrição de voz (simulada)
- Geração de animação do avatar
- Renderização do vídeo final

## ⚙️ Requisitos

- Node.js >= 14.0.0
- FFmpeg instalado no sistema
- Navegador moderno com suporte a WebGL

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript, Three.js
- **Backend**: Node.js, Express, Multer
- **Processamento**: FFmpeg
- **Armazenamento**: Sistema de arquivos local

## 🔧 Endpoints da API

- `POST /upload` - Upload e processamento de vídeo
- `GET /download/:filename` - Download do vídeo processado
- `GET /status` - Status do servidor
- `GET /videos` - Listar vídeos processados

## 📝 Exemplo de Uso

```javascript
// Upload via formulário HTML
<form action="http://localhost:3000/upload" method="post" enctype="multipart/form-data">
  <input type="file" name="video" accept="video/*" required />
  <button type="submit">Processar Vídeo</button>
</form>
```

## 🎨 Personalização

### Tipos de Avatar
- **Padrão**: Avatar roxo (#7b5cff)
- **Robô**: Azul metálico (#4a90e2)
- **Humano**: Pele realista (#ffdbac)
- **Cartoon**: Estilo animado (#ff6b6b)

### Cores do Sistema
```css
--bg: #0b0b0e          /* Fundo escuro */
--card: #14141a        /* Cards */
--primary: #7b5cff     /* Cor principal (roxa) */
--text: #ffffff        /* Texto */
--muted: #b3b3b3       /* Texto secundário */
```

## 🚨 Problemas Comuns

### FFmpeg não encontrado
Instale o FFmpeg no seu sistema:
- **Windows**: Baixe em https://ffmpeg.org/download.html
- **Linux**: `sudo apt install ffmpeg`
- **Mac**: `brew install ffmpeg`

### Erro de CORS
Verifique se o `cors()` está habilitado no `server.js`

## 📄 Licença

MIT License - Veja o arquivo LICENSE para detalhes

## 👨‍💻 Autor

**Célio Santos Silva** - Desenvolvedor Full Stack

---

💡 **Dica**: O sistema usa a configuração 🔥 `usarAudioDoVideo: true` por padrão, extraindo automaticamente o áudio do vídeo original para sincronizar com o avatar!