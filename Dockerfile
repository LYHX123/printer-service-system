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
# LibreOffice needs a writable profile dir at startup ($HOME/.config); /tmp is
# writable by any user in this base image, unlike the "nextjs" system user's
# nonexistent home directory.
ENV HOME=/tmp

# Quotation Excel -> PDF conversion (see src/lib/templateEngine/generatePdf.ts)
# shells out to a local headless LibreOffice at request time. libreoffice-calc
# is the Calc/spreadsheet component only — it still provides the shared
# `soffice` binary this app looks for, at a fraction of the size of the full
# `libreoffice` meta-package (which also pulls in Impress/Draw/Base/Writer,
# none of which this app ever uses).
RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice-calc \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone server output (includes a minimal, traced node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Generated Prisma client (custom output path, may not be fully traced)
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

# Prisma schema + full migration history, and prisma.config.ts (which is what
# actually supplies the datasource URL from DATABASE_URL — schema.prisma's
# own datasource block has no `url`, by design, since this project reads it
# via prisma.config.ts). Next's standalone output only traces modules the
# server itself imports at runtime, so these plain data/config files are
# never picked up automatically — without them, `prisma migrate deploy`
# cannot find a schema or a database URL to run against.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Full node_modules, overlaid on top of the standalone output's pruned copy
# above. The traced node_modules only contains what the running Next.js
# server itself imports, which never includes the `prisma` CLI (it's a
# dependency of the project, but nothing in the app's own request-handling
# code ever `require`s it — it's invoked directly as a binary via `npx`).
# Copied from the `deps` stage — the untouched `npm ci` install — so the
# version here is guaranteed to be exactly the one pinned in
# package-lock.json (matching the project's own `prisma` dependency), and
# `npx prisma` resolves this local install first instead of ever reaching
# out to the registry for a different one.
COPY --from=deps /app/node_modules ./node_modules

# Ensure every directory the app writes to at runtime exists and is owned by
# the unprivileged nextjs user it actually runs as (see USER below):
#   - public/uploads: Customer/Job/etc. file uploads (LocalStorageProvider)
#   - storage/generated/{quotation,invoice}: Excel/PDF generation scratch
#     output (src/lib/quotationExcel/generate.ts, src/lib/invoiceExcel/generate.ts)
#     — this one bit production: these dirs previously got here (if at all)
#     as a side effect of Next's standalone output tracing, root-owned like
#     everything else COPY brings in, so every quotation Excel/PDF write
#     failed with EACCES — which silently broke *both* the automatic
#     Dropbox sync on create/Adjust/Approve and the manual "Sync to
#     Dropbox" retry (they share the same generation code, so there was
#     never a permission-having path to retry into).
# node_modules/prisma is included here too: the Prisma CLI writes a small
# engine-checksum/cache file under node_modules/@prisma/engines on first run
# (even for read-only commands like `--version` or `migrate deploy`) — left
# root-owned (the default for a Dockerfile COPY), it fails with "Can't write
# to .../@prisma/engines" once running as the unprivileged nextjs user below.
RUN mkdir -p ./public/uploads ./storage/generated/quotation ./storage/generated/invoice \
  && chown -R nextjs:nodejs ./public/uploads ./storage ./node_modules ./prisma .next

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
