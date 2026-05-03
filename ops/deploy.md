# Deployment Guide — BoatOps

> Last updated: 2026-05-03

## Architecture

```
Internet
   │  HTTP :80
   ▼
nginx (Docker)
   ├── /          → serves frontend/dist/ static files
   ├── /api/*     → proxy → FastAPI :8000
   └── /health    → proxy → FastAPI :8000

FastAPI (Docker, micromamba Python 3.11)
   ├── all credentials read from .env
   └── all external API calls made server-side
```

Both services are managed by Docker Compose. nginx waits for the API health check before accepting traffic.

## Prerequisites

- Docker ≥ 24 + Docker Compose v2 (`docker compose version`)
- Node.js ≥ 18 (for `npm run build` — only needed to rebuild the frontend)
- Git access to this repository
- `.env` file with real credentials (see `.env.example`)

## First-time Deployment

### 1. Clone and configure

```bash
git clone <repo-url> boatops
cd boatops

# Create .env from template and fill in credentials
cp .env.example .env
$EDITOR .env
```

Required variables in `.env`:
| Variable | Source |
|----------|--------|
| `COPERNICUSMARINE_SERVICE_USERNAME` | CMEMS account at marine.copernicus.eu |
| `COPERNICUSMARINE_SERVICE_PASSWORD` | same |
| `CDSE_EMAIL` | CDSE account at dataspace.copernicus.eu |
| `CDSE_PASSWORD` | same |

### 2. Build the frontend

```bash
cd frontend
npm ci
npm run build          # writes frontend/dist/
cd ..
```

### 3. Build and start

```bash
docker compose build   # builds the API image (~5–10 min first time; installs conda env)
docker compose up -d   # starts api + web in background
```

The app is now available at `http://localhost` (or your server's IP/hostname).

### 4. Verify

```bash
# Health check
curl http://localhost/health

# Quick API smoke test
curl "http://localhost/api/solar/elevation?lat=54.18&lon=12.08"
```

## Updating

```bash
git pull

# If frontend changed:
cd frontend && npm ci && npm run build && cd ..

# If backend Python code changed:
docker compose build api

# Restart with zero-downtime (starts new, then stops old)
docker compose up -d --no-deps api
docker compose up -d --no-deps web
```

## Logs

```bash
docker compose logs -f api    # FastAPI logs
docker compose logs -f web    # nginx access/error logs
docker compose ps             # service health status
```

## Stopping

```bash
docker compose down           # stop and remove containers (data is stateless — safe)
docker compose down --rmi all # also remove built images
```

## HTTPS with Let's Encrypt (optional)

Add a Certbot/nginx HTTPS stage to `deploy/nginx.conf`, or use a reverse proxy in front of the Docker nginx (e.g., the institute's existing nginx/HAProxy). The app itself is origin-agnostic.

Minimal HTTPS addition: replace the `docker-compose.yml` `web` service with `nginx-proxy` + `acme-companion`:

```bash
# See: https://github.com/nginx-proxy/acme-companion
# Set VIRTUAL_HOST and LETSENCRYPT_HOST on the api service.
```

Or, if the institute server already runs nginx on the host:

1. Remove the `web` service from `docker-compose.yml`
2. In the host nginx config, add:
   ```nginx
   location /api/ { proxy_pass http://127.0.0.1:8000; ... }
   location / { root /path/to/boatops/frontend/dist; try_files $uri /index.html; }
   ```
3. In `docker-compose.yml`, change `expose: ["8000"]` to `ports: ["127.0.0.1:8000:8000"]`

## Resource Sizing

| Service | CPU | RAM | Notes |
|---------|-----|-----|-------|
| api | 1–2 cores | 1–2 GB | CMEMS `copernicusmarine` downloads up to ~10 MB per wave overlay |
| web | minimal | ~50 MB | pure nginx static serve + proxy |

For a planning tool with occasional (not continuous) use, a 2-core / 4 GB VPS is comfortable.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| API returns 500 on wave endpoints | CMEMS credentials wrong or expired | Check `COPERNICUSMARINE_SERVICE_USERNAME/PASSWORD` in `.env` |
| S2 overlay returns 401 | CDSE token expired or wrong credentials | Check `CDSE_EMAIL/PASSWORD` |
| `docker compose build` fails with `PackageNotFoundError` | conda-forge package unavailable | Pin the failing package to a known-good version in `deploy/environment-prod.yml` |
| Frontend shows blank map | MapLibre GL JS needs WebGL | Ensure the browser has hardware acceleration enabled |
| `/api/*` returns 502 | API container not yet healthy | Wait for `docker compose ps` to show api as `healthy`; check `docker compose logs api` |
| App serves blank page (no JS/CSS loaded) | `frontend/dist/` is empty or missing | Run `cd frontend && npm ci && npm run build` then `docker compose restart web` |
| API container crashes at startup with `ValidationError` on `cors_origins` | `CORS_ORIGINS` set as a bare string (e.g. `https://...`) instead of a JSON array | Use JSON array syntax: `CORS_ORIGINS=["https://yourhost.example.com"]` |
