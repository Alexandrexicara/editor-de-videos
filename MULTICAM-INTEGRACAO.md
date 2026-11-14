# Integração MultiCam Music Studio

O MultiCam foi incorporado como módulo isolado em `/multicam`. O projeto original permanece em seu repositório próprio e esta cópia não substitui os arquivos do Cine Séries.

## Arquitetura

- Cine Séries (Netlify): publica a página `/multicam.html` e mantém as ferramentas existentes.
- MultiCam local: executa no computador conectado às webcams, microfones e demais dispositivos USB.
- O painel local usa a porta 3000; o controle remoto usa 3002; o servidor opcional de câmera móvel usa 3001.
- FFmpeg precisa estar instalado no computador local e disponível no PATH.
- O serviço de captura não deve ser iniciado no Render: um servidor em nuvem não tem acesso às câmeras USB do computador do usuário.

## Windows

1. Instale Node.js 18 ou superior e FFmpeg.
2. Entre na pasta `multicam`.
3. Execute `INICIAR-SISTEMA.bat`. O script instala as dependências se necessário, abre o controle remoto e inicia o painel local.
4. Acesse `http://localhost:3000`.
5. Para receber vídeo de um celular, execute `npm run mobile:camera` em outro terminal e use o IP local do computador na porta 3001.
6. Para controlar a gravação pelo celular, use o IP local do computador na porta 3002.

## Segurança e armazenamento

As gravações e os arquivos temporários são locais. Pastas `node_modules`, `cameras`, `clips`, `output` e `downloads` ficam fora do Git. Não coloque chaves, tokens ou gravações privadas no repositório.

## Validação

A integração de interface foi adicionada em branch separada. A captura real depende de teste no computador com câmeras, microfone e FFmpeg instalados; não declarar validação de hardware até esse teste ser realizado.
