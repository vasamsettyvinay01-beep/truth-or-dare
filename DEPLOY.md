# Deployment

This app splits across two hosts:

| Piece | Host | Why |
|-------|------|-----|
| Next.js web (`web/`) | **Vercel** | Static/SSR frontend |
| Express + Socket.IO (`server/`) | **Render / Railway / Fly** | Persistent WebSockets (not supported on Vercel serverless) |

## 1. Deploy realtime API (Render)

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Blueprint** (uses `render.yaml`)  
   or **Web Service** with:
   - Build: `npm install && npm run build -w shared && npm run build -w server`
   - Start: `npm run start -w server`
3. Set env:
   - `CLIENT_ORIGIN` = your Vercel URL (e.g. `https://truth-or-dare.vercel.app`)
   - `CLIENT_ORIGINS` = comma-separated list if you have preview + production URLs
4. Copy the public service URL (e.g. `https://truth-or-dare-api.onrender.com`).

Free Render services sleep after idle; first join may take ~30s to wake.

## 2. Deploy web (Vercel)

```bash
npx vercel login
npx vercel --prod
```

Set environment variable in the Vercel project:

```
NEXT_PUBLIC_SOCKET_URL=https://YOUR-RENDER-URL
```

Redeploy after setting the env var so the client picks it up.

## Local production smoke test

```bash
npm run build
CLIENT_ORIGIN=http://localhost:3000 npm run start -w server
NEXT_PUBLIC_SOCKET_URL=http://localhost:4001 npm run start -w web
```
