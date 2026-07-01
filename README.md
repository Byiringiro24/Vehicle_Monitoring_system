# ARTIC VMS — Vehicle Monitoring System

A full-stack, real-time fleet management platform with live GPS tracking, telemetry monitoring, automated alerts, geofencing, and driver management.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Quick Start (Docker)](#quick-start-docker)
6. [Manual Setup (Development)](#manual-setup-development)
7. [Environment Variables](#environment-variables)
8. [Database Setup](#database-setup)
9. [Running the Application](#running-the-application)
10. [Default Login Credentials](#default-login-credentials)
11. [Feature Guide](#feature-guide)
12. [API Reference](#api-reference)
13. [Vehicle Simulator](#vehicle-simulator)
14. [MQTT Device Integration](#mqtt-device-integration)
15. [WebSocket Events](#websocket-events)
16. [User Roles & Permissions](#user-roles--permissions)
17. [Troubleshooting](#troubleshooting)

---

## System Overview

ARTIC VMS tracks a fleet of vehicles in real time. GPS devices on each vehicle send telemetry (position, speed, fuel, engine temp, etc.) to the backend via **MQTT** or **HTTP**. The backend processes data, checks alert rules, evaluates geofences, and broadcasts live updates to the dashboard through **Socket.IO**.

```
GPS Device  ──MQTT──►  Backend API  ──Socket.IO──►  Browser Dashboard
                           │
                      PostgreSQL + Redis
```

---

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Frontend   | Next.js 14, React 18, TailwindCSS, Zustand, React Query |
| Backend    | Node.js, Express, TypeScript                  |
| Database   | PostgreSQL 16 (via Prisma ORM)                |
| Cache      | Redis 7                                       |
| Real-time  | Socket.IO (WebSocket), Aedes (MQTT broker)    |
| Maps       | Leaflet / React-Leaflet (OpenStreetMap)       |
| Charts     | Recharts, Apexcharts                          |
| Auth       | JWT (access token 15 min) + refresh tokens (7 days) |

---

## Project Structure

```
/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   ├── src/
│   │   ├── config/                # DB, JWT, Redis config
│   │   ├── controllers/           # Route handlers
│   │   ├── middleware/            # Auth, validation, pagination, errors
│   │   ├── routes/                # Express routers
│   │   ├── services/              # Business logic
│   │   ├── types/                 # TypeScript types
│   │   ├── utils/                 # Logger, seed, simulator
│   │   ├── websocket/             # Socket.IO server
│   │   ├── app.ts                 # Express app setup
│   │   └── index.ts               # Entry point
│   ├── .env                       # Backend environment variables
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/            # Login page
│   │   │   └── (dashboard)/       # Protected pages
│   │   │       ├── dashboard/     # Overview stats
│   │   │       ├── vehicles/      # Vehicle list + detail
│   │   │       ├── telemetry/     # Live map
│   │   │       ├── alerts/        # Alert management
│   │   │       ├── drivers/       # Driver management
│   │   │       ├── geofences/     # Geofence zones
│   │   │       ├── reports/       # Analytics
│   │   │       ├── users/         # User management
│   │   │       ├── settings/      # Alert rules
│   │   │       └── profile/       # My account
│   │   ├── components/            # Reusable UI components
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── lib/                   # API client, socket, utils
│   │   └── store/                 # Zustand state
│   ├── .env.local                 # Frontend environment variables
│   └── package.json
└── docker-compose.yml
```

---

## Prerequisites

Make sure you have these installed:

- **Node.js** >= 18  (`node -v`)
- **npm** >= 9  (`npm -v`)
- **Docker & Docker Compose** (for quick start)  (`docker -v`)
- **PostgreSQL 16** (if running manually without Docker)
- **Redis 7** (if running manually without Docker)

---

## Quick Start (Docker)

The fastest way to run everything is with Docker Compose.

**Step 1 — Clone and enter the project**
```bash
cd "d:\Projectts 2026\SANO IRENE\New folder (2)"
```

**Step 2 — Start all services**
```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port `5432`
- Redis on port `6379`
- Backend API on port `4000`
- Frontend on port `3000`

**Step 3 — Run database migrations and seed**

Wait about 15 seconds for the backend to be ready, then:
```bash
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run seed
```

**Step 4 — Open the app**

Visit `http://localhost:3000` and log in with:
- Email: `admin@artic.io`
- Password: `Admin1234!`

**Stop services**
```bash
docker-compose down
```

**Stop and wipe all data**
```bash
docker-compose down -v
```

---

## Manual Setup (Development)

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Start PostgreSQL and Redis

Either use Docker for just the databases:
```bash
docker-compose up -d postgres redis
```

Or install them locally and start them manually.

### 4. Configure Environment

Copy and edit the backend env file:
```bash
cd backend
copy .env.example .env
```

The `.env` file already has working defaults for local Docker. If using local Postgres/Redis, confirm the connection strings match.

Frontend env is already created at `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

### 5. Set Up Database

```bash
cd backend
npx prisma generate      # generates the Prisma client
npx prisma migrate dev   # applies migrations (creates tables)
npm run seed             # seeds demo data
```

### 6. Start the Backend

```bash
cd backend
npm run dev
```

Backend starts on `http://localhost:4000` and MQTT broker on port `1883`.

### 7. Start the Frontend

In a new terminal:
```bash
cd frontend
npm run dev
```

Frontend starts on `http://localhost:3000`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable              | Default                                     | Description                         |
|-----------------------|---------------------------------------------|-------------------------------------|
| `DATABASE_URL`        | `postgresql://artic:artic_secret@localhost:5432/artic_vms` | PostgreSQL connection string |
| `REDIS_URL`           | `redis://localhost:6379`                    | Redis connection string             |
| `JWT_SECRET`          | *(set a strong secret)*                     | JWT signing secret (min 32 chars)   |
| `JWT_REFRESH_SECRET`  | *(set a strong secret)*                     | Refresh token secret                |
| `JWT_EXPIRES_IN`      | `15m`                                       | Access token lifetime               |
| `JWT_REFRESH_EXPIRES_IN` | `7d`                                     | Refresh token lifetime              |
| `PORT`                | `4000`                                      | HTTP server port                    |
| `MQTT_PORT`           | `1883`                                      | MQTT broker port                    |
| `NODE_ENV`            | `development`                               | Environment mode                    |
| `CORS_ORIGIN`         | `http://localhost:3000`                     | Frontend origin for CORS            |

### Frontend (`frontend/.env.local`)

| Variable                | Default                      | Description                    |
|-------------------------|------------------------------|--------------------------------|
| `NEXT_PUBLIC_API_URL`   | `http://localhost:4000`      | Backend API base URL           |
| `NEXT_PUBLIC_WS_URL`    | `ws://localhost:4000`        | WebSocket server URL           |

---

## Database Setup

The Prisma schema defines these main models:

- **Organization** — multi-tenant container for all data
- **User** — platform users with roles
- **Fleet** — groups of vehicles
- **Vehicle** — individual tracked units with a device token
- **Driver** — driver profile linked to a user, optionally assigned to a vehicle
- **Telemetry** — historical GPS/sensor records per vehicle
- **LastLocation** — the most recent position for each vehicle (for fast map queries)
- **Alert** — triggered alert events
- **AlertRule** — per-organization rules that auto-generate alerts
- **Geofence** — polygon zones with entry/exit monitoring
- **GeofenceEvent** — log of geofence crossings
- **RefreshToken** — persisted refresh tokens

### Useful Prisma Commands

```bash
# Apply pending migrations
npx prisma migrate dev

# Open database browser UI
npx prisma studio

# Reset database (drops all data)
npx prisma migrate reset

# Re-generate Prisma client after schema changes
npx prisma generate
```

---

## Running the Application

### Development Mode

Terminal 1 — Backend with hot reload:
```bash
cd backend && npm run dev
```

Terminal 2 — Frontend with hot reload:
```bash
cd frontend && npm run dev
```

Terminal 3 (optional) — Vehicle simulator:
```bash
cd backend && npm run simulate
```

### Production Build

Backend:
```bash
cd backend
npm run build
npm start
```

Frontend:
```bash
cd frontend
npm run build
npm start
```

### Useful Scripts

| Command                        | What it does                                  |
|--------------------------------|-----------------------------------------------|
| `cd backend && npm run dev`    | Start backend with hot reload                 |
| `cd backend && npm run seed`   | Seed demo organization, users, vehicles       |
| `cd backend && npm run simulate` | Start GPS simulator for testing             |
| `cd backend && npx prisma studio` | Open Prisma visual database browser        |
| `cd frontend && npm run dev`   | Start frontend with hot reload                |
| `cd frontend && npm run build` | Build frontend for production                 |

---

## Default Login Credentials

After running `npm run seed`:

| Role          | Email                  | Password       |
|---------------|------------------------|----------------|
| Super Admin   | admin@artic.io         | Admin1234!     |
| Fleet Manager | manager@artic.io       | Manager1234!   |

---

## Feature Guide

### Dashboard

The main overview page shows:
- **Stats cards** — total vehicles, active alerts, fleet count, online rate
- **Vehicle Status Chart** — donut chart of ACTIVE / IDLE / OFFLINE / MAINTENANCE
- **Recent Alerts** — the 5 most recent alerts across the fleet

Data refreshes automatically every 30 seconds.

---

### Live Map (Telemetry)

Navigate to **Live Map** in the sidebar.

- All vehicles with GPS data appear as coloured map markers:
  - 🟢 Green = ACTIVE (moving)
  - 🟡 Yellow = IDLE (engine on, not moving)
  - ⚫ Grey = OFFLINE
  - 🟠 Orange = MAINTENANCE
- Click a vehicle in the left panel or on the map to fly to it and see a popup with speed, fuel, and engine status.
- Vehicle positions update in real time via WebSocket without page refresh.

---

### Vehicles

**List** — search by name/plate, filter by status. Columns: name, make/model, fleet, status, last seen.

**Add Vehicle** — click **Add Vehicle**, fill in the form:
- Name, License Plate, Make, Model, Year are required
- Assign to a Fleet (optional)
- Fuel Capacity defaults to 60L

**Edit / Delete** — use the pencil and trash icons in the table row.

**Vehicle Detail** — click the eye icon to open the detail page showing:
- Real-time telemetry cards (speed, fuel, engine temp, heading)
- Historical speed/fuel/temp chart (last 200 records)
- Vehicle info and last known coordinates
- Device token for connecting a GPS device

---

### Alerts

All triggered alerts appear here. You can filter by:
- **Status** — ACTIVE, ACKNOWLEDGED, RESOLVED
- **Severity** — CRITICAL, HIGH, MEDIUM, LOW, INFO

**Acknowledge** an alert (yellow tick icon) to mark it as seen.
**Resolve** an alert (X icon) to mark it as closed.

New alerts arrive in real time via WebSocket and also pop up as toast notifications.

---

### Drivers

Shows all registered drivers as cards. Each card shows:
- Name, email, licence number and expiry
- Assigned vehicle (if any)

**Add Driver** — creates a new user with the DRIVER role and a linked driver profile.

**Assign Vehicle** — click the **Assign Vehicle** button on a driver card to link/change their assigned vehicle. Only one driver can be assigned to a vehicle at a time.

---

### Geofences

Create virtual boundaries on the map to generate entry/exit alerts.

**Add Geofence**:
1. Click **Add Geofence**
2. Enter a name and optionally a description
3. Paste a JSON array of `[lat, lng]` coordinate pairs forming a closed polygon:
   ```json
   [[-1.28, 36.81], [-1.29, 36.82], [-1.28, 36.83], [-1.28, 36.81]]
   ```
4. Choose whether to alert on Entry, Exit, or both
5. Click **Create Zone**

The toggle switch enables/disables each geofence without deleting it.

---

### Reports

Select a date range and view:
- **Alerts by Type** — bar chart grouped by severity
- **Vehicle Activity** — telemetry record counts and max speed per vehicle

---

### Users

Manage platform users (ADMIN role required):
- Create users with roles: ADMIN, FLEET_MANAGER, DRIVER, VIEWER
- Edit name, email, role, password
- Role badges are colour-coded

---

### Settings

- View **organization details**
- Manage **alert rules** — the conditions that automatically trigger alerts:
  - SPEEDING — triggers when speed exceeds a threshold (km/h)
  - LOW_FUEL — triggers when fuel drops below a percentage
  - ENGINE_OVERHEAT — triggers when engine temp exceeds a threshold (°C)
  - BATTERY_LOW — triggers when battery voltage falls below a threshold (V)

**Add Rule** — name it, choose type, severity, and enter the threshold value.

---

### Profile

View and update your personal information, and change your password.

---

## API Reference

Base URL: `http://localhost:4000/api/v1`

### Authentication

| Method | Endpoint                  | Description                    | Auth |
|--------|---------------------------|--------------------------------|------|
| POST   | `/auth/login`             | Login, returns access + refresh token | No |
| POST   | `/auth/refresh`           | Exchange refresh token for new access token | No |
| POST   | `/auth/logout`            | Invalidate refresh token       | No |
| GET    | `/auth/me`                | Get current user profile       | Yes |
| POST   | `/auth/change-password`   | Change own password            | Yes |

**Login example:**
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@artic.io","password":"Admin1234!"}'
```

Response:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "uuid-string",
  "user": { "id": "...", "email": "admin@artic.io", "role": "SUPER_ADMIN", ... }
}
```

Include the access token in all subsequent requests:
```
Authorization: Bearer <accessToken>
```

---

### Vehicles

| Method | Endpoint                           | Description                 |
|--------|------------------------------------|-----------------------------|
| GET    | `/vehicles`                        | List vehicles (paginated)   |
| GET    | `/vehicles/:id`                    | Get vehicle details         |
| POST   | `/vehicles`                        | Create vehicle              |
| PUT    | `/vehicles/:id`                    | Update vehicle              |
| DELETE | `/vehicles/:id`                    | Delete vehicle              |
| POST   | `/vehicles/:id/regenerate-token`   | Regenerate device token     |

Query params for list: `?search=&status=&fleetId=&page=1&limit=20`

---

### Telemetry

| Method | Endpoint                          | Description                            |
|--------|-----------------------------------|----------------------------------------|
| POST   | `/telemetry/ingest/:token`        | Submit telemetry (device auth by token, no JWT needed) |
| GET    | `/telemetry/locations`            | Get latest location for all fleet vehicles |
| GET    | `/telemetry/:vehicleId`           | Get telemetry history                  |
| GET    | `/telemetry/:vehicleId/latest`    | Get most recent telemetry record       |

**Device telemetry submission:**
```bash
curl -X POST http://localhost:4000/api/v1/telemetry/ingest/<deviceToken> \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": -1.286389,
    "longitude": 36.817223,
    "speed": 55.2,
    "heading": 180,
    "fuelLevel": 68.5,
    "engineTemp": 88,
    "engineOn": true,
    "rpm": 2100,
    "batteryVoltage": 13.8
  }'
```

---

### Alerts

| Method | Endpoint                      | Description                     |
|--------|-------------------------------|---------------------------------|
| GET    | `/alerts`                     | List alerts (filterable)        |
| PATCH  | `/alerts/:id/acknowledge`     | Acknowledge an alert            |
| PATCH  | `/alerts/:id/resolve`         | Resolve an alert                |
| GET    | `/alerts/rules`               | List alert rules                |
| POST   | `/alerts/rules`               | Create alert rule               |
| DELETE | `/alerts/rules/:id`           | Delete alert rule               |

---

### Fleets

| Method | Endpoint        | Description       |
|--------|-----------------|-------------------|
| GET    | `/fleets`       | List fleets       |
| POST   | `/fleets`       | Create fleet      |
| PUT    | `/fleets/:id`   | Update fleet      |
| DELETE | `/fleets/:id`   | Delete fleet      |

---

### Drivers

| Method | Endpoint                    | Description               |
|--------|-----------------------------|---------------------------|
| GET    | `/drivers`                  | List drivers              |
| POST   | `/drivers`                  | Create driver             |
| PATCH  | `/drivers/:id/assign`       | Assign/unassign vehicle   |
| GET    | `/drivers/:id/activity`     | Get driver telemetry stats |

---

### Geofences

| Method | Endpoint                    | Description                  |
|--------|-----------------------------|------------------------------|
| GET    | `/geofences`                | List geofences               |
| POST   | `/geofences`                | Create geofence              |
| PUT    | `/geofences/:id`            | Update geofence              |
| DELETE | `/geofences/:id`            | Delete geofence              |
| GET    | `/geofences/:id/events`     | Get entry/exit event log     |

---

### Dashboard & Reports

| Method | Endpoint                     | Description                  |
|--------|------------------------------|------------------------------|
| GET    | `/dashboard/stats`           | Summary stats for overview   |
| GET    | `/reports/trips`             | Vehicle activity report      |
| GET    | `/reports/alerts-summary`    | Alerts grouped by type/severity |

---

## Vehicle Simulator

The simulator connects multiple virtual vehicles to the MQTT broker and streams telemetry every 5 seconds. Useful for testing the live map and alert rules without physical devices.

```bash
cd backend
npm run simulate
```

Requirements:
- Backend must be running (`npm run dev`)
- Database must be seeded (`npm run seed`)
- At least one vehicle must exist in the database

The simulator reads vehicles from the database, connects each using its `deviceToken`, and publishes telemetry to `artic/<vehicleId>/telemetry`.

---

## MQTT Device Integration

Real GPS devices connect to the MQTT broker at `mqtt://localhost:1883`.

**Authentication:** Use the vehicle's `deviceToken` as both the MQTT username and password. Find it in the Vehicle Detail page (Settings → copy token) or via `GET /vehicles/:id`.

**Topic format:**
```
artic/<vehicleId>/telemetry
```

**Payload (JSON):**
```json
{
  "latitude":     -1.286389,
  "longitude":    36.817223,
  "altitude":     1670.0,
  "speed":        55.2,
  "heading":      180.0,
  "fuelLevel":    68.5,
  "engineTemp":   88.0,
  "engineOn":     true,
  "rpm":          2100,
  "odometer":     12345.6,
  "batteryVoltage": 13.8,
  "ignition":     true
}
```

All fields are optional — send only the ones your device supports. The backend will process and store whatever is provided.

**Regenerating a device token:** Go to Vehicle Details and use the "Regenerate Token" button (Admin only). The old token immediately becomes invalid.

---

## WebSocket Events

The frontend connects to Socket.IO at `ws://localhost:4000` with a JWT Bearer token. After connecting, the server automatically joins the client to their organization room.

### Events Emitted by Server

| Event               | Payload                                     | Description                          |
|---------------------|---------------------------------------------|--------------------------------------|
| `telemetry:update`  | `{ vehicleId, data, timestamp }`            | New telemetry received from a vehicle |
| `alert:new`         | Alert object with vehicle info              | A new alert was triggered            |

### Events Sent by Client

| Event                 | Payload         | Description                         |
|-----------------------|-----------------|-------------------------------------|
| `subscribe:vehicle`   | `vehicleId`     | Join a specific vehicle's room      |
| `unsubscribe:vehicle` | `vehicleId`     | Leave a vehicle room                |

---

## User Roles & Permissions

| Role           | Capabilities                                                         |
|----------------|----------------------------------------------------------------------|
| SUPER_ADMIN    | Full access to everything including user management and org settings |
| ADMIN          | Manage vehicles, drivers, fleets, users within the organization      |
| FLEET_MANAGER  | Create/edit vehicles, drivers, fleets, alert rules                   |
| DRIVER         | View-only access to their own vehicle data                           |
| VIEWER         | Read-only access to the dashboard                                    |

---

## Troubleshooting

### "Cannot connect to database"
- Make sure PostgreSQL is running: `docker-compose ps`
- Check the `DATABASE_URL` in `backend/.env` matches your setup
- Run `docker-compose up -d postgres` if using Docker

### "Redis connection error"
- Make sure Redis is running: `docker-compose ps`
- The app degrades gracefully — it will log errors but continue working

### Login page shows "Invalid credentials"
- Make sure you ran `npm run seed` in the backend directory
- Use `admin@artic.io` / `Admin1234!`

### Map not showing / blank map
- The Live Map uses OpenStreetMap tiles which require an internet connection
- Make sure `leaflet/dist/leaflet.css` is being imported (it is in `LiveMap.tsx`)
- The map component uses `dynamic` import with `ssr: false` to prevent server-side rendering issues

### Vehicles not appearing on Live Map
- Vehicles only appear on the map after receiving at least one telemetry record with GPS data
- Start the simulator: `cd backend && npm run simulate`
- Wait a few seconds and refresh the Live Map page

### Backend won't start — "prisma client not found"
```bash
cd backend
npx prisma generate
npm run dev
```

### Alerts not triggering
- Make sure alert rules are configured in **Settings → Alert Rules**
- The seed script creates 4 default rules (speeding, low fuel, overheat, battery)
- The simulator generates values that will occasionally exceed thresholds

### TypeScript errors after changing schema
```bash
cd backend
npx prisma generate
```
This regenerates the Prisma TypeScript types.

### Port already in use
Change the port in `backend/.env` (`PORT=4001`) and update `frontend/.env.local` accordingly (`NEXT_PUBLIC_API_URL=http://localhost:4001`).

---

## Production Deployment Notes

Before going to production:

1. **Change all secrets** in `docker-compose.yml` and `backend/.env`:
   - `JWT_SECRET` — use a random 64-character string
   - `JWT_REFRESH_SECRET` — use a different random 64-character string
   - PostgreSQL password

2. **Set `NODE_ENV=production`** in the backend environment

3. **Set the correct `CORS_ORIGIN`** to your actual frontend domain

4. **Use HTTPS** — configure a reverse proxy (nginx, Caddy) in front of both services

5. **Run migrations** instead of `migrate dev`:
   ```bash
   npx prisma migrate deploy
   ```

---

*ARTIC VMS — Built with Node.js, Next.js, PostgreSQL, and Socket.IO*
