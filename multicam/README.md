# 🎬 MultiCam Music Studio

Sistema pioneiro de gravação multicâmera automática para clipes musicais, desenvolvido em Node.js com FFmpeg.

## 🎯 Funcionalidades

- 🎥 **Gravação simultânea** de múltiplas câmeras
- 🎤 **Gravação de áudio** profissional com microfone
- 🔄 **Troca automática** de câmeras por tempo programado
- 💾 **Edição automática** do clipe musical final
- 🎛️ **Controle total** sobre duração de cada câmera
- 🌐 **Interface web** para controle remoto
- 📱 **Controle por celular** (opcional)
- 🎥 **Streaming ao vivo** (opcional)

## 📋 Requisitos

### Software Necessário

1. **Node.js** (versão 14 ou superior)
   - Download: https://nodejs.org

2. **FFmpeg** (obrigatório para processamento de vídeo)
   - Download: https://ffmpeg.org/download.html
   - Adicione ao PATH do sistema

### Hardware Recomendado

#### 🎥 Câmeras
- **Webcams HD** (mínimo 720p, preferencial 1080p)
- **Câmeras profissionais** com saída HDMI + placa de captura
- **Smartphones** (usando apps de câmera IP)

#### 🎤 Áudio
- **Microfone USB** (recomendado)
- **Microfone XLR** com interface de áudio
- **Microfone de lapela** sem fio

#### 💻 Computador
- **Processador**: Intel i5 ou AMD Ryzen 5 (superior recomendado)
- **Memória RAM**: 8GB (16GB recomendado)
- **Armazenamento**: SSD com espaço suficiente para vídeos

## 🚀 Instalação

1. **Clone ou baixe o projeto**
   ```bash
   cd multicam-music-studio
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure suas câmeras** no arquivo `config.js`

## ⚙️ Configuração

### Editando `config.js`

```javascript
module.exports = {
  // Dispositivos de câmera (ajuste conforme seu sistema)
  devices: [
    "video=Camera Frontal",
    "video=Camera Esquerda", 
    "video=Camera Direita",
    "video=Camera Superior"
  ],

  // Timeline de troca automática
  timeline: [
    { camera: 0, start: 0, end: 60 },    // 0-60s: Câmera frontal
    { camera: 1, start: 60, end: 120 },  // 60-120s: Câmera esquerda
    { camera: 2, start: 120, end: 180 }, // 120-180s: Câmera direita
    { camera: 0, start: 180, end: 240 }  // 180-240s: Câmera frontal
  ],

  // Configurações de gravação
  recording: {
    duration: 240,        // Duração total em segundos
    resolution: "1920x1080",
    fps: 30,
    bitrate: "5000k"
  },

  // Configurações de áudio
  audio: {
    device: "microphone=Microfone USB",
    sampleRate: 44100,
    bitrate: "192k",
    channels: 2
  }
};
```

### Descobrindo Dispositivos

Para listar seus dispositivos de vídeo e áudio no Windows:

```bash
# Listar dispositivos de vídeo
ffmpeg -f dshow -list_devices true -i dummy

# Listar dispositivos de áudio  
ffmpeg -f dshow -list_devices true -i dummy
```

## 🎬 Como Usar

### Modo Básico (Linha de Comando)

1. **Gravar todas as câmeras**
   ```bash
   npm run record
   ```

2. **Cortar clipes automaticamente**
   ```bash
   npm run switch
   ```

3. **Juntar no vídeo final**
   ```bash
   npm run merge
   ```

### Modo Automático (Executar Tudo)

```bash
npm run start
```

Este comando executa todos os passos sequencialmente.

### Modo Interface Gráfica

```bash
npm run gui
```

Acesse http://localhost:3000 para controlar pelo navegador.

### Modo Controle por Celular

1. Inicie o sistema no computador com `INICIAR-SISTEMA.bat`. O painel principal fica em `http://localhost:3000`; o servidor de controle remoto é iniciado em uma segunda janela na porta 3002.
2. No painel principal, configure cada posição com uma fonte USB diferente ou com o endereço HTTP/HTTPS/RTSP do celular/câmera IP.
3. Clique em **SALVAR CONFIGURAÇÃO**. Isso permite que o controle pelo celular use as mesmas fontes configuradas no computador.
4. No celular conectado à mesma rede Wi-Fi, abra `http://IP-DO-PC:3002`. A página usa um token de sessão gerado pelo servidor para proteger os comandos.
5. Para usar o próprio navegador do celular como câmera, execute `INICIAR-MOBILE.bat` e abra `http://IP-DO-PC:3001`. **Atenção:** navegadores móveis exigem HTTPS confiável para liberar câmera via `getUserMedia`; em HTTP por IP local, use uma câmera IP/RTSP (por exemplo, um app de câmera IP) ou configure HTTPS confiável.

### Gravação multicâmera

- O sistema não duplica mais uma webcam para fingir quatro câmeras.
- Cada posição selecionada é gravada em um processo FFmpeg independente, com seu próprio arquivo `cameras/camN.mp4`.
- O mesmo dispositivo USB não pode ser selecionado em duas posições. Use fontes físicas diferentes ou URLs IP diferentes.
- O botão de parar envia o comando de encerramento ao FFmpeg para finalizar os arquivos MP4.
- O microfone pode ser detectado e selecionado na interface; quando selecionado, o áudio é gravado em `output/audio.wav` pelo tempo total previsto na timeline e incluído na montagem final.
- O fluxo do controle remoto opera o mesmo servidor principal, evitando iniciar uma segunda gravação concorrente.

**Segurança:** o painel principal aceita conexões apenas do próprio computador. O controle remoto fica na rede local e exige token de sessão. Não exponha as portas do MultiCam diretamente à internet.

## 📁 Estrutura de Arquivos

```
multicam-music-studio/
├── package.json          # Dependências e scripts
├── config.js            # Configurações do sistema
├── record.js            # Gravação das câmeras
├── switcher.js          # Corte automático
├── merge.js             # Junção final
├── gui.js               # Interface gráfica
├── mobile-server.js     # Servidor para celular
├── stream.js            # Streaming ao vivo
├── clips.txt            # Lista de clipes para merge
├── README.md            # Este arquivo
├── cameras/             # Gravações individuais
│   ├── cam1.mp4
│   ├── cam2.mp4
│   └── cam3.mp4
├── clips/               # Clipes cortados
│   ├── clip0.mp4
│   ├── clip1.mp4
│   └── ...
└── output/              # Resultados finais
    ├── final.mp4
    └── audio.wav
```

## 🎛️ Controles da Interface Web

### Controles de Gravação
- **Start Recording**: Inicia gravação de todas as câmeras
- **Stop Recording**: Para gravação
- **Preview**: Visualização ao vivo das câmeras

### Timeline
- **Add Scene**: Adiciona nova cena à timeline
- **Edit**: Edita tempo e câmera de cada cena
- **Delete**: Remove cena da timeline
- **Play Preview**: Visualiza timeline programada

### Configurações
- **Camera Settings**: Configura resolução e FPS
- **Audio Settings**: Configura microfone e qualidade
- **Output Settings**: Define formato e qualidade final

## 🎥 Equipamentos Recomendados

### Câmeras (Nível Iniciante)
- **Logitech C920**: Webcam Full HD excelente
- **Microsoft LifeCam**: Boa opção custo-benefício

### Câmeras (Nível Profissional)
- **Sony A6400**: Excelente para vídeo
- **Canon M50**: Ótima qualidade de imagem
- **Blackmagic Pocket Cinema**: Cinema profissional

### Áudio
- **Blue Yeti**: Microfone USB profissional
- **Rode NT-USB**: Excelente qualidade de gravação
- **Focusrite Scarlett**: Interface de áudio para microfones XLR

### Iluminação
- **Ring Light Neewer**: Iluminação uniforme
- **Softbox Kit**: Iluminação profissional
- **LED Panel**: Controle preciso de luz

## 🔧 Solução de Problemas

### Erros Comuns

**"Dispositivo não encontrado"**
- Verifique se as câmeras estão conectadas
- Confirme o nome exato do dispositivo no config.js
- Use o comando `ffmpeg -f dshow -list_devices true -i dummy` para listar dispositivos

**"FFmpeg não encontrado"**
- Verifique se FFmpeg está instalado
- Confirme se está no PATH do sistema
- Reinicie o terminal após instalação

**"Arquivo corrompido"**
- Verifique espaço em disco
- Confirme permissões de escrita nas pastas
- Reduza a qualidade/bitrate se necessário

### Performance

**Para melhor performance:**
- Use SSD para armazenamento
- Feche outros programas durante gravação
- Reduza resolução se o computador for lento
- Use conexão USB 3.0 para câmeras

## 🚀 Funcionalidades Avançadas

### Streaming ao Vivo

Configure em `config.js`:

```javascript
streaming: {
  enabled: true,
  platform: "youtube",
  rtmpUrl: "rtmp://a.rtmp.youtube.com/live2/SEU-CODIGO",
  quality: "1080p"
}
```

Execute com:
```bash
npm run stream
```

### Controle por Celular

1. Inicie o servidor móvel:
   ```bash
   npm run mobile
   ```

2. Acesse do celular: `http://IP-DO-PC:3000`

3. Controle gravação, timeline e configurações remotamente

### Edição Avançada

Após gerar o vídeo final, você pode editar em:
- **DaVinci Resolve** (gratuito e profissional)
- **Adobe Premiere Pro**
- **Final Cut Pro** (Mac)

## 📈 Melhorias Futuras

- [ ] IA para escolha automática de melhores ângulos
- [ ] Suporte para 8K
- [ ] Integração com OBS Studio
- [ ] Efeitos visuais automáticos
- [ ] Sincronização automática por batidas da música

## 🤝 Contribuição

Contribuições são bem-vindas! Faça fork do projeto e envie pull requests.

## 📄 Licença

MIT License - Sinta-se livre para usar e modificar.

## 🎞️ Suporte

Para dúvidas e suporte:
- Verifique a seção de solução de problemas
- Confira se todos os requisitos estão instalados
- Teste com uma câmera antes de usar múltiplas

---

**MultiCam Music Studio** - Transforme sua música em clipes profissionais! 🎬🎵
