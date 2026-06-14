FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Install dependencies — layer cached until package files change
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY package.json ./
COPY backend/package.json ./backend/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile --filter=@24therapy/api...

# Copy all source and compile TypeScript → backend/dist/
COPY . .
RUN pnpm --filter=@24therapy/api build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "backend/dist/main.js"]

# Reviewed: 2026-06-14 — 24Therapy audit
