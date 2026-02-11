# 🧹 Storage Manager - Sistema Automático de Limpeza de Disco

## O Problema

Ao processar muitos vídeos, o servidor pode ficar **sem espaço em disco**, causando falhas no processamento. Especialmente em produção na internet, isso é crítico.

## A Solução

O **Storage Manager** foi implementado para:

✅ **Monitorar espaço em disco continuamente**
✅ **Limpar arquivos antigos automaticamente**
✅ **Executar limpeza de emergência quando crítico**
✅ **Validar tamanho de arquivos antes de processar**
✅ **Fornecer API para estatísticas de armazenamento**

---

## 🔧 Configuração

As configurações estão no arquivo `.env`:

```env
# Tempo máximo para manter outputs (em dias)
MAX_OUTPUT_AGE_DAYS=7

# Tempo máximo para manter temporários (em horas)
MAX_TEMP_AGE_HOURS=24

# Espaço mínimo livre obrigatório (em MB)
MIN_FREE_SPACE_MB=500

# Tamanho máximo por vídeo (em MB)
MAX_VIDEO_SIZE_MB=500
```

### Valores Recomendados

**Para desenvolvimento local:**
```env
MAX_OUTPUT_AGE_DAYS=1
MAX_TEMP_AGE_HOURS=2
MIN_FREE_SPACE_MB=200
MAX_VIDEO_SIZE_MB=100
```

**Para servidor em produção:**
```env
MAX_OUTPUT_AGE_DAYS=7
MAX_TEMP_AGE_HOURS=24
MIN_FREE_SPACE_MB=1000
MAX_VIDEO_SIZE_MB=500
```

**Para servidor com pouco disco:**
```env
MAX_OUTPUT_AGE_DAYS=2
MAX_TEMP_AGE_HOURS=4
MIN_FREE_SPACE_MB=2000
MAX_VIDEO_SIZE_MB=100
```

---

## 📊 APIs Disponíveis

### 1️⃣ Verificar Estatísticas de Armazenamento

```bash
GET /api/storage-stats
```

**Resposta exemplo:**
```json
{
  "status": "ok",
  "storage": {
    "uploads": {
      "files": 45,
      "sizeMB": "125.43"
    },
    "outputs": {
      "files": 28,
      "sizeMB": "456.78"
    },
    "temporarios": {
      "files": 5,
      "sizeMB": "12.34"
    }
  },
  "settings": {
    "maxOutputAgeDays": 7,
    "maxTempAgeHours": 24,
    "minFreeSpaceMB": 500,
    "maxVideoSizeMB": 500
  }
}
```

### 2️⃣ Executar Limpeza Manual

```bash
POST /api/cleanup
```

**Resposta exemplo:**
```json
{
  "status": "limpeza_concluida",
  "message": "Limpeza de arquivos antigos concluída",
  "storage": {
    "uploads": { "files": 40, "sizeMB": "110.21" },
    "outputs": { "files": 15, "sizeMB": "280.45" },
    "temporarios": { "files": 0, "sizeMB": "0" }
  }
}
```

---

## 🔄 Fluxo de Funcionamento

```
1. SERVIDOR INICIA
   ↓
2. Storage Manager inicializa
   ↓
3. Verifica espaço em disco
   ├─ Se OK → continua normal
   └─ Se Crítico → limpeza de emergência
   
4. A CADA 30 MINUTOS
   ↓
5. Verifica espaço novamente
   ├─ Se < 500MB → remove outputs antigos
   ├─ Se > 85% uso → limpeza preventiva
   └─ Se OK → continua normal

6. ANTES DE CADA PROCESSAMENTO
   ↓
7. Valida tamanho do arquivo
   ├─ Se > 500MB → rejeita
   └─ Se OK → processa

8. DURANTE PROCESSAMENTO
   ↓
9. Se espaço ficar crítico → para processamento
```

---

## 📁 Diretórios Monitorados

| Diretório | Finalidade | Limpeza |
|-----------|-----------|---------|
| `./uploads/` | Vídeos/áudios enviados | 7 dias (configurável) |
| `./outputs/` | Vídeos processados | 7 dias (configurável) |
| `./temp/` | Arquivos temporários | 24h (configurável) |
| `./avatars/` | Avatares personalizados | Não limpa automaticamente |

---

## 🚨 Estratégias de Limpeza

### Nível 1: Preventiva (Uso > 85%)
- Remove outputs com mais de 7 dias
- Remove temporários com mais de 24h

### Nível 2: Emergência (< 500MB livre)
- Remove outputs com mais de 2 dias ⚠️
- Remove temporários com mais de 2h ⚠️
- Remove uploads com mais de 3 dias ⚠️

---

## 💡 Dicas de Uso

### Para Dashboard/Admin

Adicionar um componente que monitora espaço:

```javascript
// Verificar espaço periodicamente
setInterval(async () => {
  const response = await fetch('/api/storage-stats');
  const data = await response.json();
  
  console.log(`📊 Espaço: ${data.storage.outputs.sizeMB} MB`);
  
  if (data.storage.outputs.files > 100) {
    console.warn('⚠️  Muitos outputs - considere limpar manualmente');
  }
}, 60000); // A cada 1 minuto
```

### Para Monitoramento

Registrar em logs:

```bash
# In your monitoring dashboard
curl http://localhost:3001/api/storage-stats | jq .

# Executar limpeza manual
curl -X POST http://localhost:3001/api/cleanup | jq .
```

---

## 🐛 Troubleshooting

### "Erro: Espaço em disco insuficiente"
1. Verifique com `/api/storage-stats`
2. Execute `/api/cleanup` manualmente
3. Reduza `MAX_OUTPUT_AGE_DAYS` no `.env`

### "Arquivo rejeitado por ser muito grande"
- Aumente `MAX_VIDEO_SIZE_MB` no `.env`
- Ou comprima o vídeo antes de enviar

### Limpeza não está funcionando
- Verifique permissões de pasta
- Confirme que `.env` foi carregado
- Reinicie o servidor

---

## 📈 Monitoramento Recomendado

Para produção, configure alertas:

```javascript
// Alerta se espaço < 1GB
if (freeMB < 1000) {
  sendAlert('Espaço em disco abaixo de 1GB!');
}

// Alerta se outputs > 100 arquivos
if (outputFiles > 100) {
  sendAlert('Mais de 100 outputs - considere limpeza');
}
```

---

## ✅ Checklist de Configuração

- [ ] Revisar valores em `.env` conforme seu servidor
- [ ] Testar `/api/storage-stats` 
- [ ] Testar `/api/cleanup` manualmente
- [ ] Monitorar logs do Storage Manager
- [ ] Configurar alertas em seu dashboard
- [ ] Documentar política de retenção para usuários

---

**Desenvolvido para evitar "disco cheio" em produção! 🚀**
