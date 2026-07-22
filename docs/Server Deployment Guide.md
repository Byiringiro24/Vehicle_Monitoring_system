# ARTIC VMS — Complete Server Deployment Guide
# Rwanda-Focused Fleet Management Platform (Global Capable)

**System:** ARTIC Vehicle Monitoring System
**Reference Region:** Rwanda (RWF currency, Kigali coordinates, MTN/Airtel APNs)
**Platform:** Ubuntu 22.04 LTS on a VPS or dedicated server
**Date:** July 2026

---

## OVERVIEW

This guide takes the ARTIC VMS system from your local Windows machine and deploys
it to a production Linux server accessible from anywhere in the world — including
fleet managers in Kigali, drivers across Rwanda, and GPS trackers in the field.

The system is designed globally but configured for Rwanda by default:
- Currency: RWF (Rwandan Franc)
- Default country: Rwanda
- Default coordinates: Kigali, Rwanda (-1.286389, 36.817223)
- Supported mobile APNs: MTN Rwanda (internet), Airtel Rwanda (airtelgprs.com)
- Compatible with GPS devices using SIM cards from local operators

---

## PART 1 — CHOOSE YOUR SERVER

### Option A: VPS (Recommended — most cost-effective)

Providers available in Africa / with good latency to Rwanda:
- DigitalOcean (Singapore node — fast from East Africa): from $12/month
- Hetzner (Johannesburg node since 2023): from $5/month
- AWS EC2 (Cape Town region): pay-per-use
- Google Cloud (Johannesburg): pay-per-use
- Vultr (Johannesburg): from $6/month

Minimum specification for up to 20 vehicles:
  CPU: 2 vCPU
  RAM: 4 GB
  Disk: 40 GB SSD
  OS: Ubuntu 22.04 LTS

For 20-100 vehicles:
  CPU: 4 vCPU
  RAM: 8 GB
  Disk: 100 GB SSD

### Option B: Dedicated server in Rwanda

- Rwanda Information Society Authority (RISA) data center
- Liquid Telecom Rwanda data center (Kigali)
- Contact: risa.gov.rw or liquidtelecom.com/rw

### Domain Name
Register a domain at:
- Domains.rw (Rwandan .rw domains)
- Namecheap.com (international)
- GoDaddy.com

Example: fleet.yourcompany.rw or track.yourcompany.com

---

## PART 2 — PREPARE THE SERVER

SSH into your new server:
```bash
ssh root@YOUR_SERVER_IP
```

### 2.1 Update and secure the system
```bash
apt update && apt upgrade -y
apt install -y ufw fail2ban curl wget git nano htop

# Create non-root user
adduser artic
usermod -aG sudo artic

# Copy SSH key to new user
cp -r ~/.ssh /home/artic/
chown -R artic:artic /home/artic/.ssh

# Switch to the new user
su - artic
```

### 2.2 Configure firewall
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22        # SSH
sudo ufw allow 80        # HTTP
sudo ufw allow 443       # HTTPS
sudo ufw allow 1883      # MQTT (GPS devices)
sudo ufw enable
sudo ufw status
```

### 2.3 Install Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version    # should show v20.x.x
npm --version
```

### 2.4 Install Docker and Docker Compose
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker artic
newgrp docker
docker --version
docker compose version
```

### 2.5 Install PM2 (process manager)
```bash
sudo npm install -g pm2
pm2 --version
```

### 2.6 Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2.7 Install Certbot (free SSL)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## PART 3 — DEPLOY THE APPLICATION CODE

### 3.1 Clone your repository
```bash
cd /home/artic
git clone https://github.com/YOUR_USERNAME/artic-vms.git
cd artic-vms
```

If not using Git, transfer files with SCP:
```bash
# Run this on your Windows machine
scp -r "d:\Projectts 2026\SANO IRENE\New folder (2)\backend"  artic@YOUR_IP:/home/artic/artic-vms/
scp -r "d:\Projectts 2026\SANO IRENE\New folder (2)\frontend" artic@YOUR_IP:/home/artic/artic-vms/
scp    "d:\Projectts 2026\SANO IRENE\New folder (2)\docker-compose.yml" artic@YOUR_IP:/home/artic/artic-vms/
```

### 3.2 Configure backend environment
```bash
cd /home/artic/artic-vms/backend
cp .env.example .env
nano .env
```

Edit with production values:
```
DATABASE_URL=postgresql://artic_user:STRONG_DB_PASS@localhost:5432/fleet_management?sslmode=disable
REDIS_URL=redis://localhost:6379
JWT_SECRET=<run: openssl rand -hex 32>
JWT_REFRESH_SECRET=<run: openssl rand -hex 32 again>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=4000
MQTT_PORT=1883
NODE_ENV=production
CORS_ORIGIN=https://fleet.yourcompany.rw
```

Generate secure secrets:
```bash
openssl rand -hex 32   # paste as JWT_SECRET
openssl rand -hex 32   # paste as JWT_REFRESH_SECRET
```

### 3.3 Configure frontend environment
```bash
cd /home/artic/artic-vms/frontend
nano .env.local
```
```
NEXT_PUBLIC_API_URL=https://fleet.yourcompany.rw
NEXT_PUBLIC_WS_URL=wss://fleet.yourcompany.rw
```

---

## PART 4 — START THE DATABASES

### 4.1 Start PostgreSQL and Redis with Docker
```bash
cd /home/artic/artic-vms
docker compose up -d postgres redis
```

Wait 15 seconds for postgres to initialise, then verify:
```bash
docker compose ps
docker exec artic-vms-postgres-1 psql -U artic_user -d fleet_management -c "SELECT 1;"
```

### 4.2 Install dependencies and run database migrations
```bash
cd /home/artic/artic-vms/backend
npm install
npx prisma generate
npx prisma migrate deploy    # use deploy, not dev, in production
npm run seed                 # creates admin account and demo data
```

---

## PART 5 — BUILD AND START THE APPLICATION

### 5.1 Build the backend
```bash
cd /home/artic/artic-vms/backend
npm run build
```

### 5.2 Start backend with PM2
```bash
pm2 start dist/index.js --name artic-backend --env production
pm2 save
```

### 5.3 Build the frontend
```bash
cd /home/artic/artic-vms/frontend
npm install
npm run build
```

### 5.4 Start frontend with PM2
```bash
pm2 start npm --name artic-frontend -- start
pm2 save
pm2 startup   # follow the printed command to auto-start on boot
```

### 5.5 Verify both are running
```bash
pm2 status
pm2 logs artic-backend --lines 20
pm2 logs artic-frontend --lines 20
```

Test the API:
```bash
curl http://localhost:4000/health
```
Expected: {"status":"ok","service":"artic-vms-backend","version":"1.0.0"}

---

## PART 6 — CONFIGURE NGINX

### 6.1 Create Nginx config
```bash
sudo nano /etc/nginx/sites-available/artic-vms
```

Paste:
```nginx
server {
    listen 80;
    server_name fleet.yourcompany.rw;

    # Frontend — Next.js on port 3000
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection upgrade;
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Backend REST API on port 4000
    location /api/ {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:4000/health;
    }

    # WebSocket (Socket.IO)
    location /socket.io/ {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_read_timeout 86400;
    }
}
```

### 6.2 Enable the site and get SSL
```bash
sudo ln -s /etc/nginx/sites-available/artic-vms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Point your domain DNS A record to this server IP first, then:
sudo certbot --nginx -d fleet.yourcompany.rw

# Follow the prompts — certbot auto-updates the nginx config with HTTPS
# Test auto-renewal:
sudo certbot renew --dry-run
```

---

## PART 7 — CONFIGURE GPS DEVICES (ESP32 + SIM808)

In your ESP32 Arduino code, change:
```cpp
const char MQTT_HOST[] = "fleet.yourcompany.rw";
const int  MQTT_PORT   = 1883;
```

The deviceToken comes from the ARTIC VMS dashboard for each individual vehicle.

MQTT port 1883 must be open in the firewall (done in Part 2).
For MQTT over TLS (port 8883), additional Nginx stream proxy config is needed.

---

## PART 8 — SET UP AUTOMATED BACKUPS

```bash
sudo mkdir -p /var/backups/artic
sudo nano /etc/cron.daily/backup-artic
```

Paste:
```bash
#!/bin/bash
set -e
DATE=$(date +%Y%m%d_%H%M)
BACKUP_DIR=/var/backups/artic
DB_CONTAINER=$(docker ps --filter name=postgres --format "{{.Names}}" | head -1)

mkdir -p $BACKUP_DIR

# Database backup
docker exec "$DB_CONTAINER" pg_dump -U artic_user fleet_management \
  | gzip > "$BACKUP_DIR/fleet_management_$DATE.sql.gz"

# Keep only last 30 backups
ls -t "$BACKUP_DIR"/*.sql.gz | tail -n +31 | xargs rm -f 2>/dev/null || true

echo "Backup completed: fleet_management_$DATE.sql.gz"
```

```bash
sudo chmod +x /etc/cron.daily/backup-artic
# Test it:
sudo /etc/cron.daily/backup-artic
ls -lh /var/backups/artic/
```

---

## PART 9 — MONITORING AND MAINTENANCE

### View live logs
```bash
pm2 logs artic-backend   # backend API logs
pm2 logs artic-frontend  # Next.js logs
docker compose logs -f redis postgres  # database logs
```

### Check system resources
```bash
htop         # CPU and memory usage
df -h        # disk space
pm2 monit    # PM2 dashboard
```

### Restart services
```bash
pm2 restart artic-backend
pm2 restart artic-frontend
docker compose restart postgres redis
```

### Update the application
```bash
cd /home/artic/artic-vms
git pull

# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart artic-backend

# Frontend
cd ../frontend
npm install
npm run build
pm2 restart artic-frontend
```

---

## PART 10 — PRODUCTION SECURITY CHECKLIST

CRITICAL (must do before going live):
[ ] JWT_SECRET is a random 64-character string (not the example value)
[ ] JWT_REFRESH_SECRET is a different random 64-character string
[ ] Database password is strong and unique
[ ] HTTPS enabled with valid SSL certificate
[ ] NODE_ENV=production in backend .env
[ ] CORS_ORIGIN set to exact frontend domain
[ ] .env files NOT committed to Git (check .gitignore)
[ ] Default passwords changed (admin@artic.io / Admin1234!)
[ ] Firewall enabled with only ports 22, 80, 443, 1883 open
[ ] fail2ban installed and running (blocks brute-force SSH attempts)

IMPORTANT:
[ ] Daily database backups configured and tested (restore one to verify)
[ ] PM2 startup command run (so services auto-restart after server reboot)
[ ] SSL certificate auto-renewal tested (certbot renew --dry-run)
[ ] Monitoring set up (UptimeRobot free tier monitors /health endpoint)

NICE TO HAVE:
[ ] Offsite backups (copy to S3, Backblaze, or Google Drive)
[ ] Log aggregation (Papertrail, Logtail)
[ ] Error monitoring (Sentry — free tier available)
[ ] CDN for frontend static files (Cloudflare free tier)

---

## APPENDIX — RWANDA-SPECIFIC NOTES

**Currency:** All financial reports display in RWF (Rwandan Franc)
**GPS center:** Default map view centers on Kigali (-1.286389, 36.817223)
**Mobile data for GPS devices:**
  - MTN Rwanda: APN="internet" — good coverage nationwide
  - Airtel Rwanda: APN="airtelgprs.com" — good in urban areas
  - RwandaTel: APN="rwandatel" — limited coverage
**Regulations:** GPS tracking devices must comply with RURA (Rwanda Utilities
  Regulatory Authority) requirements for telecommunications equipment.
**Data privacy:** Rwanda has a Data Protection Law (Law No. 058/2021).
  Vehicle tracking data of employees must comply with consent and retention
  requirements. Consult a Rwandan legal advisor before deployment.
**Server hosting:** Consider hosting in Rwanda (RISA data center) for data
  sovereignty and lower latency to local users. Contact: risa.gov.rw