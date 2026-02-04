// main.js - Ponto de entrada do aplicativo Electron

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
    // Criar a janela do navegador
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#0b0b0e',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets/icon.png'), // Ícone do app (opcional)
        title: 'Rolezando Avatar Editor'
    });

    // Carregar o servidor local
    mainWindow.loadURL('http://localhost:3000');
    
    // Abrir DevTools em modo desenvolvimento
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    // Tratar fechamento da janela
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Tratar falhas de carregamento
    mainWindow.webContents.on('did-fail-load', () => {
        // Se não conseguir carregar, mostra página de erro
        mainWindow.loadFile(path.join(__dirname, 'frontend/error.html'));
    });
}

// Iniciar servidor Node.js
function startServer() {
    console.log('🚀 Iniciando servidor backend...');
    
    serverProcess = spawn('node', ['backend/server.js'], {
        cwd: __dirname,
        stdio: 'inherit'
    });

    serverProcess.on('error', (error) => {
        console.error('❌ Erro ao iniciar servidor:', error);
    });

    serverProcess.on('exit', (code) => {
        console.log(`🛑 Servidor encerrado com código: ${code}`);
    });
}

// Eventos do Electron
app.whenReady().then(() => {
    // Iniciar servidor antes de criar a janela
    startServer();
    
    // Dar um pequeno delay para o servidor subir
    setTimeout(() => {
        createWindow();
    }, 2000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Encerrar app quando todas as janelas forem fechadas
app.on('window-all-closed', () => {
    // No macOS é comum manter o app ativo até Cmd+Q
    if (process.platform !== 'darwin') {
        // Encerrar servidor também
        if (serverProcess) {
            serverProcess.kill();
        }
        app.quit();
    }
});

// IPC handlers para comunicação entre processos
ipcMain.handle('get-app-info', () => {
    return {
        version: app.getVersion(),
        name: 'Rolezando Avatar Editor',
        isPackaged: app.isPackaged
    };
});

ipcMain.handle('restart-server', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
    startServer();
});

console.log('🎯 App Electron iniciado com sucesso!');