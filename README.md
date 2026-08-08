# Plataforma Hub

Aplicação **desktop local-first** de gestão operacional, estoque, vendas e PDV para pequenos
e médios negócios.

A plataforma roda inteiramente na máquina do cliente: o Electron orquestra o ciclo de vida,
sobe um backend NestJS em loopback e serve a interface Next.js a partir do disco. Não há
dependência de servidor externo para operar.

O produto é **genérico por decisão de arquitetura** — o mesmo core atende loja de móveis,
eletrônicos, distribuidora ou material de construção.

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│                        Electron                             │
│                                                             │
│  ┌───────────────────────┐      ┌────────────────────────┐  │
│  │      Main Process     │      │        Preload         │  │
│  │                       │      │                        │  │
│  │  • lifecycle          │─────▶│  contextBridge         │  │
│  │  • backend-process    │      │  window.hub (tipado)   │  │
│  │  • protocolo hub://   │      └───────────┬────────────┘  │
│  │  • IPC + segurança    │                  │               │
│  │  • cofre de sessão    │                  ▼               │
│  │  • hardware adapters  │      ┌────────────────────────┐  │
│  └───────────┬───────────┘      │       Renderer         │  │
│              │                  │                        │  │
│              │ spawn            │  Next.js static export │  │
│              ▼                  │  sandbox: true         │  │
│  ┌───────────────────────┐      └───────────┬────────────┘  │
│  │  NestJS local         │◀─────────────────┘               │
│  │  127.0.0.1:3001       │   HTTP + Bearer                  │
│  │  loopback apenas      │                                  │
│  └───────────┬───────────┘                                  │
└──────────────┼──────────────────────────────────────────────┘
               ▼
   SQLite (userData/data/hub.db)
```

Não há serviço externo: a aplicação instala e opera em um computador **sem PostgreSQL**,
sem Docker e sem rede.

Sequência de boot:

```text
splash → spawn NestJS → migrations → GET /api/v1/health → janela principal → splash fecha
```

A UI **nunca** aparece antes do backend responder. Se o health check falhar, o usuário vê
uma tela de erro com retry real — que reinicia o backend e abre a aplicação se ele voltar.

### Camadas

| Camada       | Onde                      | Responsabilidade                                            |
| ------------ | ------------------------- | ----------------------------------------------------------- |
| Main Process | `apps/desktop/src/main`   | lifecycle, backend, janelas, protocolo, segurança, sessão   |
| Preload      | `apps/desktop/src/preload`| ponte `window.hub`, uma função por capability                |
| IPC          | `apps/desktop/src/ipc`    | canais privados + validação de payload                       |
| Hardware     | `apps/desktop/src/hardware`| adapters de impressora, scanner e balança (contratos)       |
| Renderer     | `apps/web`                | Next.js `output: 'export'`, consome a API local              |
| Backend      | `apps/api`                | NestJS multi-tenant, loopback, SQLite via Prisma              |
| Contratos    | `packages/shared`         | DTOs e o contrato de `window.hub`, usados pelos dois lados   |

---

## Estrutura

```text
plataforma-hub/
├── apps/
│   ├── desktop/                    # Electron
│   │   ├── src/
│   │   │   ├── main/               # main, window, backend-process, protocol,
│   │   │   │                       # security, session-store, app-lifecycle
│   │   │   ├── preload/preload.ts
│   │   │   ├── ipc/                # channels.ts, register-ipc.ts
│   │   │   ├── hardware/           # printer/, scanner/, scale/
│   │   │   ├── shared/             # config.ts, logger.ts
│   │   │   └── windows/            # splash.html, error.html
│   │   ├── scripts/                # dev, copy-static, stage-backend
│   │   ├── assets/                 # logo-hub.png, icon.png (derivado de Assets/)
│   │   └── electron-builder.yml
│   │
│   ├── api/                        # NestJS
│   └── web/                        # Next.js (static export → out/)
│
├── packages/shared/                # contratos comuns
└── Assets/                         # arte oficial
    ├── logo-hub.png                # marca completa (splash, telas nativas)
    └── icon-logo.png               # simbolo com transparencia (icone do app)
```

---

## Desenvolvimento

Pré-requisitos: Node 20+. Não é necessário Docker nem banco de dados externo.

```bash
npm install

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

npm run db:migrate   # cria apps/api/prisma/dev.db e aplica as migrations
npm run db:seed      # dados de demonstração (apenas desenvolvimento)
```

Tudo junto:

```bash
npm run dev
```

Ou em terminais separados:

```bash
npm run dev:api        # NestJS em watch
npm run dev:web        # Next dev server (HMR) em :3000
npm run dev:desktop    # Electron; recompila main/preload e reinicia sozinho
```

`dev:desktop` liga `HUB_DEV_SERVER=1`, que faz o Electron carregar o dev server em vez do
export estático — é o único modo com HMR.

### Acesso local

```text
owner@plataformahub.local
Hub@123456
```

---

## Build

Ordem previsível: contratos → backend → renderer → Electron.

```bash
npm run build          # shared → api → web → desktop
```

Rodar o desktop sobre os artefatos de build (carrega o export estático):

```bash
npm run desktop
```

Validações:

```bash
npm run lint
npm test
```

---

## Packaging

```bash
npm run package        # instalador (dmg / nsis)
npm run package:dir    # apenas o diretório do app, sem instalador
```

O `package` executa, nesta ordem: build completo → `stage-backend` → electron-builder.

**`stage-backend`** monta `apps/desktop/build/backend` com `dist`, `prisma` e apenas as
dependências de produção. É necessário porque o npm workspaces faz hoisting: apontar o
empacotador para `apps/api/node_modules` produziria um app instalado sem NestJS nem Prisma.

Layout final:

```text
Plataforma Hub.app/Contents/Resources/
├── app.asar          # main + preload
├── renderer/         # export estático do Next
├── backend/          # NestJS + node_modules de produção
│   ├── dist/
│   ├── prisma/       # schema + migrations (SEM arquivos .db)
│   └── node_modules/ # inclui .prisma/client e o engine nativo do SQLite
└── assets/           # logo e ícone
```

O banco **nunca** é empacotado: ele nasce vazio em `userData` na primeira execução. O
`stage-backend` filtra `*.db` explicitamente — o `dev.db` do workspace contém a organização
e o usuário de demonstração, que não podem viajar para a máquina de um cliente.

macOS e Windows estão configurados. **Code signing não está configurado** (exige
certificado da Apple Developer / Authenticode).

---

## Local Data

A aplicação e os dados são **coisas separadas**. O `.app`/`.exe` pode ser substituído por uma
versão nova a qualquer momento; nada do cliente vive dentro dele.

| Sistema | Diretório de dados |
| --- | --- |
| macOS | `~/Library/Application Support/Plataforma Hub/` |
| Windows | `%APPDATA%\Plataforma Hub\` |
| Linux | `~/.config/Plataforma Hub/` |

```text
Plataforma Hub/
├── data/
│   └── hub.db      banco operacional (+ hub.db-wal, hub.db-shm)
├── backups/        cópias geradas pelo backend
└── logs/           desktop.log
```

O caminho vem de `app.getPath('userData')`, que já resolve o diretório correto por sistema —
nunca montamos esse caminho à mão. Verificado na prática: apagar o `.app` inteiro e
reempacotar **não** afeta `hub.db`.

## Database

SQLite via Prisma. O NestJS é o único processo que abre o arquivo; o Renderer nunca toca no
`.db` — todo acesso passa por `Renderer → NestJS → Prisma → SQLite`.

### Onde o caminho é decidido

O Renderer não sabe onde o banco fica. O Main Process resolve `userData/data/hub.db`, monta a
`DATABASE_URL` e injeta no ambiente do processo filho:

```text
Electron Main → app.getPath('userData') → data/hub.db → DATABASE_URL=file:… → spawn NestJS
```

O caminho vai **literal**, sem percent-encoding: verificado que o conector SQLite do Prisma
trata o texto após `file:` como caminho de arquivo, não como URL — codificar os espaços de
"Plataforma Hub" faz o Prisma procurar `Plataforma%20Hub` e falhar ao abrir.

### Dinheiro em inteiros

Valores monetários são gravados em **centavos** (`Int`), quantidades em **milésimos**. SQLite
não tem tipo decimal: uma coluna `DECIMAL` cai em afinidade NUMERIC e valores fracionários
viram ponto flutuante. Medido: somar mil itens de `19.99` devolve `19990.000000000135`. Num
sistema que fecha caixa isso não é aceitável.

A API continua trafegando reais; a conversão vive em `common/utils/money.ts` e no mapper.

### Adaptações do conector

| Recurso | Situação |
| --- | --- |
| `enum` | suportado (armazenado como TEXT) |
| `Json` | suportado |
| listas escalares | **não** suportadas → JSON em texto (`segments`, `operationGoals`) |
| `mode: 'insensitive'` | **não** existe → `LIKE` já ignora caixa para ASCII |
| `isolationLevel` | **não** existe → SQLite serializa escritas por natureza |

Consequência conhecida: busca por texto ignora caixa apenas em ASCII. "sofa" encontra "SOFA",
mas "sofá" não encontra "SOFÁ".

### PRAGMAs

Escolhidos deliberadamente, aplicados a cada conexão:

| PRAGMA | Motivo |
| --- | --- |
| `journal_mode=WAL` | leitura e escrita deixam de se bloquear — consultar produtos enquanto uma venda grava é o caso normal de um PDV |
| `foreign_keys=ON` | SQLite ignora FK por padrão; sem isso `onDelete: Cascade` seria decorativo |
| `busy_timeout=5000` | espera o lock em vez de falhar na hora |
| `synchronous=NORMAL` | seguro com WAL e bem mais rápido que FULL em disco de cliente |

## Migrations

Autoridas em desenvolvimento com `prisma migrate dev`; **aplicadas** — em dev e no cliente —
pelo runner em `src/database/migration-runner.ts`, que lê os mesmos arquivos e escreve na
mesma tabela `_prisma_migrations`, com o mesmo formato de checksum.

Por que um runner próprio: o CLI do Prisma é devDependency e não vai para o aplicativo
instalado; empacotá-lo só para migrar custaria dezenas de MB. Dev e produção aplicam o
**mesmo SQL** — nada de `db push` como mecanismo de produção.

Cada migration roda em transação: ou o schema avança inteiro, ou o banco fica como estava.

### Primeira execução

Tudo automático, sem nenhum comando Prisma na máquina do cliente:

```text
cria userData/data → conecta (SQLite cria o arquivo) → migrations → PRAGMAs → HTTP listen
```

O `/health` só responde `200` depois disso — e informa `database: "ok"`. Se as migrations
falharem, o backend morre e o Electron mostra a tela de erro; o motivo técnico fica no log.

## Backup

Endpoint `POST /api/v1/system/backup` (exige sessão `OWNER`/`ADMIN`). Arquivos em
`userData/backups/`, nomeados `hub-backup-2026-08-08T13-55-23.db` — sem `:`, que é inválido
no Windows.

A estratégia **não** é copiar o arquivo direto: com WAL ativo as transações recentes ainda
estariam no `-wal` e a cópia nasceria incompleta. O serviço faz
`PRAGMA wal_checkpoint(TRUNCATE)` e só então copia, produzindo um `.db` íntegro e
autossuficiente — verificado abrindo a cópia e lendo os dados.

`GET /api/v1/system/backups` lista o que existe, ordenado do mais recente. A ordenação por
nome já é cronológica, que é o que uma política de retenção futura ("7 diários, 4 semanais")
vai consumir sem reescrever nada.

**Restore não foi implementado** de propósito: substituir o banco de uma operação em
andamento é destrutivo e merece fluxo próprio, com validação do arquivo e parada controlada
do backend.

## Development vs Production

| | Desenvolvimento | Aplicação instalada |
| --- | --- | --- |
| Banco | `apps/api/prisma/dev.db` | `userData/data/hub.db` |
| `DATABASE_URL` | `.env` do workspace | injetada pelo Electron |
| Dados iniciais | `npm run db:seed` (demo) | vazio — o wizard de primeiro acesso cria |

O seed é exclusivo de desenvolvimento e **se recusa a rodar** com `NODE_ENV=production`.
Nenhum produto fictício chega ao cliente, e o `dev.db` é excluído do empacotamento.

---

## Consulta de CEP

O wizard de primeiro acesso preenche rua, bairro, cidade e UF a partir do CEP. Restam
manuais apenas os dados que nenhum serviço sabe: **número, complemento e ponto de
referência**.

A chamada sai do **backend**, não do renderer, por três motivos concretos:

1. a CSP do aplicativo só libera `connect-src` para o próprio backend;
2. evita depender do CORS de um serviço de terceiro;
3. concentra num único ponto o timeout e o tratamento de "sem internet".

`GET /api/v1/address/cep/:cep` responde `200` com o endereço, `404` para CEP inexistente e
`503` quando não há conexão. Nos dois últimos casos a interface avisa por notificação e
mantém os campos editáveis — a aplicação é local-first, e consulta de CEP é conveniência,
nunca requisito.

---

## Segurança

### Janela

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webviewTag: false`
em **todas** as janelas — incluindo splash e tela de erro.

Navegação externa é bloqueada (`will-navigate`, `will-redirect`, `setWindowOpenHandler`);
links http/https saem por `shell.openExternal`, outros protocolos são recusados.
Permissões de mídia/geolocalização são negadas por padrão.

### Preload

Nenhuma função aceita nome de canal. O mapeamento capability → canal fica fechado dentro do
preload, e o objeto exposto é congelado. Não existe `invoke(channel, payload)` genérico.

### Protocolo `hub://` em vez de `file://`

O renderer empacotado é servido por um esquema próprio registrado como `standard` + `secure`.
Três razões concretas:

1. `file://` não resolve index de diretório — dar refresh em `/products` quebraria;
2. `file://` tem origem `null`, o que obrigaria o CORS do backend a aceitar `null` ou `*`;
   com `hub://app` a origem é estável e liberada nominalmente;
3. habilita CSP, `fetch` e History API com o mesmo comportamento de produção web.

O conteúdo continua sendo lido do disco — não há servidor HTTP. Path traversal é contido
dentro do diretório publicado.

### Primeiro acesso da instalação

A Plataforma Hub roda **uma instância por empresa**. Na primeira execução não existe usuário
nem organização, e o app abre um wizard (`/setup`) que cria os dois de uma vez: responsável,
dados da empresa, endereço, logo e perfil do negócio.

`POST /api/v1/setup` é público por necessidade — não há usuário para autenticar ainda. A
proteção é outra: **ele só funciona enquanto não existir nenhum usuário OWNER**.

A garantia não vem de um `if` no service, e sim do banco:

1. A transação começa inserindo a linha `instance_setup` com **chave primária fixa**. Duas
   requisições simultâneas disputam a mesma chave e só uma insere; a outra recebe `P2002` e
   tem toda a transação desfeita. É esse INSERT que fecha a janela de corrida.
2. Dentro da mesma transação, `count(users where role = OWNER)` precisa ser zero — cobre
   bancos vindos de seed ou restaurados de backup, que nunca passaram pelo wizard.
3. Isolamento `Serializable` fecha também o caminho em que duas transações leem "nenhum
   OWNER" antes de qualquer escrita.

Verificado com 5 requisições concorrentes contra a API real: 1 sucesso, 4 × `409`, e o banco
terminando com exatamente uma organização e um OWNER.

A logo fica no próprio banco como data URL (até 512 KB), mantendo a instalação autocontida —
sem caminho de arquivo que quebra ao mover ou reinstalar o aplicativo.

### Sessão

Na versão web o refresh token vivia em cookie HttpOnly atrás de um BFF. Com static export
não há mais servidor Next, então o segredo mudou de lugar — **sem mudar de nível de
proteção**:

| Ambiente | Refresh token                                   | Access token       |
| -------- | ----------------------------------------------- | ------------------ |
| Desktop  | Main Process, cifrado por `safeStorage` (SO)    | memória do renderer |
| Browser (dev) | memória apenas; recarregar exige novo login | memória             |

Em nenhum dos dois o refresh token chega ao `localStorage`.

### Backend

Escuta em `127.0.0.1` — nunca `0.0.0.0`. CORS libera apenas `hub://app` (produção) e o dev
server (desenvolvimento).

---

## Renderer: o que mudou para o static export

`output: 'export'` remove servidor Next em runtime. Foram eliminados:

| Removido | Substituído por |
| --- | --- |
| `middleware.ts` | `AuthGuard` client-side |
| `app/api/bff/**` | renderer fala direto com a API local |
| `lib/api/server.ts`, `lib/session.ts` | `SessionProvider` + `apiClient` no cliente |
| Server Components com fetch | client components com estados de loading/erro |

### Fluxo de entrada

```text
boot → GET /setup/status
         ├── required: true  → /setup   (wizard de primeiro acesso)
         └── required: false → sessão guardada?
                                ├── sim  → /dashboard
                                └── não  → /login
```

### Rotas dinâmicas

Segmentos `[id]` exigiriam `generateStaticParams`, e os ids só existem em runtime. Migração:

| Antes                     | Depois                        |
| ------------------------- | ----------------------------- |
| `/products/[id]`          | `/products/detail?id=...`     |
| `/products/[id]/edit`     | `/products/edit?id=...`       |

Links são construídos por `productDetailRoute()` / `productEditRoute()` em `lib/routes.ts` —
nenhum componente monta essas URLs à mão.

---

## Hardware

Contratos prontos, periféricos reais ainda não implementados. Os adapters atuais respondem
`unsupported` de forma previsível, o que permite construir a tela de PDV antes de haver
hardware na mesa.

```text
window.hub.hardware.printer.{getStatus, printReceipt, openCashDrawer}
window.hub.hardware.scanner.{getStatus, getDevices, startListening, stopListening, onScan}
window.hub.hardware.scale.{getStatus, getDevices, read}
```

Componentes React não chamam `window.hub` direto — usam `lib/desktop/hardware.ts`.

**Leitor de código de barras:** modelos HID (a maioria no varejo) se comportam como teclado e
serão tratados no Renderer, sem adapter nativo. Apenas leitores seriais passam pelo Main
Process.

---

## Decisões de arquitetura

| Tema                  | Decisão                                        | Motivo                                                              |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| Renderer em produção  | esquema `hub://`, não `file://`                 | refresh, CSP e CORS nominal (ver Segurança)                          |
| Modo do renderer      | `HUB_DEV_SERVER=1`, não `app.isPackaged`        | rodar Electron sem empacotar é o fluxo normal de validar o export    |
| Spawn do backend      | `process.execPath` + `ELECTRON_RUN_AS_NODE`     | não exige Node instalado na máquina do cliente                       |
| Sessão                | Main Process + `safeStorage`                    | preserva o invariante de não expor refresh token ao JS               |
| URL da API            | `additionalArguments` no preload                | disponível de forma síncrona, sem round-trip de IPC no boot          |
| Watchdog no backend   | filho monitora o pai                            | SIGKILL no Electron não roda handler algum; sem isso sobraria órfão  |
| Backend empacotado    | staging com deps de produção                    | hoisting do workspace deixa `apps/api/node_modules` vazio            |
| Banco                 | PostgreSQL mantido                              | migração para SQLite local é passo seguinte, não deste               |

---

## Próximos passos

Nesta etapa **não** foram implementados (por decisão de escopo): ESC/POS real, serialport,
driver de balança, integração fiscal, TEF, Pix, cloud sync, auto update, restore automático,
criptografia do banco, code signing e telemetria.

A arquitetura já está preparada para todos eles: hardware por adapter, backend local
isolado, e nenhuma decisão que impeça sincronização opcional com a nuvem no futuro.
