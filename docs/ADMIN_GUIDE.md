# Nkuku Companion — Admin Guide

## User Management

### Roles
- **Owner:** Full access to all features, can manage users
- **Manager:** Can create/edit flocks and records, cannot delete users
- **Viewer:** Read-only access to view data, cannot create or modify

### Creating Users
1. Go to **Users** in the navigation (owner only)
2. Click **Create User**
3. Enter name, email, select role
4. The user will receive a temporary password

### Managing Users
- **Edit:** Change name, email, or role
- **Deactivate:** Temporarily disable access
- **Delete:** Permanently remove user (owner only)

## System Configuration

### Environment Variables
Key variables in `.env`:
- `DATABASE_URL` — PostgreSQL connection
- `JWT_SECRET` — Must be strong and rotated periodically
- `OWNER_PASSWORD` — Change immediately after first login
- `CORS_ORIGINS` — Allowed frontend domains

### Database Management

#### Re-seeding Data
```bash
docker compose exec api npx prisma db seed
```

#### Database Backup
```bash
docker compose exec postgres pg_dump -U nkuku_user nkuku_db > backup_$(date +%Y%m%d).sql
```

#### Database Restore
```bash
docker compose exec -T postgres psql -U nkuku_user nkuku_db < backup_file.sql
```

## Monitoring

### Container Health
```bash
docker compose ps
docker compose logs api --tail 100
docker compose logs web --tail 100
```

### API Health Check
```bash
curl -s http://localhost:30001/health
```

## Security Best Practices

1. **Change default passwords immediately**
2. **Rotate JWT_SECRET** every 90 days
3. **Use strong passwords** for all accounts
4. **Enable SSL** in production (Let's Encrypt)
5. **Restrict database access** to internal network only
6. **Regular backups** — daily automated backups recommended

## Updating the Application

### Minor Updates
```bash
cd /var/www/nkuku
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

### Major Updates (with schema changes)
```bash
cd /var/www/nkuku
git pull
# Review migration changes
docker compose -f docker-compose.prod.yml up --build -d
# Verify database migrated successfully
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.
