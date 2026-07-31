# Truth or Dare

Premium real-time multiplayer **Truth or Dare** for the browser. Create a room, share a code or invite link, play with friends anywhere — no accounts, no database, nothing persisted after the room dies.

## Stack

| Layer | Tech |
|-------|------|
| Web | Next.js 15, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Zustand |
| Realtime | Express, Socket.IO |
| State | In-memory rooms only |

## Quick start

```bash
npm install
npm run build -w shared
npm run dev
```

- Web: [http://localhost:3000](http://localhost:3000)
- Server: [http://localhost:4001](http://localhost:4001)

Environment variables (see [`.env.example`](.env.example) for the annotated list):

```bash
# web/.env.local
NEXT_PUBLIC_SOCKET_URL=http://localhost:4001

# server
PORT=4001
CLIENT_ORIGIN=http://localhost:3000
CLIENT_ORIGINS=http://localhost:3000
```

To play from a phone on your LAN, point `NEXT_PUBLIC_SOCKET_URL` at your
machine's IP (`http://192.168.x.x:4001`) and add the matching web origin to
`CLIENT_ORIGINS`. `localhost` resolves to the phone itself and will never work.

## Deployment

The frontend and the realtime server deploy separately, because Vercel's
serverless functions cannot hold an open WebSocket.

| Piece | Host | Notes |
|-------|------|-------|
| `web/` | Vercel | Next.js App Router, native routing — no SPA rewrites |
| `server/` | Render / Railway / Fly | Persistent Node process, health check at `/health` |

1. Deploy the server first. [`render.yaml`](render.yaml) is a ready blueprint;
   set `CLIENT_ORIGINS` to your Vercel domains.
2. Copy the resulting **https** URL.
3. In Vercel, set `NEXT_PUBLIC_SOCKET_URL` to that URL for Production (and
   Preview, if you want previews to work) and redeploy.

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time, so
changing the variable requires a redeploy. An `http://` URL on an `https://`
page is blocked by every mobile browser as mixed content.

## Game flow

Landing → Create / Join → Lobby → Everyone ready → Host picks level → Turns → Truth/Dare (or spin/random) → Complete / Skip / New prompt → Next player

### Levels

Cool · Spicy · Extreme · No Boundaries

### Modes

Classic · Random · Spin Wheel · Survival · Couples · Team Battle · Last Standing

## Custom prompts

Default packs live in `server/prompts/` (auto-loaded):

- `core-pack.json`
- `adult-romance-pack.json` (~1080 romance / flirting prompts)

Hosts can **export / import** JSON packs from the lobby admin panel. Canonical schema:

```json
{
  "id": "my-pack",
  "name": "My Pack",
  "version": "1.0.0",
  "categories": ["romance", "flirting"],
  "prompts": [
    {
      "id": "unique-id",
      "type": "truth",
      "category": "romance",
      "difficulty": "cool",
      "prompt": "Your prompt here",
      "remoteFriendly": true,
      "tags": ["cool", "truth", "romance", "remote"],
      "weight": 1
    }
  ]
}
```

See `server/prompts/PROMPT_ENGINE.md` for search, weighting, and remote-play details.

`difficulty`: `cool` | `spicy` | `extreme` | `no_boundaries`  
`type`: `truth` | `dare`  
Legacy `level` / `text` fields are still accepted and normalized on load.

## Architecture

```
shared/     Shared TypeScript types & constants
server/     Express + Socket.IO, in-memory RoomManager, prompt engine
web/        Next.js app (feature UI, Zustand, socket client)
```

Rooms live only in memory. When the last player leaves (or the room idles out), the room and any imported packs for that room are destroyed.

Reconnect: a token is kept in `sessionStorage` so a refresh rejoins the same
seat within the grace window. It is scoped to the tab, expires on its own, and
is cleared when the player leaves or the room is destroyed. Nothing is
persisted server-side either — rooms live in memory only.

A dropped socket is not treated as leaving. Mobile browsers disconnect whenever
the screen locks or the user switches apps, so the seat is held for 90 seconds
in the lobby and 5 minutes mid-game before the sweeper reclaims it.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Server + web together |
| `npm run build` | Build shared, server, web |
| `npm run lint` | ESLint over the web app |
| `npm run typecheck` | Typecheck all packages |
| `npm test` | End-to-end multiplayer flow against a running server |
| `npm run test:mobile` | Playwright audit across phone viewports, plus a two-device touch run |

`npm test` and `npm run test:mobile` expect `npm run dev` to already be
running. The mobile audit needs `npx playwright install chromium` once.

## Notes

- Adults-only content packs are editable — keep production prompts appropriate for your audience.
- Optional voice is signaling-ready (`voice:*` events); wire WebRTC peers on the client if you want full audio.
