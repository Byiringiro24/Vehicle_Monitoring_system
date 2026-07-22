# ARTIC VMS — REST API Documentation

**Base URL:** `http://172.209.217.176:5000/api/v1`  
**Authentication:** Bearer JWT token  
**Content-Type:** `application/json`

---

## Authentication

### Login
```
POST /auth/login
Body: { "email": "admin@artic.io", "password": "Admin1234!" }
Response: { "accessToken": "...", "refreshToken": "...", "user": {...} }
```

### Refresh Token
```
POST /auth/refresh
Body: { "refreshToken": "..." }
Response: { "accessToken": "..." }
```

### Logout
```
POST /auth/logout
Body: { "refreshToken": "..." }
```

---

## Live Fleet Tracking

### Get All Vehicle Locations (for live map)
```
GET /telemetry/locations
Auth: Required
Response: [
  {
    "vehicleId": "uuid",
    "latitude": -1.9763,
    "longitude": 30.1366,
    "speed": 0.6,
    "heading": 0,
    "engineOn": true,
    "updatedAt": "2026-07-08T14:22:00.000Z",
    "vehicle": {
      "id": "uuid",
      "name": "Truck Alpha",
      "licensePlate": "RAB 002 B",
      "status": "ACTIVE"
    }
  }
]
```

### Get GPS History for Replay
```
GET /vehicles/:id/gps-history?from=2026-07-08T08:00:00Z&to=2026-07-08T09:00:00Z&limit=3000
Auth: Required
Response: {
  "vehicle": { "id": "...", "licensePlate": "RAB 002 B" },
  "points": [
    { "latitude": -1.9763, "longitude": 30.1366, "speed": 12.3, "timestamp": "..." }
  ],
  "count": 1800
}
```

### Get Latest Telemetry for a Vehicle
```
GET /telemetry/:vehicleId/latest
Auth: Required
Response: {
  "id": "...", "vehicleId": "...", "latitude": -1.9763, "longitude": 30.1366,
  "speed": 0, "engineOn": true, "fuelLevel": null, "timestamp": "..."
}
```

### Get Telemetry History with Date Range
```
GET /telemetry/:vehicleId?from=2026-07-08&to=2026-07-09&limit=1000
Auth: Required
Response: { "data": [...telemetry records], "from": "...", "to": "..." }
```

### Delete Telemetry (by date range)
```
DELETE /telemetry/:vehicleId?from=2026-07-01&to=2026-07-07
Auth: Required (Admin only)
Response: { "telemetryDeleted": 500, "gpsDeleted": 500, "message": "..." }
```

---

## Vehicles

### List Vehicles
```
GET /vehicles?search=RAB&status=ACTIVE&fleetId=uuid&page=1&limit=20
Auth: Required
Response: {
  "data": [{ "id": "...", "licensePlate": "...", "status": "ACTIVE", "lastLocation": {...} }],
  "pagination": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
}
```

### Get Single Vehicle
```
GET /vehicles/:id
Auth: Required
Response: { ...full vehicle object with lastLocation, fleet, gpsDevice, currentDriver }
```

### Create Vehicle
```
POST /vehicles
Auth: Required (Admin/Fleet Manager)
Body: { "name": "Truck Alpha", "licensePlate": "RAB 001 A", "manufacturer": "Toyota", "model": "Hilux", "year": 2024 }
Response: { ...vehicle with deviceToken }
```

### Update Vehicle
```
PUT /vehicles/:id
Auth: Required (Admin/Fleet Manager)
Body: { any vehicle fields to update }
Response: { ...updated vehicle }
```

### Lock / Unlock Engine
```
PATCH /vehicles/:id/lock
Auth: Required (Admin/Fleet Manager)
Body: { "locked": true }   // true = lock, false = unlock
Response: { "vehicleId": "...", "engineLocked": true, "message": "Engine lock command sent" }
```

### Ping GPS Module
```
POST /vehicles/:id/gps-ping
Auth: Required
Response: { "gpsOnline": true, "checkedAt": "...", "message": "GPS module is online" }
```

### Get GPS History
```
GET /vehicles/:vehicleId/gps-history?from=2026-07-08T14:00:00Z&to=2026-07-08T15:00:00Z
Auth: Required
Response: { "points": [...], "count": 360 }
```

### Regenerate Device Token
```
POST /vehicles/:id/regenerate-token
Auth: Required (Admin only)
Response: { "deviceToken": "new-uuid-here" }
```

---

## Device Remote Commands

### Send Command to GPS Device
```
POST /devices/:vehicleId/command
Auth: Required (Admin/Fleet Manager)
Body: { "command": "ping" }
       { "command": "check_internet" }
       { "command": "restart" }
       { "command": "lock" }
       { "command": "unlock" }
       { "command": "ussd", "code": "*175#" }

Response: { "sent": true, "command": "check_internet", "topic": "artic/.../command" }
Note: Response from device arrives via MQTT → telemetry topic (subscribe via Socket.IO)
```

### Update SIM Card Number (with verification)
```
PATCH /devices/:vehicleId/sim
Auth: Required
Body: { "simNumber": "+250780123456" }
Response: {
  "success": true,
  "simNumber": "+250780123456",
  "verified": true,
  "message": "✅ SIM number verified! Matches the SIM reported by the GPS device."
}
Note: verified=true only if ESP32 has already reported the same number in telemetry
```

### Record Data Plan Purchase
```
PATCH /devices/:vehicleId/data-plan
Auth: Required
Body: {
  "dataPlanType": "MONTHLY",
  "dataPlanBoughtAt": "2026-07-08T10:00:00Z",
  "dataPlanExpiry":   "2026-08-08T10:00:00Z"
}
Response: { "dataPlanType": "MONTHLY", "dataPlanExpiry": "...", "message": "MONTHLY data plan recorded" }
Alert thresholds: MONTHLY=3 days | WEEKLY=1 day | DAILY=3 hours before expiry
```

---

## Alerts

### List Alerts
```
GET /alerts?status=ACTIVE&page=1&limit=20
Auth: Required
Response: { "data": [...alerts], "pagination": {...} }
```

### Acknowledge Alert
```
PATCH /alerts/:id/acknowledge
Auth: Required
```

### Resolve Alert
```
PATCH /alerts/:id/resolve
Auth: Required
```

---

## Geofences

### List Geofences
```
GET /geofences
Auth: Required
Response: [{ "id": "...", "name": "Kigali Centre", "vehicleIds": ["uuid1"], "isActive": true }]
```

### Create Geofence
```
POST /geofences
Auth: Required
Body: {
  "name": "Warehouse Zone",
  "coordinates": [[-1.94, 30.06], [-1.95, 30.07], [-1.94, 30.08], [-1.94, 30.06]],
  "type": "polygon",
  "alertOnEntry": true,
  "alertOnExit": true,
  "vehicleIds": ["uuid1", "uuid2"],
  "color": "#EF4444"
}
```

### Assign Vehicles to Geofence
```
PATCH /geofences/:id/vehicles
Body: { "vehicleIds": ["uuid1", "uuid2"] }   // [] = all vehicles
```

---

## Reports

### Daily Payment Report (spreadsheet format)
```
GET /reports/daily-payments?month=7&year=2026
Auth: Required
Response: {
  "month": 7, "year": 2026, "daysInMonth": 31,
  "vehicles": [{ "id": "...", "plate": "RAB 001 A", "name": "Truck Alpha" }],
  "grid": { "2026-07-01": { "vehicleId": 7000 }, ... },
  "totals": { "vehicleId": 49000 },
  "grandTotal": 175000
}
```

### GPS Activity Summary
```
GET /reports/trips?from=2026-07-01&to=2026-07-07
Auth: Required
```

### Alerts Summary
```
GET /reports/alerts-summary?from=2026-07-01&to=2026-07-07
Auth: Required
```

---

## Socket.IO Real-Time Events

Connect: `ws://172.209.217.176:5000`  
Auth: `{ auth: { token: "Bearer ..." } }`

### Events you receive:
```javascript
socket.on('location:update', (data) => {
  // Vehicle position updated (every 2s when GPS online)
  // { vehicleId, latitude, longitude, speed, heading, updatedAt, vehicle }
})

socket.on('device:heartbeat', (data) => {
  // Device is online but may have no GPS fix
  // { vehicleId, updatedAt, engineOn, engineLocked, gpsModuleOn }
})

socket.on('gps:online', (data) => {
  // GPS device connected to MQTT broker
  // { vehicleId, licensePlate, timestamp }
})

socket.on('gps:offline', (data) => {
  // GPS device disconnected
  // { vehicleId, licensePlate, timestamp }
})

socket.on('telemetry:update', (data) => {
  // Raw telemetry for charts
  // { vehicleId, data: {...}, timestamp }
})

socket.on('vehicle:lock', (data) => {
  // Engine lock state changed from dashboard
  // { vehicleId, locked, triggeredBy, timestamp }
})

socket.on('alert:new', (data) => {
  // New alert triggered
  // { title, message, severity, vehicle }
})

socket.on('vehicles:offline', (data) => {
  // Backend detected stale vehicles
  // { vehicleIds: [...], timestamp }
})
```

### Subscribe to a specific vehicle room:
```javascript
socket.emit('subscribe:vehicle', vehicleId)
socket.emit('unsubscribe:vehicle', vehicleId)
```

---

## Integration Example — React Live Map

```javascript
import { io } from 'socket.io-client';

// 1. Login
const { accessToken } = await fetch('/api/v1/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
}).then(r => r.json());

// 2. Get initial locations
const locations = await fetch('/api/v1/telemetry/locations', {
  headers: { Authorization: `Bearer ${accessToken}` }
}).then(r => r.json());

// 3. Connect Socket.IO for live updates
const socket = io('ws://172.209.217.176:5000', {
  auth: { token: accessToken }
});

const markers = {};

// Seed from REST
locations.forEach(loc => {
  markers[loc.vehicleId] = { lat: loc.latitude, lng: loc.longitude };
  drawMarker(loc.vehicleId, loc.latitude, loc.longitude);
});

// Update on new GPS packet
socket.on('location:update', ({ vehicleId, latitude, longitude, speed }) => {
  if (markers[vehicleId]) {
    moveMarker(vehicleId, latitude, longitude); // smooth move
  } else {
    drawMarker(vehicleId, latitude, longitude); // new marker
  }
  markers[vehicleId] = { lat: latitude, lng: longitude, speed };
});

// Handle device going offline
socket.on('gps:offline', ({ vehicleId }) => {
  greyOutMarker(vehicleId);
});
```

---

## MQTT Topic Reference (for direct ESP32 integration)

| Topic | Direction | Payload |
|---|---|---|
| `artic/<TOKEN>/telemetry` | ESP32 → Server | GPS + engine data JSON |
| `artic/<TOKEN>/command` | Server → ESP32 | `{"command":"lock"}` etc |
| `artic/<TOKEN>/ping` | Server → ESP32 | `{"ts":123456}` |
| `artic/<TOKEN>/pong` | ESP32 → Server | `{"pong":true,"simNumber":"..."}` |

**Where `<TOKEN>` is the vehicle's deviceToken (UUID from dashboard).**

Broker: `mqtt://172.209.217.176:1883`  
Auth: username = deviceToken, password = deviceToken

---

*ARTIC VMS API v1 — July 2026*
