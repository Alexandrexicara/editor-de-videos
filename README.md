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

## 🎬 Cine Séries — geração de imagens NVIDIA

O estúdio de cenas usa NVIDIA NIM para gerar imagens cinematográficas. Sem imagens de referência, usa geração por texto; com referências cadastradas na biblioteca (personagens, figurinos e cenários), envia as imagens para edição com o modelo de imagem configurado.

Variáveis privadas do servidor (Render ou ambiente local):

- `NVIDIA_API_KEY`: chave da NVIDIA API Catalog. Nunca coloque a chave no frontend nem no Git.
- `NVIDIA_IMAGE_MODEL` (opcional): modelo de imagem; padrão `black-forest-labs/flux.2-klein-4b`.
- `NVIDIA_TEXT_MODEL` (opcional): modelo de texto para roteiros; padrão `meta/llama-3.3-70b-instruct`.
- `ELEVENLABS_API_KEY`: chave já utilizada para narração e efeitos sonoros.

Endpoints:
- `GET /api/cine/image-config`: informa se a NVIDIA está configurada.
- `POST /api/cine/image`: gera imagem de uma cena; aceita prompt e até 8 imagens de referência.
- `POST /api/cine/script`: cria roteiro estruturado com sinopse, cenas, diálogos, direção de câmera, som e notas de continuidade, considerando personagens e locações cadastrados.

A geração real depende de uma chave NVIDIA válida, acesso ao modelo e limites/créditos disponíveis na conta. A chave deve ser configurada nas variáveis privadas do serviço; ela não é armazenada no navegador nem no repositório.

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

## MCP (integração com assistentes de IA)

O projeto inclui um servidor MCP local para consultar o estado do editor, listar vídeos gerados, verificar armazenamento e acionar o processador existente com arquivos locais autorizados. Consulte [`MCP_SETUP.md`](MCP_SETUP.md) para instalação e configuração. A integração não altera o pipeline de voz nem oferece ações de exclusão.


## Carteira e pagamentos

A página `/conta.html` mostra saldo, pacotes em BRL/USD, pagamentos SumUp e histórico de créditos. Para configurar o ambiente e ativar os pagamentos, siga `BILLING_SETUP.md` e configure as variáveis privadas a partir de `.env.example`. O backend exige PostgreSQL e sessão autenticada para processar vídeos; um crédito é reservado e só é consumido após o vídeo ser concluído.


## Narração do Cine Séries com ElevenLabs

O Cine Séries inclui uma rota autenticada para gerar narração em MP3 usando a voz pública **Lucas — Deep & Profound Narrator** (PT-BR).

Configure no ambiente privado do servidor:
- `ELEVENLABS_API_KEY`: sua chave da ElevenLabs (não coloque no GitHub nem no frontend).
- `ELEVENLABS_VOICE_ID=GIuLCSVfgJaUuh7hYOY8`: ID da voz pública selecionada. Pode ser sobrescrito por variável de ambiente.

A interface envia o texto para `POST /api/cine/voice`; o backend chama a ElevenLabs e devolve o áudio. A rota exige sessão autenticada e limita cada texto a 5.000 caracteres. A configuração pública da voz pode ser consultada em `GET /api/cine/voice-config`, sem expor a chave privada.


## Biblioteca de áudio do Cine Séries

- Catálogo local com mais de 50 IDs de vozes públicas consultados na biblioteca ElevenLabs; nesta versão foram registrados 122 itens. A interface filtra por faixa etária/personagem, gênero e idioma, e identifica o idioma de cada voz.
- Vozes infantis/personagens são opções de TTS; sons de bebê (como choro e balbucio), animais, aves, Foley e ambientes são gerados como efeitos sonoros separados.
- `POST /api/cine/sound-effect` usa o endpoint oficial `/v1/sound-generation` com `eleven_text_to_sound_v2`, duração de 0,5 a 30 segundos e opção de loop.
- Efeitos com duração especificada custam aproximadamente 40 créditos por segundo segundo a documentação da ElevenLabs; por exemplo, 5 segundos custam cerca de 200 créditos. A conta ElevenLabs é cobrada diretamente pelo provedor.
- A biblioteca de vozes é servida por `GET /api/cine/voices`; geração de voz e efeitos exige sessão autenticada e `ELEVENLABS_API_KEY` no servidor.

### Biblioteca de áudio e associação a cenas

- Narrações e efeitos recém-gerados podem ser guardados na biblioteca local do navegador.
- Os arquivos de áudio são armazenados em IndexedDB; os metadados (tipo, nome, data e cena associada) ficam no rascunho local do Cine Séries.
- Cada item pode ser ouvido, baixado ou removido. É possível associar o áudio a uma cena existente.
- A exportação JSON v3 inclui o manifesto/metadados dos áudios, mas não incorpora os bytes dos arquivos. Baixe os áudios individualmente para fazer backup ou transferi-los para outro dispositivo.
- Limpar os dados do navegador pode apagar os arquivos locais. Ainda não há sincronização em nuvem.

### Continuidade visual de personagens e cenas

- O compositor de cenas permite vincular um episódio, uma locação cadastrada, vários personagens e várias imagens de referência.
- Cada cena salva uma fotografia dos dados visuais/de voz dos personagens selecionados e da descrição da locação, além das notas específicas de continuidade.
- As imagens referenciadas são identificadas na cena e continuam na biblioteca geral de imagens do projeto; o JSON exportado inclui os dados da biblioteca.
- Ao cadastrar/remover personagens, locações ou imagens, os seletores do compositor são atualizados.
- Isto prepara referências consistentes para futuras chamadas de IA; ainda não força automaticamente a mesma aparência em imagens/vídeos gerados, pois o pipeline de geração visual ainda não foi conectado.


### Roteirista IA NVIDIA
O Cine Séries inclui um roteirista NVIDIA NIM que recebe a ideia do episódio, sinopse da série, elenco e locações. Ele retorna cenas estruturadas com diálogos, emoção/intenção, câmera, som e notas de continuidade. O usuário pode revisar o JSON gerado, baixar o roteiro e importar as cenas para o storyboard. As falas ficam associadas às cenas para a próxima etapa de geração de vozes por personagem. O endpoint utiliza a API compatível com OpenAI da NVIDIA (`/v1/chat/completions`). A execução real depende de `NVIDIA_API_KEY`, acesso ao modelo escolhido e limites disponíveis na conta.


### Voz própria por personagem e geração de diálogos
- Cada personagem pode ter uma voz ElevenLabs específica, selecionada no catálogo público.
- A voz escolhida é gravada na ficha do personagem e copiada para as referências de continuidade das cenas e para o contexto do roteirista.
- Em uma cena com diálogos importados, use **Gerar todas as falas da cena**. O sistema gera cada fala separadamente, escolhe a voz do personagem correspondente e guarda cada MP3 na biblioteca local com personagem, emoção, voz e cena identificados.
- A geração é sequencial para reduzir falhas por excesso de chamadas; se uma fala falhar, as faixas já concluídas são preservadas.
- As emoções são mantidas como metadados do diálogo. A interpretação final também depende da capacidade da voz/modelo ElevenLabs selecionado; esta função ainda não monta automaticamente as faixas em uma linha do tempo nem sincroniza lábios.
