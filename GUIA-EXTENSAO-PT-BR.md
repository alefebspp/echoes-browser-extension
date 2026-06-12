# Como criar uma extensão de navegador — Guia prático

Este guia explica, em português brasileiro, como funciona uma extensão de navegador moderna e como construir uma do zero. Usamos o projeto **Echoes Browser Extension** deste repositório como exemplo concreto em cada etapa.

---

## Sumário

1. [O que é uma extensão de navegador?](#o-que-é-uma-extensão-de-navegador)
2. [Manifest V3 — o ponto de partida](#manifest-v3--o-ponto-de-partida)
3. [Anatomia de uma extensão](#anatomia-de-uma-extensão)
4. [Estrutura do projeto Echoes](#estrutura-do-projeto-echoes)
5. [Passo a passo: do zero à extensão funcionando](#passo-a-passo-do-zero-à-extensão-funcionando)
6. [Service Worker — o cérebro em segundo plano](#service-worker--o-cérebro-em-segundo-plano)
7. [Permissões: o mínimo necessário](#permissões-o-mínimo-necessário)
8. [Armazenamento local com chrome.storage](#armazenamento-local-com-chromestorage)
9. [Página de configurações (UI)](#página-de-configurações-ui)
10. [Comunicação com uma API externa](#comunicação-com-uma-api-externa)
11. [TypeScript + Vite: por que usar um bundler?](#typescript--vite-por-que-usar-um-bundler)
12. [Testar localmente no Chrome](#testar-localmente-no-chrome)
13. [Fluxo completo de um evento no Echoes](#fluxo-completo-de-um-evento-no-echoes)
14. [Boas práticas e erros comuns](#boas-práticas-e-erros-comuns)
15. [Próximos passos](#próximos-passos)

---

## O que é uma extensão de navegador?

Uma extensão é um pacote de código que o navegador (Chrome, Edge, Brave, etc.) instala e executa com permissões especiais. Ela pode:

- Rodar scripts em segundo plano
- Ler informações de abas abertas (com permissão)
- Exibir uma interface (popup, página de opções, ícone na barra)
- Se comunicar com servidores externos
- Persistir dados localmente

No caso do **Echoes**, a extensão observa a navegação do usuário (URL e título da página), monta um evento estruturado e envia para o backend Echoes Engine — sem ler conteúdo da página, formulários ou cookies.

```text
Usuário navega → Extensão detecta → Evento é criado → Enviado para API
```

---

## Manifest V3 — o ponto de partida

Toda extensão Chrome moderna começa com um arquivo `manifest.json`. Ele é o "RG" da extensão: nome, versão, permissões e quais arquivos executar.

O Chrome exige **Manifest V3** (MV3) para extensões novas. A principal mudança em relação ao V2 é que o script de fundo virou um **Service Worker** — um script que acorda só quando há eventos, em vez de ficar sempre aberto.

No Echoes, o manifest fica na raiz do projeto:

```json
{
  "manifest_version": 3,
  "name": "Echoes",
  "version": "0.1.0",
  "description": "Capture browsing activity and send structured events to Echoes Engine.",
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "permissions": ["tabs", "storage", "alarms"],
  "host_permissions": ["http://localhost:3847/*", "https://*/*"],
  "options_page": "src/settings/settings.html"
}
```

| Campo | Função |
|-------|--------|
| `manifest_version` | Deve ser `3` |
| `background.service_worker` | Script que roda em segundo plano |
| `permissions` | APIs internas do Chrome (`tabs`, `storage`, etc.) |
| `host_permissions` | URLs que a extensão pode acessar via `fetch` |
| `options_page` | Página de configurações aberta pelo ícone |
| `action` | Ícone na barra de ferramentas do navegador |

---

## Anatomia de uma extensão

Uma extensão típica tem quatro peças principais:

```text
┌─────────────────────────────────────────────────────────┐
│                    manifest.json                        │
│         (configuração, permissões, entry points)        │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│   Service    │    │   Página de      │    │   Ícones e   │
│   Worker     │    │   opções / popup │    │   assets     │
│ (background) │    │   (HTML + JS)    │    │   (public/)  │
└──────────────┘    └──────────────────┘    └──────────────┘
```

| Peça | Papel | No Echoes |
|------|-------|-----------|
| **Service Worker** | Escuta eventos do navegador, orquestra lógica | `src/background/service-worker.ts` |
| **Página de opções** | Interface para o usuário configurar a extensão | `src/settings/` |
| **Módulos auxiliares** | Auth, fila de eventos, cliente HTTP | `src/auth/`, `src/events/`, `src/api/` |
| **Manifest** | Declara tudo ao Chrome | `manifest.json` |

---

## Estrutura do projeto Echoes

```text
echoes-browser-extension/
├── manifest.json                 # Configuração da extensão
├── package.json                  # Dependências e scripts npm
├── vite.config.ts                # Build com Vite + CRXJS
├── src/
│   ├── background/
│   │   └── service-worker.ts     # Escuta abas, dispara captura
│   ├── auth/
│   │   └── auth.ts               # Login e token
│   ├── api/
│   │   └── client.ts             # fetch para a API Echoes
│   ├── events/
│   │   ├── event-types.ts        # Formato do evento WEB_VISIT
│   │   └── event-queue.ts        # Fila local + retry
│   ├── settings/
│   │   ├── settings.html         # UI de configurações
│   │   ├── settings.css
│   │   └── settings.ts           # Lógica da UI
│   └── shared/
│       └── constants.ts          # Chaves de storage, defaults
├── public/icons/                 # Ícones 16, 48, 128 px
├── mock-server/server.js         # API fake para testes locais
└── dist/                         # Extensão compilada (carregar no Chrome)
```

Essa separação segue um princípio simples: **cada pasta tem uma responsabilidade clara**.

---

## Passo a passo: do zero à extensão funcionando

### 1. Criar a pasta e o manifest

Crie um diretório e um `manifest.json` mínimo:

```json
{
  "manifest_version": 3,
  "name": "Minha Extensão",
  "version": "0.1.0",
  "background": {
    "service_worker": "background.js"
  }
}
```

No Echoes, usamos TypeScript e apontamos para `src/background/service-worker.ts`; o bundler converte isso em JavaScript na pasta `dist/`.

### 2. Escrever o Service Worker

É o arquivo mais importante. Ele registra listeners para eventos do Chrome:

```typescript
// Exemplo simplificado — equivalente ao Echoes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    console.log("Página carregada:", tab.url, tab.title);
  }
});
```

No Echoes, essa lógica está em `src/background/service-worker.ts` e inclui filtros de URL, verificação de consentimento e envio para a fila de eventos.

### 3. Adicionar permissões conforme a necessidade

Se você precisa ler URL e título das abas:

```json
"permissions": ["tabs"]
```

Se precisa salvar preferências:

```json
"permissions": ["storage"]
```

**Regra de ouro:** peça só o que for usar. Usuários desconfiam de extensões que pedem permissões demais.

### 4. Criar a interface do usuário

Extensões podem ter:

- **Popup** — janela pequena ao clicar no ícone (`action.default_popup`)
- **Página de opções** — aba completa (`options_page`) ← usado no Echoes
- **Side panel** — painel lateral (Chrome recente)

O Echoes usa `options_page` porque precisa de espaço para consentimento, login, fila de eventos e log local.

### 5. Configurar o build

O Chrome não executa TypeScript diretamente. Por isso usamos **Vite** + **@crxjs/vite-plugin**:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [crx({ manifest })],
  build: { outDir: "dist" },
});
```

```bash
npm install
npm run build
```

O resultado em `dist/` é o que você carrega no Chrome.

### 6. Carregar no navegador

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `dist/`

Pronto — a extensão está instalada localmente.

---

## Service Worker — o cérebro em segundo plano

No Manifest V3, o background script é um **Service Worker**. Diferenças importantes:

| Background page (V2) | Service Worker (V3) |
|----------------------|---------------------|
| Ficava sempre aberto | Dorme quando ocioso |
| Podia acessar DOM | Não tem DOM |
| Persistia variáveis na memória | Estado deve ir para `chrome.storage` |

### O que o Echoes escuta

**1. `chrome.tabs.onUpdated`** — quando uma aba muda (URL, status de carregamento):

```typescript
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void handleTabUpdate(tabId, changeInfo, tab);
});
```

Só processa quando `changeInfo.status === "complete"` — ou seja, a página terminou de carregar.

**2. `chrome.tabs.onActivated`** — quando o usuário troca de aba:

```typescript
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  // captura URL e título da aba ativa
});
```

**3. `chrome.alarms`** — timer periódico para reenviar eventos que falharam:

```typescript
chrome.alarms.create("flush-queue", { periodInMinutes: 0.5 });
```

**4. `chrome.action.onClicked`** — clique no ícone abre as configurações:

```typescript
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
```

### URLs ignoradas

Páginas internas do navegador não devem ser rastreadas:

```typescript
const IGNORED_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "devtools://",
];
```

---

## Permissões: o mínimo necessário

### Permissões de API (`permissions`)

| Permissão | Para que serve | Usada no Echoes? |
|-----------|----------------|------------------|
| `tabs` | Ler URL, título e status das abas | Sim |
| `storage` | Persistir token, fila, preferências | Sim |
| `alarms` | Timers em background | Sim |
| `activeTab` | Acesso temporário à aba ativa | Não |
| `scripting` | Injetar scripts em páginas | Não (propositalmente) |
| `history` | Ler histórico completo | Não |

O Echoes **não usa content scripts** — nunca injeta código nas páginas visitadas. Isso é uma decisão de privacidade: só lê metadados da aba via API `tabs`.

### Permissões de host (`host_permissions`)

Declara quais domínios a extensão pode chamar com `fetch`:

```json
"host_permissions": [
  "http://localhost:3847/*",
  "https://*/*"
]
```

- `localhost:3847` — servidor mock para desenvolvimento
- `https://*/*` — API de produção/staging

---

## Armazenamento local com chrome.storage

Extensões não devem usar `localStorage` comum — ele não é compartilhado entre o service worker e páginas da extensão de forma confiável.

Use `chrome.storage.local`:

```typescript
// Salvar
await chrome.storage.local.set({ minha_chave: "valor" });

// Ler
const result = await chrome.storage.local.get("minha_chave");
console.log(result.minha_chave);

// Escutar mudanças (útil na UI)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.minha_chave) {
    console.log("Valor mudou:", changes.minha_chave.newValue);
  }
});
```

No Echoes, as chaves ficam centralizadas em `src/shared/constants.ts`:

```typescript
export const STORAGE_KEYS = {
  AUTH_TOKEN: "echoes_auth_token",
  TRACKING_ENABLED: "echoes_tracking_enabled",
  CONSENT_GIVEN: "echoes_consent_given",
  API_BASE_URL: "echoes_api_base_url",
  EVENT_QUEUE: "echoes_event_queue",
  LOCAL_EVENT_LOG: "echoes_local_event_log",
};
```

Isso evita typos e facilita manutenção.

---

## Página de configurações (UI)

A UI do Echoes é uma página HTML comum, registrada no manifest:

```json
"options_page": "src/settings/settings.html"
```

### Estrutura

```text
settings.html   → markup (consentimento, login, log de eventos)
settings.css    → estilos
settings.ts     → lógica (lê/escreve storage, chama auth, atualiza UI)
```

### O que a UI faz

1. **Consentimento** — checkbox obrigatório antes de qualquer captura
2. **Toggle de rastreamento** — pausa/retoma sem desinstalar
3. **Login** — envia email/senha para `POST /api/v1/auth/login`
4. **URL da API** — permite apontar para staging ou localhost
5. **Status da fila** — quantos eventos aguardam envio
6. **Log local** — últimos 100 eventos capturados (transparência)

A UI e o service worker **compartilham o mesmo storage**. Quando o usuário desativa o rastreamento na UI, o service worker lê essa flag na próxima captura e para de enfileirar eventos.

---

## Comunicação com uma API externa

Extensões usam `fetch` normalmente, com algumas particularidades:

### Autenticação

```typescript
const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

const { token } = await response.json();
await chrome.storage.local.set({ echoes_auth_token: token });
```

### Envio de eventos

```typescript
await fetch(`${baseUrl}/api/v1/events`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(evento),
});
```

### Formato do evento (Echoes)

```json
{
  "type": "WEB_VISIT",
  "timestamp": "2026-06-12T15:30:00.000Z",
  "source": "browser_extension",
  "metadata": {
    "url": "https://kafka.apache.org",
    "title": "Apache Kafka",
    "browser": "chrome"
  }
}
```

Contrato completo da API: **[API.md](./API.md)**.

### Fila com retry

Rede falha. Usuário pode não estar logado ainda. Por isso o Echoes:

1. Salva o evento em `chrome.storage.local` **antes** de enviar
2. Tenta enviar imediatamente
3. Se falhar, mantém na fila e tenta de novo (até 5 vezes)
4. A cada 30 segundos, o alarm dispara um flush automático

Isso garante que eventos não se percam por instabilidade de rede.

---

## TypeScript + Vite: por que usar um bundler?

Você *pode* escrever uma extensão em JavaScript puro, sem build. Mas para projetos reais, TypeScript + bundler traz:

| Benefício | Explicação |
|-----------|------------|
| **Type safety** | Erros de tipo aparecem antes de rodar |
| **Módulos ES** | `import/export` entre arquivos |
| **Autocompletar da API Chrome** | Pacote `@types/chrome` |
| **Build otimizado** | Vite gera a pasta `dist/` pronta para o Chrome |
| **Hot reload no dev** | `npm run dev` recompila ao salvar |

Scripts disponíveis no Echoes:

```bash
npm run build        # compila uma vez → dist/
npm run dev          # recompila ao salvar arquivos
npm run mock-server  # sobe API fake em localhost:3847
```

---

## Testar localmente no Chrome

### Pré-requisitos

- Node.js 18+
- Google Chrome (ou Chromium, Edge, Brave)

### Passo a passo

```bash
# 1. Instalar dependências
npm install

# 2. Compilar a extensão
npm run build

# 3. Em outro terminal, subir a API mock
npm run mock-server
```

### Instalar a extensão

1. Acesse `chrome://extensions`
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique **Carregar sem compactação**
4. Selecione a pasta **`dist/`** do projeto

### Configurar e validar

1. Clique no ícone **Echoes** na barra → abre a página de configurações
2. Marque **consentimento** e ative **rastreamento**
3. Faça login:
   - Email: `demo@echoes.local`
   - Senha: `demo1234`
4. Visite sites normais (ex.: https://example.com)
5. Verifique:
   - Eventos aparecem em **Recent events (local)** nas configurações
   - O terminal do mock server imprime `[mock] event received: ...`

### Ciclo de desenvolvimento

```bash
# Terminal 1
npm run mock-server

# Terminal 2
npm run dev
```

Após cada recompilação, volte em `chrome://extensions` e clique **Recarregar** na extensão Echoes.

### Depurar

| O quê | Como |
|-------|------|
| Service Worker | `chrome://extensions` → Echoes → **Inspect views: service worker** |
| Página de opções | Botão direito na página → **Inspecionar** |
| Storage | DevTools → Application → Storage → Extension storage |
| Erros de permissão | Console do service worker mostra erros de API |

---

## Fluxo completo de um evento no Echoes

```text
1. Usuário abre https://kafka.apache.org
         │
         ▼
2. chrome.tabs.onUpdated dispara (status: complete)
         │
         ▼
3. Service worker verifica:
   ├── Consentimento dado? ──Não──► para
   ├── Rastreamento ativo? ──Não──► para
   └── URL rastreável?     ──Não──► para
         │ Sim
         ▼
4. createWebVisitEvent(url, title)
         │
         ▼
5. Evento salvo no log local + fila (chrome.storage)
         │
         ▼
6. flushQueue() → POST /api/v1/events com Bearer token
         │
         ├── 2xx → remove da fila
         └── erro → mantém na fila, retry depois
```

Esse fluxo está implementado em:

- `src/background/service-worker.ts` — passos 2 e 3
- `src/events/event-types.ts` — passo 4
- `src/events/event-queue.ts` — passos 5 e 6
- `src/api/client.ts` — HTTP do passo 6

---

## Boas práticas e erros comuns

### Faça

- Peça **consentimento explícito** antes de coletar dados
- Use **permissões mínimas**
- Persista estado em `chrome.storage`, não em variáveis globais do service worker
- Trate falhas de rede com **fila + retry**
- Documente o contrato da API ([API.md](./API.md))
- Teste com uma **API mock** antes de integrar com produção

### Evite

- Injetar content scripts sem necessidade real
- Coletar conteúdo de página, formulários ou cookies
- Assumir que o service worker está sempre vivo — ele pode ser encerrado a qualquer momento
- Usar `localStorage` para dados compartilhados entre contextos
- Esquecer de recarregar a extensão após `npm run build`

### Erros comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Extensão não atualiza | Build não rodou ou extensão não recarregada | `npm run build` + Recarregar em `chrome://extensions` |
| Nenhum evento capturado | Consentimento desmarcado ou URL `chrome://` | Verificar configurações e testar com site normal |
| Eventos na fila, não no servidor | Usuário não logado | Fazer login nas configurações |
| `401 Unauthorized` | Token inválido ou expirado | Sair e entrar novamente |
| Service worker "inativo" | Comportamento normal do MV3 | Ele acorda nos eventos; use `chrome.storage` para estado |

---

## Próximos passos

Depois de entender este guia e o projeto Echoes, você pode explorar:

| Tópico | Recurso neste repo |
|--------|-------------------|
| Arquitetura interna detalhada | [IMPLEMENTATION.md](./IMPLEMENTATION.md) |
| Contrato HTTP com o backend | [API.md](./API.md) |
| Visão de produto e escopo MVP | [README.md](./README.md) |

Ideias para evoluir a extensão:

- **Popup** em vez de (ou além da) página de opções
- **Content scripts** para casos específicos (com consentimento extra)
- **Suporte a Firefox** (WebExtensions — API muito similar)
- **Publicação na Chrome Web Store** (requer conta de desenvolvedor e revisão)
- **Sincronização** via `chrome.storage.sync` para preferências entre dispositivos

---

## Referências externas

- [Documentação oficial — Chrome Extensions (MV3)](https://developer.chrome.com/docs/extensions/mv3/)
- [API chrome.tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [API chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin)
- [MDN — Browser Extensions](https://developer.mozilla.org/pt-BR/docs/Mozilla/Add-ons/WebExtensions)

---

*Este guia foi escrito com base no código real do repositório `echoes-browser-extension`. Para ver a implementação de cada conceito, navegue pelos arquivos em `src/` enquanto lê.*
