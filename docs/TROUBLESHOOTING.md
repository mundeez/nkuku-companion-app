# Nkuku Companion — Troubleshooting Guide

## Login Issues

### Cannot Log In
**Symptoms:** "INVALID_CREDENTIALS" error

**Solutions:**
1. Verify email address is correct (check for typos)
2. Reset password if forgotten (contact admin)
3. Check if account is active (admin can verify)
4. Clear browser cache and try again

### Token Expired
**Symptoms:** Redirected to login unexpectedly

**Solutions:**
1. Re-log in (tokens expire after 15 minutes)
2. The app should auto-refresh — if not, check JWT_SECRET configuration

## Application Errors

### 500 Internal Server Error
**Symptoms:** Page shows error or blank screen

**Solutions:**
1. Check API logs: `docker compose logs api --tail 50`
2. Verify database is running: `docker compose ps`
3. Check if database migrations ran: `docker compose exec api npx prisma migrate status`
4. Restart containers: `docker compose restart`

### Database Connection Failed
**Symptoms:** API returns database errors

**Solutions:**
1. Verify DATABASE_URL in `.env` is correct
2. Check postgres container is healthy: `docker compose ps`
3. Ensure DB_PASSWORD matches in DATABASE_URL
4. Restart postgres: `docker compose restart postgres`

### Frontend Not Loading
**Symptoms:** Browser shows connection error or blank page

**Solutions:**
1. Check web container is running: `docker compose ps`
2. Check web logs: `docker compose logs web --tail 50`
3. Verify NEXT_PUBLIC_API_URL is set correctly
4. Restart web container: `docker compose restart web`

## Data Issues

### Missing Seed Data
**Symptoms:** No breeds, diseases, or performance targets in dropdowns

**Solutions:**
```bash
# Re-run seeds
docker compose exec api npx prisma db seed
```

### Records Not Saving
**Symptoms:** Forms submit but data disappears

**Solutions:**
1. Check network tab in browser dev tools
2. Verify user has correct role (manager/owner can create)
3. Check API logs for validation errors
4. Ensure all required fields are filled

## Performance Issues

### Slow Page Loading
**Solutions:**
1. Check database query performance
2. Verify Redis is running (for caching)
3. Check server resources (CPU, memory)
4. Consider scaling if running on low-resource server

### Large Flocks Loading Slowly
**Solutions:**
1. The app loads records in batches
2. Avoid extremely large flocks (>10,000 birds) if possible
3. Consider archiving completed flocks

## Mobile Issues

### Mobile App Not Connecting
**Solutions:**
1. Verify API URL in mobile app settings
2. Check CORS_ORIGINS includes mobile origin
3. Ensure SSL certificate is valid
4. Test API directly: `curl -s https://your-domain/api/v1/health`

## Docker Issues

### Containers Won't Start
**Solutions:**
```bash
# Check for port conflicts
sudo lsof -i :30001
sudo lsof -i :30000

# Free up ports or change in docker-compose.yml

# Full reset (WARNING: destroys data)
docker compose down -v
docker compose up --build -d
```

### Out of Disk Space
**Solutions:**
```bash
# Clean up Docker
docker system prune -a

# Check volumes
docker volume ls
docker volume rm <unused-volume>
```

## Getting Help

If issues persist:
1. Check API logs: `docker compose logs api --tail 100`
2. Check web logs: `docker compose logs web --tail 100`
3. Verify environment variables
4. Check GitHub issues for known problems
5. Contact your system administrator
