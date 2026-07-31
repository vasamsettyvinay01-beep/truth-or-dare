# Contributing

## Setup

```bash
npm install
npm run build -w shared
npm run dev
```

- Web: http://localhost:3000  
- API: http://localhost:4001  

Copy `.env.example` into `web/.env.local` for local socket URL overrides.

## Checks before a PR

```bash
npm run typecheck
npm run lint
npm run test:unit
# needs a running server on :4001
npm run test:e2e
npm run build
```

## Guidelines

* Keep the no-accounts / in-memory room model.
* Validate every Socket.IO payload on the server.
* Do not log reconnect tokens, chat text, or imported packs.
* Prefer small, focused PRs with a clear security or reliability reason.
* Mark incomplete game modes as `experimental` in `GAME_MODES` rather than
  silently deleting them.
* Do not commit `.env`, tokens, or build output.
