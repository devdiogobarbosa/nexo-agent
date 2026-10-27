# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário conversa em português. O Nexo consulta só os chamados dele, busca na central de ajuda e prepara um rascunho. O chamado só é gravado depois da confirmação. Quando a pessoa pede um analista, a conversa pausa o agent até alguém assumir, devolver ou encerrar.

## Como rodar

Requisitos: Node.js 20 e npm.

```bash
npm install
copy .env.example .env
```

Preencha `SESSION_SECRET` com uma string longa. Para conversar com o modelo, preencha também a chave do provedor (`OPENAI_API_KEY` se `LLM_MODEL` começar com `openai/`).

```bash
npm run db:seed
npm run dev
```

Abra http://localhost:3000. Exemplos:

- Funcionária: `ana.souza@nexo.com.br` e qualquer senha não vazia
- Analista: `rafael.lima@nexo.com.br` e qualquer senha não vazia

Outros comandos: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Arquitetura

A interface Next.js fala só com rotas em `src/app/api`. Três módulos não se misturam:

- `src/components` desenha login, chat, perfil e console.
- `src/server/agent` é o Mastra. Ele decide a ferramenta e explica a decisão.
- `src/server/tickets` é o sistema de chamados simulado. O agent não grava chamado direto.

O banco é libSQL. Localmente é o arquivo `data/nexo.db`, que continua depois de reiniciar o processo. Na Vercel o disco da função não persiste, então a mesma URL aponta para um Turso.

## Como o agent decide

A cada mensagem com o agent ativo, o Mastra recebe as regras do Anexo A e pode chamar:

- buscar na central de ajuda
- listar só os chamados do funcionário autenticado
- consultar um número
- calcular o prazo em horário útil de São Paulo
- montar um rascunho, sem gravar
- oferecer transferência

Criar, atualizar e reabrir acontecem na rota de confirmação, depois do botão Confirmar. Pedir um analista muda o estado para `aguardando_atendente` e a rota de chat deixa de chamar o modelo. Acima de cada resposta ficam as ações executadas. O detalhe abre o entendimento, a ação, a confiança e o motivo. Se o modelo não fechar esse bloco, o rastro é reconstruído das ferramentas que rodaram de fato.

O artigo da VPN com erro 809 só vale para Windows 10. No Windows 11 a busca avisa que é preciso abrir chamado.

## Qualidade das decisões

O que não pode depender do modelo está em código e em teste: prazo útil, duplicidade, reabertura de 7 dias, privacidade entre funcionários, confirmação antes de gravar, pausa na transferência, assunção exclusiva e limite de 30 mensagens. A suíte não chama a API do modelo. Um roteiro manual, com a chave configurada, confere dúvida coberta pela central, abertura com confirmação, consulta sem número, chamado vencido e assunto fora de TI.

O serviço de chamados pode falhar de propósito com `TICKET_FAILURE_RATE`. O padrão é zero. A tool tenta uma vez de novo e, se continuar fora, diz que o legado oscilou.

## Trade-offs

- Mastra 0.24, não a linha 1.x. A 1.x pede Node.js 22 e esta máquina de desenvolvimento está no Node 20. A API usada é a de Agent, `createTool` e `RuntimeContext`.
- Modelo padrão `openai/gpt-6.1-sol`, trocável por `LLM_MODEL`. A escolha privilegia tool calling. O histórico enviado para o modelo fica nas últimas 10 falas e o console do analista não chama o modelo.
- Central de ajuda com busca por termos, não embeddings. São oito artigos curtos.
- Confirmação e transferência sensível ficam na rota, não só no prompt.
- O protótipo tem seis telas. Perfil é somente leitura. Redefinir senha aponta para o ramal 4000, sem e-mail.

## O que eu faria com mais tempo

Avaliação automática de conversas com um modelo falso gravado, fila com mais de um analista e presença ao vivo, e um cálculo de custo por conversa exposto no rastro.

## Deploy na Vercel

O deploy é diferencial. A ausência não impede a correção local.

1. Crie um banco Turso e rode `DATABASE_URL=... DATABASE_AUTH_TOKEN=... npm run db:seed` uma vez contra ele.
2. Importe o repositório na Vercel. O framework é Next.js. Build: `next build`.
3. Variáveis de Production: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SESSION_SECRET`, `LLM_MODEL`, `OPENAI_API_KEY`, `TICKET_FAILURE_RATE=0`, `DAILY_MESSAGE_CAP=80`.
4. A rota `/api/chat` usa runtime Node e `maxDuration` de 60 segundos.

Não há segredo em variável `NEXT_PUBLIC_`. O teto diário fica no banco, então vale entre instâncias serverless. Depois do deploy, entre como Ana, faça uma pergunta e consulte o INC-20311. O rastro precisa aparecer acima da resposta.
