# Echoes Browser Extension — API Contract

This document describes the **exact HTTP contract** the extension expects from the Echoes Engine backend. It is derived from the current implementation in `src/auth/auth.ts`, `src/api/client.ts`, and `src/events/event-types.ts`.

---

## Base URL

| Setting | Value |
|---------|-------|
| Default | `http://localhost:3847` |
| Configurable | Yes — via the settings page (**Echoes API base URL**) |
| Stored key | `echoes_api_base_url` in `chrome.storage.local` |
| Trailing slash | Stripped on save; requests always use `{baseUrl}/api/v1/...` |

**Examples**

| Environment | Base URL |
|-------------|----------|
| Local mock server | `http://localhost:3847` |
| Staging | `https://staging-api.echoes.example` |
| Production | `https://api.echoes.example` |

All endpoint paths below are appended to this base URL.

---

## Endpoints used by the extension

The extension makes **two** HTTP calls to the backend:

| Method | Path | Auth required | Called from |
|--------|------|---------------|-------------|
| `POST` | `/api/v1/auth/login` | No | Settings page (login form) |
| `POST` | `/api/v1/events` | Yes (`Bearer` token) | Background service worker / queue flush |

No other endpoints are called by the extension at runtime.

---

## 1. Login

Authenticates the user and returns a token stored locally for subsequent event requests.

### Request

```http
POST {baseUrl}/api/v1/auth/login
Content-Type: application/json
```

**Body**

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | `string` | Yes | User email (trimmed in the UI before send) |
| `password` | `string` | Yes | User password |

### Success response

**Status:** any `2xx` (the client uses `response.ok`)

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | `string` | Yes | Bearer token stored as `echoes_auth_token` and sent on event requests |

The extension does **not** parse JWT claims, expiry, or refresh tokens. It stores the string as-is and sends it until the user signs out.

### Error response

**Status:** any non-`2xx` (e.g. `401`)

Body is read as plain text and shown in the settings UI. JSON is recommended for consistency:

```json
{
  "error": "Invalid credentials"
}
```

### Example

```bash
curl -X POST http://localhost:3847/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@echoes.local","password":"demo1234"}'
```

```json
{
  "token": "mock-jwt-token-for-local-dev"
}
```

---

## 2. Submit event

Sends a browsing event to the backend. Called immediately after capture and on periodic queue flushes (every 30 seconds, or manually from settings).

### Request

```http
POST {baseUrl}/api/v1/events
Content-Type: application/json
Authorization: Bearer <token>
```

If the user is not signed in, the `Authorization` header is **omitted**. The event stays in the local queue until login succeeds.

**Body — minimum contract**

The extension builds events with this shape:

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"WEB_VISIT"` | Yes | Event type literal (only type in MVP) |
| `timestamp` | `string` | Yes | ISO-8601 UTC, from `new Date().toISOString()` |
| `source` | `"browser_extension"` | Yes | Fixed literal identifying this client |
| `metadata` | `object` | Yes | Event-specific payload |
| `metadata.url` | `string` | Yes | Full page URL at time of capture |
| `metadata.title` | `string` | Yes | Tab title, or `"Untitled"` if empty |
| `metadata.browser` | `string` | No | Always `"chrome"` in current implementation |

**Body — actual payload on the wire**

When flushing the queue, the extension sends the **queued** object, which includes internal fields. Your API should accept (and may ignore) these extra properties:

```json
{
  "type": "WEB_VISIT",
  "timestamp": "2026-06-12T15:30:00.000Z",
  "source": "browser_extension",
  "metadata": {
    "url": "https://kafka.apache.org",
    "title": "Apache Kafka",
    "browser": "chrome"
  },
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "attempts": 0,
  "createdAt": "2026-06-12T15:30:01.123Z"
}
```

| Extra field | Type | Description |
|-------------|------|-------------|
| `id` | `string` | UUID generated client-side for queue deduplication |
| `attempts` | `number` | Send retry count (0 on first attempt) |
| `createdAt` | `string` | ISO-8601 UTC when the event was queued |

> **Backend recommendation:** Treat `id` as an optional idempotency key. Ignore `attempts` and `createdAt` unless you need operational metrics.

### Success response

**Status:** any `2xx`

The extension does **not** read or validate the response body on success. An empty `204 No Content` or a JSON body both work.

The mock server returns:

```json
{
  "id": "0a2dec5a-6914-4657-9c06-03c1fd26e1f1",
  "status": "accepted"
}
```

This is illustrative only — the extension ignores it.

### Error response

**Status:** any non-`2xx`

| Status | Extension behavior |
|--------|-------------------|
| `401` | Event kept in queue, retried (up to 5 attempts total) |
| `4xx` / `5xx` | Same — retried until max attempts, then dropped |
| Network error | Same — retried until max attempts, then dropped |

Error body is read as plain text for logging; not shown in the UI.

```json
{
  "error": "Unauthorized"
}
```

### Retry policy

| Constant | Value |
|----------|-------|
| Max attempts per event | `5` |
| Flush interval | Every `30` seconds (`chrome.alarms`) |
| Also flushed | Immediately after each new capture, after login, and via manual **Flush queue now** in settings |

### Example

```bash
curl -X POST http://localhost:3847/api/v1/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-jwt-token-for-local-dev" \
  -d '{
    "type": "WEB_VISIT",
    "timestamp": "2026-06-12T15:30:00.000Z",
    "source": "browser_extension",
    "metadata": {
      "url": "https://kafka.apache.org",
      "title": "Apache Kafka",
      "browser": "chrome"
    }
  }'
```

---

## URLs that are never sent

The extension filters these URL prefixes before creating events:

- `chrome://`
- `chrome-extension://`
- `edge://`
- `about:`
- `devtools://`

---

## Authentication header format

```http
Authorization: Bearer <token>
```

- Scheme must be `Bearer` (capital B).
- Token is the raw string from the login response `token` field.
- No `token_type` field is expected from login.

---

## CORS and network access

The extension declares host permissions for:

- `http://localhost:3847/*` (local dev)
- `https://*/*` (production/staging)

Requests originate from:

1. **Service worker** (`src/background/service-worker.ts`) — event delivery
2. **Settings page** (`src/settings/settings.ts`) — login only

Extension-origin `fetch` calls are **not** subject to normal web-page CORS. The backend does not need CORS headers for the extension to work in Chrome.

CORS **is** useful if you also call the same API from a web app during development. The mock server includes:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

---

## Mock server reference (local dev only)

`npm run mock-server` implements the contract above plus two **debug-only** endpoints not used by the extension:

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/health` | No | Health check → `{ "status": "ok" }` |
| `GET` | `/api/v1/events` | No | List events received by the mock server |

**Mock credentials**

| Field | Value |
|-------|-------|
| Email | `demo@echoes.local` |
| Password | `demo1234` |
| Token returned | `mock-jwt-token-for-local-dev` |

---

## TypeScript types (reference)

From `src/events/event-types.ts`:

```typescript
type WebVisitEvent = {
  type: "WEB_VISIT";
  timestamp: string;
  source: "browser_extension";
  metadata: {
    url: string;
    title: string;
    browser?: string;
  };
};

type QueuedEvent = WebVisitEvent & {
  id: string;
  attempts: number;
  createdAt: string;
};
```

Login response expected by `src/auth/auth.ts`:

```typescript
{ token: string }
```

---

## Backend checklist

To integrate with this extension, your Echoes Engine API must:

- [ ] Expose `POST /api/v1/auth/login` accepting `{ email, password }` and returning `{ token }`
- [ ] Expose `POST /api/v1/events` accepting the event JSON above
- [ ] Validate `Authorization: Bearer <token>` on event submission
- [ ] Return `2xx` on successful event ingest (body optional)
- [ ] Return non-`2xx` on auth/validation failures
- [ ] Use HTTPS in non-local environments
- [ ] Optionally accept/ignore queue fields: `id`, `attempts`, `createdAt`

---

## Related docs

- [IMPLEMENTATION.md](./IMPLEMENTATION.md) — how the extension uses this API internally
- [README.md](./README.md) — product overview and MVP scope
