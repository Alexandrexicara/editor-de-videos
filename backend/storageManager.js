/**
 * Storage Manager - Gerencia espaço em disco e limpeza automática
 * Previne que o servidor fique sem espaço
 */

const fs = require('fs');
const path = require('path');

class StorageManager {
    constructor(config) {
        this.config = config;
        this.settings = {
            // Arquivos finais pertencem ao usuário: retenção automática fica desativada por padrão.
            // Configure MAX_OUTPUT_AGE_DAYS explicitamente para habilitar expiração.
            MAX_OUTPUT_AGE_DAYS: process.env.MAX_OUTPUT_AGE_DAYS === undefined ? 0 : Math.max(0, parseInt(process.env.MAX_OUTPUT_AGE_DAYS, 10) || 0),
            MAX_TEMP_AGE_HOURS: parseInt(process.env.MAX_TEMP_AGE_HOURS) || 24,
            MIN_FREE_SPACE_MB: parseInt(process.env.MIN_FREE_SPACE_MB) || 500,
            MAX_VIDEO_SIZE_MB: parseInt(process.env.MAX_VIDEO_SIZE_MB) || 500,
        };
    }

    /**
     * Inicia monitoramento de espaço em disco
     */
    startMonitoring(intervalMinutes = 30) {
        console.log(`📊 Storage Manager iniciado - Verificação a cada ${intervalMinutes} minutos`);
        
        // Verificar imediatamente
        this.checkAndCleanup();
        
        // Verificar periodicamente
        setInterval(() => {
            console.log('📊 Verificação periódica de espaço em disco...');
            this.checkAndCleanup();
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Verifica espaço e faz limpeza se necessário
     */
    checkAndCleanup() {
        try {
            const diskInfo = this.getDiskSpace();
            const freeMB = diskInfo.freeMB;
            const usedPercent = diskInfo.usedPercent;
            
            console.log(`💾 Espaço: ${freeMB.toFixed(2)}MB livre (${usedPercent.toFixed(1)}% usado)`);
            
            if (freeMB < this.settings.MIN_FREE_SPACE_MB) {
                console.warn(`⚠️  CRÍTICO: Menos de ${this.settings.MIN_FREE_SPACE_MB}MB disponível!`);
                this.performEmergencyCleanup();
            } else if (usedPercent > 85) {
                console.warn('⚠️  Espaço em disco > 85% - Iniciando limpeza preventiva');
                this.performPreventiveCleanup();
            }
        } catch (err) {
            console.warn(`⚠️  Erro ao verificar espaço: ${err.message}`);
        }
    }

    /**
     * Obtém informações de espaço em disco
     */
    getDiskSpace() {
        // Não inventar capacidade livre: use os dados reais do filesystem.
        // statfsSync existe nas versões atuais do Node exigidas pelo projeto.
        const target = fs.existsSync(this.config.diretorios.uploads)
            ? this.config.diretorios.uploads
            : process.cwd();
        const info = fs.statfsSync(target);
        const blockSize = Number(info.bsize);
        const totalBlocks = Number(info.blocks);
        const availableBlocks = Number(info.bavail);
        const freeMB = (availableBlocks * blockSize) / (1024 * 1024);
        const usedPercent = totalBlocks > 0
            ? ((totalBlocks - Number(info.bfree)) / totalBlocks) * 100
            : 0;
        if (!Number.isFinite(freeMB) || !Number.isFinite(usedPercent)) {
            throw new Error('O sistema não retornou estatísticas válidas do disco.');
        }
        return { freeMB, usedPercent };
    }

    /**
     * Limpeza preventiva - remove arquivos antigos
     */
    performPreventiveCleanup() {
        console.log('🧹 Limpeza preventiva iniciada');
        
        // Nunca apagar vídeos finais silenciosamente por padrão.
        // A expiração só é ativada quando MAX_OUTPUT_AGE_DAYS é configurado > 0.
        if (this.settings.MAX_OUTPUT_AGE_DAYS > 0) {
            this.cleanupDirectory(
                this.config.diretorios.outputs,
                this.settings.MAX_OUTPUT_AGE_DAYS * 24 * 60 * 60 * 1000,
                'output'
            );
        }
        
        // Remover temporários com mais de 24h
        this.cleanupDirectory(
            this.config.diretorios.temporarios,
            this.settings.MAX_TEMP_AGE_HOURS * 60 * 60 * 1000,
            'temporário'
        );
    }

    /**
     * Limpeza de emergência - remove TODOS os files antigos agressivamente
     */
    performEmergencyCleanup() {
        console.log('🚨 LIMPEZA DE EMERGÊNCIA - Espaço crítico!');
        
        // Mesmo em emergência, preservar os vídeos finais do usuário.
        // Se uma retenção foi configurada explicitamente, respeitar exatamente esse prazo.
        if (this.settings.MAX_OUTPUT_AGE_DAYS > 0) {
            this.cleanupDirectory(
                this.config.diretorios.outputs,
                this.settings.MAX_OUTPUT_AGE_DAYS * 24 * 60 * 60 * 1000,
                'output_emergência'
            );
        }
        
        // Remover temp com mais de 2h
        this.cleanupDirectory(
            this.config.diretorios.temporarios,
            2 * 60 * 60 * 1000,
            'temporário_emergência'
        );
        
        // Remover uploads antigos
        this.cleanupDirectory(
            this.config.diretorios.uploads,
            3 * 24 * 60 * 60 * 1000,
            'upload'
        );
    }

    /**
     * Remove arquivos antigos de um diretório
     */
    cleanupDirectory(dirPath, maxAgeMs, label) {
        try {
            if (!fs.existsSync(dirPath)) return;
            
            const files = fs.readdirSync(dirPath);
            const now = Date.now();
            let deleted = 0;
            let freedMB = 0;
            
            files.forEach(file => {
                const filePath = path.join(dirPath, file);
                
                try {
                    const stats = fs.statSync(filePath);
                    const age = now - stats.mtimeMs;
                    
                    if (age > maxAgeMs) {
                        if (stats.isDirectory()) {
                            this.deleteDirectory(filePath);
                        } else {
                            freedMB += stats.size / 1024 / 1024;
                            fs.unlinkSync(filePath);
                        }
                        deleted++;
                    }
                } catch (err) {
                    console.warn(`⚠️  Erro ao processar ${filePath}: ${err.message}`);
                }
            });
            
            if (deleted > 0) {
                console.log(`✅ ${label}: ${deleted} arquivo(s) removido(s) - ${freedMB.toFixed(2)}MB liberado`);
            }
        } catch (err) {
            console.warn(`⚠️  Erro ao limpar ${label}: ${err.message}`);
        }
    }

    /**
     * Deleta diretório recursivamente
     */
    deleteDirectory(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                const filePath = path.join(dirPath, file);
                if (fs.lstatSync(filePath).isDirectory()) {
                    this.deleteDirectory(filePath);
                } else {
                    fs.unlinkSync(filePath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }

    /**
     * Valida tamanho do arquivo antes de processar
     */
    validateFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const sizeMB = stats.size / 1024 / 1024;
            
            if (sizeMB > this.settings.MAX_VIDEO_SIZE_MB) {
                throw new Error(`Arquivo muito grande: ${sizeMB.toFixed(2)}MB (máximo: ${this.settings.MAX_VIDEO_SIZE_MB}MB)`);
            }
            
            return true;
        } catch (err) {
            if (err.message.includes('muito grande')) {
                throw err;
            }
            throw new Error(`Erro ao validar arquivo: ${err.message}`);
        }
    }

    /**
     * Obtém estatísticas do sistema de armazenamento
     */
    getStorageStats() {
        const stats = {};
        
        ['uploads', 'outputs', 'temporarios'].forEach(dir => {
            const dirPath = this.config.diretorios[dir];
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath);
                let totalSize = 0;
                
                files.forEach(file => {
                    try {
                        const filePath = path.join(dirPath, file);
                        const fileStats = fs.statSync(filePath);
                        totalSize += fileStats.size;
                    } catch (err) {
                        // ignore
                    }
                });
                
                stats[dir] = {
                    files: files.length,
                    sizeMB: (totalSize / 1024 / 1024).toFixed(2)
                };
            }
        });
        
        return stats;
    }
}

module.exports = StorageManager;
