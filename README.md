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

Optional env:

```bash
# web/.env.local
NEXT_PUBLIC_SOCKET_URL=http://localhost:4001

# server
PORT=4001
CLIENT_ORIGIN=http://localhost:3000
```

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

Reconnect: a token is stored in `localStorage` so a refresh can rejoin the same seat within the grace window.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Server + web together |
| `npm run build` | Build shared, server, web |
| `npm run typecheck` | Typecheck all packages |

## Notes

- Adults-only content packs are editable — keep production prompts appropriate for your audience.
- Optional voice is signaling-ready (`voice:*` events); wire WebRTC peers on the client if you want full audio.
