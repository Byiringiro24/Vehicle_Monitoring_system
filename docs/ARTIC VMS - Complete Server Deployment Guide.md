# ARTIC VMS — Complete Server Deployment Guide
**Server:** vmi3674971 · 185.208.207.100 · Ubuntu 24.04 LTS  
**Domain:** articvms.ddnsgeek.com  
**Admin user:** articadmin  
**SSH key:** C:\Users\Byiringiro\.ssh\artic_vms  

---

## PART 1 — CONNECT TO THE SERVER

From Windows PowerShell:
```powershell
ssh -i "$env:USERPROFILE\.ssh\artic_vms" articadmin@185.208.207.100
```

If that fails, connect as root (less secure, only for emergencies):
```
ssh root@185.208.207.100
```

---

## PART 2 — DEPLOY LATEST CODE FROM GITHUB

Run these commands every time you want to update the server with new code:

```bash
# 1. Go to the project folder
cd /home/articadmin/artic-vms

# 2. Pull latest code from GitHub master
git pull origin master

# 3. Stop all containers
docker compose down

# 4. Rebuild all containers (takes 5–15 minutes first time, faster after)
docker compose build --no-cache

# 5. Start all containers
docker compose up -d

# 6. Run any pending database migrations
docker compose exec backend npx prisma migrate deploy

# 7. Verify everything is running
docker compose ps
```

Expected output from `docker compose ps`:
```
NAME                        STATUS
artic-vms-postgres-1        Up (healthy)
artic-vms-redis-1           Up
artic-vms-backend-1         Up
artic-vms-frontend-1        Up
```

**Test it works:**
```bash
curl http://localhost:4000/health
# Expected: {"status":"ok","service":"artic-vms-backend",...}

curl https://articvms.ddnsgeek.com/health
# Expected: same response (confirms Nginx + HTTPS working)
```

---

## PART 3 — FIRST-TIME SETUP (already done, for reference)

### 3.1 The .env file (CRITICAL — create once, never delete)
```bash
nano /home/articadmin/artic-vms/.env
```

The file must contain exactly these values (replace the `CHANGE_ME` placeholders):
```env
# Database
POSTGRES_PASSWORD=your_strong_database_password

# JWT secrets — generate with: openssl rand -hex 32
JWT_SECRET=your_64_char_hex_secret_here
JWT_REFRESH_SECRET=your_different_64_char_hex_secret

# Frontend URLs
NEXT_PUBLIC_API_URL=https://articvms.ddnsgeek.com
NEXT_PUBLIC_WS_URL=wss://articvms.ddnsgeek.com

# CORS
CORS_ORIGIN=https://articvms.ddnsgeek.com

# SMTP — Gmail App Password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=byiringirofabrice6@gmail.com
SMTP_PASS=advlaszqtqwbybwc
SMTP_FROM="ARTIC VMS <byiringirofabrice6@gmail.com>"
APP_URL=https://articvms.ddnsgeek.com

# MQTT internal configuration
AEDES_PORT=1884
MQTT_HOST=127.0.0.1
MQTT_INTERNAL_PORT=1884
```

> ⚠️ This file is NOT in git. If you lose it, the application won't start. Keep a secure backup.

### 3.2 Database seed (run once after first deploy)
```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend node dist/utils/seed.js
```

This creates:
- Organization: ARTIC Demo Organization
- admin@artic.io / Admin1234! (SUPER_ADMIN)
- manager@artic.io / Manager1234! (FLEET_MANAGER)
- finance@artic.io / Finance1234! (FINANCE_MANAGER)

### 3.3 All pending migrations (run if building from scratch)
```bash
docker compose exec backend npx prisma migrate deploy
```

This applies all migrations in order including:
- Initial schema (vehicles, drivers, contracts, etc.)
- Password reset tokens
- Unified identity (memberships, subscriptions, entitlements)
- Document management
- Business models and agreements

---

## PART 4 — NGINX CONFIGURATION

Nginx routes all traffic. Config file is at:
```
/etc/nginx/sites-available/artic-vms
```

**View current config:**
```bash
cat /etc/nginx/sites-available/artic-vms
```

**After any Nginx config change:**
```bash
sudo nginx -t                    # test config syntax
sudo systemctl reload nginx      # apply changes
```

**SSL certificate info:**
```bash
sudo certbot certificates
# Shows expiry date — renews automatically
```

**Test SSL renewal manually:**
```bash
sudo certbot renew --dry-run
# Should say: "Congratulations, all simulated renewals succeeded"
```

---

## PART 5 — DATABASE MANAGEMENT

### Check database is healthy
```bash
docker compose exec postgres psql -U artic_user fleet_management -c "\dt"
# Lists all tables
```

### Connect to database directly
```bash
docker compose exec postgres psql -U artic_user fleet_management
```

### Useful SQL queries
```sql
-- Count records in main tables
SELECT 'users' as t, COUNT(*) FROM users
UNION ALL SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL SELECT 'agreements', COUNT(*) FROM agreements
UNION ALL SELECT 'telemetry', COUNT(*) FROM telemetry;

-- Check which migrations have been applied
SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at;

-- Find all SUPER_ADMIN users
SELECT email, "firstName", "lastName", "isActive" FROM users WHERE role = 'SUPER_ADMIN';

-- Exit
\q
```

### Manual database backup
```bash
# Run the backup script immediately
sudo /usr/local/bin/artic-backup

# List existing backups
ls -lh /var/backups/artic/
```

### Restore from backup
```bash
sudo /home/articadmin/artic-vms/infrastructure/backup/restore.sh \
  /var/backups/artic/fleet_management_20261021_020000.sql.gz
```

---

## PART 6 — CHECKING LOGS

### Backend logs (most useful for debugging)
```bash
docker compose -f /home/articadmin/artic-vms/docker-compose.yml logs -f backend --tail=100
```

### Frontend logs
```bash
docker compose -f /home/articadmin/artic-vms/docker-compose.yml logs -f frontend --tail=50
```

### Nginx access + error logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Check what's listening on ports
```bash
sudo ss -tulpn
```
Expected:
- Port 22 — SSH
- Port 80 — Nginx (HTTP → redirects to HTTPS)
- Port 443 — Nginx (HTTPS)
- Port 1883 — MQTT (GPS devices)
- Port 3000 — Frontend (internal, via Docker)
- Port 4000 — Backend API (internal, via Docker)

---

## PART 7 — COMMON PROBLEMS AND FIXES

### Problem: Website shows 502 Bad Gateway
```bash
# Check if containers are running
docker compose ps

# If backend is down, check its logs
docker compose logs backend --tail=50

# Restart just the backend
docker compose restart backend

# If it keeps crashing, check for migration errors
docker compose exec backend npx prisma migrate deploy
```

### Problem: MQTT port 1883 not working (GPS devices can't connect)
```bash
# Check UFW allows it
sudo ufw status verbose
# Should show: 1883/tcp ALLOW IN Anywhere

# Check something is listening on 1883
sudo ss -tulpn | grep 1883
# Should show Docker listening

# Test from Windows:
# Test-NetConnection -ComputerName articvms.ddnsgeek.com -Port 1883
```

### Problem: Emails not sending
```bash
# Check backend logs for SMTP errors
docker compose logs backend | grep -i smtp

# Verify SMTP config is in .env
grep SMTP /home/articadmin/artic-vms/.env

# Test the Gmail App Password is still valid at:
# https://myaccount.google.com/apppasswords
```

### Problem: SSL certificate expired or invalid
```bash
# Renew manually
sudo certbot renew

# After renewal, reload Nginx
sudo systemctl reload nginx
```

### Problem: Disk space running out
```bash
# Check disk usage
df -h

# Find large files
du -sh /var/backups/artic/*
du -sh /home/articadmin/artic-vms/backend/uploads/*

# Remove old Docker images (safe to run)
docker system prune -f

# Remove old backups (keeps most recent 30 automatically via cron)
ls -lt /var/backups/artic/*.sql.gz | tail -n +31 | xargs rm -f
```

### Problem: "fatal: detected dubious ownership" when running git pull
```bash
git config --global --add safe.directory /home/articadmin/artic-vms
git pull origin master
```

---

## PART 8 — AUTO-BACKUP SETUP (already done, for reference)

The backup script runs daily at 2:00 AM:

```bash
# Verify cron is set up
crontab -l
# Should show: 0 2 * * * /usr/local/bin/artic-backup >> /var/log/artic-backup.log 2>&1

# Check backup log
tail -20 /var/log/artic-backup.log

# List current backups
ls -lh /var/backups/artic/
```

---

## PART 9 — ENVIRONMENT VARIABLES REFERENCE

These must all be present in `/home/articadmin/artic-vms/.env`:

| Variable | Description | Example |
|---|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL password | Strong random password |
| `JWT_SECRET` | JWT signing secret | 64-char hex string |
| `JWT_REFRESH_SECRET` | Refresh token secret | Different 64-char hex string |
| `NEXT_PUBLIC_API_URL` | Frontend → backend URL | https://articvms.ddnsgeek.com |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | wss://articvms.ddnsgeek.com |
| `CORS_ORIGIN` | Allowed browser origin | https://articvms.ddnsgeek.com |
| `SMTP_HOST` | Email server | smtp.gmail.com |
| `SMTP_PORT` | Email port | 587 |
| `SMTP_SECURE` | TLS mode | false (STARTTLS on 587) |
| `SMTP_USER` | Email username | byiringirofabrice6@gmail.com |
| `SMTP_PASS` | Gmail App Password | advlaszqtqwbybwc |
| `SMTP_FROM` | Sender display name | "ARTIC VMS <email>" |
| `APP_URL` | Public URL for email links | https://articvms.ddnsgeek.com |
| `AEDES_PORT` | Internal MQTT broker port | 1884 |
| `MQTT_HOST` | Internal MQTT host | 127.0.0.1 |
| `MQTT_INTERNAL_PORT` | Internal MQTT port | 1884 |

**Generate new secrets:**
```bash
openssl rand -hex 32   # run twice — once for JWT_SECRET, once for JWT_REFRESH_SECRET
```

---

## PART 10 — FULL REDEPLOY FROM SCRATCH (emergency procedure)

Only use this if the server is completely broken and needs rebuilding.

```bash
# 1. Connect
ssh -i "$HOME/.ssh/artic_vms" articadmin@185.208.207.100

# 2. Install Docker (if not installed)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker articadmin
# Log out and back in

# 3. Install Nginx and Certbot
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# 4. Clone repo
cd /home/articadmin
git clone -b master https://github.com/Byiringiro24/Vehicle_Monitoring_system.git artic-vms
cd artic-vms

# 5. Create .env (fill in real values — see Part 3)
nano .env

# 6. Configure Nginx
sudo rm /etc/nginx/sites-enabled/default
sudo nano /etc/nginx/sites-available/artic-vms
# Paste the Nginx config (see Contabo Deployment Guide.md for full config)
sudo ln -s /etc/nginx/sites-available/artic-vms /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 7. Get SSL certificate
sudo certbot --nginx -d articvms.ddnsgeek.com

# 8. Build and start
docker compose build --no-cache
docker compose up -d

# 9. Run migrations and seed
docker compose exec backend npx prisma migrate deploy
docker compose exec backend node dist/utils/seed.js

# 10. Enable auto-start
sudo systemctl enable docker nginx

# 11. Set up backup
cp infrastructure/backup/backup.sh /usr/local/bin/artic-backup
chmod +x /usr/local/bin/artic-backup
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/artic-backup >> /var/log/artic-backup.log 2>&1") | crontab -
sudo mkdir -p /var/backups/artic

# 12. Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 1883/tcp
sudo ufw --force enable
```

---

## PART 11 — REGULAR MAINTENANCE CHECKLIST

**Weekly:**
- [ ] `docker compose ps` — all containers Up
- [ ] `curl https://articvms.ddnsgeek.com/health` — returns ok
- [ ] `ls -lh /var/backups/artic/` — backup files created daily
- [ ] Check free disk: `df -h`

**Monthly:**
- [ ] Test backup restore: `sudo /home/articadmin/artic-vms/infrastructure/backup/restore.sh <latest-backup>`
- [ ] Check SSL cert expiry: `sudo certbot certificates`
- [ ] Review security: `sudo fail2ban-client status` (if fail2ban installed)
- [ ] Pull latest code: `git pull origin master` then rebuild if there are updates

**After any code update:**
```bash
cd /home/articadmin/artic-vms
git pull origin master
docker compose build --no-cache
docker compose up -d
docker compose exec backend npx prisma migrate deploy
```

---

## PART 12 — SERVER SPECIFICATIONS

| Item | Value |
|---|---|
| Provider | Contabo (Cloud VPS 6) |
| Cost | ~$13/month ($9 server + $4 backup) |
| IP | 185.208.207.100 |
| IPv6 | 2a02:c207:2367:4971::1 |
| Hostname | vmi3674971 |
| OS | Ubuntu 24.04.5 LTS |
| CPU | 6 vCPU |
| RAM | ~11 GiB |
| Storage | 192 GB |
| Region | Hub Europe |
| Admin SSH user | articadmin |
| SSH key path (Windows) | C:\Users\Byiringiro\.ssh\artic_vms |
| Backup subscription | Auto Backup (Contabo) |
