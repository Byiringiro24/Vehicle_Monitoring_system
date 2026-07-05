# ARTIC VMS — Full System Setup Guide

**Project:** ARTIC Vehicle Monitoring System  
**Version:** 2.1  
**Author:** System Documentation  
**Date:** July 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Technologies Used](#3-technologies-used)
4. [Hardware Required](#4-hardware-required)
5. [Ports & Network](#5-ports--network)
6. [Server Setup](#6-server-setup)
7. [Database Setup](#7-database-setup)
8. [Backend Setup](#8-backend-setup)
9. [Frontend Setup](#9-frontend-setup)
10. [MQTT Broker Setup](#10-mqtt-broker-setup)
11. [Arduino IDE & ESP32 Setup](#11-arduino-ide--esp32-setup)
12. [Wiring Diagram](#12-wiring-diagram)
13. [Environment Variables](#13-environment-variables)
14. [Running Everything](#14-running-everything)
15. [Features Reference](#15-features-reference)
16. [Troubleshooting](#16-troubleshooting)
17. [Default Credentials](#17-default-credentials)

---

## 1. System Overview

ARTIC VMS is a professional fleet management and vehicle monitoring system that provides:

- **Real-time GPS tracking** via ESP32 + SIM808 modules over GPRS/4G
- **Live map** with automatic vehicle position updates every 15 seconds
- **Engine relay control** (lock/unlock ignition remotely via MQTT)
- **GPS status monitoring** independent of engine lock state
- **Geofencing** with per-vehicle zone assignment and entry/exit alerts
- **GPS history replay** with custom date-time range (e.g. 14:05 to 15:40)
- **Financial management** — contracts, payments, expenses, P&L statements
- **Driver management** — assignments, payments, performance reports
- **Daily payment reports** in spreadsheet format
- **Responsive web dashboard** — works on phone, tablet, desktop
- **Dark/light mode** toggle

---

## 2. Architecture

```
GPS Satellites
     │
     ▼
ESP32 + SIM808 (in vehicle)
     │  reads GPS every 15s
     │  publishes via MQTT over GPRS
     ▼
Mosquitto MQTT Broker (port 1883 on server)
     │
     ├── Backend MQTT Client subscribes to artic/+/telemetry
     │        │
     │        ├── Saves to PostgreSQL (telemetry, gps_history, last_location)
     │        ├── Updates vehicle status (ACTIVE/IDLE based on speed)
     │        └── Broadcasts via Socket.IO → Browser dashboard
     │
     └── Backend publishes to artic/<TOKEN>/command (lock/unlock)
              │
              ▼
         ESP32 receives → toggles relay GPIO26

Browser (React/Next.js dashboard)
     │  Socket.IO WebSocket
     ├── Receives location:update → moves map marker
     ├── Receives gps:online/gps:offline → updates status badges
     └── REST API calls → backend Express.js → PostgreSQL
```

---

## 3. Technologies Used

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 22.x | Runtime |
| TypeScript | 5.x | Type-safe JavaScript |
| Express.js | 4.x | HTTP API server |
| Prisma ORM | 5.22 | Database access layer |
| PostgreSQL | 16 | Main database |
| Redis | 7 | Session caching, rate limiting |
| Socket.IO | 4.x | Real-time WebSocket communication |
| MQTT (npm) | 5.x | MQTT client to connect to mosquitto |
| Aedes | 0.x | Built-in MQTT broker (port 1884, internal) |
| JWT | — | Authentication tokens |
| bcryptjs | — | Password hashing |
| Winston | — | Structured logging |
| PM2 | — | Process manager (keeps app running) |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14.2 | React framework with SSR |
| React | 18 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first CSS |
| React Leaflet | 4.x | Interactive maps |
| Leaflet | 1.9 | Map engine |
| Recharts | 2.x | Charts and graphs |
| @tanstack/react-query | 5.x | Data fetching and caching |
| Socket.IO client | 4.x | Real-time updates |
| Zustand | — | State management (auth store) |
| React Hook Form | — | Form handling |
| Zod | — | Schema validation |
| date-fns | — | Date formatting |
| react-hot-toast | — | Toast notifications |

### Hardware (GPS Device)
| Component | Purpose |
|---|---|
| ESP32 Dev Module | Main microcontroller |
| SIM808 Module | GPS + GPRS communication |
| Relay Module (5V, active LOW) | Engine ignition cut-off |
| SIM card | Mobile data (Airtel/MTN Rwanda — APN: internet) |
| 4.0–4.2V Li-Po battery or regulator | Power supply for SIM808 |

### Infrastructure
| Component | Purpose |
|---|---|
| Ubuntu 24.04 LTS (Azure VM) | Server OS |
| Mosquitto | MQTT broker |
| Nginx (optional) | Reverse proxy |
| Let's Encrypt (optional) | SSL certificates |

---

## 4. Hardware Required

### Per Vehicle GPS Unit
```
1x ESP32 Dev Module (30-pin or 38-pin)
1x SIM808 GSM/GPS module (not SIM800 — must have GPS)
1x 5V Relay Module (1-channel, active LOW)
1x SIM card with data plan (MTN or Airtel Rwanda)
1x 4.0V–4.2V power supply for SIM808 (min 2A)
  — Use a Li-Po 3.7V with boost converter, or a dedicated 4V regulator
Wires, connectors, enclosure
```

### SIM808 Notes
- **Do NOT power SIM808 from ESP32's 3.3V or 5V pin** — it draws up to 2A during GPRS which will crash the ESP32
- SIM808 needs 4.0–4.2V at its VCC pin
- Antenna: attach the small GPS antenna to the IPEX connector on the SIM808
- SIM card: insert a SIM card with active data plan (APN = "internet" for Airtel/MTN Rwanda)

---

## 5. Ports & Network

### Server Ports (Azure NSG — must be open)
| Port | Protocol | Service | Open in Azure? |
|---|---|---|---|
| 22 | TCP | SSH | ✅ Yes |
| 80 | TCP | HTTP (if using Nginx) | ✅ Yes |
| 443 | TCP | HTTPS (if using SSL) | Optional |
| 1883 | TCP | Mosquitto MQTT (ESP32 connects here) | ✅ Yes |
| 3000 | TCP | Next.js Frontend | ✅ Yes |
| 5000 | TCP | Express.js Backend API | ✅ Yes |

### Internal Ports (NOT opened in Azure — server internal only)
| Port | Service |
|---|---|
| 1884 | Aedes MQTT broker (internal bridge) |
| 5432 | PostgreSQL |
| 6379 | Redis |

### ESP32 Connections
- Connects to `172.209.217.176:1883` (mosquitto) via GPRS
- Does NOT need any port opened except 1883

---

## 6. Server Setup

### Prerequisites
```bash
# Connect to server
ssh artic@172.209.217.176
# Password: Vehicle$2026 (change this after setup)

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # should show v22.x
npm --version    # should show 10.x

# Install Git
sudo apt install -y git

# Install PM2 (process manager)
sudo npm install -g pm2

# Install build tools
sudo apt install -y build-essential
```

### Clone the Repository
```bash
cd /home/artic
git clone https://github.com/Byiringiro24/Vehicle_Monitoring_system.git
cd Vehicle_Monitoring_system
```

---

## 7. Database Setup

### Install PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### Create Database and User
```bash
sudo -u postgres psql
```
Inside the PostgreSQL shell:
```sql
CREATE USER "Byiringiro" WITH PASSWORD 'Artic$2026';
CREATE DATABASE fleet_management OWNER "Byiringiro";
GRANT ALL PRIVILEGES ON DATABASE fleet_management TO "Byiringiro";
\q
```

### Install Redis
```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Test Redis is working
redis-cli ping
# Should respond: PONG
```

### Run Database Migrations
```bash
cd /home/artic/Vehicle_Monitoring_system/backend
npx prisma migrate deploy
# Expected output: "All migrations have been successfully applied."

# Generate Prisma client (required after migrations)
npx prisma generate
```

### Seed Initial Data (first time only)
```bash
node dist/utils/seed.js
# Creates default organization, admin user, fleet manager, finance user
```

---

## 8. Backend Setup

### Install Dependencies
```bash
cd /home/artic/Vehicle_Monitoring_system/backend
npm install
```

### Create Environment File
```bash
nano .env
```
Paste the following (adjust values as needed):
```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://Byiringiro:Artic$2026@localhost:5432/fleet_management
JWT_SECRET=VehicleMonitoringSecretKey2026XYZ
JWT_REFRESH_SECRET=VehicleMonitoringRefreshSecretKey2026
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REDIS_URL=redis://localhost:6379
MQTT_PORT=1883
MQTT_HOST=localhost
AEDES_PORT=1884
CORS_ORIGIN=http://172.209.217.176:3000
```
Save: `Ctrl+O` → Enter → `Ctrl+X`

### Build Backend
```bash
npm run build
# Compiles TypeScript → dist/ folder
```

### Start with PM2
```bash
pm2 start dist/index.js --name "vms-backend"
pm2 save
pm2 startup
# Run the sudo command it prints
```

### Verify Backend is Running
```bash
pm2 status
# Should show vms-backend as "online"

pm2 logs vms-backend --lines 20
# Should show:
# PostgreSQL connected
# Redis connected
# MQTT client connected to mqtt://localhost:1883
# MQTT client subscribed to artic/+/telemetry
# ARTIC VMS backend running on port 5000
```

### Update Backend (after git pull)
```bash
cd /home/artic/Vehicle_Monitoring_system/backend
git pull origin master
npm run build
pm2 restart vms-backend --update-env
```

---

## 9. Frontend Setup

### Install Dependencies
```bash
cd /home/artic/Vehicle_Monitoring_system/frontend
npm install
```

### Create Environment File
```bash
nano .env.local
```
Paste:
```env
NEXT_PUBLIC_API_URL=http://172.209.217.176:5000
NEXT_PUBLIC_WS_URL=ws://172.209.217.176:5000
```
Save: `Ctrl+O` → Enter → `Ctrl+X`

### Build Frontend
```bash
npm run build
```

### Start with PM2
```bash
pm2 start npm --name "vms-frontend" -- start
pm2 save
```

### Verify Frontend is Running
```bash
pm2 status
# Should show vms-frontend as "online"
# Access at: http://172.209.217.176:3000
```

### Update Frontend (after git pull)
```bash
cd /home/artic/Vehicle_Monitoring_system/frontend
npm run build
pm2 restart vms-frontend
```

---

## 10. MQTT Broker Setup

### Install Mosquitto
```bash
sudo apt install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
```

### Configure Mosquitto (allow anonymous connections)
```bash
sudo nano /etc/mosquitto/conf.d/artic.conf
```
Paste:
```
listener 1883 0.0.0.0
allow_anonymous true
```
Save and restart:
```bash
sudo systemctl restart mosquitto
sudo systemctl status mosquitto
# Should show: active (running)
```

### Open UFW Firewall for MQTT
```bash
sudo ufw allow 1883/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 5000/tcp
sudo ufw reload
sudo ufw status
```

### Open Azure NSG Firewall
In **Azure Portal → VM → Networking → Inbound port rules**, add:

| Name | Port | Protocol | Action | Priority |
|---|---|---|---|---|
| Allow-MQTT-1883 | 1883 | TCP | Allow | 330 |
| Allow-Frontend-3000 | 3000 | TCP | Allow | 310 |
| Allow-Backend-5000 | 5000 | TCP | Allow | 320 |

### Test MQTT from Server
```bash
# Terminal 1 — subscribe to all artic topics
mosquitto_sub -h localhost -p 1883 -t "artic/#" -v

# Terminal 2 — publish a test message
mosquitto_pub -h localhost -p 1883 -t "artic/test/telemetry" -m '{"test":true}'
# Terminal 1 should print: artic/test/telemetry {"test":true}
```

### Verify ESP32 Messages
When ESP32 is powered and connected, Terminal 1 will show:
```
artic/5466f18d-ffd6-4267-ad81-93583d1bbaa4/telemetry {"latitude":-1.976,"longitude":30.136,...}
```

---

## 11. Arduino IDE & ESP32 Setup

### Step 1 — Install Arduino IDE
Download from: https://www.arduino.cc/en/software  
Install Arduino IDE 2.x (recommended) or 1.8.x

### Step 2 — Add ESP32 Board Support
1. Open Arduino IDE
2. Go to **File → Preferences**
3. In "Additional boards manager URLs" add:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Click OK
5. Go to **Tools → Board → Boards Manager**
6. Search for `esp32`
7. Install **esp32 by Espressif Systems** (version 3.x recommended)

### Step 3 — Select Board
1. Connect ESP32 via USB
2. Go to **Tools → Board → esp32 → ESP32 Dev Module**
3. Go to **Tools → Port** → select the COM port (e.g. COM42)
4. Upload speed: 921600

### Step 4 — Install Required Libraries
Go to **Tools → Manage Libraries** and install each one:

| Library | Author | Version |
|---|---|---|
| TinyGSM | Volodymyr Shymanskyy | 0.12.0 |
| PubSubClient | Nick O'Leary | 2.8 |
| ArduinoJson | Benoit Blanchon | 7.x |

**Important:** ArduinoJson v7 uses `JsonDocument` not `StaticJsonDocument`.

### Step 5 — Configure the Sketch
Open your sketch and update these constants:

```cpp
// Get from Dashboard → Vehicles → click vehicle → copy Device Token
const char DEVICE_TOKEN[] = "PASTE-YOUR-DEVICE-TOKEN-HERE";

// Your server public IP
const char MQTT_HOST[] = "172.209.217.176";
const int  MQTT_PORT   = 1883;

// SIM card APN (Airtel/MTN Rwanda = "internet")
const char APN[] = "internet";
```

### Step 6 — Get the Device Token
1. Log in to the dashboard: `http://172.209.217.176:3000`
2. Go to **Vehicles** → click your vehicle
3. In the **Overview** tab → find "Device Token"
4. Click the **Copy** button
5. Paste into `DEVICE_TOKEN` in the sketch

### Step 7 — Upload
1. Press the **Boot** button on ESP32 while clicking Upload (if needed)
2. Click the Upload arrow button in Arduino IDE
3. Wait for "Done uploading"

### Step 8 — Monitor Output
1. Go to **Tools → Serial Monitor**
2. Set baud rate to **115200**
3. Press the **Reset** (EN) button on the ESP32

Expected output when working correctly:
```
=====================================
  ARTIC VMS GPS Tracker v2.1
  Server: 172.209.217.176:1883
  Token:  5466f18d...
=====================================
[MODEM] Restarting SIM808...
[MODEM] Info: SIM808 R14.18
[MODEM] Signal: 28
[GPS] Powering on GPS module...
[GPS] Module confirmed ON
[GPRS] Connecting on APN 'internet'... OK ✓ IP: 21.14.32.88
[MQTT] Connecting to 172.209.217.176:1883 ... OK ✓
[MQTT] Subscribed to:
  artic/5466f18d-.../ping
  artic/5466f18d-.../command
[GPS] No fix yet — sending heartbeat
[MQTT] Telemetry OK ✓
...
[GPS] Fix: -1.976342, 30.136665  Speed: 0.6 km/h  Sats: 8
[MQTT] Telemetry OK ✓
```

### Troubleshooting Serial Output
| Message | Meaning | Fix |
|---|---|---|
| `FAILED rc=-2` | TCP timeout — can't reach server | Open port 1883 in Azure NSG |
| `FAILED rc=4` | Wrong credentials | Check DEVICE_TOKEN matches dashboard |
| `FAILED rc=5` | Token not in database | Regenerate token in dashboard |
| `GPRS FAILED` | No mobile data | Check SIM card, verify APN |
| `Signal: 0` | No GSM signal | Move to open area, check antenna |
| `Module OFF` | SIM808 not responding | Check power supply (needs 4V/2A) |

---

## 12. Wiring Diagram

### ESP32 ↔ SIM808
```
ESP32 GPIO16 (RX2)  ←────  SIM808 TX
ESP32 GPIO17 (TX2)  ────→  SIM808 RX
ESP32 GND           ────   SIM808 GND
                           SIM808 VCC ← 4.0–4.2V dedicated supply (NOT ESP32 pins)
```

### ESP32 ↔ Relay Module
```
ESP32 GPIO26        ────→  Relay IN signal
ESP32 5V (VIN)      ────→  Relay VCC
ESP32 GND           ────   Relay GND
```

### Relay ↔ Vehicle Ignition
```
Relay COM           ────   One side of ignition wire
Relay NC            ────   Other side of ignition wire
```
- **NC = Normally Closed** → relay OFF = engine runs normally
- When relay ON (GPIO26 goes LOW) → NC opens → engine ignition cut

### Active LOW Relay Logic
```
engineLocked = false → GPIO26 HIGH → relay OFF  → NC closed → engine runs
engineLocked = true  → GPIO26 LOW  → relay ON   → NC open   → engine cut
```

### Power Supply Recommendation
```
Car 12V battery
    │
    ├── 12V → 5V buck converter → ESP32 VIN (5V)
    └── 12V → 4.2V LDO regulator or Li-Po charger → SIM808 VCC
```

**Never power SIM808 directly from ESP32 USB 5V pin** — the SIM808 
draws up to 2 Amps during GPRS transmit, which will brown out the ESP32.

---

## 13. Environment Variables

### Backend (.env)
```env
# Server
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://Byiringiro:Artic$2026@localhost:5432/fleet_management

# JWT Authentication
JWT_SECRET=VehicleMonitoringSecretKey2026XYZ
JWT_REFRESH_SECRET=VehicleMonitoringRefreshSecretKey2026
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://localhost:6379

# MQTT
MQTT_PORT=1883
MQTT_HOST=localhost
AEDES_PORT=1884

# CORS (frontend URL)
CORS_ORIGIN=http://172.209.217.176:3000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://172.209.217.176:5000
NEXT_PUBLIC_WS_URL=ws://172.209.217.176:5000
```

---

## 14. Running Everything

### Start All Services
```bash
# Start mosquitto (MQTT broker)
sudo systemctl start mosquitto

# Start backend
cd /home/artic/Vehicle_Monitoring_system/backend
pm2 start dist/index.js --name "vms-backend"

# Start frontend
cd /home/artic/Vehicle_Monitoring_system/frontend
pm2 start npm --name "vms-frontend" -- start

# Save PM2 config
pm2 save

# Auto-start on server reboot
pm2 startup
# Run the sudo command it outputs
```

### Check Status
```bash
pm2 status
# Shows: vms-backend (online), vms-frontend (online)

pm2 logs vms-backend --lines 20
pm2 logs vms-frontend --lines 10
```

### Restart All
```bash
pm2 restart all
```

### Stop All
```bash
pm2 stop all
```

### Update and Deploy New Version
```bash
cd /home/artic/Vehicle_Monitoring_system
git pull origin master

# Run any new migrations
cd backend
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart vms-backend --update-env

cd ../frontend
npm run build
pm2 restart vms-frontend
```

### Verify Full System is Working
```bash
# 1. PostgreSQL
sudo systemctl status postgresql
# Should show: active (running)

# 2. Redis
redis-cli ping
# Should respond: PONG

# 3. Mosquitto MQTT
sudo systemctl status mosquitto
# Should show: active (running)

# 4. Backend API
curl -s http://localhost:5000/health
# Should respond: {"status":"ok","service":"artic-vms-backend"}

# 5. Frontend
curl -s -I http://localhost:3000
# Should respond: HTTP/1.1 200 OK

# 6. ESP32 telemetry arriving
mosquitto_sub -h localhost -p 1883 -t "artic/#" -v
# Should see GPS packets every 15 seconds when ESP32 is powered
```

---

## 15. Features Reference

### GPS Status Logic
| Status | Condition | Color |
|---|---|---|
| ACTIVE | Telemetry received < 45s ago AND speed > 2 km/h | 🟢 Green |
| IDLE | Telemetry received < 45s ago AND speed ≤ 2 km/h | 🟡 Yellow |
| OFFLINE | No telemetry for > 45 seconds | ⚫ Gray |

**Important:** GPS status is completely independent of engine lock state.  
A locked vehicle still shows ACTIVE/IDLE if the GPS is sending data.  
Only loss of MQTT signal marks a vehicle OFFLINE.

### Engine Lock/Unlock
- Lock button sends `{"command":"lock"}` to `artic/<TOKEN>/command` via MQTT
- ESP32 receives it and pulls GPIO26 LOW → relay energises → NC opens → ignition cut
- GPS continues transmitting — location still visible on map
- Unlock sends `{"command":"unlock"}` → GPIO26 HIGH → relay off → engine can start

### MQTT Topic Structure
| Topic | Direction | Purpose |
|---|---|---|
| `artic/<TOKEN>/telemetry` | ESP32 → Server | GPS position every 15s |
| `artic/<TOKEN>/command` | Server → ESP32 | lock / unlock / ping |
| `artic/<TOKEN>/ping` | Server → ESP32 | GPS health check |
| `artic/<TOKEN>/pong` | ESP32 → Server | Response to ping |

Where `<TOKEN>` = the vehicle's Device Token (UUID from dashboard).

### GPS History Replay
- Go to **Vehicles → click vehicle → GPS History tab**
- Select FROM datetime and TO datetime (includes hours and minutes)
- Example: `2026-07-16 23:47` to `2026-07-17 19:03` (cross-midnight)
- Example: `2026-07-06 14:05` to `2026-07-06 15:40` (same day)
- Map shows all GPS points as a path with timestamps

### Geofences Per Vehicle
- When creating a geofence, select which vehicles it applies to
- Leave vehicle list empty = applies to ALL vehicles
- Entry/Exit alerts are only triggered for assigned vehicles
- Each vehicle can be in multiple geofences

### Daily Payment Report
- Go to **Reports → Daily Payments tab**
- Select month and year
- Shows a table: dates (rows) × vehicles (columns) with daily payment amounts
- Highlights Sundays and zero-payment days
- Export to CSV button

### Live Map
- Accessible at `/map` in the sidebar
- Shows all vehicles with GPS fix
- Markers: green (moving), yellow (idle), gray (offline)
- Click marker → popup with address, speed, fuel, engine state
- Search box filters vehicles by plate or name
- Active vehicles sorted to top of sidebar list
- Auto-updates every 15 seconds via Socket.IO

### Auto-Ping System
- Backend pings all vehicles every 15 seconds automatically
- No manual action needed
- If device responds → GPS Online confirmed
- If no response for 45s → marked OFFLINE

---

## 16. Troubleshooting

### Vehicle shows OFFLINE but ESP32 is on
1. Check Serial Monitor — is it connected to MQTT? (`OK ✓`)
2. Check server logs: `pm2 logs vms-backend --lines 20`
3. Run on server: `mosquitto_sub -h localhost -p 1883 -t "artic/#" -v`
   — Do you see packets when ESP32 sends telemetry?
4. If no packets: ESP32 can't reach server — check Azure NSG port 1883
5. If packets visible but dashboard offline: check Socket.IO CORS settings

### Login not working
1. Check CORS: `CORS_ORIGIN` in backend `.env` must match frontend URL exactly
2. Check: `pm2 logs vms-backend --lines 5` for errors after login attempt
3. Verify backend is running: `curl http://localhost:5000/health`

### Map shows no vehicles
1. Wait for GPS fix (ESP32 needs 1–5 minutes outdoors)
2. Check Serial Monitor: are you seeing `[GPS] Fix: -1.xxx, 30.xxx`?
3. Check fleet-locations API: `curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/v1/telemetry/locations`

### SIM808 turns off unexpectedly
- Add `AT+CSCLK=0` in setup to disable sleep mode
- Ensure power supply can deliver 2A
- Keep periodic AT ping: `sendAT("AT", "OK", 1500)` every 30 seconds

### Database connection error
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection string in .env
cat /home/artic/Vehicle_Monitoring_system/backend/.env | grep DATABASE_URL

# Test connection manually
sudo -u postgres psql -d fleet_management -c "SELECT COUNT(*) FROM vehicles;"
```

### Frontend build fails with "window is not defined"
- A Leaflet import is being used at SSR time
- Ensure all map components use `dynamic(() => import(...), { ssr: false })`
- Never import `getLiveStatus` from `LiveMap.tsx` — import from `lib/liveStatus.ts` instead

---

## 17. Default Credentials

### Web Dashboard Login
| Role | Email | Password |
|---|---|---|
| Super Admin | admin@artic.io | Admin1234! |
| Fleet Manager | manager@artic.io | Manager1234! |
| Finance | finance@artic.io | Finance1234! |

**Change these passwords immediately after first login.**  
Go to: Profile → Change Password

### Server Access
| Item | Value |
|---|---|
| Server IP | 172.209.217.176 |
| SSH User | artic |
| Database | fleet_management |
| DB User | Byiringiro |
| Frontend URL | http://172.209.217.176:3000 |
| Backend API | http://172.209.217.176:5000 |
| API Health | http://172.209.217.176:5000/health |

### GitHub Repository
```
https://github.com/Byiringiro24/Vehicle_Monitoring_system.git
```

### Quick Deploy Commands
```bash
# Pull latest code and redeploy everything
cd /home/artic/Vehicle_Monitoring_system
git pull origin master
cd backend && npx prisma migrate deploy && npx prisma generate && npm run build && pm2 restart vms-backend --update-env
cd ../frontend && npm run build && pm2 restart vms-frontend
```

---

*Document generated for ARTIC VMS v2.1 — July 2026*  
*For support: contact the development team*
