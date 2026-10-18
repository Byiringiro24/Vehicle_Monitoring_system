# ARTIC VMS — Contabo Server Deployment Guide
**Server:** vmi3674971 · 185.208.207.100 · Ubuntu 24.04 LTS  
**Method:** Docker Compose (all services in containers)  
**Git repo:** https://github.com/Byiringiro24/Vehicle_Monitoring_system.git  
**Date:** October 2026

---

## WHAT YOU WILL END UP WITH

After completing this guide:

| Service | URL / Port | Notes |
|---|---|---|
| Frontend (dashboard) | http://185.208.207.100 | Port 80 via Nginx |
| Backend API | http://185.208.207.100/api | Proxied by Nginx |
| WebSocket (Socket.IO) | ws://185.208.207.100/socket.io | Proxied by Nginx |
| MQTT broker | 185.208.207.100:1883 | Direct TCP, for ESP32 devices |
| PostgreSQL | internal only | Not exposed publicly |
| Redis | internal only | Not exposed publicly |

---

## BEFORE YOU START

You need:
- Your SSH private key at `C:\Users\Byiringiro\.ssh\artic_vms`
- A strong database password (make one up — you will paste it once)
- Two random secrets for JWT (generate them below)

Open Windows PowerShell and connect:

```powershell
ssh -i "$env:USERPROFILE\.ssh\artic_vms" articadmin@185.208.207.100
```

All commands from here on are run **inside the server** (as articadmin) unless
the step says "on your Windows machine".

---

## STEP 1 — INSPECT THE SERVER FIRST

Run these read-only commands to see the current state. Do not skip this.

```bash
sudo ufw status verbose
sudo ss -tulpn
systemctl is-active ssh
timedatectl
df -h
```

Expected results before we proceed:
- UFW should show active or inactive — either is fine, we will configure it
- SSH should show `active`
- Timezone should show `Africa/Kigali` (already confirmed)
- Disk should show roughly 191 GiB free on `/`

---

## STEP 2 — FIREWALL CONFIGURATION

This sets up UFW to allow only the ports the VMS actually needs.  
Port 5432 (Postgres) and 6379 (Redis) are intentionally NOT opened — they
stay internal to Docker.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

sudo ufw allow 22/tcp    # SSH — never close this first
sudo ufw allow 80/tcp    # HTTP (Nginx frontend + API proxy)
sudo ufw allow 443/tcp   # HTTPS (when you add a domain later)
sudo ufw allow 1883/tcp  # MQTT — ESP32 GPS trackers connect here

sudo ufw --force enable
sudo ufw status verbose
```

You should see exactly these five rules open (22, 80, 443, 1883 + loopback).

---

## STEP 3 — SSH HARDENING (OPTIONAL BUT RECOMMENDED)

Disable root SSH login now that articadmin is working.

```bash
sudo nano /etc/ssh/sshd_config
```

Find and change (or add) these lines:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Then reload SSH — keep your current session open while doing this:
```bash
sudo systemctl reload sshd
```

Open a **second PowerShell window** and test that articadmin login still works:
```powershell
ssh -i "$env:USERPROFILE\.ssh\artic_vms" articadmin@185.208.207.100
```

If the second window connects, the hardening worked. If not, use your first
window to revert the change.

---

## STEP 4 — INSTALL REQUIRED PACKAGES

```bash
sudo apt update
sudo apt install -y git curl nano htop fail2ban
```

### 4.1 Install Docker Engine

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker articadmin
```

**Log out and back in** so the docker group takes effect:
```bash
exit
```
```powershell
ssh -i "$env:USERPROFILE\.ssh\artic_vms" articadmin@185.208.207.100
```

Verify Docker works without sudo:
```bash
docker --version
docker compose version
```

Expected: Docker 26.x or newer, Compose 2.x or newer.

### 4.2 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## STEP 5 — CLONE THE REPOSITORY

```bash
cd /home/articadmin
git clone -b master https://github.com/Byiringiro24/Vehicle_Monitoring_system.git artic-vms
cd artic-vms
ls
```

You should see: `backend/`, `frontend/`, `docker-compose.yml`, etc.

> Note: The repo's default production branch is `master`. Always clone or pull
> from `master` for server deployments.

---

## STEP 6 — CREATE THE PRODUCTION .env FILE

The docker-compose.yml reads secrets from a `.env` file in the project root.
You will create this file now with real production values.

### 6.1 Generate JWT secrets

```bash
openssl rand -hex 32   # copy the output — this is JWT_SECRET
openssl rand -hex 32   # copy the output — this is JWT_REFRESH_SECRET
```

Run each command separately and save the two outputs.

### 6.2 Create the .env file

```bash
nano /home/articadmin/artic-vms/.env
```

Paste the following, replacing every `CHANGE_ME` value:

```env
# ── Database ─────────────────────────────────────────────────────────────────
POSTGRES_PASSWORD=CHANGE_ME_strong_db_password_here

# ── JWT (paste the two openssl outputs from step 6.1) ────────────────────────
JWT_SECRET=CHANGE_ME_paste_first_openssl_output_here
JWT_REFRESH_SECRET=CHANGE_ME_paste_second_openssl_output_here

# ── URLs — using IP address (no domain yet) ───────────────────────────────────
# IMPORTANT: Do NOT add /api here. The frontend code appends /api/v1 itself.
# Both go through Nginx on port 80, so no extra firewall port needed.
NEXT_PUBLIC_API_URL=http://185.208.207.100
NEXT_PUBLIC_WS_URL=ws://185.208.207.100

# ── CORS — must match what the browser address bar shows ─────────────────────
CORS_ORIGIN=http://185.208.207.100
```

Save with Ctrl+O, Enter, Ctrl+X.

Verify the file looks correct:
```bash
cat /home/articadmin/artic-vms/.env
```

---

## STEP 7 — CONFIGURE NGINX

Nginx will sit in front of everything:
- Port 80 → frontend (port 3000)
- `/api/` → backend API (port 4000)
- `/socket.io/` → WebSocket (port 4000)
- Port 1883 stays direct TCP for MQTT (Nginx does not proxy this)

```bash
sudo nano /etc/nginx/sites-available/artic-vms
```

Paste this complete config:

```nginx
server {
    listen 80;
    server_name 185.208.207.100;

    # Increase body size for file uploads (documents, receipts)
    client_max_body_size 20M;

    # ── Frontend (Next.js on port 3000) ──────────────────────────────────────
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # ── Backend REST API (port 4000) ─────────────────────────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60;
    }

    # ── Health check ─────────────────────────────────────────────────────────
    location = /health {
        proxy_pass http://127.0.0.1:4000/health;
    }

    # ── WebSocket / Socket.IO ─────────────────────────────────────────────────
    location /socket.io/ {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

Enable it and test:
```bash
sudo ln -s /etc/nginx/sites-available/artic-vms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` must output: `syntax is ok` and `test is successful`.

---

## STEP 8 — BUILD AND START ALL SERVICES

This single command builds the backend and frontend Docker images, then starts
PostgreSQL, Redis, the API, and the dashboard — in the correct order.

```bash
cd /home/articadmin/artic-vms
docker compose up -d --build
```

This will take **10–20 minutes** on first run because it builds both Next.js and
the TypeScript backend from source. Subsequent restarts are instant.

Watch progress:
```bash
docker compose logs -f
```

Press Ctrl+C to stop watching logs (services keep running).

---

## STEP 9 — RUN DATABASE MIGRATIONS AND SEED

Wait for the backend container to be healthy, then run migrations:

```bash
# Check all containers are running
docker compose ps

# Run Prisma migrations (creates all tables)
docker compose exec backend npx prisma migrate deploy

# Seed the database (creates admin account + demo data)
docker compose exec backend node dist/utils/seed.js
```

> If the seed command fails because the seed file is not compiled, run:
> ```bash
> docker compose exec backend npx tsx src/utils/seed.ts
> ```

### Default admin credentials (change after first login!)
```
Email:    admin@artic.io
Password: Admin1234!
```

---

## STEP 10 — VERIFY EVERYTHING IS WORKING

### 10.1 Check container status
```bash
docker compose ps
```
All four services (postgres, redis, backend, frontend) should show `Up` or
`Up (healthy)`.

### 10.2 Test the API health endpoint
```bash
curl http://localhost:4000/health
```
Expected: `{"status":"ok","service":"artic-vms-backend","version":"1.0.0"}`

### 10.3 Test Nginx is proxying correctly
```bash
curl http://185.208.207.100/health
```
Same JSON response — confirms Nginx is working.

### 10.4 Open the dashboard in your browser
Navigate to: **http://185.208.207.100**

Login with `admin@artic.io` / `Admin1234!`.

### 10.5 Test MQTT port
From your Windows machine:
```powershell
# This should succeed (connection) not hang or refuse
Test-NetConnection -ComputerName 185.208.207.100 -Port 1883
```
Expected: `TcpTestSucceeded : True`

---

## STEP 11 — AUTO-RESTART ON SERVER REBOOT

Docker containers already have `restart: unless-stopped` in docker-compose.yml,
so they restart automatically after a reboot. Verify Docker itself starts on boot:

```bash
sudo systemctl enable docker
sudo systemctl enable nginx
```

Test it:
```bash
sudo reboot
```

Wait 2 minutes, then reconnect and check:
```bash
ssh -i "$env:USERPROFILE\.ssh\artic_vms" articadmin@185.208.207.100
docker compose -f /home/articadmin/artic-vms/docker-compose.yml ps
```

All containers should be running again.

---

## STEP 12 — CONFIGURE ESP32 DEVICES

In the ESP32 firmware, update the MQTT host:

```cpp
const char MQTT_HOST[] = "185.208.207.100";
const int  MQTT_PORT   = 1883;
```

The `deviceToken` for each vehicle comes from the ARTIC VMS dashboard under
the vehicle's GPS device settings.

---

## STEP 13 — DAILY AUTOMATED BACKUPS

```bash
sudo mkdir -p /var/backups/artic

sudo tee /etc/cron.daily/backup-artic > /dev/null << 'EOF'
#!/bin/bash
set -e
DATE=$(date +%Y%m%d_%H%M)
BACKUP_DIR=/var/backups/artic
DB_CONTAINER=$(docker ps --filter name=artic-vms-postgres --format "{{.Names}}" | head -1)

mkdir -p "$BACKUP_DIR"

docker exec "$DB_CONTAINER" pg_dump -U artic_user fleet_management \
  | gzip > "$BACKUP_DIR/fleet_management_$DATE.sql.gz"

# Keep last 30 backups only
ls -t "$BACKUP_DIR"/*.sql.gz | tail -n +31 | xargs rm -f 2>/dev/null || true

echo "Backup: fleet_management_$DATE.sql.gz"
EOF

sudo chmod +x /etc/cron.daily/backup-artic

# Test it immediately
sudo /etc/cron.daily/backup-artic
ls -lh /var/backups/artic/
```

---

## STEP 14 — UPDATING THE APPLICATION

When you push new code to GitHub:

```bash
cd /home/articadmin/artic-vms

# Pull latest code
git pull

# Rebuild and restart changed containers only
docker compose up -d --build

# Run any new database migrations
docker compose exec backend npx prisma migrate deploy
```

---

## ADDING A DOMAIN AND HTTPS (LATER)

When you register a domain (e.g., fleet.yourcompany.rw):

1. Point the domain's DNS A record to `185.208.207.100`

2. Install Certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```

3. Update `/etc/nginx/sites-available/artic-vms`:
   - Change `server_name 185.208.207.100;` to `server_name fleet.yourcompany.rw;`
   - Reload Nginx

4. Get a free SSL certificate:
   ```bash
   sudo certbot --nginx -d fleet.yourcompany.rw
   sudo certbot renew --dry-run  # test auto-renewal
   ```

5. Update the `.env` file to use HTTPS:
   ```env
   NEXT_PUBLIC_API_URL=https://fleet.yourcompany.rw
   NEXT_PUBLIC_WS_URL=wss://fleet.yourcompany.rw
   CORS_ORIGIN=https://fleet.yourcompany.rw
   ```

6. Rebuild the frontend (the HTTPS URLs are baked in at build time):
   ```bash
   docker compose up -d --build frontend
   ```

---

## QUICK REFERENCE — USEFUL COMMANDS

```bash
# See all running containers
docker compose -f /home/articadmin/artic-vms/docker-compose.yml ps

# View backend logs live
docker compose -f /home/articadmin/artic-vms/docker-compose.yml logs -f backend

# View frontend logs live
docker compose -f /home/articadmin/artic-vms/docker-compose.yml logs -f frontend

# Restart backend only (after a hot fix without rebuild)
docker compose -f /home/articadmin/artic-vms/docker-compose.yml restart backend

# Connect to the PostgreSQL database
docker compose -f /home/articadmin/artic-vms/docker-compose.yml exec postgres psql -U artic_user fleet_management

# Check disk space
df -h

# Check RAM usage
free -h

# Check CPU usage
htop
```

---

## PRODUCTION CHECKLIST

Before sharing access with anyone:

- [ ] Changed the default admin password (admin@artic.io / Admin1234!)
- [ ] Created a real organization in the dashboard
- [ ] JWT_SECRET is a random 64-character hex string (not the example)
- [ ] JWT_REFRESH_SECRET is a different 64-character hex string
- [ ] Database password is strong and unique
- [ ] UFW firewall is enabled (`sudo ufw status` shows `Status: active`)
- [ ] SSH root login is disabled
- [ ] Daily backup has been tested (`ls /var/backups/artic/` shows a .sql.gz file)
- [ ] `docker compose ps` shows all services as `Up`
- [ ] Dashboard loads at http://185.208.207.100
- [ ] API health check returns ok at http://185.208.207.100/health
- [ ] MQTT port 1883 is reachable (Test-NetConnection from Windows)
- [ ] ESP32 firmware updated with server IP 185.208.207.100
