# syntax=docker/dockerfile:1

##### Stage 1: install dependencies #####
FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

##### Stage 2: build the application #####
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate the Prisma client (writes to src/generated/prisma)
RUN npx prisma generate

# Build Next.js in standalone mode
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

##### Stage 3: production runtime #####
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone server output (includes a minimal node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Generated Prisma client (custom output path, may not be fully traced)
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

# Prisma runtime packages, in case they aren't bundled by output tracing
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Ensure the uploads directory exists and is writable by the app user
RUN mkdir -p ./public/uploads && chown -R nextjs:nodejs ./public/uploads .next

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
