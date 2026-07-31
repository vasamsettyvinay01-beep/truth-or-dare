# Truth or Dare

Premium real-time multiplayer **Truth or Dare** for the browser. Create a room, share a code or invite link, and play with friends — no accounts, no database, nothing persisted after the room ends.

## Production

| Surface | URL |
|---------|-----|
| Frontend | https://truth-or-dare-gray.vercel.app |
| API | https://api-production-97fc.up.railway.app |
| Health | https://api-production-97fc.up.railway.app/health |

```text
Browser (Vercel / Next.js)
        │  HTTPS + Socket.IO
        ▼
Express + Socket.IO (Railway)
        │
   in-memory rooms only
```

## Stack

| Layer | Tech |
|-------|------|
| `web/` | Next.js 15, React 19, TypeScript, Tailwind, Framer Motion, Zustand |
| `server/` | Express, Socket.IO, in-memory `RoomManager`, prompt engine |
| `shared/` | Shared types, limits, validation helpers |

## Privacy model

* No accounts or passwords
* No database
* Rooms, chat, nicknames, and imported packs live only in server memory
* Reconnect tokens are temporary, room-scoped, and stored in tab `sessionStorage`
* Nothing is retained after the room is destroyed or the process restarts

## Security model (high level)

* CORS allowlist — no `*` in production
* Server-side validation of every Socket.IO payload
* Host authority from server room state (never trust client `isHost`)
* Per-IP / per-socket rate limits and payload size caps
* Temporary reconnect tokens with expiry and invalidation on leave
* Prompt imports validated as hostile JSON (size, count, shape)
* Security headers on API and Next.js responses
* Minimal logging — no tokens, chat content, or full packs

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## Quick start

```bash
npm install
npm run build -w shared
npm run dev
```

- Web: http://localhost:3000
- Server: http://localhost:4001

Copy [`.env.example`](.env.example) into `web/.env.local` as needed:

```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:4001
PORT=4001
CLIENT_ORIGIN=http://localhost:3000
CLIENT_ORIGINS=http://localhost:3000
```

Phone on the same Wi-Fi: open the Network URL from `next dev`. A loopback socket URL is rewritten to the page host; the server accepts private-network origins outside production.

## Repository structure

```text
shared/     Types, constants, limits, sanitizers
server/     Express + Socket.IO, rooms, prompts, rate limits
web/        Next.js UI, Zustand, socket client
prompts/    Source prompt packs
scripts/    Unit + e2e + mobile audit helpers
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Server + web |
| `npm run build` | Build shared → server → web |
| `npm run lint` | ESLint (web) |
| `npm run typecheck` | Typecheck all workspaces |
| `npm run test:unit` | Shared validation unit checks |
| `npm run test:e2e` | Socket.IO multiplayer flow (needs server on `:4001`) |
| `npm test` | Unit + e2e |
| `npm run test:mobile` | Playwright mobile audit (needs `npm run dev`) |

## Deployment

Frontend and realtime server deploy separately — Vercel cannot hold long-lived WebSockets.

| Piece | Host | Notes |
|-------|------|-------|
| `web/` | Vercel | Set `NEXT_PUBLIC_SOCKET_URL` (Production) to the https API URL |
| `server/` | Railway | `PORT`, `CLIENT_ORIGINS`, `NODE_ENV=production`; bind `0.0.0.0` |

1. Deploy the API (`server/Dockerfile` / `railway.toml`).
2. Set `CLIENT_ORIGINS` to the production Vercel origin (and optional preview pattern).
3. Set Vercel `NEXT_PUBLIC_SOCKET_URL` to the Railway https URL and redeploy.

Never point an https frontend at an `http://` API (mixed content). Do not set `CLIENT_ORIGINS=*`.

## Game flow

Landing → Create / Join → Lobby → Ready → Host starts → Level → Turns → Truth/Dare → Complete / Skip → Next

**Levels:** Cool · Spicy · Extreme · No Boundaries  

**Modes:** Classic · Random · Spin Wheel · Survival / Couples / Team Battle / Last Standing (**experimental** in the UI)

## Custom prompts

Default packs in `server/prompts/`. Hosts can export / import JSON from the lobby. Imports are size- and schema-limited. See `server/prompts/PROMPT_ENGINE.md`.

## Known limitations

* Single Node process — rooms do not survive redeploys or multi-instance fan-out
* Rate limits are in-memory per instance
* Voice is signaling-only (“Coming soon” in UI)
* Theme preference is stored but not fully applied in CSS yet
* `npm audit` may report Next.js-transitive issues; do not force-downgrade Next without review

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Create room stuck / “Connection lost” on Vercel | `NEXT_PUBLIC_SOCKET_URL` set and redeployed; `/health` OK |
| CORS errors | `CLIENT_ORIGINS` includes the exact frontend origin |
| Phone cannot reach localhost API | Use LAN Network URL or deployed API |
| Room vanished | Process restarted or idle cleanup — expected for in-memory rooms |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
