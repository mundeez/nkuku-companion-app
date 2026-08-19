# Enterprise / Self-Hosted Deployment Guide

This guide covers deploying the Nkuku Companion App as a self-hosted,
white-labeled enterprise installation.

## Prerequisites

- Docker 24+ and Docker Compose v2+
- A server with at least 4GB RAM and 40GB disk
- PostgreSQL 15+ (included in docker-compose.prod.yml)
- Redis 7+ (included in docker-compose.prod.yml)
- A valid enterprise license key (contact sales@nkuku.app)

## 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
nano .env
```

### Enterprise-Specific Environment Variables

```env
# ── Branding / White-Label ──
BRAND_APP_NAME=Your Farm Manager
BRAND_TAGLINE=Smart Poultry Management
BRAND_PRIMARY_COLOR=#1a56db
BRAND_LOGO_URL=https://your-domain.com/logo.png
BRAND_FAVICON_URL=https://your-domain.com/favicon.ico
BRAND_SUPPORT_EMAIL=support@your-domain.com
BRAND_SUPPORT_PHONE=+260123456789
BRAND_WEBSITE_URL=https://your-domain.com
BRAND_WHITE_LABEL=true

# ── License ──
LICENSE_KEY=your-uuid-license-key
LICENSED_TO=Your Organization Name
LICENSE_EXPIRY=2027-12-31T23:59:59Z

# ── Security (REQUIRED) ──
JWT_SECRET=your-strong-jwt-secret-min-32-chars
CORS_ORIGINS=https://your-domain.com
OWNER_PASSWORD=change-this-immediately

# ── Database ──
DATABASE_URL=postgresql://nkuku_user:strong-password@postgres:5432/nkuku_db
```

## 2. Build and Start

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

## 3. Verify

```bash
# API health
curl -s http://127.0.0.1:30001/health

# Branding endpoint
curl -s http://127.0.0.1:30001/api/v1/admin/branding | jq

# Web frontend
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:30000
```

## 4. Reverse Proxy

Place an Nginx or Caddy reverse proxy in front of the containers:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:30000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:30001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 5. Backup and Restore

### Backup

```bash
# Database backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U nkuku_user nkuku_db > backup_$(date +%Y%m%d).sql

# Document storage backup (MinIO/S3)
# If using MinIO, use mc client:
mc mirror local/nkuku-documents backup/nkuku-documents
```

### Restore

```bash
# Database restore
cat backup_20250101.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U nkuku_user nkuku_db
```

## 6. Updates

```bash
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

## 7. License Validation

The application validates the license key on startup via the `/api/v1/admin/branding`
endpoint. If the license is expired or invalid, the API will report
`licenseValid: false` but will not block operation — the enterprise contract
governs usage terms.

## 8. Support

Enterprise customers receive:
- Priority email support (response within 4 business hours)
- Quarterly feature briefing calls
- Bug fix SLA: critical bugs within 48 hours
- Custom feature development (quoted separately)

Contact: support@nkuku.app

## Branding Customization

All branding is controlled via environment variables — no code changes needed.

| Variable | Default | Description |
|----------|---------|-------------|
| `BRAND_APP_NAME` | Nkuku Companion | App name in headers/emails |
| `BRAND_TAGLINE` | Poultry Farm Management | Tagline on login screen |
| `BRAND_PRIMARY_COLOR` | #16a34a | Primary UI color (hex) |
| `BRAND_LOGO_URL` | (empty) | Logo image URL |
| `BRAND_FAVICON_URL` | (empty) | Favicon URL |
| `BRAND_SUPPORT_EMAIL` | support@nkuku.app | Support contact |
| `BRAND_WHITE_LABEL` | false | Hide Nkuku branding references |
