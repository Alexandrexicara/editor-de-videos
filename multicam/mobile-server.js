const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const http = require('http');
const socketIo = require('socket.io');
const STUDIO_API = process.env.MULTICAM_STUDIO_API || 'http://127.0.0.1:3000';

async function forwardToStudio(route, method = 'POST', body) {
  const response = await fetch(STUDIO_API + route, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  return { status: response.status, data };
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const REMOTE_TOKEN = process.env.MULTICAM_REMOTE_TOKEN || crypto.randomBytes(24).toString('hex');
io.use((socket, next) => {
  if (socket.handshake.auth && socket.handshake.auth.token === REMOTE_TOKEN) return next();
  return next(new Error('Acesso remoto não autorizado.'));
});

const PORT = Number(process.env.MULTICAM_MOBILE_PORT || 3002);


// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public-mobile')));

// Criar diretório public-mobile se não existir
if (!fs.existsSync(path.join(__dirname, 'public-mobile'))) {
  fs.mkdirSync(path.join(__dirname, 'public-mobile'), { recursive: true });
}

// HTML da interface mobile
const mobileInterface = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎬 MultiCam Mobile</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
            overflow-x: hidden;
        }

        .container {
            max-width: 480px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            animation: fadeInDown 0.8s ease;
        }

        .header h1 {
            font-size: 2rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .header .status {
            background: rgba(255,255,255,0.2);
            padding: 8px 16px;
            border-radius: 20px;
            display: inline-block;
            margin-top: 10px;
            backdrop-filter: blur(10px);
        }

        .control-panel {
            display: grid;
            gap: 15px;
            margin-bottom: 30px;
        }

        .control-card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.2);
            animation: fadeInUp 0.8s ease;
        }

        .control-card h3 {
            margin-bottom: 15px;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .btn {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 15px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            margin: 5px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .btn:active {
            transform: scale(0.95);
        }

        .btn.primary {
            background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
            color: #2d3436;
        }

        .btn.danger {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
        }

        .btn.secondary {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
        }

        .btn.warning {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            color: #2d3436;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .progress-container {
            background: rgba(255,255,255,0.2);
            border-radius: 10px;
            height: 8px;
            margin: 15px 0;
            overflow: hidden;
        }

        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #43e97b 0%, #38f9d7 100%);
            width: 0%;
            transition: width 0.3s ease;
            border-radius: 10px;
        }

        .timeline-preview {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.2);
            margin-bottom: 20px;
        }

        .timeline-item {
            display: flex;
            align-items: center;
            padding: 10px;
            margin: 5px 0;
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            font-size: 0.9rem;
        }

        .timeline-item .camera {
            font-weight: bold;
            margin-right: 10px;
            background: rgba(255,255,255,0.2);
            padding: 4px 8px;
            border-radius: 8px;
        }

        .timeline-item .time {
            margin-right: 10px;
            opacity: 0.8;
        }

        .camera-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin: 15px 0;
        }

        .camera-preview {
            background: rgba(0,0,0,0.3);
            border-radius: 10px;
            aspect-ratio: 16/9;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            border: 2px solid rgba(255,255,255,0.2);
        }

        .camera-preview.active {
            border-color: #43e97b;
            background: rgba(67,233,123,0.2);
        }

        .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin: 15px 0;
        }

        .stat-item {
            background: rgba(255,255,255,0.1);
            padding: 10px;
            border-radius: 10px;
            text-align: center;
        }

        .stat-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #43e97b;
        }

        .stat-label {
            font-size: 0.8rem;
            opacity: 0.8;
        }

        .log-container {
            background: rgba(0,0,0,0.3);
            border-radius: 10px;
            padding: 15px;
            max-height: 150px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.8rem;
            margin-top: 15px;
        }

        .log-entry {
            margin: 2px 0;
            opacity: 0.8;
        }

        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes pulse {
            0%, 100% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.05);
            }
        }

        .recording {
            animation: pulse 2s infinite;
        }

        .floating-action {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        @media (max-width: 480px) {
            .container {
                padding: 15px;
            }
            
            .header h1 {
                font-size: 1.5rem;
            }
            
            .camera-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 MultiCam</h1>
            <div class="status" id="connection-status">🟢 Conectado</div>
        </div>

        <div class="control-panel">
            <div class="control-card">
                <h3>🎥 Gravação</h3>
                <button id="record-btn" class="btn primary" onclick="toggleRecording()">
                    <span>▶️</span> Iniciar Gravação
                </button>
                <div class="progress-container">
                    <div id="recording-progress" class="progress-bar"></div>
                </div>
                <div class="stats">
                    <div class="stat-item">
                        <div class="stat-value" id="recording-time">00:00</div>
                        <div class="stat-label">Tempo</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="camera-count">4</div>
                        <div class="stat-label">Câmeras</div>
                    </div>
                </div>
            </div>

            <div class="control-card">
                <h3>✂️ Edição</h3>
                <button class="btn secondary" onclick="switchClips()">
                    <span>✂️</span> Cortar Clipes
                </button>
                <button class="btn warning" onclick="mergeVideo()">
                    <span>🎬</span> Juntar Vídeo
                </button>
                <button class="btn primary" onclick="fullProcess()">
                    <span>🚀</span> Processo Completo
                </button>
            </div>
        </div>

        <div class="timeline-preview">
            <h3>🕐 Timeline</h3>
            <div id="timeline-container">
                <!-- Timeline será carregada aqui -->
            </div>
        </div>

        <div class="control-card">
            <h3>📹 Preview das Câmeras</h3>
            <div class="camera-grid">
                <div class="camera-preview" id="cam1">📹 Câmera 1</div>
                <div class="camera-preview" id="cam2">📹 Câmera 2</div>
                <div class="camera-preview" id="cam3">📹 Câmera 3</div>
                <div class="camera-preview" id="cam4">📹 Câmera 4</div>
            </div>
        </div>

        <div class="control-card">
            <h3>📋 Log</h3>
            <div class="log-container" id="log">
                <div class="log-entry">🎬 Sistema MultiCam iniciado</div>
            </div>
        </div>
    </div>

    <button class="floating-action" onclick="emergencyStop()">🛑</button>

    <script>
        const REMOTE_TOKEN = '__REMOTE_TOKEN__';
        let isRecording = false;
        let recordingInterval;
        let recordingStartTime;
        let socket;
        let timelineData = JSON.parse('${JSON.stringify(config.timeline)}');

        // Conectar WebSocket
        function connectWebSocket() {
            socket = io({ auth: { token: REMOTE_TOKEN } });
            
            socket.on('connect', () => {
                addLog('🟢 Conectado ao servidor');
                document.getElementById('connection-status').textContent = '🟢 Conectado';
            });

            socket.on('disconnect', () => {
                addLog('🔴 Desconectado do servidor');
                document.getElementById('connection-status').textContent = '🔴 Desconectado';
            });

            socket.on('status', (data) => {
                updateStatus(data);
            });

            socket.on('progress', (data) => {
                updateProgress(data);
            });
        }

        function addLog(message) {
            const log = document.getElementById('log');
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            const timestamp = new Date().toLocaleTimeString();
            entry.textContent = '[' + timestamp + '] ' + message;
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }

        function updateStatus(data) {
            if (data.recording !== undefined) {
                isRecording = data.recording;
                updateRecordingButton();
            }
        }

        function updateProgress(data) {
            if (data.recording) {
                document.getElementById('recording-progress').style.width = data.recording + '%';
            }
        }

        function updateRecordingButton() {
            const btn = document.getElementById('record-btn');
            if (isRecording) {
                btn.innerHTML = '<span>⏹️</span> Parar Gravação';
                btn.className = 'btn danger recording';
            } else {
                btn.innerHTML = '<span>▶️</span> Iniciar Gravação';
                btn.className = 'btn primary';
            }
        }

        function toggleRecording() {
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        }

        function startRecording() {
            if (isRecording) return;
            addLog('🎥 Iniciando gravação...');
            fetch('/api/mobile/record/start', { method: 'POST', headers: { 'x-multicam-token': REMOTE_TOKEN } })
                .then(response => response.json())
                .then(data => {
                    addLog(data.message);
                    if (!data.success) return;
                    isRecording = true;
                    recordingStartTime = Date.now();
                    updateRecordingButton();
                    startRecordingTimer(Number(data.recordingDuration || data.duration || 60));
                })
                .catch(error => addLog('❌ Erro: ' + error.message));
        }

        function stopRecording() {
            if (!isRecording) return;
            addLog('⏹️ Solicitando parada e finalização dos arquivos...');
            fetch('/api/mobile/record/stop', { method: 'POST', headers: { 'x-multicam-token': REMOTE_TOKEN } })
                .then(response => response.json())
                .then(data => {
                    addLog(data.message);
                    if (!data.success) return;
                    isRecording = false;
                    clearInterval(recordingInterval);
                    updateRecordingButton();
                })
                .catch(error => addLog('❌ Erro ao parar: ' + error.message));
        }

        function startRecordingTimer(durationSeconds) {
            const totalSeconds = Math.max(1, Number(durationSeconds) || 60);
            recordingInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                document.getElementById('recording-time').textContent = 
                    minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
                
                // Progresso calculado pelo tempo real informado pelo gravador.
                const progress = Math.min((elapsed / totalSeconds) * 100, 100);
                document.getElementById('recording-progress').style.width = progress + '%';
                
                if (progress >= 100) {
                    stopRecording();
                }
            }, 1000);
        }

        function switchClips() {
            addLog('✂️ Cortando clipes...');
            fetch('/api/mobile/switch', { method: 'POST', headers: { 'x-multicam-token': REMOTE_TOKEN } })
                .then(response => response.json())
                .then(data => addLog(data.message));
        }

        function mergeVideo() {
            addLog('🎬 Juntando vídeo...');
            fetch('/api/mobile/merge', { method: 'POST', headers: { 'x-multicam-token': REMOTE_TOKEN } })
                .then(response => response.json())
                .then(data => addLog(data.message));
        }

        function fullProcess() {
            addLog('🚀 Iniciando processo completo...');
            fetch('/api/mobile/full-process', { method: 'POST', headers: { 'x-multicam-token': REMOTE_TOKEN } })
                .then(response => response.json())
                .then(data => addLog(data.message));
        }

        function emergencyStop() {
            if (confirm('Parar todas as operações?')) {
                stopRecording();
                addLog('🛑 Parada de emergência acionada');
            }
        }

        function loadTimeline() {
            const container = document.getElementById('timeline-container');
            container.innerHTML = '';
            
            timelineData.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'timeline-item';
                div.innerHTML = 
                    '<span class="camera">C' + (item.camera + 1) + '</span>' +
                    '<span class="time">' + item.start + 's-' + item.end + 's</span>';
                container.appendChild(div);
            });
        }

        function updateCameraPreviews() {
            // Simular ativação de câmeras durante gravação
            const cameras = ['cam1', 'cam2', 'cam3', 'cam4'];
            cameras.forEach((cam, index) => {
                const element = document.getElementById(cam);
                if (isRecording && Math.random() > 0.5) {
                    element.classList.add('active');
                } else {
                    element.classList.remove('active');
                }
            });
        }

        // Inicialização
        document.addEventListener('DOMContentLoaded', () => {
            connectWebSocket();
            loadTimeline();
            addLog('📱 Interface mobile carregada');
            
            // Atualizar previews periodicamente
            setInterval(updateCameraPreviews, 2000);
        });

        // Prevenir fechamento acidental
        window.addEventListener('beforeunload', (e) => {
            if (isRecording) {
                e.preventDefault();
                e.returnValue = 'Gravação em andamento. Tem certeza?';
            }
        });
    </script>
</body>
</html>
`;

// Criar arquivo HTML mobile
fs.writeFileSync(path.join(__dirname, 'public-mobile', 'index.html'), mobileInterface.replace('__REMOTE_TOKEN__', REMOTE_TOKEN));

// Rotas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-mobile', 'index.html'));
});

app.use('/api/mobile', (req, res, next) => {
    if (req.get('x-multicam-token') !== REMOTE_TOKEN) {
        return res.status(401).json({ success: false, message: 'Acesso não autorizado.' });
    }
    next();
});

// API endpoints para controle mobile
app.post('/api/mobile/record/start', async (req, res) => {
    try {
        let setup = req.body && Array.isArray(req.body.cameras) ? req.body : null;
        if (!setup) {
            const savedPath = path.join(__dirname, 'recording-config.json');
            if (fs.existsSync(savedPath)) setup = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
        }
        if (!setup || !Array.isArray(setup.cameras)) {
            return res.status(400).json({ success: false, message: 'Configure e salve as câmeras primeiro na interface principal do computador.' });
        }
        const result = await forwardToStudio('/api/record/start', 'POST', setup);
        io.emit('status', { recording: Boolean(result.data.success) });
        return res.status(result.status).json(result.data);
    } catch (error) {
        return res.status(503).json({ success: false, message: 'Não foi possível conectar ao estúdio principal: ' + error.message });
    }
});

app.post('/api/mobile/record/stop', async (req, res) => {
    try {
        const result = await forwardToStudio('/api/record/stop');
        if (result.data.success) io.emit('status', { recording: false });
        return res.status(result.status).json(result.data);
    } catch (error) {
        return res.status(503).json({ success: false, message: 'Estúdio principal indisponível: ' + error.message });
    }
});

app.get('/api/mobile/record/status', async (req, res) => {
    try {
        const result = await forwardToStudio('/api/record/status', 'GET');
        return res.status(result.status).json(result.data);
    } catch (error) {
        return res.status(503).json({ recording: false, message: 'Estúdio principal indisponível.' });
    }
});

app.post('/api/mobile/switch', async (req, res) => {
    try {
        const result = await forwardToStudio('/api/switch');
        return res.status(result.status).json(result.data);
    } catch (error) {
        return res.status(503).json({ success: false, message: 'Estúdio principal indisponível: ' + error.message });
    }
});

app.post('/api/mobile/merge', async (req, res) => {
    try {
        const result = await forwardToStudio('/api/merge');
        return res.status(result.status).json(result.data);
    } catch (error) {
        return res.status(503).json({ success: false, message: 'Estúdio principal indisponível: ' + error.message });
    }
});

app.post('/api/mobile/full-process', async (req, res) => {
    try {
        const result = await forwardToStudio('/api/full-process');
        return res.status(result.status).json(result.data);
    } catch (error) {
        return res.status(503).json({ success: false, message: 'Estúdio principal indisponível: ' + error.message });
    }
});

// WebSocket events
io.on('connection', (socket) => {
    console.log('📱 Cliente mobile conectado:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('📱 Cliente mobile desconectado:', socket.id);
    });
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
    console.log('🔐 Controle remoto protegido por token.');
    if (!process.env.MULTICAM_REMOTE_TOKEN) console.log('🔑 Token de sessão gerado automaticamente para esta inicialização.');
    console.log('📱 Servidor de controle mobile disponível em http://localhost:' + PORT);
    console.log('🎬 MultiCam Mobile Server iniciado!');
    console.log('🔗 Escaneie o QR Code ou acesse do seu celular');
});

module.exports = app;
