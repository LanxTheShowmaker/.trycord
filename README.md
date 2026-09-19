# .trycord — server (`server` branch)

## How to start the server

```bat
cd trycord-server
npm install
copy .env.example .env
```

Edit `.env` — required: `JWT_SECRET` (generate one), plus a database
(`DB_CLIENT=sqlite` + `DB_FILE=./dev.db` for local dev, or your own MySQL —
see `.env.example`). The server refuses to start without them and never
creates a database implicitly.

```bat
npm run seed
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

This branch is the self-hosting backend: API, WebSocket gateway, and access
to the administrator's database. It owns all instance data. See `main` for
the full architecture (access points, global sync, MySQL setup, migration).
Full repo (client + desktop app) lives on `main`.
