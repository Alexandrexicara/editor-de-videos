# ⚡ Início Rápido - 5 Passos

## 🎯 Objetivo
Gerar um vídeo com seu avatar personalizado em apenas 5 passos!

---

## Passo 1️⃣ - Acesse a Interface

**Digite na barra de endereço do navegador:**
```
http://localhost:3001/criaçao.html
```

✅ Você verá a interface roxa com o formulário

---

## Passo 2️⃣ - Envie os Arquivos

### Arquivo 1: Vídeo
- Clique em "Escolha arquivo..." na seção "📹 ENVIE SEU VÍDEO"
- Selecione um vídeo em MP4, WebM, MOV ou AVI
- **Tamanho máximo:** 100MB

### Arquivo 2: Avatar (Obrigatório!)
- Clique em "Escolha arquivo..." na seção "👤 ENVIE SUA FOTO DE AVATAR"
- Selecione uma imagem em JPG, PNG, GIF, BMP ou WebP
- **Tamanho máximo:** 100MB
- 💡 **Dica:** Use uma foto clara de rosto por melhores resultados

### Arquivo 3: Áudio (Opcional)
- Se quiser um áudio customizado, clique em "Escolha arquivo..."
- Selecione MP3, WAV, M4A ou AAC
- **Se deixar em branco:** usa o áudio do vídeo original

---

## Passo 3️⃣ - Configure o Avatar

### 1. Tamanho
```
Mova o slider para ajustar o tamanho do avatar
[════●═══════════════════════════════════] 35%
```
- **Mínimo:** 10%
- **Máximo:** 60%
- **Padrão:** 35% (recomendado)

### 2. Posição
Clique em um dos 9 botões:
```
↖️ Superior-Esq    ⬆️ Topo-Centro    ↗️ Superior-Dir
⬅️ Centro-Esq       🎯 CENTRO         ➡️ Centro-Dir
↙️ Inferior-Esq    ⬇️ Base-Centro    ↘️ Inferior-Dir
```
- O botão **selecionado ficará azul**
- **Padrão:** Centro (🎯)

### 3. Margem (espaço das bordas)
```
Mova o slider para o espaço das bordas
[═════●═════════════════════════════════════] 15px
```
- **Mínimo:** 5px
- **Máximo:** 50px
- **Padrão:** 15px (espaço confortável)

### 📊 Resumo
Veja as configurações atuais:
```
Tamanho: 35%
Posição: Centro
Margem: 15px
```

---

## Passo 4️⃣ - Clique em "Gerar Vídeo Final"

✅ O botão está no final da página:
```
┌──────────────────────┬──────────────────────┐
│ Gerar Vídeo Final    │ Limpar Formulário    │
└──────────────────────┴──────────────────────┘
```

**Após clicar:**
- Aparecerá um ⟳ **spinner de carregamento**
- Mostrará: "Processando seu vídeo... Isso pode levar alguns minutos."
- **Não feche a página!**

---

## Passo 5️⃣ - Download Automático

✅ Quando terminar:
1. Uma mensagem verde aparecerá: "✅ Vídeo gerado com sucesso!"
2. O arquivo será **baixado automaticamente**
3. Nome do arquivo: `video-[TIMESTAMP]_FINAL.mp4`
4. Localizado em: Pasta "Downloads" ou "Downloads" do navegador

---

## ✅ Pronto!

Seu vídeo com avatar foi gerado! 🎉

**Próximos passos:**
- Abra o vídeo em qualquer player (VLC, Windows Media Player, etc.)
- Compartilhe em redes sociais
- Faça mais vídeos com outras imagens/áudios!

---

## ⚡ Dicas Importantes

### 📸 Melhor Qualidade de Avatar
- Use **foto clara** com fundo simples
- Rosto centralizado na imagem
- **Boa iluminação** é essencial
- Evite roupas muito escuras ou muito claras

### 🎬 Melhor Qualidade de Vídeo
- Resolução mínima: **480p** (melhor: 1080p)
- Codec: H.264 ou similiar
- Frame rate: 25fps ou 30fps

### 🎵 Melhor Qualidade de Áudio
- **Mono ou Estéreo** funcionam bem
- Taxa de amostragem: 44100Hz ou 48000Hz
- Evite áudio muito comprimido

### ⏱️ Tempo de Processamento
- **2-5 minutos** por vídeo (dependendo do tamanho)
- Computador mais rápido = processamento mais rápido
- Paciência! ⏳

---

## ❌ Se Algo Deu Errado

### Erro: "Selecione vídeo e avatar!"
- ✅ Verifique se selecionou tanto vídeo quanto avatar
- ✅ Verifique extensões (MP4, JPG, PNG, etc.)

### Erro: "Arquivo muito grande"
- ✅ Reduza o tamanho dos arquivos
- ✅ Máximo: 100MB por arquivo

### Vídeo não é gerado
- ✅ Espere mais tempo (pode estar processando)
- ✅ Verifique console do navegador (F12)
- ✅ Reinicie o servidor

### Avatar aparece distorcido
- ✅ Ajuste o tamanho (menor = mais legível)
- ✅ Escolha melhor posição
- ✅ Aumentar margem pode ajudar

---

## 🔄 Para Gerar Outro Vídeo

1. Clique em **"Limpar Formulário"**
2. Selecione novos arquivos
3. Ajuste as configurações
4. Clique em **"Gerar Vídeo Final"** novamente

**Ou acesse novamente:** `http://localhost:3001/criaçao.html`

---

## 🎓 Próximos Passos Avançados

**Quer mais funcionalidades?**
- 🎨 Editor de cores do avatar
- ⏱️ Avatar animado (SyncLabs ou Wav2Lip)
- 🔊 Sincronização labial
- 🎬 Transições e efeitos
- 💾 Salvar projetos

**Entre em contato para solicitar!**

---

## 📱 Suporte

**Problema não resolvido?**
1. Verifique se servidor está rodando: `npm start`
2. Verifique a porta: `http://localhost:3001`
3. Limpe cache do navegador (Ctrl+Shift+Del)
4. Reinicie o navegador

---

**Versão:** 2.0  
**Data:** 03/02/2026  
**Status:** ✅ Pronto para Usar!

Divirta-se criando vídeos! 🎬🎉
