# Echoes Browser Extension — Technical Overview

## Install (early access)

The extension isn't on the Chrome Web Store yet, so it's installed manually in developer mode. It works in Chrome, Edge, Brave and other Chromium browsers.

1. Download [`echoes-extension.zip`](https://github.com/alefebspp/echoes-browser-extension/releases/latest/download/echoes-extension.zip) and unzip it somewhere you'll keep — Chrome loads it from that folder.
2. Open `chrome://extensions` and turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the unzipped `echoes-extension` folder.
4. Click the Echoes icon, give consent, turn tracking on, and sign in with your Echoes account.

To update, download the new zip, replace the folder's contents, and click the reload icon on the extension's card.

## Releasing

Releases are built by `.github/workflows/release.yml`:

1. Set the repository variable `VITE_API_BASE_URL` to the production API URL (once).
2. Bump `version` in `manifest.json` (and `package.json`).
3. Commit, then push a matching tag: `git tag v0.1.1 && git push origin v0.1.1`.

The workflow builds the extension and attaches `echoes-extension.zip` to a GitHub release.

## Purpose

The Echoes Browser Extension is responsible for capturing user browsing activity and sending structured events to the Echoes Engine backend. Its primary role is to act as a lightweight event source, allowing the platform to build a digital memory timeline and identify behavioral patterns over time.

The extension should be designed with privacy, transparency, and user consent as first-class principles.

---

## Initial MVP Scope

The first version should focus exclusively on collecting basic browsing events:

- Current page URL
- Page title
- Timestamp
- Browser identifier (optional)

No page content, form data, cookies, passwords, or personal information should be collected.

### Example Event

```json
{
  "type": "WEB_VISIT",
  "timestamp": "2026-06-12T15:30:00Z",
  "source": "chrome_extension",
  "data": {
    "url": "https://kafka.apache.org",
    "title": "Apache Kafka"
  }
}
```

---

## Architecture

The browser extension should be maintained in a separate repository from the backend to enable independent development, deployment, and versioning.

### Suggested Repository

```text
echoes-browser-extension/
├── src/
├── public/
├── manifest.json
├── package.json
└── README.md
```

---

## Core Components

### Background Service Worker

Responsible for:

- Detecting tab updates
- Detecting navigation events
- Creating normalized events
- Sending events to the Echoes API

### Authentication Module

Responsible for:

- User login
- Secure token storage
- Attaching authentication headers to API requests

### Event Queue

Responsible for:

- Buffering events locally
- Retrying failed requests
- Preventing data loss during network interruptions

### Settings Page

Allows users to:

- Enable or disable tracking
- View collected data
- Manage permissions
- Sign out

---

## Communication with Echoes Engine

The extension communicates directly with the Echoes API through HTTPS requests.

### Endpoint Example

```http
POST /api/v1/events
Authorization: Bearer <token>
```

### Payload Example

```json
{
  "type": "WEB_VISIT",
  "timestamp": "2026-06-12T15:30:00Z",
  "source": "browser_extension",
  "metadata": {
    "url": "https://youtube.com",
    "title": "Kafka Tutorial"
  }
}
```

---

## Privacy Requirements

The extension must:

- Request explicit user consent
- Clearly explain what data is collected
- Allow users to disable tracking at any time
- Use encrypted HTTPS communication
- Store only the minimum amount of local data required

The extension must not collect:

- Passwords
- Form inputs
- Cookies
- Banking information
- Private messages
- Page content

---

## Chrome Extension Requirements

The extension should be built using Manifest V3.

### Required Permissions

```json
{
  "permissions": ["tabs", "storage"]
}
```

Additional permissions should only be added when absolutely necessary.

---

## Future Enhancements

Potential future capabilities include:

- Time spent per website
- Domain categorization
- Productivity scoring
- Browser bookmarks integration
- Reading history analysis
- Context-aware event enrichment
- Cross-browser support (Chrome, Edge, Firefox)

The extension should remain lightweight and focus exclusively on event collection, while all intelligence, enrichment, pattern recognition, and recommendation logic should be handled by the Echoes Engine backend.

---

## Local development

See **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** for a full walkthrough of how each component works and how to test locally.

For the exact backend HTTP contract (endpoints, URLs, payloads), see **[API.md](./API.md)**.

Para um guia completo em português sobre como criar extensões de navegador usando este projeto como exemplo, veja **[GUIA-EXTENSAO-PT-BR.md](./GUIA-EXTENSAO-PT-BR.md)**.

Quick start:

```bash
npm install
npm run build
npm run mock-server   # in a separate terminal
```

Then load the `dist/` folder as an unpacked extension in `chrome://extensions`.
