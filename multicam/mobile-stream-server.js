const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3001;
const CAMERA_TOKEN = crypto.randomBytes(24).toString('hex');
let latestFrame = null;
let frameCount = 0;

// Servir a interface web
app.get('/', (req, res) => {
    fs.readFile(path.join(__dirname, 'mobile-camera-server.html'), 'utf8', (error, html) => {
        if (error) return res.status(500).send('Não foi possível abrir a interface da câmera.');
        res.type('html').send(html.replace('__CAMERA_TOKEN__', CAMERA_TOKEN));
    });
});

// Endpoint para stream de vídeo (MJPEG)
app.get('/stream', (req, res) => {
    if (req.query.token !== CAMERA_TOKEN) return res.status(401).send('Acesso ao stream não autorizado.');
    console.log('📡 Cliente conectado no stream');
    
    // Enviar header MJPEG correto
    res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=frameboundary',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Pragma': 'no-cache',
        'Expires': '0'
    });

    // Enviar frames periodicamente
    const interval = setInterval(() => {
        if (latestFrame) {
            res.write('--frameboundary\r\n');
            res.write('Content-Type: image/jpeg\r\n');
            res.write('Content-Length: ' + latestFrame.length + '\r\n\r\n');
            res.write(latestFrame);
            frameCount++;
        } else {
            // Enviar frame preto se não tiver vídeo
            const blackFrame = Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080010001001011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc40055100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbfc5ffd9', 'hex');
            res.write('--frameboundary\r\n');
            res.write('Content-Type: image/jpeg\r\n');
            res.write('Content-Length: ' + blackFrame.length + '\r\n\r\n');
            res.write(blackFrame);
        }
    }, 200); // 5 FPS quando sem vídeo, 10 FPS com vídeo

    req.on('close', () => {
        clearInterval(interval);
        console.log('📡 Cliente desconectou');
    });
    
    req.on('error', (err) => {
        console.error('❌ Erro no stream:', err);
        clearInterval(interval);
    });
});

// Endpoint para snapshot único
app.get('/snapshot', (req, res) => {
    if (req.query.token !== CAMERA_TOKEN) return res.status(401).send('Acesso ao snapshot não autorizado.');
    if (latestFrame) {
        res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': latestFrame.length
        });
        res.end(latestFrame);
    } else {
        res.status(404).send('Nenhum frame disponível');
    }
});

// WebSocket para receber frames do cliente
wss.on('connection', (ws, request) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    if (requestUrl.searchParams.get('token') !== CAMERA_TOKEN) {
        ws.close(1008, 'Acesso não autorizado');
        return;
    }
    console.log('🔌 Cliente WebSocket conectado');

    ws.on('message', (message) => {
        // Se for um frame de vídeo (Buffer)
        if (message instanceof Buffer) {
            latestFrame = message;
        }
        // Se for comando
        else if (typeof message === 'string') {
            try {
                const cmd = JSON.parse(message);
                console.log('📨 Comando:', cmd);
                
                if (cmd.type === 'frame' && cmd.data) {
                    // Converter base64 para buffer
                    latestFrame = Buffer.from(cmd.data.split(',')[1], 'base64');
                }
            } catch (e) {
                console.error('Erro ao processar comando:', e);
            }
        }
    });

    ws.on('close', () => {
        console.log('🔌 Cliente WebSocket desconectou');
    });

    ws.on('error', (error) => {
        console.error('❌ Erro WebSocket:', error);
    });
});

// Criar arquivo de stream para FFmpeg consumir
setInterval(() => {
    if (latestFrame) {
        const streamPath = path.join(__dirname, 'stream.jpg');
        try { fs.writeFileSync(streamPath, latestFrame); } catch (error) { console.error('Falha ao atualizar frame:', error.message); }
    }
}, 500);

server.listen(PORT, '0.0.0.0', () => {
    // Obter IP da rede
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let externalIP = 'localhost';
    
    for (const iface of Object.values(interfaces)) {
        for (const config of iface) {
            if (config.family === 'IPv4' && !config.internal) {
                externalIP = config.address;
                break;
            }
        }
    }
    
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║     🎬 SERVIDOR DE CÂMERA MOBILE INICIADO!             ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  🌐 Interface Local: http://localhost:${PORT}                  ║`);
    console.log(`║  🌐 Interface Rede: http://${externalIP}:${PORT}              ║`);
    console.log(`║  📡 Stream MJPEG: http://${externalIP}:${PORT}/stream?token=${CAMERA_TOKEN} ║`);
    console.log(`║  📸 Snapshot: http://${externalIP}:${PORT}/snapshot?token=${CAMERA_TOKEN} ║`);
    console.log('║                                                           ║');
    console.log('║  COMO USAR NO CELULAR:                                   ║');
    console.log(`║  1. Conecte celular e PC na mesma rede Wi-Fi            ║`);
    console.log(`║  2. No celular, acesse: http://${externalIP}:${PORT}            ║`);
    console.log('║  3. Clique em "INICIAR CÂMERA"                          ║');
    console.log(`║  4. Use no sistema: http://${externalIP}:${PORT}/stream         ║`);
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
});

// Handler para graceful shutdown
process.on('SIGINT', () => {
    console.log('\n⏹️ Parando servidor...');
    server.close(() => {
        console.log('✅ Servidor parado');
        process.exit(0);
    });
});
