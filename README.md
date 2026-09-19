# .trycord — client + desktop app (`client` branch)

`trycord-client/` is the static web client. The easiest way to use it:
start the server (on `main` / `server` branch) and open http://localhost:3000.

## Desktop app (Discord-style window)

Needs the server running at http://localhost:3000.

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
