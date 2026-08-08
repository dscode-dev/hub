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
         PostgreSQL
```

Sequência de boot:

```text
splash → spawn NestJS → GET /api/v1/health → janela principal → splash fecha
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
| Backend      | `apps/api`                | NestJS multi-tenant, loopback                                |
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
│   │   ├── assets/                 # logo-hub.png, icon.png
│   │   └── electron-builder.yml
│   │
│   ├── api/                        # NestJS
│   └── web/                        # Next.js (static export → out/)
│
├── packages/shared/                # contratos comuns
└── Assets/logo-hub.png             # logo oficial
```

---

## Desenvolvimento

Pré-requisitos: Node 20+, Docker.

```bash
npm install
npm run db:up

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

npm run db:migrate
npm run db:seed
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
├── backend/          # NestJS + node_modules de produção + engine do Prisma
└── assets/           # logo e ícone
```

macOS e Windows estão configurados. **Code signing não está configurado** (exige
certificado da Apple Developer / Authenticode).

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

| Removido                      | Substituído por                                    |
| ----------------------------- | -------------------------------------------------- |
| `middleware.ts`               | `AuthGuard` client-side                             |
| `app/api/bff/**`              | renderer fala direto com a API local                |
| `lib/api/server.ts`, `lib/session.ts` | `SessionProvider` + `apiClient` no cliente  |
| Server Components com fetch   | client components com estados de loading/erro       |

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
driver de balança, integração fiscal, TEF, Pix, banco local, cloud sync, auto update,
code signing e telemetria.

A arquitetura já está preparada para todos eles: hardware por adapter, backend local
isolado, e nenhuma decisão que impeça sincronização opcional com a nuvem no futuro.
