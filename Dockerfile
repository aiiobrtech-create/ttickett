# TTICKETT — build do front (Vite) + servidor Express em produção
FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM deps AS prod-deps
RUN npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json* ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server.ts ./
COPY server ./server

# Uploads temporários (multer)
RUN mkdir -p uploads

EXPOSE 3000
ENV PORT=3000
ENV LISTEN_HOST=0.0.0.0

CMD ["npm", "run", "start:prod"]
