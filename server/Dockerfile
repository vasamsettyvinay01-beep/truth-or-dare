# Deployed on Render / Railway / Fly — NOT Vercel (WebSockets need a long-lived Node process)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci --omit=dev=false

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY . .
RUN npm run build -w shared && npm run build -w server \
  && mkdir -p server/dist/prompts \
  && cp -r server/prompts/*.json server/dist/../prompts/ 2>/dev/null || true

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/server ./server
EXPOSE 4001
CMD ["npm", "run", "start", "-w", "server"]
