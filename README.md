# .trycord — server (`server` branch)

## How to start the server

```bat
cd trycord-server
npm install
npm start
```

Then open **http://localhost:9971** — the web client is served by the server itself,
so there is nothing else to run.

The server binds to `HOST` (default `0.0.0.0`) on `PORT` (default `9971`).
Set `HOST=127.0.0.1` in `trycord-server/.env` to listen on loopback only.

First run? Seed a demo account + server:

```bat
npm run seed
```

Login with `demo` / `demo1234`, or register your own user.
Join a server with its join code (the seed prints one, e.g. `lobby`).

Config is optional (`trycord-server/.env`, see `.env.example`).
Full repo (client + desktop app) lives on `main`.
