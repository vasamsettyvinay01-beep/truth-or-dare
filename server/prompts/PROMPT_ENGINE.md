# Prompt Engine

Professional prompt system for the adults-only Truth or Dare multiplayer game.

## Schema

Every prompt in a pack:

```json
{
  "id": "romance-cool-truth-1",
  "type": "truth",
  "category": "romance",
  "difficulty": "cool",
  "prompt": "What small romantic gesture always makes you melt a little?",
  "remoteFriendly": true,
  "tags": ["cool", "truth", "romance", "remote", "flirty"],
  "weight": 1
}
```

Pack wrapper:

```json
{
  "id": "adult-romance-pack",
  "name": "Adult Romance Pack",
  "version": "2.0.0",
  "description": "...",
  "categories": ["romance", "kissing", "..."],
  "prompts": [ ... ]
}
```

## Difficulty guide

| Level | Intent |
|-------|--------|
| `cool` | Funny, icebreakers, casual, lighthearted |
| `spicy` | Flirty, romantic, playful, personal |
| `extreme` | Very bold, emotionally revealing, socially daring |
| `no_boundaries` | Boldest prompts within consent + category settings |

## Architecture

```
shared/src/index.ts          PromptRecord, PromptQuery, normalize helpers
server/src/prompts/catalog.ts Indexed catalog (by type/difficulty/category/tag)
server/src/prompts/engine.ts  Multi-pack loader, room overlays, pick/query/export
server/prompts/*.json         Editable on-disk packs (auto-loaded)
```

### Features

- **No repeats** during a room session (`usedPromptIds` + strict pick)
- **Weighted random** by `weight` × host category weights
- **Remote-only filter** (default on) for video-call-safe dares
- **Search / filter** via `GET /api/prompts` and socket `prompts:query`
- **Import / export** JSON packs from the lobby or HTTP
- Scales to thousands of prompts via set indexes (not full scans per field)

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/prompts/summary` | Counts, categories, tags |
| `GET /api/prompts?search=&type=&difficulty=&category=&remoteOnly=1` | Filtered query |
| `GET /api/prompts?full=1` | Entire merged pack |
| `GET /api/prompts/export` | Download pack JSON |
| `POST /api/prompts/validate` | Validate a pack body |

## Adding community packs

1. Drop a `.json` file into `server/prompts/`
2. Restart the server (or call reload in future tooling)
3. Or import at runtime from the host lobby UI

Legacy packs using `level` / `text` are auto-normalized on load.
