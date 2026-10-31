# Carteira de créditos e pagamentos SumUp

## Preços configurados
- Brasil: R$ 0,10 por vídeo. R$ 1 = 10 vídeos; R$ 5 = 50; R$ 10 = 100; R$ 50 = 500.
- Exterior: US$ 0,10 por vídeo. US$ 1 = 10 vídeos; US$ 5 = 50; US$ 10 = 100; US$ 50 = 500.
- Cada processamento concluído consome 1 crédito. Se falhar, o crédito reservado é devolvido.

## Variáveis obrigatórias no serviço de hospedagem
- DATABASE_URL: conexão PostgreSQL.
- SESSION_SECRET: segredo aleatório longo (mínimo 32 bytes) para assinar cookies de sessão.
- ADMIN_API_KEY: segredo administrativo opcional; necessário apenas para acionar a limpeza manual.
- SUMUP_API_KEY: chave privada da API SumUp.
- SUMUP_MERCHANT_CODE: código do estabelecimento SumUp.
- PUBLIC_BASE_URL: URL HTTPS pública do backend.
- NODE_ENV=production
- HOST=0.0.0.0
- PORT: porta fornecida pelo serviço.

Não coloque credenciais reais no GitHub. O banco cria as tabelas automaticamente; database/schema.sql documenta a estrutura.

## Fluxo implementado
1. Cadastro/login real com senha derivada por scrypt e cookie HttpOnly.
2. O cliente escolhe pacote BRL ou USD.
3. O backend cria checkout hospedado na SumUp.
4. A notificação da SumUp leva o backend a consultar o checkout diretamente na API oficial.
5. O saldo só é atualizado quando a SumUp confirma PAID e valor, moeda, referência e estabelecimento conferem.
6. O backend reserva um crédito antes do processamento e confirma o débito ao concluir; em erro, devolve o crédito.
7. O histórico registra compras, consumo e estornos.

## Endpoints
- POST /api/signup, POST /api/login, POST /api/logout, GET /api/me
- GET /api/credits/packages, GET /api/credits/balance, GET /api/credits/history
- POST /api/credits/checkout
- POST /api/payments/sumup/notify
- GET /api/payments/:reference/status
- POST /upload (sessão obrigatória e 1 crédito)

## Antes de ativar vendas reais
A API SumUp documenta BRL e USD como moedas aceitas pelo endpoint de checkout, mas isso não garante que as duas moedas ou todos os métodos estejam habilitados para a conta do estabelecimento. Confirme a disponibilidade na sua conta SumUp e faça um teste ponta a ponta antes de anunciar vendas internacionais.
Nenhuma credencial ou conta SumUp foi adicionada ao repositório. Sem configurar todas as variáveis acima, o sistema não processa pagamentos reais.
O MCP existente continua sendo uma integração local via stdio. Ele não é automaticamente um serviço público remoto ou marketplace.


## Limite da integração MCP atual

O MCP incluído nesta entrega é local (stdio) e chama o pipeline local diretamente. A carteira controla o processamento feito pelo endpoint web POST /upload; ela ainda não autentica nem cobra chamadas feitas por um cliente MCP local. Para vender acesso MCP pela internet, será necessária uma versão remota HTTP com autenticação por usuário/chave, cobrança de créditos por chamada e limites de uso. Não anuncie o MCP local como serviço pago remoto.
