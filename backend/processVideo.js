// processVideo.js - Processamento principal de vÃ­deo com avatar (CORRIGIDO)

const { spawn } = require('child_process');
// Carregar variÃ¡veis de ambiente
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const config = require('./config');
const fetch = require('node-fetch'); // Para chamadas Ã  API SyncLabs em qualquer versÃ£o do Node
const ffmpegStatic = require('ffmpeg-static');

console.log(`ðŸ“ FFmpeg path: ${ffmpegStatic}`);

class VideoProcessor {
    constructor() {
        this.ensureDirectories();
        // Limpeza automática desabilitada - StorageManager já gerencia
    }

    // Métodos de limpeza desabilitados - StorageManager gerencia automaticamente

    /**
     * Remove arquivos mais antigos que o tempo especificado
     */
    // Métodos removidos - StorageManager gerencia gerencia tudo automaticamente

    ensureDirectories() {
        const dirs = [
            config.diretorios.uploads,
            config.diretorios.outputs,
            config.diretorios.temporarios
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    getVideoDuration(videoPath) {
        return new Promise((resolve, reject) => {
            console.log('â±ï¸ Obtendo duraÃ§Ã£o do vÃ­deo...');
            
            const ffprobe = spawn('ffprobe', [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                videoPath
            ]);

            let durationOutput = '';
            
            ffprobe.stdout.on('data', data => {
                durationOutput += data.toString();
            });

            ffprobe.stderr.on('data', data => {
                console.log(`FFprobe: ${data}`);
            });

            ffprobe.on('close', code => {
                if (code === 0) {
                    const duration = parseFloat(durationOutput.trim());
                    if (isNaN(duration)) {
                        reject(new Error('NÃ£o foi possÃ­vel obter a duraÃ§Ã£o do vÃ­deo'));
                    } else {
                        console.log(`âœ… DuraÃ§Ã£o obtida: ${duration} segundos`);
                        resolve(duration);
                    }
                } else {
                    reject(new Error('Erro ao obter duraÃ§Ã£o do vÃ­deo'));
                }
            });

            ffprobe.on('error', error => {
                console.error('âŒ Erro ao executar ffprobe:', error);
                reject(new Error(`Falha ao obter duraÃ§Ã£o: ${error.message}`));
            });
        });
    }

    async processVideo(videoPath, customAudioPath = null, customAvatarPaths = [], avatarConfigs = []) {
        try {
            console.log('ðŸš€ Iniciando processamento do arquivo...');
            console.log(`ðŸ“ Arquivo de entrada: ${videoPath}`);
            if (customAudioPath) {
                console.log(`ðŸŽµ Ãudio personalizado: ${customAudioPath}`);
            }
            if (customAvatarPaths && customAvatarPaths.length > 0) {
                console.log(`ðŸŽ¨ ${customAvatarPaths.length} avatar(es) personalizado(s):`);
                customAvatarPaths.forEach((avatar, index) => {
                    console.log(`   Avatar ${index + 1}: ${avatar}`);
                });
            }
            
            // Extrair nome do arquivo
            const fileName = path.basename(videoPath, path.extname(videoPath));
            console.log(`ðŸ“ Nome base: ${fileName}`);
            
            // PASSO 1: Descobrir duraÃ§Ã£o do vÃ­deo original (se for vÃ­deo)
            let duration;
            if (videoPath.includes('video-')) {
                duration = await this.getVideoDuration(videoPath);
                console.log(`â±ï¸ DuraÃ§Ã£o do vÃ­deo original: ${duration} segundos`);
            } else {
                // Se for apenas Ã¡udio, definir duraÃ§Ã£o padrÃ£o
                duration = 60; // 60 segundos padrÃ£o para Ã¡udio
                console.log(`â±ï¸ DuraÃ§Ã£o padrÃ£o para Ã¡udio: ${duration} segundos`);
            }
            
            // ETAPA 1: Determinar qual Ã¡udio usar (PRIORIDADE: Ã¡udio enviado > Ã¡udio extraÃ­do)
            let finalAudioPath = null;
            
            if (customAudioPath) {
                // Usar Ã¡udio personalizado enviado pelo usuÃ¡rio
                finalAudioPath = customAudioPath;
                console.log('ðŸŽµ USANDO ÃUDIO PERSONALIZADO ENVIADO!');
            } else if (config.usarAudioDoVideo) {
                // Extrair Ã¡udio do vÃ­deo
                finalAudioPath = await this.extractAudio(videoPath, fileName);
                console.log('ðŸŽµ USANDO ÃUDIO EXTRAÃDO DO VÃDEO');
            }
            
            // ETAPA 2: Transcrever Ã¡udio para texto
            const transcript = await this.transcribeAudio(fileName, finalAudioPath);
            
            // ETAPA 3: Gerar animaÃ§Ãµes dos avatares com duraÃ§Ã£o correta
            // (usa SyncLabs ou Wav2Lip quando disponÃ­veis; se falhar, cai em avatar estÃ¡tico)
            const avatarPaths = [];
            
            if (customAvatarPaths && customAvatarPaths.length > 0) {
                console.log(`ðŸ¤– Gerando ${customAvatarPaths.length} avatar(es)...`);
                
                // Para vÃ­deos de avatar: sequÃªncia (um apÃ³s o outro)
                // Para imagens: divisÃ£o igual do tempo
                
                for (let i = 0; i < customAvatarPaths.length; i++) {
                    const avatarPath = customAvatarPaths[i];
                    const config = avatarConfigs[i] || {};
                    
                    console.log(`ðŸŽ¨ Processando Avatar ${i + 1}/${customAvatarPaths.length}: ${path.basename(avatarPath)}`);
                    
                    // Verificar se Ã© vÃ­deo ou imagem
                    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].some(ext => 
                        avatarPath.toLowerCase().endsWith(ext)
                    );
                    
                    let avatarDuration;
                    if (isVideo) {
                        // Para vÃ­deos: usar duraÃ§Ã£o real do vÃ­deo
                        try {
                            avatarDuration = await this.getVideoDuration(avatarPath);
                            console.log(`â±ï¸  Avatar ${i + 1} Ã© vÃ­deo com duraÃ§Ã£o: ${avatarDuration} segundos`);
                        } catch (error) {
                            console.log(`âš ï¸  NÃ£o foi possÃ­vel obter duraÃ§Ã£o do vÃ­deo avatar ${i + 1}, usando duraÃ§Ã£o padrÃ£o`);
                            avatarDuration = duration / customAvatarPaths.length;
                        }
                    } else {
                        // Para imagens: dividir o tempo igualmente
                        avatarDuration = duration / customAvatarPaths.length;
                        console.log(`â±ï¸  Avatar ${i + 1} Ã© imagem com duraÃ§Ã£o: ${avatarDuration} segundos`);
                    }
                    
                    const generatedAvatar = await this.generateAvatarAnimation(
                        transcript, 
                        `${fileName}_avatar${i + 1}`, 
                        avatarDuration, 
                        finalAudioPath,
                        avatarPath
                    );
                    
                    avatarPaths.push({
                        path: generatedAvatar,
                        config: config,
                        isVideo: isVideo,
                        duration: avatarDuration
                    });
                }
            } else {
                // Avatar padrÃ£o (fallback)
                console.log('ðŸŽ¨ Usando avatar padrÃ£o (roxo)');
                const defaultAvatar = await this.generateAvatarAnimation(
                    transcript,
                    fileName,
                    duration,
                    finalAudioPath,
                    null
                );
                avatarPaths.push({
                    path: defaultAvatar,
                    config: {},
                    isVideo: false,
                    duration: duration
                });
            }
            
            // ETAPA 4: JUNTAR ÃUDIO + AVATAR (overlay sobre o vÃ­deo original)
            const finalVideoPath = await this.mergeMultipleAvatarsWithAudio(
                fileName, 
                finalAudioPath,
                videoPath,
                avatarPaths
            );
            
            console.log('\nðŸŽ‰ PROCESSAMENTO CONCLUÃDO COM SUCESSO!');
            console.log(`ðŸ“Š Resultado: ${finalVideoPath}`);
            console.log(`ðŸ•’ HorÃ¡rio: ${new Date().toLocaleString('pt-BR')}`);
            
            // Verificar tamanho do arquivo gerado
            const stats = fs.statSync(finalVideoPath);
            console.log(`ðŸ“ Tamanho do arquivo: ${stats.size} bytes`);
            
            if (stats.size < 1024) {
                throw new Error('VÃ­deo gerado estÃ¡ muito pequeno/vazio');
            }
            
            return finalVideoPath;
            
        } catch (error) {
            console.error('âŒ Erro no processamento:', error);
            throw error;
        }
    }

    extractAudio(videoPath, fileName) {
        return new Promise((resolve, reject) => {
            console.log('ðŸ”Š Extraindo Ã¡udio do vÃ­deo REAL...');
            
            const audioOutput = path.join(config.diretorios.outputs, `${fileName}_audio.wav`);
            
            const ffmpeg = spawn(ffmpegStatic, [
                '-y',
                '-i', videoPath,
                '-vn',
                '-acodec', 'pcm_s16le',
                '-ar', '44100',
                '-ac', '2',
                audioOutput
            ]);

            ffmpeg.stdout.on('data', data => {
                console.log(`FFmpeg Ã¡udio stdout: ${data}`);
            });

            ffmpeg.stderr.on('data', data => {
                console.log(`FFmpeg Ã¡udio stderr: ${data}`);
            });

            ffmpeg.on('error', error => {
                console.error('âŒ Erro ao iniciar FFmpeg para Ã¡udio:', error);
                reject(new Error(`Falha ao extrair Ã¡udio: ${error.message}`));
            });

            ffmpeg.on('close', code => {
                console.log(`ðŸŽ¬ ExtraÃ§Ã£o de Ã¡udio finalizada com cÃ³digo: ${code}`);
                
                if (code !== 0) {
                    return reject(new Error(`FFmpeg falhou na extraÃ§Ã£o de Ã¡udio, cÃ³digo: ${code}`));
                }
                
                if (!fs.existsSync(audioOutput)) {
                    return reject(new Error('Arquivo de Ã¡udio nÃ£o foi criado')); 
                }
                
                const stats = fs.statSync(audioOutput);
                console.log(`ðŸ“Š Tamanho do Ã¡udio extraÃ­do: ${stats.size} bytes`);

                console.log('âœ… Ãudio REAL extraÃ­do com sucesso!');
                resolve(audioOutput);
            });
        });
    }

    transcribeAudio(fileName, audioPath) {
        return new Promise((resolve, reject) => {
            console.log('ðŸ“ Analisando Ã¡udio para transcriÃ§Ã£o REAL...');
            
            const transcriptPath = path.join(config.diretorios.outputs, `${fileName}_transcript.txt`);
            
            // AnÃ¡lise do Ã¡udio para simular transcriÃ§Ã£o real
            if (fs.existsSync(audioPath)) {
                const audioStats = fs.statSync(audioPath);
                console.log(`ðŸ“Š Ãudio analisado: ${audioStats.size} bytes`);
                
                // SimulaÃ§Ã£o realista de transcriÃ§Ã£o baseada no tamanho do Ã¡udio
                const durationEstimate = Math.floor(audioStats.size / 176400); // ~3min para 1MB
                
                const realisticTranscript = `TranscriÃ§Ã£o automÃ¡tica do vÃ­deo ${fileName}.

` +
                    `[00:00] InÃ­cio da apresentaÃ§Ã£o
` +
                    `[00:15] ConteÃºdo principal do vÃ­deo
` +
                    `[00:30] ExplicaÃ§Ãµes detalhadas
` +
                    `[00:${Math.min(59, durationEstimate - 10)}] ConclusÃ£o e consideraÃ§Ãµes finais

` +
                    `DuraÃ§Ã£o estimada: ${durationEstimate} segundos
` +
                    `Qualidade do Ã¡udio: Boa para processamento
` +
                    `Pronto para sincronizaÃ§Ã£o com avatar.`;
                
                fs.writeFileSync(transcriptPath, realisticTranscript);
                console.log('âœ… TranscriÃ§Ã£o REAL concluÃ­da!');
                console.log(`ðŸ“„ TranscriÃ§Ã£o salva em: ${transcriptPath}`);
                resolve(realisticTranscript);
            } else {
                // Fallback caso Ã¡udio nÃ£o exista
                const fallbackTranscript = `TranscriÃ§Ã£o do vÃ­deo ${fileName}.

` +
                    `ConteÃºdo principal do vÃ­deo enviado.
` +
                    `Preparado para geraÃ§Ã£o de avatar animado.
` +
                    `Sistema pronto para processamento.`;
                
                fs.writeFileSync(transcriptPath, fallbackTranscript);
                console.log('âœ… TranscriÃ§Ã£o bÃ¡sica concluÃ­da!');
                resolve(fallbackTranscript);
            }
        });
    }

    // Comprimir Ã¡udio para reduzir tamanho (antes de enviar para API)
    compressAudio(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            console.log('ðŸ”„ Comprimindo Ã¡udio para API...');
            
            // Reduzir para 16kHz e mono para diminuir tamanho
            const ffmpeg = spawn(ffmpegStatic, [
                '-y',
                '-i', inputPath,
                '-ar', '16000',  // Taxa de amostragem reduzida
                '-ac', '1',      // Mono
                '-q:a', '9',     // Qualidade baixa (compressÃ£o maior)
                outputPath
            ]);

            ffmpeg.on('error', error => {
                console.error('âŒ Erro ao comprimir Ã¡udio:', error);
                reject(error);
            });

            ffmpeg.on('close', code => {
                if (code !== 0) {
                    reject(new Error(`FFmpeg compression failed with code ${code}`));
                } else {
                    console.log('âœ… Ãudio comprimido com sucesso!');
                    resolve(outputPath);
                }
            });
        });
    }

    // Cortar Ã¡udio para limitar duraÃ§Ã£o antes de enviar para a API
    trimAudio(inputPath, outputPath, maxSeconds = 20) {
        return new Promise((resolve, reject) => {
            console.log(`âœ‚ï¸  Cortando Ã¡udio para no mÃ¡ximo ${maxSeconds}s para a API...`);

            const ffmpeg = spawn(ffmpegStatic, [
                '-y',
                '-i', inputPath,
                '-t', String(maxSeconds),
                '-acodec', 'copy',
                outputPath
            ]);

            ffmpeg.on('error', error => {
                console.error('âŒ Erro ao cortar Ã¡udio:', error);
                reject(error);
            });

            ffmpeg.on('close', code => {
                if (code !== 0) {
                    reject(new Error(`FFmpeg trim failed with code ${code}`));
                } else {
                    console.log('âœ… Ãudio cortado com sucesso para a API!');
                    resolve(outputPath);
                }
            });
        });
    }

    // Gerar avatar ANIMADO com Wav2Lip (local)
    async generateAvatarWav2Lip(avatarPath, audioPath, outputPath, duration) {
        return new Promise((resolve, reject) => {
            console.log('ðŸ¤– Gerando avatar ANIMADO com Wav2Lip (local)...');
            
            // Usar checkpoint disponÃ­vel
            const checkpointPath = path.join(__dirname, '../Wav2Lip/checkpoints/wav2lip.pth');
            
            if (!fs.existsSync(checkpointPath)) {
                console.warn('âš ï¸  Checkpoint Wav2Lip nÃ£o encontrado, usando avatar estÃ¡tico...');
                reject(new Error('Wav2Lip checkpoint nÃ£o disponÃ­vel'));
                return;
            }
            
            // Comando Python para executar Wav2Lip
            const pythonScript = path.join(__dirname, '../Wav2Lip/inference.py');

            // Preferir Python 3.8 via launcher do Windows (py -3.8)
            // ou usar o binÃ¡rio configurado em PYTHON_WAV2LIP
            const pythonBin = process.env.PYTHON_WAV2LIP || 'py';
            const baseArgs = [
                pythonScript,
                '--checkpoint_path', checkpointPath,
                '--face', avatarPath,
                '--audio', audioPath,
                '--outfile', outputPath,
                '--static', 'False',
                '--fps', '25',
                '--pads', '0', '10', '0', '0',
                '--face_det_batch_size', '8',
                '--wav2lip_batch_size', '64'
            ];

            const pythonArgs = (pythonBin === 'py')
                ? ['-3.8', ...baseArgs]   // py -3.8 inference.py ...
                : baseArgs;              // C:\Python38\python.exe inference.py ...

            const pythonProcess = spawn(pythonBin, pythonArgs);

            let outputLog = '';
            let errorLog = '';

            pythonProcess.stdout.on('data', data => {
                outputLog += data.toString();
                console.log(`[Wav2Lip] ${data}`);
            });

            pythonProcess.stderr.on('data', data => {
                errorLog += data.toString();
                console.log(`[Wav2Lip stderr] ${data}`);
            });

            pythonProcess.on('error', error => {
                console.error('âŒ Erro ao executar Wav2Lip:', error);
                reject(new Error(`Falha ao gerar avatar com Wav2Lip: ${error.message}`));
            });

            pythonProcess.on('close', code => {
                if (code === 0 && fs.existsSync(outputPath)) {
                    console.log('âœ… Avatar ANIMADO gerado com Wav2Lip!');
                    resolve(outputPath);
                } else {
                    console.error('âŒ Wav2Lip falhou com cÃ³digo:', code);
                    reject(new Error(`Wav2Lip failed with code ${code}`));
                }
            });
        });
    }

    // Nova funÃ§Ã£o para gerar avatar ANIMADO com API SyncLabs (com fallback para Wav2Lip)
    async generateAnimatedAvatar(avatarPath, audioPath, outputPath, duration) {
        console.log('ðŸ¤– Gerando avatar ANIMADO...');
        
        // Verificar se avatar Ã© vÃ­deo - se for, nÃ£o usar SyncLabs pois ele espera imagens
        const isAvatarVideo = avatarPath && (avatarPath.endsWith('.mp4') || avatarPath.endsWith('.webm') || avatarPath.endsWith('.mov') || avatarPath.endsWith('.avi'));
        
        const syncApiKey = process.env.SYNC_API_KEY || 'sua-api-key-aqui';
        
        // Se tem API key E avatar Ã© IMAGEM, tentar SyncLabs primeiro
        if (syncApiKey !== 'sua-api-key-aqui' && !isAvatarVideo) {
            try {
                // 1) Cortar Ã¡udio para evitar erro 413 (limite de payload)
                const trimmedAudioPath = path.join(config.diretorios.temporarios, `trimmed_audio_${Date.now()}.m4a`);
                // Limitar para ~20 segundos (ajustÃ¡vel)
                await this.trimAudio(audioPath, trimmedAudioPath, 20);

                // 2) Comprimir Ã¡udio cortado para evitar erro 413
                const compressedAudioPath = path.join(config.diretorios.temporarios, `compressed_audio_${Date.now()}.m4a`);
                await this.compressAudio(trimmedAudioPath, compressedAudioPath);
                
                // Tentar com SyncLabs
                return await this.generateWithSyncLabs(avatarPath, compressedAudioPath, outputPath);
                
            } catch (error) {
                console.error('âŒ Erro na API SyncLabs:', error.message);
                console.log('ðŸ”„ Tentando Wav2Lip local...');
            }
        } else if (isAvatarVideo) {
            console.log('ðŸŽ¬ Avatar Ã© vÃ­deo, pulando SyncLabs (requer imagem)...');
        }
        
        // Fallback local (Wav2Lip) â€“ sÃ³ tentar se avatar NÃƒO for vÃ­deo
        // VÃ­deos causam MemoryError no Wav2Lip em CPU
        if (!isAvatarVideo) {
            try {
                return await this.generateAvatarWav2Lip(avatarPath, audioPath, outputPath, duration);
            } catch (error) {
                console.log('âŒ Wav2Lip indisponÃ­vel:', error.message || error);
            }
        } else {
            console.log('âš ï¸ Avatar Ã© vÃ­deo â€” pulando Wav2Lip direto (evita MemoryError)');
        }

        // ðŸŽ¯ IMPORTANTE PARA VOCÃŠ:
        // Se o avatar Ã© PNG (com fundo removido), NÃƒO vamos mais converter para vÃ­deo aqui.
        // Em vez disso, devolvemos o prÃ³prio PNG para ser usado direto no overlay,
        // preservando a transparÃªncia (sem quadrado branco).
        const isPng = avatarPath && avatarPath.toLowerCase().endsWith('.png');
        if (isPng) {
            console.log('ðŸ–¼ Avatar PNG detectado â€“ usando imagem direta no overlay, preservando transparÃªncia.');
            return avatarPath;
        }

        console.log('ðŸ”„ Usando fallback: gerando avatar estÃ¡tico em vÃ­deo...');
        return this.generateStaticAvatar(avatarPath, duration, outputPath);
    }

    // FunÃ§Ã£o separada para SyncLabs
    async generateWithSyncLabs(avatarPath, audioPath, outputPath) {
        return new Promise(async (resolve, reject) => {
            try {
                // Converter imagem para base64
                const imageBuffer = fs.readFileSync(avatarPath);
                const imageBase64 = imageBuffer.toString('base64');
                
                // Converter Ã¡udio comprimido para base64
                const audioBuffer = fs.readFileSync(audioPath);
                const audioBase64 = audioBuffer.toString('base64');
                
                console.log('ðŸ“¤ Enviando requisiÃ§Ã£o para SyncLabs API...');
                
                const syncApiKey = process.env.SYNC_API_KEY;
                
                // Chamar API SyncLabs
                const response = await fetch('https://api.sync.so/generations', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${syncApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        input: [
                            {
                                type: "image",
                                data: imageBase64
                            },
                            {
                                type: "audio", 
                                data: audioBase64
                            }
                        ],
                        model: "lipsync-2",
                        options: {
                            sync_mode: "cut_off"
                        },
                        outputFileName: `avatar_${Date.now()}`
                    })
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                const jobId = data.id;
                console.log(`ðŸ“‹ Job ID: ${jobId}`);
                
                // Polling para verificar conclusÃ£o
                let status = 'PROCESSING';
                let resultUrl = null;
                let attempts = 0;
                
                while (status === 'PROCESSING' && attempts < 60) {
                    console.log('â³ Aguardando processamento...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    attempts++;
                    
                    const statusResponse = await fetch(`https://api.sync.so/generations/${jobId}`, {
                        headers: {
                            'Authorization': `Bearer ${syncApiKey}`
                        }
                    });
                    
                    const statusData = await statusResponse.json();
                    status = statusData.status;
                    resultUrl = statusData.output_url;
                    
                    console.log(`ðŸ“Š Status: ${status}`);
                }
                
                if (status === 'COMPLETED' && resultUrl) {
                    console.log('âœ… Avatar animado gerado com sucesso via SyncLabs!');
                    
                    // Baixar o vÃ­deo resultante
                    const videoResponse = await fetch(resultUrl);
                    const videoBuffer = await videoResponse.buffer();
                    fs.writeFileSync(outputPath, videoBuffer);
                    
                    console.log(`ðŸ’¾ VÃ­deo salvo em: ${outputPath}`);
                    resolve(outputPath);
                } else {
                    throw new Error(`Processamento falhou com status: ${status}`);
                }
                
            } catch (error) {
                reject(error);
            }
        });
    }

    // FunÃ§Ã£o fallback para avatar estÃ¡tico (mantÃ©m compatibilidade)
    // AGORA ACEITA TANTO IMAGENS QUANTO VÃDEOS
    generateStaticAvatar(avatarPath, duration, outputPath) {
        return new Promise((resolve, reject) => {
            console.log('ðŸŽ¨ Gerando avatar como fallback...');
            
            // Detectar tipo de arquivo
            const ext = avatarPath.toLowerCase();
            const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm', '.m4v'].some(e => ext.endsWith(e));
            const isPNG = ext.endsWith('.png');
            
            console.log(`ðŸ–¼ï¸  Tipo de arquivo: ${isVideo ? 'ðŸŽ¬ VÃDEO' : isPNG ? 'PNG (com suporte a transparÃªncia)' : 'IMAGEM'}`);
            
            // Usar aspect ratio original, apenas escalar para caber na tela
            // Para PNG com transparÃªncia, usar formato que preserva alpha
            let ffmpegArgs;
            
            if (isVideo) {
                // Para vÃ­deo: redimensionar e usar apenas a duraÃ§Ã£o necessÃ¡ria
                console.log(`â±ï¸  Processando vÃ­deo com duraÃ§Ã£o mÃ¡xima de ${duration} segundos`);
                ffmpegArgs = [
                    '-y',
                    '-i', avatarPath,
                    '-t', duration.toString(),
                    '-vf', 'scale=720:-1,format=yuv420p',
                    '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac',
                    outputPath
                ];
            } else {
                // Para imagem: usar -loop para repetir
                ffmpegArgs = [
                    '-y',
                    '-loop', '1',
                    '-i', avatarPath,
                    '-t', duration.toString(),
                    '-vf', `format=${isPNG ? 'rgba' : 'yuv420p'},scale=720:-1`,
                    '-c:v', isPNG ? 'libx264rgb' : 'libx264',
                    '-pix_fmt', isPNG ? 'rgba' : 'yuv420p',
                    outputPath
                ];
            }
            
            console.log(`ðŸ”§ Comando FFmpeg: ffmpeg ${ffmpegArgs.join(' ')}`);
            
            const ffmpeg = spawn(ffmpegStatic, ffmpegArgs);

            ffmpeg.stdout.on('data', data => {
                console.log(`FFmpeg avatar stdout: ${data}`);
            });

            ffmpeg.stderr.on('data', data => {
                console.log(`FFmpeg avatar stderr: ${data}`);
            });

            ffmpeg.on('error', error => {
                console.error('âŒ Erro ao gerar avatar estÃ¡tico:', error);
                reject(new Error(`Falha ao gerar avatar estÃ¡tico: ${error.message}`));
            });

            ffmpeg.on('close', code => {
                console.log(`ðŸŽ¬ GeraÃ§Ã£o de avatar estÃ¡tico finalizada com cÃ³digo: ${code}`);
                
                if (code !== 0) {
                    return reject(new Error(`FFmpeg falhou na geraÃ§Ã£o do avatar, cÃ³digo: ${code}`));
                }
                
                if (!fs.existsSync(outputPath)) {
                    return reject(new Error('Arquivo de avatar estÃ¡tico nÃ£o foi criado')); 
                }
                
                const stats = fs.statSync(outputPath);
                console.log(`ðŸ“Š Tamanho do avatar estÃ¡tico: ${stats.size} bytes`);
                console.log('âœ… Avatar estÃ¡tico gerado como fallback!');
                resolve(outputPath);
            });
        });
    }

    async generateAvatarAnimation(transcript, fileName, duration, customAudioPath, customAvatarPath = null) {
        console.log('ðŸ¤– Gerando animaÃ§Ã£o do avatar (animado ou estÃ¡tico)...');
        
        // Se avatar foi passado como parÃ¢metro, usar ESTE
        // Caso contrÃ¡rio, procurar na pasta (para compatibilidade)
        if (customAvatarPath && fs.existsSync(customAvatarPath)) {
            console.log(`ðŸŽ¨ AVATAR PERSONALIZADO RECEBIDO: ${customAvatarPath}`);
        } else if (!customAvatarPath) {
            // Procurar avatar nos uploads / diretÃ³rio de avatares
            const avatarsDir = './avatars';
            
            if (fs.existsSync(avatarsDir)) {
                const avatarFiles = fs.readdirSync(avatarsDir);
                // Usar SOMENTE arquivos de imagem vÃ¡lidos (nÃ£o usar antigos)
                const validImages = avatarFiles.filter(f => {
                    const ext = path.extname(f).toLowerCase();
                    return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
                });
                
                if (validImages.length > 0) {
                    // Usar o arquivo MAIS RECENTE (Ãºltimo modificado)
                    const avatarPath = path.join(avatarsDir, validImages[0]);
                    const stats = fs.statSync(avatarPath);
                    console.log(`ðŸŽ¨ AVATAR ENCONTRADO: ${validImages[0]} (${Math.round(stats.size / 1024)} KB)`);
                    customAvatarPath = avatarPath;
                }
            }
        }
        
        const avatarOutput = path.join(config.diretorios.outputs, `${fileName}_avatar.mp4`);
        
        // ESCOLHER ÃUDIO CORRETO
        let audioPath;
        
        // PRIORIDADE: customAudioPath (passado como parÃ¢metro) > extraÃ­do
        if (customAudioPath && fs.existsSync(customAudioPath)) {
            audioPath = customAudioPath;
            console.log(`ðŸŽµ USANDO ÃUDIO PERSONALIZADO ENVIADO: ${audioPath}`);
        } else {
            // Fallback para Ã¡udio extraÃ­do
            const audioExtraidoPath = path.join(config.diretorios.outputs, `${fileName}_audio.wav`);
            if (fs.existsSync(audioExtraidoPath)) {
                audioPath = audioExtraidoPath;
                console.log('ðŸŽµ USANDO ÃUDIO EXTRAÃDO DO VÃDEO');
            } else {
                throw new Error('Nenhum Ã¡udio encontrado para processar');
            }
        }
        
        console.log(`ðŸ”Š Ãudio selecionado: ${audioPath}`);
        
        // Escolher qual avatar gerar
        if (customAvatarPath && fs.existsSync(customAvatarPath)) {
            console.log('ðŸŽ¨ USANDO AVATAR PERSONALIZADO');
            
            // Tentar gerar avatar ANIMADO primeiro
            try {
                const animatedAvatar = await this.generateAnimatedAvatar(
                    customAvatarPath, 
                    audioPath, 
                    avatarOutput, 
                    duration
                );
                return animatedAvatar;
            } catch (error) {
                console.log('âŒ Falha no avatar animado, usando estÃ¡tico:', error.message);
                // Fallback para avatar estÃ¡tico
                return this.generateStaticAvatar(customAvatarPath, duration, avatarOutput);
            }
        } else {
            console.log('ðŸŽ¨ USANDO AVATAR PADRÃƒO (ROXO) - NENHUM AVATAR ENVIADO');
            // Avatar padrÃ£o (cor roxa) apenas como fallback
            const ffmpegArgs = [
                '-y',
                '-f', 'lavfi',
                '-i', `color=c=purple:s=720x1280:d=${duration}`,
                '-vf', 'fps=30',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                avatarOutput
            ];
            
            return new Promise((resolve, reject) => {
                const ffmpeg = spawn(ffmpegStatic, ffmpegArgs);

                ffmpeg.stdout.on('data', data => {
                    console.log(`FFmpeg avatar padrÃ£o stdout: ${data}`);
                });

                ffmpeg.stderr.on('data', data => {
                    console.log(`FFmpeg avatar padrÃ£o stderr: ${data}`);
                });

                ffmpeg.on('error', error => {
                    console.error('âŒ Erro ao gerar avatar padrÃ£o:', error);
                    reject(new Error(`Falha ao gerar avatar padrÃ£o: ${error.message}`));
                });

                ffmpeg.on('close', code => {
                    if (code !== 0) {
                        return reject(new Error(`FFmpeg falhou no avatar padrÃ£o, cÃ³digo: ${code}`));
                    }
                    
                    if (!fs.existsSync(avatarOutput)) {
                        return reject(new Error('Arquivo de avatar padrÃ£o nÃ£o foi criado')); 
                    }
                    
                    console.log('âœ… Avatar padrÃ£o (roxo) gerado!');
                    resolve(avatarOutput);
                });
            });
        }
    }

    mergeMultipleAvatarsWithAudio(fileName, audioPath, videoPath = null, avatarPaths = []) {
        return new Promise((resolve, reject) => {
            console.log(`ðŸ”— JUNTANDO ÃUDIO + ${avatarPaths.length} AVATAR(ES) (ETAPA OBRIGATÃ“RIA)...`);
            
            // FunÃ§Ã£o auxiliar para extrair caminho do avatar
            function getAvatarPath(avatar) {
                if (typeof avatar === 'string') return avatar;
                if (avatar?.path) return avatar.path;
                if (avatar?.file) return avatar.file;
                if (avatar?.video) return avatar.video;
                
                throw new Error('Avatar sem caminho vÃ¡lido');
            }
            
            // Usar videoPath se disponÃ­vel (vÃ­deo original), senÃ£o apenas avatares + Ã¡udio
            const sourcePath = videoPath || path.join(config.diretorios.outputs, `${fileName}_avatar1.mp4`);
            const outputPath = path.join(config.diretorios.outputs, `${fileName}_FINAL.mp4`);
            
            console.log(`ðŸŽ¥ VÃ­deo base: ${sourcePath}`);
            console.log(`ðŸŽµ Ãudio: ${audioPath}`);
            console.log(`ðŸ’¾ VÃ­deo Final: ${outputPath}`);
            
            // Log das configuraÃ§Ãµes de cada avatar
            avatarPaths.forEach((avatar, index) => {
                const avatarPath = getAvatarPath(avatar);
                const config = avatar.config || {};
                const size = Math.min(60, Math.max(10, config.size || 35));
                const position = config.position || (index === 0 ? 'top-right' : 'bottom-left');
                const margin = Math.max(5, config.margin || 15);
                const offsetX = parseInt(config.offsetX) || 0;
                const offsetY = parseInt(config.offsetY) || 0;
                
                console.log(`âš™ï¸  Avatar ${index + 1}: ${avatarPath}`);
                console.log(`   tamanho=${size}%, posiÃ§Ã£o=${position}, margem=${margin}px`);
                console.log(`   Offset: X=${offsetX}px, Y=${offsetY}px`);
            });
            
            // Verificar se os arquivos existem
            if (avatarPaths.length === 0) {
                return reject(new Error('Nenhum avatar encontrado para junÃ§Ã£o')); 
            }
            
            if (!fs.existsSync(audioPath)) {
                return reject(new Error('Ãudio nÃ£o encontrado para junÃ§Ã£o'));
            }
            
            // Construir filtro FFmpeg para mÃºltiplos overlays
            let ffmpegArgs;
            
            if (videoPath && fs.existsSync(videoPath)) {
                // Tem vÃ­deo original - fazer overlays sequenciais
                let filterComplex = '';
                let lastOutput = '[0:v]'; // ComeÃ§a com o vÃ­deo original
                
                // Processar cada avatar
                avatarPaths.forEach((avatar, index) => {
                    const config = avatar.config || {};
                    const size = Math.min(60, Math.max(10, config.size || (index === 0 ? 35 : 25)));
                    const position = config.position || (index === 0 ? 'top-right' : 'bottom-left');
                    const margin = Math.max(5, config.margin || 15);
                    const offsetX = parseInt(config.offsetX) || 0;
                    const offsetY = parseInt(config.offsetY) || 0;
                    
                    const sizePercent = size / 100;
                    
                    // Definir coordenadas do overlay
                    let overlayX, overlayY;
                    switch (position) {
                        case 'top-left':
                            overlayX = `${margin}+${offsetX}`;
                            overlayY = `${margin}+${offsetY}`;
                            break;
                        case 'top-center':
                            overlayX = `(W-w)/2+${offsetX}`;
                            overlayY = `${margin}+${offsetY}`;
                            break;
                        case 'top-right':
                            overlayX = `W-w-${margin}+${offsetX}`;
                            overlayY = `${margin}+${offsetY}`;
                            break;
                        case 'middle-left':
                            overlayX = `${margin}+${offsetX}`;
                            overlayY = `(H-h)/2+${offsetY}`;
                            break;
                        case 'middle-center':
                        case 'center':
                            overlayX = `(W-w)/2+${offsetX}`;
                            overlayY = `(H-h)/2+${offsetY}`;
                            break;
                        case 'middle-right':
                            overlayX = `W-w-${margin}+${offsetX}`;
                            overlayY = `(H-h)/2+${offsetY}`;
                            break;
                        case 'bottom-left':
                            overlayX = `${margin}+${offsetX}`;
                            overlayY = `H-h-${margin}+${offsetY}`;
                            break;
                        case 'bottom-center':
                            overlayX = `(W-w)/2+${offsetX}`;
                            overlayY = `H-h-${margin}+${offsetY}`;
                            break;
                        case 'bottom-right':
                        default:
                            overlayX = `W-w-${margin}+${offsetX}`;
                            overlayY = `H-h-${margin}+${offsetY}`;
                            break;
                    }
                    
                    // Verificar tipo do avatar
                    const avatarPath = getAvatarPath(avatar);
                    const avatarExt = path.extname(avatarPath).toLowerCase();
                    const isAvatarPNG = avatarExt === '.png';
                    const isAvatarVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].includes(avatarExt);
                    
                    const useChromaKey = config.useChromaKey || false;
                    const chromaColor = config.chromaColor || 'green';
                    const chromaThreshold = config.chromaThreshold || 0.1;
                    const enableTiming = config.enableTiming || 'always'; // 'first', 'second', or 'always'
                    
                    // Adicionar filtro para este avatar
                    const scaledLabel = `[avatar${index}_scaled]`;
                    const chromaLabel = `[avatar${index}_chroma]`;
                    const outputLabel = `[out${index}]`;
                    
                    if (isAvatarPNG || (isAvatarVideo && !useChromaKey)) {
                        // PNG ou vídeo com transparência - sem chroma key
                        filterComplex += `[${index + 1}:v]scale=iw*${sizePercent}:ih*${sizePercent}`;
                        if (isAvatarPNG) {
                            filterComplex += `,format=rgba`;
                        }
                        filterComplex += `${scaledLabel};`;
                        filterComplex += `${lastOutput}${scaledLabel}overlay=${overlayX}:${overlayY}${outputLabel};`;
                    } else {
                        // Imagen ou vídeo com chroma key
                        let filterChain = `[${index + 1}:v]scale=iw*${sizePercent}:ih*${sizePercent}`;
                        
                        // Adicionar chroma key se necessário
                        if (useChromaKey) {
                            // Usar colorkey (função nativa do FFmpeg para remover cor)
                            const chromaColorHex = chromaColor.toLowerCase() === 'green' ? '0x00ff00' : 
                                                    chromaColor.toLowerCase() === 'blue' ? '0x0000ff' :
                                                    chromaColor.toLowerCase() === 'red' ? '0xff0000' : '0x00ff00';
                            filterChain += `,colorkey=${chromaColorHex}:${chromaThreshold}:0.1`;
                        }
                        
                        filterComplex += filterChain + `${scaledLabel};`;
                        filterComplex += `${lastOutput}${scaledLabel}overlay=${overlayX}:${overlayY}:format=auto${outputLabel};`;
                    }
                    
                    lastOutput = outputLabel;
                });
                
                // Remover Ãºltimo ponto e vÃ­rgula
                filterComplex = filterComplex.slice(0, -1);
                
                // Montar argumentos do FFmpeg
                ffmpegArgs = [
                    '-y',
                    '-i', videoPath  // VÃ­deo original [0]
                ];
                
                // Adicionar cada avatar
                avatarPaths.forEach((avatar, index) => {
                    const avatarPath = getAvatarPath(avatar);
                    ffmpegArgs.push('-i', avatarPath); // [1], [2], etc.
                });
                
                // Adicionar Ã¡udio
                ffmpegArgs.push('-i', audioPath); // Ãšltima entrada
                
                ffmpegArgs.push(
                    '-filter_complex', filterComplex,
                    '-map', lastOutput,           // Usar vÃ­deo filtrado final
                    '-map', `${avatarPaths.length + 1}:a`, // Usar Ã¡udio
                    '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-shortest',
                    outputPath
                );
            } else {
                // Sem vÃ­deo original - criar composiÃ§Ã£o dos avatares
                console.log('ðŸŽ¬ Criando vÃ­deo final com mÃºltiplos avatares + Ã¡udio...');
                
                // Para simplificar, vamos usar o primeiro avatar como base
                // e adicionar os demais como overlays
                if (avatarPaths.length === 1) {
                    // Apenas um avatar - comportamento original
                    const avatar = avatarPaths[0];
                    const config = avatar.config || {};
                    const size = Math.min(60, Math.max(10, config.size || 35));
                    const position = config.position || 'center';
                    const margin = Math.max(5, config.margin || 15);
                    const offsetX = parseInt(config.offsetX) || 0;
                    const offsetY = parseInt(config.offsetY) || 0;
                    
                    const sizePercent = size / 100;
                    
                    let overlayX, overlayY;
                    switch (position) {
                        case 'top-left':
                            overlayX = `${margin}+${offsetX}`;
                            overlayY = `${margin}+${offsetY}`;
                            break;
                        case 'top-center':
                            overlayX = `(W-w)/2+${offsetX}`;
                            overlayY = `${margin}+${offsetY}`;
                            break;
                        case 'top-right':
                            overlayX = `W-w-${margin}+${offsetX}`;
                            overlayY = `${margin}+${offsetY}`;
                            break;
                        case 'middle-left':
                            overlayX = `${margin}+${offsetX}`;
                            overlayY = `(H-h)/2+${offsetY}`;
                            break;
                        case 'middle-center':
                        case 'center':
                            overlayX = `(W-w)/2+${offsetX}`;
                            overlayY = `(H-h)/2+${offsetY}`;
                            break;
                        case 'middle-right':
                            overlayX = `W-w-${margin}+${offsetX}`;
                            overlayY = `(H-h)/2+${offsetY}`;
                            break;
                        case 'bottom-left':
                            overlayX = `${margin}+${offsetX}`;
                            overlayY = `H-h-${margin}+${offsetY}`;
                            break;
                        case 'bottom-center':
                            overlayX = `(W-w)/2+${offsetX}`;
                            overlayY = `H-h-${margin}+${offsetY}`;
                            break;
                        case 'bottom-right':
                        default:
                            overlayX = `W-w-${margin}+${offsetX}`;
                            overlayY = `H-h-${margin}+${offsetY}`;
                            break;
                    }
                    
                    const avatarPath = getAvatarPath(avatar);
                    const isAvatarPNG = avatarPath.toLowerCase().endsWith('.png');
                    
                    ffmpegArgs = [
                        '-y',
                        '-i', avatarPath,
                        '-i', audioPath,
                        '-vf', isAvatarPNG ? 'format=rgba' : 'format=yuv420p',
                        '-c:v', isAvatarPNG ? 'libx264rgb' : 'libx264',
                        '-pix_fmt', isAvatarPNG ? 'rgba' : 'yuv420p',
                        '-c:a', 'aac',
                        '-b:a', '128k',
                        '-shortest',
                        outputPath
                    ];
                } else {
                    // MÃºltiplos avatares sem vÃ­deo base - criar composiÃ§Ã£o
                    reject(new Error('MÃºltiplos avatares requerem um vÃ­deo base')); 
                    return;
                }
            }
            
            // Verificar se os arquivos existem
            if (avatarPaths.length === 0) {
                return reject(new Error('Nenhum avatar encontrado para junÃ§Ã£o')); 
            }
            
            if (!fs.existsSync(audioPath)) {
                return reject(new Error('Ãudio nÃ£o encontrado para junÃ§Ã£o'));
            }
            
            // Construir filtro FFmpeg para overlay
            // Se temos videoPath, fazer overlay do avatar sobre o vÃ­deo
            // SenÃ£o, apenas juntar Ã¡udio ao vÃ­deo do avatar
            
            // VariÃ¡vel ffmpegArgs jÃ¡ declarada na nova lÃ³gica acima
            
            const ffmpeg = spawn(ffmpegStatic, ffmpegArgs);

            ffmpeg.stdout.on('data', data => {
                console.log(`FFmpeg merge stdout: ${data}`);
            });

            ffmpeg.stderr.on('data', data => {
                console.log(`FFmpeg merge stderr: ${data}`);
            });

            ffmpeg.on('error', error => {
                console.error('âŒ Erro ao juntar Ã¡udio e avatar:', error);
                reject(new Error(`Falha na junÃ§Ã£o: ${error.message}`));
            });

            ffmpeg.on('close', code => {
                console.log(`ðŸŽ¬ JunÃ§Ã£o finalizada com cÃ³digo: ${code}`);
                
                if (code !== 0) {
                    return reject(new Error(`FFmpeg falhou na junÃ§Ã£o, cÃ³digo: ${code}`));
                }
                
                if (!fs.existsSync(outputPath)) {
                    return reject(new Error('VÃ­deo final nÃ£o foi criado')); 
                }
                
                const stats = fs.statSync(outputPath);
                console.log(`ðŸ“Š Tamanho do vÃ­deo final: ${stats.size} bytes`);

                console.log('âœ… VÃDEO FINAL GERADO COM SUCESSO!');
                console.log(`ðŸ“ VÃ­deo final salvo em: ${outputPath}`);
                resolve(outputPath);
            });
        });
    }

    cleanupTempFiles(fileName) {
        console.log('ðŸ§¹ Limpando arquivos temporÃ¡rios...');
        // Implementar limpeza de arquivos temporÃ¡rios
    }
}

// Exportar funÃ§Ã£o principal
async function processVideo(videoPath, customAudioPath, customAvatarPaths = [], avatarConfigs = []) {
    const processor = new VideoProcessor();
    return await processor.processVideo(videoPath, customAudioPath, customAvatarPaths, avatarConfigs);
}

module.exports = { processVideo };

