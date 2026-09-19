# .trycord — client + desktop app (`client` branch)

`trycord-client/` is the static web client. The easiest way to use it:
start the server (on `main` / `server` branch) and open http://localhost:9971.

## Point the client at another server

The backend URL is centralized — one source of truth, no rebuild needed.
Precedence: `?api=` launch argument → saved Server setting →
`trycord-client/config.js` (`window.TRYCORD_CONFIG.API_URL`) → default
(`http://localhost:9971`, or same-origin when served by the server).

```js
// trycord-client/config.js — point at a remote server, e.g.:
window.TRYCORD_CONFIG = { API_URL: 'http://51.79.44.111:9971' };
```

Or in the app: click **Change** next to the server name on the login page
(or Settings → Application → Test connection), enter the URL, test it
against `/api/health`, and save. WebSocket (`ws://`/`wss://`) derives
from the same URL automatically.

## Desktop app (Discord-style window)

Needs the server running at http://localhost:9971 (server defaults: `HOST=0.0.0.0`, `PORT=9971`).

```bat
cd trycord-desktop
npm install
npm start
```

Build a single-file Windows exe:

```bat
npm run dist
```

Output: `trycord-desktop/release/Trycord-*-portable.exe` (gitignored — never committed).
Verify its SHA256, then upload it to VirusTotal for a scan report.

Full repo (including server) lives on `main`.
