@echo off
title MultiCam Music Studio - Iniciando...
color 0A
cd /d "%~dp0"

echo.
echo ===============================================
echo    🎬 MULTICAM MUSIC STUDIO - INICIANDO
echo ===============================================
echo.
echo ⏳ Aguarde, iniciando o sistema...
echo.

REM Verificar se Node.js está instalado
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERRO: Node.js não encontrado!
    echo.
    echo 💡 Instale o Node.js em: https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM Verificar se FFmpeg está instalado
where ffmpeg >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERRO: FFmpeg não encontrado!
    echo.
    echo 💡 Instale o FFmpeg em: https://ffmpeg.org/download.html
    echo.
    pause
    exit /b 1
)

REM Verificar dependências
echo 📦 Verificando dependências...
if not exist "node_modules" (
    echo ⚠️ Instalando dependências pela primeira vez...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Erro ao instalar dependências!
        pause
        exit /b 1
    )
)

echo ✅ Dependências OK!
echo.

REM Criar diretórios se não existirem
if not exist "cameras" mkdir cameras
if not exist "clips" mkdir clips
if not exist "output" mkdir output
if not exist "public" mkdir public

echo 📁 Diretórios verificados!
echo.

REM Iniciar servidor GUI
echo 🌐 INICIANDO INTERFACE WEB...
echo.
echo ===============================================
echo    ✅ SISTEMA INICIADO COM SUCESSO!
echo ===============================================
echo.
echo 🌐 Interface web: http://localhost:3000
echo 📱 Controle remoto: http://IP-DO-PC:3002
echo 📷 Servidor de câmera opcional: execute INICIAR-MOBILE.bat
echo.
echo 💡 INSTRUÇÕES:
echo    1. Abra seu navegador
echo    2. Acesse: http://localhost:3000
echo    3. Use todos os recursos pela interface!
echo.
echo ⚠️ MANTENHA ESTA JANELA ABERTA!
echo    Para fechar: Ctrl+C ou feche a janela
echo.
echo ===============================================
echo.

REM Iniciar servidor de controle remoto em outra janela
start "MultiCam Controle Remoto" cmd /k "cd /d %~dp0 && npm run mobile:control"

REM Iniciar GUI apenas no computador
call npm run gui

REM Se chegou aqui, foi fechado
echo.
echo 👋 Sistema finalizado!
pause
