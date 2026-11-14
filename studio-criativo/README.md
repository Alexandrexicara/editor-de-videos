# Studio Criativo AI — Cine Séries

Módulo integrado ao frontend do Cine Séries. O build gera os arquivos em `frontend/studio-criativo` para publicação no mesmo Netlify.

- Editor Fabric.js: imagens, texto, formas, camadas, opacidade, rotação e histórico desfazer/refazer.
- Modelos rápidos para promoções, eventos e produtos.
- Exportação PNG, JPG, WebP e impressão/salvamento em PDF.
- Projetos na nuvem por usuário, usando a sessão já existente do Cine Séries e PostgreSQL.
- Criação e edição de imagens via endpoint NVIDIA já usado pelo Cine Séries; as chaves permanecem no backend.

As imagens são incorporadas ao documento do projeto e limitadas a 5 MB por arquivo. O backend cria somente a tabela `studio_projects`, sem alterar tabelas de usuários, pagamentos ou carteira.
