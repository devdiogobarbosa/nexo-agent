# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário descreve o problema com as próprias palavras. O Nexo consulta só os chamados dele, busca na central de ajuda e prepara um rascunho. O chamado só entra no sistema depois que a pessoa confirma. Se ela pede um analista, o agent para de responder até alguém assumir, devolver ou encerrar.

O repositório também guarda o enunciado e o protótipo, sem alteração:

- `Desafio_Tecnico_Nexo_Assist_PRD_v5.pdf`
- `nexo.pen`

## Como rodar

É preciso Node.js 20 e npm.

```bash
npm install
copy .env.example .env
```

No PowerShell, `copy` cria o `.env`. No bash, use `cp .env.example .env`.

Abra o `.env` e preencha pelo menos o `SESSION_SECRET` com uma string longa e aleatória. Sem a chave do modelo o login e o console funcionam, mas o chat avisa que o modelo não está configurado em vez de inventar uma resposta.

```bash
npm run db:seed
npm run dev
```

Abra http://localhost:3000.

| Quem | E-mail | Senha |
| --- | --- | --- |
| Ana Souza, Financeiro, Windows 11 | `ana.souza@nexo.com.br` | qualquer texto não vazio |
| Rafael Lima, Suporte N2 | `rafael.lima@nexo.com.br` | qualquer texto não vazio |

A senha não é conferida nem armazenada. O e-mail precisa existir na base semeada. E-mail desconhecido é recusado.

Outros funcionários já estão na fila do console: Carla Mendes, Bruno Tavares, Diego Ramos e Fábio Nunes, todos `@nexo.com.br`.

### Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | sobe o Next.js em http://localhost:3000 |
| `npm run db:seed` | recria funcionários, artigos, chamados e a fila de exemplo |
| `npm test` | regras de negócio, sem chamar o modelo |
| `npm run typecheck` | TypeScript estrito |
| `npm run lint` | ESLint |
| `npm run build` | build de produção |

`npm run db:seed` apaga e regrava o banco local. Use de novo sempre que quiser voltar ao cenário do Anexo B.

## O que experimentar

Com a chave do modelo configurada, estes roteiros cobrem o desafio:

1. **Dúvida sem chamado.** Ana pergunta o horário do service desk. A central responde e nenhum chamado é criado.
2. **VPN no Windows 11.** Ana diz que o notebook mostra o erro 809. O artigo vale só para Windows 10. O Nexo não aplica essa solução e prepara um rascunho. Confirmar grava. Cancelar não grava.
3. **Consulta sem lembrar o número.** Ana pergunta o status dos chamados. Se houver mais de um aberto, ela escolhe. O INC-20311 aparece com prazo vencido.
4. **Mesmo problema de novo.** Tentar abrir outro chamado de notebook lento atualiza o INC-20311 em vez de duplicar.
5. **Reabertura.** O INC-20150 foi resolvido há poucos dias e ainda pode ser reaberto. A troca de senha de julho não pode.
6. **Fora de TI.** Um assunto de RH, financeiro ou facilities é redirecionado, sem chamado. Pedido de acesso ao SharePoint continua sendo TI.
7. **Analista.** Ana pede para falar com uma pessoa, ou escolhe essa opção. A conversa vai para “Para você”. Rafael assume, o composer dela deixa de chamar o modelo, ele responde, devolve ao agent ou encerra. Encerrar zera a sessão de 30 mensagens. O histórico permanece.

Cada resposta do agent mostra, acima do texto, as ações que rodaram. “Como o Nexo decidiu” abre o entendimento, a ação, a confiança e o motivo.

## Arquitetura

A interface não fala com o banco nem com o modelo. Ela só chama rotas em `src/app/api`.

```text
funcionário ou analista
        │
        ▼
   Next.js (telas)
        │
        ▼
   rotas de API
        │
        ├── sessão (cookie httpOnly)
        ├── conversas (estado, limite, pausa)
        ├── agent Mastra  ──►  ferramentas
        │                         ├── central de ajuda
        │                         └── serviço de chamados
        └── confirmação de rascunho ──► serviço de chamados
                                              │
                                              ▼
                                         libSQL
```

| Pasta | Responsabilidade |
| --- | --- |
| `src/components` | login, chat, perfil e console, em subpastas |
| `src/app` | páginas e rotas |
| `src/server/agent` | Mastra, ferramentas, rastro e a regra de “pedir analista” |
| `src/server/tickets` | sistema de chamados simulado, separado do agent |
| `src/server/knowledge` | busca nos artigos |
| `src/server/sla` | prazos em horário de Brasília |
| `src/server/conversations` | estado da conversa e limite de mensagens |
| `src/server/db` | schema, migração e seed |
| `src/lib` | tipos, erros e formatação usados dos dois lados |

O banco local é o arquivo `data/nexo.db`. Ele continua depois de reiniciar o `npm run dev`. Na Vercel o disco da função não persiste, então a mesma variável aponta para um Turso.

### Estados da conversa

| Estado | O que acontece |
| --- | --- |
| `com_agent` | o modelo pode responder |
| `aguardando_atendente` | o agent está pausado e a conversa entra em “Para você” |
| `em_atendimento` | só o analista que assumiu responde; um segundo analista é recusado |
| `encerrada` | a próxima mensagem da pessoa reabre a mesma conversa, com a contagem de 30 zerada |

O limite de 30 conta falas da pessoa e do agent na sessão aberta. Mensagem de analista e aviso do sistema não entram na conta. Há ainda um teto diário (`DAILY_MESSAGE_CAP`, padrão 80) gravado no banco, para valer entre instâncias serverless.

## Como o agent decide

A cada mensagem com o agent ativo, o Mastra recebe as regras do Anexo A e escolhe as ferramentas. Ele não tem acesso livre ao banco.

| Ferramenta | Efeito |
| --- | --- |
| `buscarCentralDeAjuda` | busca artigos por termo. No erro 809, se o Windows não for o 10, a resposta manda abrir chamado |
| `listarMeusChamados` | só os chamados do funcionário autenticado. Se houver vários abertos, a tela oferece a escolha |
| `consultarChamado` | lê um número e marca se o prazo venceu |
| `calcularPrazo` | aplica o SLA em `America/Sao_Paulo` |
| `prepararRascunho` | devolve o rascunho. Não grava. Se já existe chamado aberto parecido, devolve esse chamado |
| `proporTransferencia` | oferece analista. Não pausa sozinha |

A gravação acontece só em `POST /api/drafts/[id]`, no Confirmar. Atualizar um chamado resolvido há até 7 dias reabre. Mais antigo que isso é recusado. Duplicata aberta vira atualização.

Pedir analista é detectado na rota, pelo botão ou por uma frase explícita (“quero falar com um analista”). A rota grava o resumo, muda o estado e para de chamar o modelo. “Não quero um analista” não transfere.

O modelo termina a resposta com um bloco `<decisao>`. A tela esconde esse bloco e mostra o detalhe. Se o bloco não vier, o rastro é montado a partir das ferramentas que realmente rodaram, com confiança 0,5 e o motivo explícito de que foi reconstruído. Os chips nunca são texto solto do modelo: são as tools executadas.

Prioridade e prazo:

| Prioridade | Quando | Prazo |
| --- | --- | --- |
| Crítica | equipe ou empresa parada | 1 hora corrida, plantão 24 h |
| Alta | uma pessoa sem trabalhar, ou compromisso no mesmo dia | 4 horas úteis |
| Média | atrapalha, mas há alternativa | 3 dias úteis |
| Baixa | pedido sem urgência | 5 dias úteis |

Horário útil: segunda a sexta, 8h às 18h, America/Sao_Paulo. Pedido fora do expediente começa a contar na próxima abertura.

## Qualidade das decisões

O que não pode depender do modelo está no código e na suíte. `npm test` não usa rede nem chave de API.

| Garantia | Onde |
| --- | --- |
| Prazo útil, inclusive sexta à tarde e madrugada crítica | `src/server/sla` |
| Chamado de outra pessoa não é lido | `src/server/tickets` |
| Problema aberto parecido não duplica | `src/server/tickets` |
| Reabrir só até 7 dias | `src/server/tickets` |
| Legado indisponível falha e a tool tenta de novo uma vez | `TICKET_FAILURE_RATE` e `withTicketRetry` |
| Dois analistas não assumem a mesma conversa | `src/server/conversations` |
| Devolver reativa o agent; encerrar zera as 30 mensagens | `src/server/conversations` |
| A 31ª mensagem da sessão é recusada | `src/server/conversations` |
| O bloco de decisão é separado do texto visível | `src/server/agent/trace` |
| “Não quero analista” não transfere | `src/server/agent/policy` |
| Artigo 809 não é solução para Windows 11 | `src/server/knowledge` |

`TICKET_FAILURE_RATE` vai de 0 a 1. O padrão é 0. Com valor maior, o serviço simula a oscilação do legado por alguns instantes.

O modelo em si é conferido no roteiro da seção “O que experimentar”. A suíte não tenta afirmar que o LLM sempre escolhe a ferramenta certa. Por isso confirmação, privacidade, pausa e limite não estão só no prompt.

## Variáveis de ambiente

Copie `.env.example`. Nada disso vai para o client: não existe variável `NEXT_PUBLIC_` com segredo.

| Variável | Para que serve |
| --- | --- |
| `DATABASE_URL` | `file:./data/nexo.db` local, ou `libsql://...` no Turso |
| `DATABASE_AUTH_TOKEN` | token do Turso. Vazio no arquivo local |
| `SESSION_SECRET` | assinatura do cookie httpOnly |
| `LLM_MODEL` | modelo no formato `provedor/modelo`. Padrão: `openai/gpt-6.1-sol` |
| `OPENAI_API_KEY` | obrigatória se o modelo começar com `openai/` |
| `ANTHROPIC_API_KEY` | se o modelo começar com `anthropic/` |
| `GOOGLE_API_KEY` | se o modelo começar com `google/` |
| `TICKET_FAILURE_RATE` | chance de o legado falhar. Use 0 |
| `DAILY_MESSAGE_CAP` | teto diário por pessoa, além das 30 da sessão. Padrão 80 |

## Trade-offs

- **Mastra 0.24, não a linha 1.x.** A 1.x pede Node.js 22. O desenvolvimento desta entrega está no Node 20, que é o que a máquina e o `npm install` aceitam sem aviso de engine. A API usada é a atual dessa linha: `Agent`, `createTool` e `RuntimeContext`.
- **Um modelo com tool calling, configurável.** O padrão é `openai/gpt-6.1-sol` porque o roteador do Mastra chama a ferramenta sem um provider object no código. Dá para trocar por `LLM_MODEL`. O console do analista não chama o modelo. O histórico enviado fica nas últimas 10 falas, com no máximo 5 passos de ferramenta.
- **Busca por termos, não embeddings.** São oito artigos curtos. Um índice vetorial não muda o resultado e acrescenta serviço e custo.
- **Confirmação e transferência fora do prompt.** O modelo pode esquecer uma regra. Gravar chamado, pausar o agent e estourar a sessão são decisões da rota.
- **Perfil somente leitura.** O protótipo tem a sexta tela, ligada no menu. Redefinir senha aponta para o ramal 4000. Não há provedor de e-mail no desafio.
- **Sem presença ao vivo.** “Digitando…” do protótipo é ilustração. O que existe de tempo real é o streaming da resposta do agent.

## O que eu faria com mais tempo

- Um conjunto de conversas gravadas, com modelo falso, para regressão da escolha de ferramenta sem gastar API.
- Mais de um analista na fila, com atribuição explícita em vez de “quem assumir primeiro”.
- O custo em tokens de cada resposta dentro do rastro.
- Editar os campos do rascunho na própria tela, não só confirmar ou cancelar.

## Deploy na Vercel

Publicar é diferencial. A aplicação local já é avaliável sem URL.

1. Crie um banco Turso.
2. Rode o seed uma vez contra ele, fora do build:

```bash
DATABASE_URL="libsql://SEU-BANCO.turso.io" DATABASE_AUTH_TOKEN="seu-token" npm run db:seed
```

3. Importe este repositório na Vercel. Framework: Next.js. Install: `npm install`. Build: `next build`. Não é preciso `vercel.json`.
4. Em Production, defina `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SESSION_SECRET`, `LLM_MODEL`, `OPENAI_API_KEY`, `TICKET_FAILURE_RATE=0` e `DAILY_MESSAGE_CAP=80`.
5. A rota `/api/chat` usa runtime Node e `maxDuration` de 60 segundos. Ela não pode ir para Edge: Mastra e libSQL rodam em Node.

O teto diário fica na tabela de conversas, então continua valendo quando a Vercel sobe mais de uma instância. Depois do deploy, entre como Ana, faça uma pergunta que a central responde e abra o detalhe da decisão. Entre como Rafael e confira a fila em “Para você”.

## Dados de exemplo

O seed recria o Anexo B com datas relativas a hoje, para o vencimento e a janela de 7 dias continuarem verdadeiros.

| Chamado | Situação |
| --- | --- |
| INC-20311 | notebook lento, hardware, média, aguardando analista, prazo vencido |
| INC-20298 | acesso ao SharePoint, em andamento |
| REQ-10442 | segundo monitor, baixa, aprovado |
| INC-20150 | senha do SAP, resolvido há poucos dias, ainda reabre |
| INC-19877 e INC-19410 | resolvidos há mais de 7 dias |

Há oito artigos, entre eles o da VPN com erro 809 e o do horário do service desk.
