# ARTIC VMS — Contabo Server Deployment Guide
**Server:** vmi3674971 · 185.208.207.100 · Ubuntu 24.04 LTS  
**Domain:** articvms.ddnsgeek.com → 185.208.207.100 (confirmed)  
**Method:** Docker Compose (all services in containers) + Nginx reverse proxy  
**Git repo:** https://github.com/Byiringiro24/Vehicle_Monitoring_system.git  

---

## WHAT YOU WILL END UP WITH

| Service | Public URL | Internal port |
|---|---|---|
| Dashboard (frontend) | https://articvms.ddnsgeek.com | 3000 |
| Backend API | https://articvms.ddnsgeek.com/api/v1/ | 4000 |
| WebSocket (Socket.IO) | wss://articvms.ddnsgeek.com/socket.io/ | 4000 |
| MQTT (GPS trackers) | articvms.ddnsgeek.com **:1883** | 1883 (direct TCP) |
| PostgreSQL | internal only — never public | — |
| Redis | internal only — never public | — |

HTTP on port 80 automatically redirects to HTTPS. MQTT stays plain TCP on 1883
(GPS trackers use it directly — Nginx does not proxy TCP).

---

## CONFIRMED SERVER STATE (from inspection)

Before starting, you ran `ss -tulpn` and `ufw status`. This is what we found:

| Item | Status |
|---|---|
| SSH (port 22) | listening — UFW allows it |
| Nginx | installed, running, listening on 80 |
| UFW | active — rules: 22, 80, 443, 1883 already open |
| Docker | **not yet installed** |
| Port 3000 | free |
| Port 4000 | free |
| Port 1883 | free |
| PostgreSQL / Redis | not running |

The firewall is already correctly configured. No port changes needed.

---

## STEP 1 — INSTALL DOCKER

Connect to the server:
```bash
ssh -i ~/.ssh/artic_vms articadmin@185.208.207.100
```

Install Docker Engine:
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker articadmin
```

**Log out and back in** so the docker group takes effect:
```bash
exit
```
```bash
ssh -i ~/.ssh/artic_vms articadmin@185.208.207.100
```

Verify:
```bash
docker --version
docker compose version
```

Expected: Docker 26.x or newer, Compose v2.x or newer.

---

## STEP 2 — CLONE THE REPOSITORY

```bash
cd /home/articadmin
git clone -b master https://github.com/Byiringiro24/Vehicle_Monitoring_system.git artic-vms
cd artic-vms
ls
```

You should see: `backend/`, `frontend/`, `docker-compose.yml`, `.env.example`

---

## STEP 3 — CREATE THE PRODUCTION .env FILE

The `.env` file in the project root is read by docker-compose at startup.
It is never committed to git (it's in `.gitignore`).

### 3.1 Generate JWT secrets

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Run each line separately. Save both outputs — first is JWT_SECRET, second is
JWT_REFRESH_SECRET.

### 3.2 Create the file

```bash
nano /home/articadmin/artic-vms/.env
```

Paste this, replacing the three `CHANGE_ME` values:

```env
# ── Database ──────────────────────────────────────────────────────────────────
POSTGRES_PASSWORD=CHANGE_ME_strong_password_here

# ── JWT secrets ───────────────────────────────────────────────────────────────
JWT_SECRET=CHANGE_ME_paste_first_openssl_output
JWT_REFRESH_SECRET=CHANGE_ME_paste_second_openssl_output

# ── Public URLs (domain, HTTPS) ───────────────────────────────────────────────
# Do NOT add /api here — the frontend appends /api/v1 itself
NEXT_PUBLIC_API_URL=https://articvms.ddnsgeek.com
NEXT_PUBLIC_WS_URL=wss://articvms.ddnsgeek.com

# ── CORS — must match what the browser shows in the address bar ───────────────
CORS_ORIGIN=https://articvms.ddnsgeek.com
```

Save: Ctrl+O → Enter → Ctrl+X

Verify it looks right:
```bash
cat /home/articadmin/artic-vms/.env
```

---

## STEP 4 — BUILD AND START ALL CONTAINERS

```bash
cd /home/articadmin/artic-vms
docker compose up -d --build
```

First run takes **10–20 minutes** — it compiles TypeScript and builds Next.js
from scratch. Subsequent starts are instant.

Watch the build progress (optional, Ctrl+C to stop watching — services keep running):
```bash
docker compose logs -f
```

Once done, check all four containers are up:
```bash
docker compose ps
```

Expected output — all services should show `Up` or `Up (healthy)`:
```
NAME                        STATUS
artic-vms-postgres-1        Up (healthy)
artic-vms-redis-1           Up
artic-vms-backend-1         Up
artic-vms-frontend-1        Up
```

Quick API sanity check (before Nginx):
```bash
curl http://localhost:4000/health
```
Expected: `{"status":"ok","service":"artic-vms-backend","version":"1.0.0",...}`

---

## STEP 5 — RUN DATABASE MIGRATIONS AND SEED

```bash
# Create all database tables
docker compose exec backend npx prisma migrate deploy

# Create default admin account + demo organisation
docker compose exec backend node dist/utils/seed.js
```

> If seed fails (file not compiled yet), run:
> ```bash
> docker compose exec backend npx tsx src/utils/seed.ts
> ```

Default credentials — **change these after first login**:
```
Email:    admin@artic.io
Password: Admin1234!
```

---

## STEP 6 — CONFIGURE NGINX

Nginx is already running. We will replace the default site with the ARTIC VMS
config, then get a free SSL certificate from Let's Encrypt.

### 6.1 Remove the default site

```bash
sudo rm /etc/nginx/sites-enabled/default
```

### 6.2 Create the ARTIC VMS Nginx config

```bash
sudo nano /etc/nginx/sites-available/artic-vms
```

Paste this complete config:

```nginx
# ── HTTP — redirect everything to HTTPS ──────────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name articvms.ddnsgeek.com;

    # Let's Encrypt challenge (Certbot needs this before issuing the cert)
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# ── HTTPS ─────────────────────────────────────────────────────────────────────
# NOTE: Certbot will add the ssl_certificate lines below automatically.
# This block is a placeholder — fill it in after running certbot (Step 6.4).
# Uncomment and complete after Certbot runs.
#
# server {
#     listen 443 ssl;
#     listen [::]:443 ssl;
#     server_name articvms.ddnsgeek.com;
#
#     ssl_certificate     /etc/letsencrypt/live/articvms.ddnsgeek.com/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/articvms.ddnsgeek.com/privkey.pem;
#     include             /etc/letsencrypt/options-ssl-nginx.conf;
#     ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;
#
#     client_max_body_size 20M;
#
#     # Frontend (Next.js)
#     location / {
#         proxy_pass         http://127.0.0.1:3000;
#         proxy_http_version 1.1;
#         proxy_set_header   Upgrade $http_upgrade;
#         proxy_set_header   Connection "upgrade";
#         proxy_set_header   Host $host;
#         proxy_set_header   X-Real-IP $remote_addr;
#         proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header   X-Forwarded-Proto $scheme;
#         proxy_cache_bypass $http_upgrade;
#         proxy_read_timeout 86400;
#     }
#
#     # Backend REST API
#     location /api/ {
#         proxy_pass         http://127.0.0.1:4000;
#         proxy_http_version 1.1;
#         proxy_set_header   Host $host;
#         proxy_set_header   X-Real-IP $remote_addr;
#         proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header   X-Forwarded-Proto $scheme;
#         proxy_read_timeout 60;
#     }
#
#     # Health check
#     location = /health {
#         proxy_pass http://127.0.0.1:4000/health;
#     }
#
#     # WebSocket / Socket.IO
#     location /socket.io/ {
#         proxy_pass         http://127.0.0.1:4000;
#         proxy_http_version 1.1;
#         proxy_set_header   Upgrade $http_upgrade;
#         proxy_set_header   Connection "upgrade";
#         proxy_set_header   Host $host;
#         proxy_set_header   X-Real-IP $remote_addr;
#         proxy_read_timeout 86400;
#         proxy_send_timeout 86400;
#     }
# }
```

Enable the site and test:
```bash
sudo ln -s /etc/nginx/sites-available/artic-vms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` must print: `syntax is ok` and `test is successful`.

### 6.3 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.4 Get the SSL certificate

```bash
sudo certbot --nginx -d articvms.ddnsgeek.com
```

Certbot will:
1. Ask for your email address (for renewal reminders)
2. Ask you to agree to the terms of service
3. Issue the certificate
4. **Automatically update your Nginx config** with the HTTPS block and SSL lines

After it finishes, verify the config was updated:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Test renewal (dry run — does not issue a real cert):
```bash
sudo certbot renew --dry-run
```

Expected: `Congratulations, all simulated renewals succeeded.`

### 6.5 Verify HTTPS is working

```bash
curl https://articvms.ddnsgeek.com/health
```

Expected: `{"status":"ok","service":"artic-vms-backend",...}`

Open in your browser: **https://articvms.ddnsgeek.com**

---

## STEP 7 — ENABLE AUTO-RESTART ON REBOOT

```bash
sudo systemctl enable docker
sudo systemctl enable nginx
```

Docker containers already have `restart: unless-stopped` so they come back
automatically after a reboot. Test it:

```bash
sudo reboot
```

Wait 2 minutes, reconnect, and check:
```bash
ssh -i ~/.ssh/artic_vms articadmin@185.208.207.100
docker compose -f /home/articadmin/artic-vms/docker-compose.yml ps
```

All containers should be `Up` again.

---

## STEP 8 — ESP32 FIRMWARE UPDATE

Update the MQTT host in the ESP32 sketch:

```cpp
const char MQTT_HOST[] = "articvms.ddnsgeek.com";
const int  MQTT_PORT   = 1883;
```

The `deviceToken` for each vehicle is shown in the ARTIC VMS dashboard under
each vehicle's GPS device settings.

---

## STEP 9 — AUTOMATED DAILY BACKUPS

```bash
sudo mkdir -p /var/backups/artic

sudo tee /etc/cron.daily/backup-artic > /dev/null << 'EOF'
#!/bin/bash
set -e
DATE=$(date +%Y%m%d_%H%M)
BACKUP_DIR=/var/backups/artic
DB_CONTAINER=$(docker ps --filter name=postgres --format "{{.Names}}" | head -1)

mkdir -p "$BACKUP_DIR"

docker exec "$DB_CONTAINER" pg_dump -U artic_user fleet_management \
  | gzip > "$BACKUP_DIR/fleet_management_$DATE.sql.gz"

# Keep last 30 backups only
ls -t "$BACKUP_DIR"/*.sql.gz | tail -n +31 | xargs rm -f 2>/dev/null || true

echo "Backup complete: fleet_management_$DATE.sql.gz"
EOF

sudo chmod +x /etc/cron.daily/backup-artic

# Test it immediately
sudo /etc/cron.daily/backup-artic
ls -lh /var/backups/artic/
```

---

## UPDATING THE APPLICATION

When you push new code to GitHub:

```bash
cd /home/articadmin/artic-vms

# Pull latest code
git pull origin master

# Rebuild changed containers (only rebuilds what changed)
docker compose up -d --build

# Apply any new database migrations
docker compose exec backend npx prisma migrate deploy
```

---

## USEFUL COMMANDS

```bash
# All container status
docker compose -f /home/articadmin/artic-vms/docker-compose.yml ps

# Backend logs live
docker compose -f /home/articadmin/artic-vms/docker-compose.yml logs -f backend

# Frontend logs live
docker compose -f /home/articadmin/artic-vms/docker-compose.yml logs -f frontend

# Restart backend only (no rebuild)
docker compose -f /home/articadmin/artic-vms/docker-compose.yml restart backend

# Open PostgreSQL CLI
docker compose -f /home/articadmin/artic-vms/docker-compose.yml exec postgres \
  psql -U artic_user fleet_management

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# System resources
free -h && df -h
```

---

## PRODUCTION CHECKLIST

- [ ] Default admin password changed (admin@artic.io / Admin1234!)
- [ ] Real organisation created in dashboard
- [ ] JWT_SECRET is a random 64-char hex string
- [ ] JWT_REFRESH_SECRET is a different 64-char hex string
- [ ] Database password is strong and unique
- [ ] `docker compose ps` — all services `Up`
- [ ] `curl https://articvms.ddnsgeek.com/health` returns ok
- [ ] Dashboard loads at https://articvms.ddnsgeek.com
- [ ] HTTPS padlock shown in browser (valid Let's Encrypt cert)
- [ ] HTTP redirects to HTTPS automatically
- [ ] MQTT reachable: `Test-NetConnection articvms.ddnsgeek.com -Port 1883` → True
- [ ] Certbot dry-run renewal passed
- [ ] Daily backup tested — file exists in `/var/backups/artic/`
- [ ] `sudo systemctl enable docker nginx` done (auto-start on reboot)
- [ ] ESP32 firmware updated with `articvms.ddnsgeek.com`
