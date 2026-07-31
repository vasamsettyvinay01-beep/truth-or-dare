# Deployed on Render / Railway / Fly — NOT Vercel (WebSockets need a long-lived Node process)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
# Workspaces hoist to /app/node_modules — don't expect per-package folders.
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/shared/package.json ./shared/
COPY --from=deps /app/server/package.json ./server/
COPY --from=deps /app/web/package.json ./web/
COPY shared ./shared
COPY server ./server
RUN npm run build -w shared && npm run build -w server

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/server ./server
EXPOSE 4001
CMD ["npm", "run", "start", "-w", "server"]
