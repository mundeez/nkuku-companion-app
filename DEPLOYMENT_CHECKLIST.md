# Nkuku Companion App — Deployment Checklist

## Pre-Deployment Verification

### 1. Code Status
- [ ] All phases complete (1-4)
- [ ] All tests passing (14/14)
- [ ] Docker containers build successfully
- [ ] No uncommitted changes
- [ ] Tagged with version number

### 2. Environment Variables
- [ ] `.env` file created from `.env.example`
- [ ] `DB_PASSWORD` — strong password (32+ chars)
- [ ] `JWT_SECRET` — generated with `openssl rand -base64 64`
- [ ] `OWNER_PASSWORD` — changed from default
- [ ] `CORS_ORIGINS` — includes production domain
- [ ] `DATABASE_URL` — uses correct DB_PASSWORD

### 3. Database
- [ ] Prisma schema validated
- [ ] Migration files created (if not using db push)
- [ ] Seed data ready to populate

## Deployment Steps

### Step 1: Server Setup
```bash
# On production server
cd /var/www/nkuku
git pull origin main
```

### Step 2: Environment Configuration
```bash
cp .env.example .env
nano .env  # Fill in all values
```

### Step 3: Build & Start
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### Step 4: Verify Containers
```bash
docker compose -f docker-compose.prod.yml ps
```
Expected status: `Up (healthy)` for postgres, redis, api, web

### Step 5: Health Checks
```bash
# API health
curl -s http://127.0.0.1:30001/health
# Expected: {"status":"ok","timestamp":"..."}

# Web frontend
curl -s http://127.0.0.1:30000 | head -c 100
# Expected: HTML response starting with <!DOCTYPE html>
```

### Step 6: Database Verification
```bash
# Check tables exist
docker compose -f docker-compose.prod.yml exec postgres psql -U nkuku_user -d nkuku_db -c "\dt"
# Expected: 25 tables including broiler management tables

# Verify seed data
docker compose -f docker-compose.prod.yml exec postgres psql -U nkuku_user -d nkuku_db -c "SELECT name FROM breeds;"
# Expected: Ross 308, Cobb 500
```

### Step 7: API Smoke Tests
```bash
# Login
TOKEN=$(curl -s -X POST http://127.0.0.1:30001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@nkuku.local","password":"YOUR_PASSWORD"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['accessToken'])")

# Test endpoints
curl -s http://127.0.0.1:30001/api/v1/breeds -H "Authorization: Bearer $TOKEN"
curl -s http://127.0.0.1:30001/api/v1/diseases -H "Authorization: Bearer $TOKEN"
```

### Step 8: ISPConfig Configuration
- [ ] Nginx directives pasted in ISPConfig
- [ ] SSL enabled with Let's Encrypt
- [ ] Domain resolves correctly
- [ ] HTTPS working

### Step 9: Frontend Verification
- [ ] Login page loads at `https://nkuku.deeztechnology.solutions`
- [ ] Can authenticate with owner credentials
- [ ] Dashboard shows broiler stats
- [ ] Can navigate to /broiler-flocks
- [ ] Can navigate to /diseases
- [ ] Can navigate to /alerts

## Post-Deployment

### Immediate Actions
- [ ] Change owner password
- [ ] Create additional users (manager, viewer roles)
- [ ] Verify all navigation links work
- [ ] Test flock creation flow end-to-end

### Monitoring
- [ ] Set up log rotation
- [ ] Configure health check alerts
- [ ] Monitor disk usage (PostgreSQL growth)

### Backup Strategy
```bash
# Database backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U nkuku_user nkuku_db > backup_$(date +%Y%m%d).sql

# Automated daily backups recommended
```

## Rollback Procedure

If deployment fails:
```bash
cd /var/www/nkuku
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml up --build -d
```

## Troubleshooting

### Issue: Database connection failed
- Check `.env` DATABASE_URL matches DB_PASSWORD
- Verify postgres container is healthy

### Issue: JWT errors
- Ensure JWT_SECRET is set and strong
- Check JWT_EXPIRES_IN format (e.g., "15m", "24h")

### Issue: CORS errors
- Add production domain to CORS_ORIGINS
- Include `https://` prefix

### Issue: Frontend 500 errors
- Check web container logs: `docker logs nkuku-companion-app-web-1`
- Verify NEXT_PUBLIC_API_URL is empty for same-origin
