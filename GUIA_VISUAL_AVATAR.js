/**
 * GUIA VISUAL DO SISTEMA DE CONFIGURAÇÃO DE AVATAR
 * ================================================
 * 
 * INTERFACE WEB: http://localhost:3001
 * 
 * ┌─────────────────────────────────────────────────────────────┐
 * │                  🎬 CONFIGURAR AVATAR                       │
 * │                                                             │
 * │ ┌────────────────────────┐  ┌──────────────────────────┐   │
 * │ │   CONTROLES            │  │   PREVIEW                │   │
 * │ │                        │  │                          │   │
 * │ │ 📏 Tamanho do Avatar:  │  │  ┌──────────────────────┐│   │
 * │ │ [====●─────] 35%       │  │  │ │                    ││   │
 * │ │                        │  │  │ │                    ││   │
 * │ │ 📍 Posição:            │  │  │ │                    ││   │
 * │ │ ┌─────┬─────┬─────┐   │  │  │ │                    ││   │
 * │ │ │  ↖  │  ↑  │  ↗  │   │  │  │ │                    ││   │
 * │ │ ├─────┼─────┼─────┤   │  │  │ │       AVATAR       ││   │
 * │ │ │  ←  │  ●  │  →  │   │  │  │ │   (redimensionado  ││   │
 * │ │ ├─────┼─────┼─────┤   │  │  │ │   na posição)      ││   │
 * │ │ │  ↙  │  ↓  │ ↘✓ │   │  │  │ │                    ││   │
 * │ │ └─────┴─────┴─────┘   │  │  │ │                    ││   │
 * │ │ (● = selecionado)      │  │  │ │                    ││   │
 * │ │                        │  │  │ └──────────────────────┘│   │
 * │ │ 📐 Margem:             │  │  │ Aspecto 9:16 (vertical)  │   │
 * │ │ [──●────────] 15px     │  │                             │   │
 * │ │                        │  │  Posição: bottom-right     │   │
 * │ │ UPLOAD DE ARQUIVOS     │  │  Tamanho: 35%             │   │
 * │ │ ──────────────────     │  │  Margem: 15px             │   │
 * │ │                        │  │                            │   │
 * │ │ 🎬 Vídeo: [Escolher]   │  └──────────────────────────┘   │
 * │ │ 🎵 Áudio: [Escolher]   │                                │   │
 * │ │ 🎨 Avatar: [Escolher]  │                                │   │
 * │ │                        │                                │   │
 * │ │ [━━━━ PROCESSAR ━━━━]  │                                │   │
 * │ │                        │                                │   │
 * │ └────────────────────────┘                                │   │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * 
 * POSIÇÕES DISPONÍVEIS (9 OPÇÕES)
 * ═════════════════════════════════════════════════════════════
 * 
 * Top-Left        │ Top-Center      │ Top-Right
 * ↖ Corner        │ ↑ Top           │ ↗ Corner
 * ─────────────────┼─────────────────┼─────────────────
 * Middle-Left     │ Middle-Center   │ Middle-Right
 * ← Left          │ ● Center        │ → Right
 * ─────────────────┼─────────────────┼─────────────────
 * Bottom-Left     │ Bottom-Center   │ Bottom-Right ✓
 * ↙ Corner        │ ↓ Bottom        │ ↘ Corner (default)
 * 
 * 
 * TAMANHO (SLIDER)
 * ═════════════════════════════════════════════════════════════
 * 
 * Mínimo: 10%  ─ Avatar muito pequeno
 * Padrão: 35%  ─ Avatar em tamanho moderado
 * Máximo: 60%  ─ Avatar grande (quase tela inteira)
 * 
 * [10%]────[35%]────────────────[60%]
 *  ↓        ↓                      ↓
 *  Tiny     Medium                 Large
 * 
 * 
 * MARGEM (SLIDER)
 * ═════════════════════════════════════════════════════════════
 * 
 * Mínimo: 5px   ─ Avatar bem perto da borda
 * Padrão: 15px  ─ Espaço confortável
 * Máximo: 50px  ─ Avatar longe da borda
 * 
 * [5px]─[15px]────────────────────[50px]
 *  ↓     ↓                           ↓
 *  Near  Medium                      Far
 * 
 * 
 * PIPELINE DE PROCESSAMENTO
 * ═════════════════════════════════════════════════════════════
 * 
 * ENTRADA (Frontend)
 * ┌──────────────────────────────────────┐
 * │ ✓ Vídeo Original                     │
 * │ ✓ Áudio Personalizado (opcional)     │
 * │ ✓ Avatar (imagem)                    │
 * │ ✓ Configuração:                      │
 * │   - Tamanho: 35%                     │
 * │   - Posição: bottom-right            │
 * │   - Margem: 15px                     │
 * └──────────────────────────────────────┘
 *            ↓
 * PROCESSAMENTO (Backend)
 * ┌──────────────────────────────────────┐
 * │ 1. Extrair duração do vídeo          │
 * │ 2. Determinar áudio (personalizado)  │
 * │ 3. Transcrever áudio                 │
 * │ 4. Gerar avatar animado/estático     │
 * │ 5. APLICAR CONFIGURAÇÃO:             │
 * │    - Scale: 720*0.35:ih              │
 * │    - Overlay: x=W-w-15, y=H-h-15    │
 * │ 6. Mesclar áudio + avatar            │
 * └──────────────────────────────────────┘
 *            ↓
 * SAÍDA (Vídeo Final)
 * ┌──────────────────────────────────────┐
 * │ Vídeo com avatar:                    │
 * │ • Redimensionado (35% da tela)       │
 * │ • Posicionado (inferior direita)     │
 * │ • Com margem (15px)                  │
 * │ • Com áudio sincronizado             │
 * │ • Pronto para download               │
 * └──────────────────────────────────────┘
 * 
 * 
 * EXEMPLOS DE CONFIGURAÇÃO
 * ═════════════════════════════════════════════════════════════
 * 
 * Exemplo 1: Pequeno e Discreto
 * ┌────────────────────────────────────────┐
 * │                                        │
 * │                                        │
 * │                                        │
 * │                                        │
 * │                         ┌────┐         │
 * │                         │ A  │         │
 * │                         │ V  │         │
 * │                         │ A  │         │
 * │                         │ T  │         │
 * │                         └────┘         │
 * │                          15px→←5%      │
 * └────────────────────────────────────────┘
 * Tamanho: 10%, Posição: bottom-right, Margem: 15px
 * 
 * Exemplo 2: Médio e Centrado
 * ┌────────────────────────────────────────┐
 * │                                        │
 * │                                        │
 * │           ┌──────────┐                 │
 * │           │  AVATAR  │                 │
 * │           │          │                 │
 * │           │          │                 │
 * │           └──────────┘                 │
 * │                                        │
 * │                                        │
 * │                                        │
 * └────────────────────────────────────────┘
 * Tamanho: 35%, Posição: middle-center, Margem: 20px
 * 
 * Exemplo 3: Grande no Canto Superior
 * ┌────────────────────────────────────────┐
 * │  ┌──────────────────┐                  │
 * │  │      AVATAR      │                  │
 * │  │      (Grande)    │                  │
 * │  │      60% tela    │                  │
 * │  └──────────────────┘                  │
 * │                                        │
 * │                                        │
 * │                                        │
 * │                                        │
 * │                                        │
 * └────────────────────────────────────────┘
 * Tamanho: 60%, Posição: top-left, Margem: 10px
 * 
 * 
 * URLS IMPORTANTES
 * ═════════════════════════════════════════════════════════════
 * 
 * Interface:      http://localhost:3001
 * Download:       http://localhost:3001/download/:filename
 * Status Servidor: http://localhost:3001/status
 * Listar Vídeos:  http://localhost:3001/videos
 * 
 * 
 * COMANDOS FFmpeg GERADOS
 * ═════════════════════════════════════════════════════════════
 * 
 * Para "bottom-right, 35%, 15px":
 * 
 * ffmpeg \\
 *   -i video.mp4 \\
 *   -i avatar.mp4 \\
 *   -i audio.m4a \\
 *   -filter_complex "[0:v]scale=iw*0.35:ih*0.35[avatar_scaled];
 *                    [1:v][avatar_scaled]overlay=x=W-w-15:y=H-h-15[out]" \\
 *   -map "[out]" \\
 *   -map "2:a" \\
 *   -c:v libx264 -c:a aac -b:a 128k \\
 *   -shortest output.mp4
 * 
 * 
 * VARIÁVEIS FFmpeg EXPLICADAS
 * ═════════════════════════════════════════════════════════════
 * 
 * W = Largura do vídeo base (geralmente 720px)
 * H = Altura do vídeo base (geralmente 1280px)
 * w = Largura do avatar redimensionado
 * h = Altura do avatar redimensionado
 * 
 * x = Coordenada X (horizontal)
 * y = Coordenada Y (vertical)
 * 
 * Exemplos:
 * • x=15, y=15              → Top-left (15px margin)
 * • x=(W-w)/2, y=H-h-15     → Bottom-center (15px margin)
 * • x=W-w-15, y=H-h-15      → Bottom-right (15px margin)
 * 
 * 
 * STATUS DO SERVIDOR
 * ═════════════════════════════════════════════════════════════
 * 
 * ✅ Servidor: ONLINE
 * ✅ Porta: 3001
 * ✅ Interface: avatar-config.html (servido em /)
 * ✅ FFmpeg: 6.1.1 (integrado)
 * ✅ Node.js: versão adequada
 * ✅ CORS: Habilitado
 * ✅ Limits: 100MB por arquivo
 * 
 * 
 * TESTE RÁPIDO
 * ═════════════════════════════════════════════════════════════
 * 
 * 1. Abrir: http://localhost:3001
 * 2. Configurar:
 *    - Tamanho: 30% (move o slider)
 *    - Posição: bottom-right (clique no botão)
 *    - Margem: 20px (move o slider)
 * 3. Upload:
 *    - Vídeo: escolher arquivo MP4
 *    - Áudio: escolher arquivo MP3/WAV (opcional)
 *    - Avatar: escolher imagem JPG/PNG
 * 4. Clicar PROCESSAR
 * 5. Aguardar processamento
 * 6. Download do vídeo final via link fornecido
 * 
 * 
 * POSSÍVEIS CUSTOMIZAÇÕES FUTURAS
 * ═════════════════════════════════════════════════════════════
 * 
 * □ Adicionar fundo customizável (cor/imagem)
 * □ Adicionar sombra/brilho do avatar
 * □ Adicionar animação de entrada/saída do avatar
 * □ Adicionar múltiplos avatares simultâneos
 * □ Adicionar filtros de vídeo (blur, vintage, etc)
 * □ Adicionar transição entre cenas
 * □ Adicionar overlays de texto
 * □ Adicionar marca d'água
 * □ Adicionar compressão customizável
 * □ Adicionar preview de vídeo no navegador
 * 
 */
