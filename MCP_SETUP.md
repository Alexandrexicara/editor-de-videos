# MCP — Rolezando Avatar Editor

Esta integração adiciona um servidor MCP local sem substituir o backend Express, o frontend, o áudio ou o pipeline de processamento existente.

## Requisitos

- Node.js 18 ou superior
- Dependências do projeto instaladas
- O editor e os arquivos de trabalho no mesmo computador

## Instalação

Na pasta raiz do projeto:

\`\`\`bash
npm install
\`\`\`

O script \`npm run mcp\` inicia o servidor MCP pelo transporte stdio. Não abra o servidor MCP em uma porta pública.

## Ferramentas disponíveis

- \`avatar_status\`: estado do MCP, configuração e pastas.
- \`avatar_list_videos\`: lista os MP4 finais em \`outputs\`.
- \`avatar_storage_stats\`: consulta o uso de armazenamento sem apagar arquivos.
- \`avatar_process_video\`: executa o pipeline atual com um vídeo de \`uploads\`, áudio opcional de \`audios\` e até dois avatares de \`avatars\`.

O processamento só começa quando a ferramenta \`avatar_process_video\` é chamada explicitamente. O MCP não oferece ferramenta de limpeza nem exclusão de arquivos.

## Conectar em um cliente MCP

Configure o cliente para iniciar o comando \`node\` apontando para o caminho absoluto de \`mcp/server.js\`. Exemplo de configuração:

\`\`\`json
{
  "mcpServers": {
    "rolezando-avatar-editor": {
      "command": "node",
      "args": ["C:/CAMINHO/DO/PROJETO/mcp/server.js"],
      "env": {
        "AVATAR_EDITOR_ROOT": "C:/CAMINHO/DO/PROJETO"
      }
    }
  }
}
\`\`\`

Substitua os caminhos de exemplo pelo caminho real do projeto. Em Windows, use barras normais (\`/\`) no JSON.

## Segurança e limites

- O transporte é stdio local; não expõe uma porta HTTP.
- A ferramenta de processamento aceita apenas nomes de arquivos, nunca caminhos fornecidos livremente.
- Os arquivos são confinados às pastas \`uploads\`, \`audios\` e \`avatars\`, inclusive após resolução de links simbólicos.
- Vídeo respeita o limite configurado no \`StorageManager\`; áudio e cada avatar têm limite adicional de 100 MB.
- Nenhuma ferramenta MCP executa limpeza, remove arquivos ou altera o cadastro/login.
- A integração usa o processador de vídeo já existente. Não adiciona provedores de voz nem modifica o pipeline de áudio.

## Lockfile

Após adicionar as dependências MCP, execute \`npm install\` no ambiente de desenvolvimento para atualizar \`package-lock.json\` antes de usar \`npm ci\` em uma instalação limpa.
