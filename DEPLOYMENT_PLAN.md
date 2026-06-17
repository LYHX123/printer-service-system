# Production Deployment Plan — Printer Service Management System

Status: **Planning only — no application code changed.**
This document is the agreed plan. Implementation (Dockerfile, compose file, config edits) will be done in a follow-up step after review.

---

## 1. Architecture Overview

```
                        Internet
                           │
                     [DNS: yourdomain.com]
                           │
                 ┌─────────────────────┐
                 │  Caddy (reverse      │  ← HTTPS (auto Let's Encrypt),
                 │  proxy, port 80/443) │     port 80/443 published
                 └─────────┬───────────┘
                           │ HTTP (internal docker network)
                 ┌─────────▼───────────┐
                 │  Next.js app        │  ← container "app", port 3000 (internal)
                 │  (printer-service)  │
                 └─────────┬───────────┘
                           │
                 ┌─────────▼───────────┐
                 │  PostgreSQL 16      │  ← container "db", internal only
                 │  (named volume)     │
                 └──────────────────────┘

   Persistent volumes:
     - pgdata           → /var/lib/postgresql/data  (database)
     - uploads          → /app/public/uploads        (photos, signatures, logos)
     - caddy_data       → Caddy's TLS certs/cache
```

All 3 containers are managed by a single `docker-compose.yml` on one VPS. The app container is stateless (all persistent data is in named volumes), so it can be rebuilt/redeployed without data loss.

---

## 2. Server Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| vCPU | 2 | 2–4 |
| RAM | 2 GB | 4 GB |
| Disk | 25 GB SSD | 40–80 GB SSD (grows with photo uploads) |
| OS | Ubuntu 22.04/24.04 LTS | Ubuntu 24.04 LTS |
| Software | Docker Engine + Docker Compose plugin | + `ufw`, `fail2ban`, `unattended-upgrades` |
| Network | Static public IP, ports 80 & 443 open | + port 22 (SSH) restricted to known IPs |
| Domain | A/AAAA record pointing to server IP | e.g. `printerservice.yourcompany.com` |

Sizing notes:
- 2 GB RAM is enough for the app + Postgres for a small/medium company (tens of concurrent users). Bump to 4 GB if Postgres grows large or many engineers upload photos simultaneously.
- Disk usage will be dominated by `public/uploads` (job photos, signatures, company logos) and Postgres data — plan for growth and monitor disk usage.

---

## 3. Required Application-Level Changes (for review, not yet applied)

These are small, low-risk changes needed to make the app Docker/production-ready. Listed here so you can approve before I touch code:

1. **`next.config.ts`** — add `output: "standalone"` so the Docker image only needs the minimal Next.js server runtime (much smaller image, faster builds).
2. **`src/auth.config.ts` / NextAuth setup** — ensure `AUTH_SECRET` and `AUTH_TRUST_HOST=true` are read from env (NextAuth v5 requires `AUTH_SECRET` in production and `AUTH_TRUST_HOST` when behind a reverse proxy).
3. **`.env.production` (new file, not committed)** — production environment variables (see §5).
4. No changes needed to `src/lib/uploads.ts` — it already writes to `public/uploads`, which we'll mount as a Docker volume.

---

## 4. Docker Setup (planned files)

### 4.1 `Dockerfile` (multi-stage, for Next.js standalone output)
- **Stage 1 (deps)**: `node:22-alpine`, install dependencies with `npm ci`.
- **Stage 2 (builder)**: copy source, run `npx prisma generate`, run `npm run build` (produces `.next/standalone`).
- **Stage 3 (runner)**: minimal `node:22-alpine`, copy `.next/standalone`, `.next/static`, `public/`, run as non-root user, `CMD ["node", "server.js"]`.
- Image will include `sharp` (already in deps) — Alpine needs `sharp`'s prebuilt binaries; we'll verify it installs cleanly in Alpine or switch base to `node:22-slim` (Debian) if Alpine has issues with `sharp`/`bcryptjs` native bindings.

### 4.2 `docker-compose.yml` (planned services)

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks: [internal]

  app:
    build: .
    restart: unless-stopped
    env_file: .env.production
    volumes:
      - uploads:/app/public/uploads
    depends_on: [db]
    networks: [internal, web]

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [app]
    networks: [web]

networks:
  internal:
  web:

volumes:
  pgdata:
  uploads:
  caddy_data:
  caddy_config:
```

### 4.3 `Caddyfile` (planned)

```
yourdomain.com {
    reverse_proxy app:3000
}
```

Caddy automatically obtains and renews a Let's Encrypt TLS certificate for `yourdomain.com` — no certbot scripts needed.

---

## 5. Environment Variables (`.env.production`, not committed to git)

| Variable | Example | Purpose |
|---|---|---|
| `POSTGRES_USER` | `printerapp` | DB user |
| `POSTGRES_PASSWORD` | *(strong random)* | DB password |
| `POSTGRES_DB` | `printer_service` | DB name |
| `DATABASE_URL` | `postgresql://printerapp:***@db:5432/printer_service` | Prisma connection string (uses Docker service name `db`) |
| `AUTH_SECRET` | *(generate via `openssl rand -base64 32`)* | NextAuth JWT/session signing |
| `AUTH_TRUST_HOST` | `true` | Required behind reverse proxy |
| `AUTH_URL` | `https://yourdomain.com` | Canonical app URL for NextAuth |
| `NEXT_PUBLIC_APP_NAME` | `Printer Service System` | Display name |
| `NODE_ENV` | `production` | Standard |

`.env.production` will be created on the server only (added to `.gitignore`, which already ignores `.env*`).

---

## 6. Multiple Employee Logins

No special infrastructure work needed beyond the above:
- NextAuth Credentials provider + Postgres `User` table already supports unlimited users with roles (`ADMIN`, `MANAGER`, `ENGINEER`, `RECEPTIONIST`).
- JWT session strategy is stateless — scales fine for many concurrent logged-in users on a single small VPS.
- HTTPS (via Caddy) is required for secure cookies (`__Secure-` prefixed NextAuth cookies are only set over HTTPS) — covered in §4.3.
- Each company's data is isolated by `companyId` — already handled by the existing schema.

---

## 7. Persistent File Storage (photos, signatures, PDFs)

- `public/uploads/**` (job photos, signatures, company logos) is written directly to disk by `src/lib/uploads.ts`.
- This directory will be mounted as a **named Docker volume** (`uploads:/app/public/uploads`), so it survives container rebuilds/redeploys.
- Generated PDFs (`@react-pdf/renderer`) — confirm whether these are streamed on-the-fly (no persistence needed) or written to disk; if written to disk, they must live under the same `uploads` volume. *(To verify during implementation — flagged for follow-up check of report-generation code.)*

---

## 8. Backup Strategy

### 8.1 Database backups
- Nightly cron job on the host running:
  ```bash
  docker compose exec -T db pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > /backups/db/db_$(date +%F).sql.gz
  ```
- Retain last 14 daily backups locally; prune older ones.

### 8.2 Uploaded files backup
- Nightly `tar`/`rsync` of the `uploads` volume to `/backups/uploads/`:
  ```bash
  tar -czf /backups/uploads/uploads_$(date +%F).tar.gz -C /var/lib/docker/volumes/<project>_uploads/_data .
  ```

### 8.3 Offsite copy
- Sync `/backups/` nightly to an offsite location (e.g., S3-compatible bucket via `rclone`, or another server via `rsync` over SSH).
- Recommended retention: 14 daily + 6 monthly snapshots offsite.

### 8.4 Restore procedure (documented, tested periodically)
- DB: `gunzip -c backup.sql.gz | docker compose exec -T db psql -U $POSTGRES_USER $POSTGRES_DB`
- Uploads: extract tarball into the `uploads` volume mount point.

---

## 9. Step-by-Step Deployment Commands (once files are created & approved)

```bash
# 1. On the server: install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Configure DNS
#    Create an A record: yourdomain.com -> <server public IP>

# 3. Clone the repo to the server
git clone <your-repo-url> printer-service-system
cd printer-service-system

# 4. Create production env file
cp .env.production.example .env.production
nano .env.production   # fill in DATABASE_URL, AUTH_SECRET, POSTGRES_*, AUTH_URL

# 5. Update Caddyfile with your real domain
nano Caddyfile

# 6. Build and start everything
docker compose up -d --build

# 7. Run database migrations + seed (first deploy only)
docker compose exec app npx prisma migrate deploy
docker compose exec app npx tsx prisma/seed.ts   # if seeding initial admin/company

# 8. Verify
docker compose ps
docker compose logs -f app
curl -I https://yourdomain.com

# 9. Set up backup cron (on host)
crontab -e
# add:
# 0 2 * * * cd /path/to/printer-service-system && docker compose exec -T db pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > /backups/db/db_$(date +\%F).sql.gz
# 30 2 * * * tar -czf /backups/uploads/uploads_$(date +\%F).tar.gz -C /var/lib/docker/volumes/printer-service-system_uploads/_data .
```

### Future redeploys (after code changes)
```bash
git pull
docker compose up -d --build app
docker compose exec app npx prisma migrate deploy
```

---

## 10. Open Questions / Items to Confirm Before Implementation

1. Confirm domain name to use (placeholder `yourdomain.com` above).
2. Confirm hosting provider/VPS (DigitalOcean, Hetzner, AWS Lightsail, etc.) — affects exact firewall/setup commands.
3. Confirm whether PDF reports are written to disk (need volume) or generated in-memory/streamed.
4. Confirm git repo is hosted somewhere accessible from the server (currently no remote configured locally).
5. Decide on offsite backup target (S3 bucket, another server, etc.).

---

## Next Steps

Once you review and approve this plan, the implementation step will:
1. Add `output: "standalone"` to `next.config.ts`.
2. Create `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.env.production.example`.
3. Verify Prisma + `sharp` work correctly in the chosen base image.
4. Test the full stack locally with `docker compose up --build` before you deploy to the server.
