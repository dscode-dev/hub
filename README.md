# Plataforma Hub

SaaS de gestao operacional para pequenos e medios negocios: produtos, estoque, clientes,
vendas, financeiro, entregas e relatorios em um unico lugar.

Este repositorio contem a **fundacao** da plataforma: multi-tenancy, autenticacao,
onboarding, dashboard de ativacao e o primeiro dominio real (Produtos + Categorias +
importacao por CSV).

O produto e **generico por decisao de arquitetura**. Nada no core assume um segmento
especifico: o mesmo cadastro atende loja de moveis, eletronicos, distribuidora ou material
de construcao.

---

## Stack

| Camada   | Tecnologias                                                        |
| -------- | ------------------------------------------------------------------ |
| Backend  | NestJS 11, TypeScript, PostgreSQL 17, Prisma 6, REST, Swagger      |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4, shadcn/ui (Radix) |
| Infra    | npm workspaces, Docker Compose (Postgres)                          |

---

## Estrutura

```text
plataforma-hub/
  apps/
    api/                      # NestJS
      prisma/                 # schema, migrations, seed
      src/
        common/               # prisma, guards, filtros, pipes, utils
        config/               # configuracao e validacao de ambiente
        modules/
          audit/              # trilha de auditoria
          auth/               # login, refresh, logout, /me
          categories/
          organizations/      # dados do tenant + onboarding
          products/
            import/           # importacao de CSV
      test/                   # testes de integracao (HTTP + banco real)
    web/                      # Next.js
      app/
        (app)/                # area logada (shell + modulos)
        api/bff/              # camada BFF: unico caminho do browser ate a API
        login/  onboarding/
      components/             # ui/, layout/, products/, common/, brand/
      lib/                    # api/, auth/, format, navigation, routes
      middleware.ts           # guarda de rota + renovacao de sessao
  packages/
    shared/                   # contratos e enums usados pelos dois apps
```

---

## Como rodar

Pre-requisitos: Node 20+, Docker.

```bash
# 1. dependencias
npm install

# 2. banco
npm run db:up

# 3. variaveis de ambiente
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 4. schema + dados de exemplo
npm run db:migrate --workspace=@hub/api
npm run db:seed

# 5. subir os dois apps
npm run dev
```

| Servico | URL                            |
| ------- | ------------------------------ |
| Web     | http://localhost:3000          |
| API     | http://localhost:5010/api/v1   |
| Swagger | http://localhost:5010/docs     |
| Postgres| localhost:5442                 |

### Acesso de desenvolvimento

```text
owner@plataformahub.local
Hub@123456
```

Credencial exclusiva de ambiente local. O seed nao marca o onboarding como concluido,
de proposito: assim o fluxo de primeiro acesso pode ser percorrido a cada `db:reset`.

---

## Validacao

```bash
npm run lint     # api + web
npm run build    # shared + api + web
npm test         # testes de integracao da API
```

---

## Decisoes de arquitetura

### Multi-tenancy

`organizationId` vem **sempre** do access token, nunca do corpo, query ou header da
requisicao. Nenhuma rota aceita o cliente escolher o tenant. Toda consulta por id filtra
por `id + organizationId`, o que faz um acesso cruzado retornar 404 (e nao 403), sem
revelar que o registro existe.

Unicidade de dados de negocio e por tenant (`organizationId + sku`), nunca global: dois
clientes diferentes podem usar o mesmo codigo de produto.

### Autenticacao

- Access token JWT curto (15 min) carregando o tenant.
- Refresh token opaco e aleatorio, guardado no banco apenas como SHA-256, com rotacao a
  cada uso e revogacao no logout.
- Nenhum token toca o `localStorage`. Ambos vivem em cookies `HttpOnly`; o browser fala
  exclusivamente com o BFF (`/api/bff/*`), que traduz cookie em `Authorization`.
- O cookie de access expira junto com o token, entao "cookie ausente" ja significa
  "renovar" - o middleware faz isso de forma transparente, porque Server Components nao
  podem gravar cookies.

### Soft delete

Produtos e categorias nunca sao apagados fisicamente. `DELETE` desativa (`active=false`)
e a interface oferece reativacao. Historico futuro (vendas, movimentacoes) continua valido.

### Modulos ainda nao implementados

Estoque, clientes, vendas, financeiro, entregas, relatorios e configuracoes aparecem na
navegacao com uma pagina honesta de "em construcao", em vez de sumirem do menu. O usuario
enxerga o alcance do produto e nao procura funcoes que "desapareceram".

### Decisoes tomadas sem especificacao previa

| Tema                | Decisao                                            | Motivo                                                             |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| Monorepo            | npm workspaces                                      | Sem Nx/Turborepo: 3 pacotes nao justificam a camada extra          |
| Refresh token       | Opaco + hash no banco                               | Permite revogacao real; JWT nao permitiria                          |
| Saldo de estoque    | Campos em `Product`                                 | Placeholder ate existir o modulo com movimentacoes                  |
| Tema                | Somente claro                                       | Briefing pede base branca; tema escuro seria superficie sem demanda |
| Fonte               | Stack do sistema                                    | Zero dependencia de rede em build e runtime                         |
| Storage do CSV      | Conteudo na linha do `ImportJob`                    | Suficiente para PME; volume maior pede object storage + fila        |
| Rate limit          | Global 300/min, login 10/min                        | Barreira contra forca bruta sem atrapalhar uso normal               |
| `loading.tsx`       | Por rota, nunca no grupo inteiro                    | Boundary compartilhado inicia streaming e quebra o status 404       |

---

## Proximos passos

O proximo dominio recomendado e **Clientes**, seguido de **Vendas**. A justificativa esta
no relatorio de entrega do Step 1.
