## ⚠️ RÈGLES CRITIQUES - À RESPECTER ABSOLUMENT

**INTERDICTIONS ABSOLUES** :
1. ❌ **NE JAMAIS faire de `git reset`, `git revert`, ou rollback Git sans demander explicitement la permission au développeur**
2. ❌ **NE JAMAIS supprimer une collection MongoDB (`db.collection.drop()`) sans confirmation explicite**
3. ❌ **NE JAMAIS supprimer des fichiers ou dossiers entiers sans validation**
4. ❌ **NE JAMAIS modifier les commits existants ou l'historique Git**

**TOUJOURS** :
- ✅ Proposer les changements et attendre la confirmation avant toute opération destructive
- ✅ Créer des backups avant modifications importantes de la DB
- ✅ Faire des commits réguliers avec des messages clairs
- ✅ Demander validation avant suppression de données

## Repo snapshot for AI coding agents

This repo is a combined React + Phaser frontend and an Express/Socket.IO backend with MongoDB. Key entry points:

- Backend: `server.js` — creates Express HTTP(S) server, initializes managers and Socket.IO. Default backend port: `BACKEND_PORT` or 3000.
- Frontend: `src/index.js` + `src/App.js` — React mounts a Phaser game (scenes in `src/*Scene.js`) inside React. Dev server: `npm start`.
- Managers (server-side): `managers/` contains modular manager classes (DatabaseManager, PlayerManager, SocketManager, QuizManager, TripleTriadManager, PhotoManager). Managers often:
  - expose `setupRoutes(app)` to register HTTP routes (see `managers/DatabaseManager.js`).
  - expose socket hooks like `setupEvents(socket)` and are initialized from `server.js`.

## What to know (high-value, concrete items)

- Server lifecycle: `server.js` initializes DatabaseManager (connects to Mongo), then SocketManager, then other managers. Any manager that needs HTTP routes should implement `setupRoutes(app)` and is registered in `server.js`.
- Static assets are served from `/public` and mounted at `/public` via `express.static('public')`. Expect game assets under `public/assets`, `public/maps`, `public/apparences`.
- Socket flow: SocketManager creates `io` and calls managers' socket handlers. `PlayerManager` maps socket.id ↔ playerId and broadcasts `playersUpdate` every 50ms.
- Database: `managers/DatabaseManager.js` uses `process.env.MONGO_URI` (or fallback constant). Avoid hard-coding credentials when changing the code. Use `.env` files for local development.

## Typical developer workflows (how humans run things locally)

- Start frontend dev server (React) in one terminal (PowerShell):

```powershell
$env:PORT=4000; npm start
```

Set `PORT` to avoid collisions with backend (default backend port = 3000).

- Start backend server in another terminal (PowerShell):

```powershell
npm run server
# or: node server.js
```

- Build for production (frontend):

```powershell
npm run build
# then serve or integrate the build folder into deployment
```

- Database helpers / seeds: inspect `scripts/` for `seedDatabase.js`, `populatePlayers.js` and `testDatabaseConnection.js` when you need DB fixtures.

## Environment variables the agent should respect

- NODE_ENV — affects HTTPS certificate logic in `server.js`.
- BACKEND_PORT — override default backend port (3000).
- FRONTEND_URL — used in CORS allowlist in `server.js`.
- MONGO_URI — connection string used by `DatabaseManager`.

Set them in `.env` files or export in the terminal (PowerShell style shown above).

## Project-specific conventions & patterns (examples)

- Managers-as-singletons: each manager is constructed in `server.js`, stored in `this.managers`, and passed to others (example: `new PlayerManager(io, databaseManager)`). Follow that pattern when adding new managers.
- Route placement: prefer manager-level `setupRoutes(app)` for related endpoints (see `DatabaseManager.setupRoutes` for many `/api/*` routes). Use `routes/` only for truly separate route bundles (see `routes/booster.js`).
- Socket events: expose `setupEvents(socket)` on managers; SocketManager wires sockets to managers. `PlayerManager` uses `socket.on('chatMessage', ...)`, `socket.emit('chatHistory', ...)` patterns.
- File paths & assets: front-end expects assets at `/assets/*` or `/public/assets/*` (e.g., `character` paths in PlayerManager are like `/assets/apparences/<pseudo>.png`).

## Common APIs & examples (copyable snippets to reference)

- Get player list (server-side route): `GET /api/players` — implemented in `managers/DatabaseManager.js`.
- Update player position: `POST /api/players/update-position` — body: { pseudo, posX, posY, mapId }.
- Inventory retrieval: `GET /api/inventory/:playerId` — joins `inventory` ↔ `items` collections.
- Shop buy booster: `POST /api/shop/buy-booster` — body: { playerId, boosterId, price } (see `server.js` shop routes).

## Implementation hints for code edits

- When adding HTTP endpoints prefer `DatabaseManager.setupRoutes(app)` or create a new manager with `setupRoutes` to keep code organized.
- For socket messages, use `this.io.to(socketId).emit(...)` when targeting a specific client; use `this.io.emit(...)` for global broadcasts. Match the existing naming (French logs + English event names mixed — prefer existing event names).
- Avoid changing the `playersUpdate` frequency without considering frontend performance: it runs every 50ms (20Hz).

## Tests / linting / build

- This is a Create React App frontend. Use `npm test` for CRA tests.
- No centralized lint/test runner for the backend; run the backend via `npm run server` and inspect logs.

## Where to look next (key files to inspect for context)

- `server.js` — orchestration, CORS, manager lifecycle, shop routes.
- `managers/DatabaseManager.js` — all major REST endpoints and DB helpers.
- `managers/PlayerManager.js` — socket handling, players state, chat logic, examples of interaction events.
- `src/*Scene.js` and `src/index.js` — how Phaser scenes are wired into React and how `useChat` integrates Socket logic client-side.

---

If you'd like, I can:
- merge this into an existing `.github/copilot-instructions.md` (none was found), or
- extend any section with more code examples (e.g., exact socket event shapes or DB schemas).

Please tell me which sections need more detail or if you'd like the agent to include safe defaults for missing env vars and secrets handling.
