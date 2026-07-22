# ESP32 + SIM808 — ARTIC VMS Device Integration Guide

**Project:** ARTIC Vehicle Monitoring System
**Hardware:** ESP32 + SIM808 GSM/GPRS/GPS module
**Protocol:** MQTT over GPRS → ARTIC VMS Backend
**Date:** July 2026

---

## TABLE OF CONTENTS

1. Hardware Overview
2. How the Device Communicates with ARTIC VMS
3. Complete ESP32 Arduino Code
4. Wiring Diagram
5. How to Get a Vehicle DeviceToken
6. Testing the Connection
7. What the Live Map Shows
8. Vehicle Types Supported
9. GPS Online/Offline Detection
10. Troubleshooting

---

## 1. HARDWARE OVERVIEW

The ESP32 microcontroller connects to a SIM808 module which provides:
- GSM/GPRS: internet connectivity over a mobile SIM card
- GPS: latitude, longitude, speed, altitude, satellite count

The ESP32 reads GPS data from the SIM808 via AT commands over UART2 (pins 16/17).
It then publishes this data to your ARTIC VMS backend over MQTT using the GPRS
internet connection.

Required hardware:
- ESP32 development board (any variant with 2 UART ports)
- SIM808 or SIM800L + GPS module (or SIM7600 for 4G)
- Active SIM card with GPRS data plan (MTN Rwanda, Airtel Rwanda, etc.)
- 12V relay module (for engine cut-off — optional)
- 4.2V LiPo battery + charging circuit for backup power
- Antenna: GSM antenna + GPS active antenna

APN settings (Rwanda):
- MTN Rwanda: APN = "internet"
- Airtel Rwanda: APN = "airtelgprs.com"

---

## 2. HOW THE DEVICE COMMUNICATES WITH ARTIC VMS

The device authenticates using the vehicle's unique deviceToken.
This token is found in the ARTIC VMS dashboard under:
Vehicle Detail page → Device Token field

Connection flow:
1. ESP32 powers on → initialises SIM808 via AT commands
2. SIM808 connects to GSM network and registers on the APN
3. GPRS data session opened (internet access via SIM card)
4. ESP32 connects to your ARTIC VMS MQTT broker (port 1883)
   - Server: your backend hostname or IP
   - Username: deviceToken
   - Password: deviceToken
   - ClientId: any unique string (e.g. "ESP32_<vehicleId>")
5. ESP32 **subscribes** to:
   - `artic/<DEVICE_TOKEN>/ping`    — backend sends ping to check if GPS is online
   - `artic/<DEVICE_TOKEN>/command` — lock/unlock engine commands
6. GPS fix acquired (can take 30-90 seconds cold start)
7. Every 15 seconds:
   a. Read GPS coordinates, speed, altitude
   b. Build JSON payload
   c. Publish to topic: `artic/<DEVICE_TOKEN>/telemetry`
8. When ping arrives on `/ping` topic:
   - ESP32 immediately replies on `artic/<DEVICE_TOKEN>/pong`
   - Backend resolves the ping as "online" and shows GPS status = Online

---

## 3. COMPLETE ESP32 ARDUINO CODE

Save this as `artic_vms_device.ino` in Arduino IDE.
Install libraries: TinyGSM, PubSubClient (via Library Manager)

```cpp
/*
 * ARTIC VMS — ESP32 + SIM808 GPS Tracker
 * v2.0 — GPS online/offline detection + engine lock/unlock
 *
 * Topics:
 *   PUBLISH:   artic/<TOKEN>/telemetry  — GPS + engine data (every 15s)
 *   PUBLISH:   artic/<TOKEN>/pong       — response to backend ping
 *   SUBSCRIBE: artic/<TOKEN>/ping       — backend checks if device is online
 *   SUBSCRIBE: artic/<TOKEN>/command    — lock/unlock engine relay
 *
 * Wiring:
 *   ESP32 GPIO16 (RX2) → SIM808 TX
 *   ESP32 GPIO17 (TX2) → SIM808 RX
 *   ESP32 GPIO5        → Relay IN (HIGH = cut engine, LOW = allow engine)
 *   ESP32 3.3V/5V      → SIM808 VCC (use dedicated supply — SIM808 draws 2A!)
 *   ESP32 GND          → SIM808 GND
 */

#define TINY_GSM_MODEM_SIM808
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>    // Install from Library Manager: "ArduinoJson" by Benoit Blanchon

// ─── Pin Configuration ────────────────────────────────────────────────────────
#define RXD2        16          // ESP32 RX2 ← SIM808 TX
#define TXD2        17          // ESP32 TX2 → SIM808 RX
#define RELAY_PIN    5          // Engine cut-off relay (HIGH = lock, LOW = allow)
                                // Set to -1 if you don't have a relay

// ─── Network Configuration ────────────────────────────────────────────────────
const char APN[]      = "internet";   // MTN Rwanda
// const char APN[]   = "airtelgprs.com";  // Airtel Rwanda
const char APN_USER[] = "";
const char APN_PASS[] = "";

// ─── ARTIC VMS Backend ────────────────────────────────────────────────────────
// Replace with your actual server IP or hostname
// Examples:
//   Same LAN (dev):     "192.168.1.100"
//   Public server:      "fleet.yourcompany.com"
//   ngrok tunnel:       "0.tcp.ngrok.io"  (set MQTT_PORT to ngrok port)
const char MQTT_HOST[] = "YOUR_SERVER_HOST";  // ← CHANGE THIS
const int  MQTT_PORT   = 1883;

// ─── Vehicle Identity ─────────────────────────────────────────────────────────
// Get from ARTIC VMS → Vehicles → [vehicle] → Device Token
// IMPORTANT: Each vehicle has a UNIQUE token — never share tokens
const char DEVICE_TOKEN[] = "PASTE_YOUR_DEVICE_TOKEN_HERE";  // ← CHANGE THIS

// Vehicle metadata
const char VEHICLE_TYPE[] = "CAR";      // CAR, MOTORCYCLE, TRUCK, VAN, BUS, PICKUP
const char FUEL_TYPE[]    = "PETROL";   // PETROL, DIESEL, ELECTRIC, HYBRID

// ─── Timing ───────────────────────────────────────────────────────────────────
const unsigned long TELEMETRY_INTERVAL_MS = 15000;  // 15s between GPS publishes
const unsigned long RECONNECT_INTERVAL_MS = 5000;   // retry MQTT every 5s

// ─── MQTT Topics (derived from deviceToken) ───────────────────────────────────
// These are set in setup() after DEVICE_TOKEN is known
char TOPIC_TELEMETRY[128];  // artic/<TOKEN>/telemetry  — we publish here
char TOPIC_PONG[128];       // artic/<TOKEN>/pong        — we publish ping replies
char TOPIC_PING[128];       // artic/<TOKEN>/ping        — we subscribe (backend pings us)
char TOPIC_COMMAND[128];    // artic/<TOKEN>/command     — we subscribe (lock/unlock)

// ─── Globals ─────────────────────────────────────────────────────────────────
HardwareSerial SerialAT(2);
TinyGsm        modem(SerialAT);
TinyGsmClient  gsm(modem);
PubSubClient   mqtt(gsm);

unsigned long lastTelemetryAt = 0;
unsigned long lastReconnectAt = 0;
bool          engineLocked    = false;  // current relay state
float         lastLat = 0, lastLon = 0;

// ─── MQTT Callback — receive commands + ping ──────────────────────────────────
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String topicStr  = String(topic);
  String payloadStr = String((char*)payload, length);

  Serial.print("[MQTT] Received on ");
  Serial.print(topicStr);
  Serial.print(": ");
  Serial.println(payloadStr);

  // ── Handle ping → respond with pong ─────────────────────────────────────
  if (topicStr == String(TOPIC_PING)) {
    Serial.println("[GPS] Ping received — sending pong");
    String pong = "{\"pong\":true,\"ts\":" + String(millis()) + "}";
    mqtt.publish(TOPIC_PONG, pong.c_str(), false);
    return;
  }

  // ── Handle lock/unlock command ────────────────────────────────────────────
  if (topicStr == String(TOPIC_COMMAND)) {
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, payloadStr);
    if (err) {
      Serial.println("[CMD] Invalid JSON");
      return;
    }
    const char* command = doc["command"];
    if (!command) return;

    if (String(command) == "lock") {
      engineLocked = true;
      if (RELAY_PIN > 0) {
        digitalWrite(RELAY_PIN, HIGH);  // Energise relay = cut engine
        Serial.println("[RELAY] Engine LOCKED 🔒");
      }
      // Acknowledge command
      String ack = "{\"ack\":\"lock\",\"engineLocked\":true}";
      mqtt.publish(TOPIC_TELEMETRY, ack.c_str(), false);

    } else if (String(command) == "unlock") {
      engineLocked = false;
      if (RELAY_PIN > 0) {
        digitalWrite(RELAY_PIN, LOW);   // De-energise relay = allow engine
        Serial.println("[RELAY] Engine UNLOCKED 🔓");
      }
      String ack = "{\"ack\":\"unlock\",\"engineLocked\":false}";
      mqtt.publish(TOPIC_TELEMETRY, ack.c_str(), false);
    }
    return;
  }
}

// ─── Build & Publish GPS Telemetry ────────────────────────────────────────────
void publishGPS() {
  if (millis() - lastTelemetryAt < TELEMETRY_INTERVAL_MS) return;
  lastTelemetryAt = millis();

  float lat = 0, lon = 0, spd = 0, alt = 0, acc = 0;
  int   vsat = 0, usat = 0;
  bool  fix = modem.getGPS(&lat, &lon, &spd, &alt, &vsat, &usat, &acc);

  StaticJsonDocument<512> doc;
  doc["online"]      = true;
  doc["vehicleType"] = VEHICLE_TYPE;
  doc["fuelType"]    = FUEL_TYPE;
  doc["engineOn"]    = !engineLocked;   // if relay is cut, engine is effectively OFF
  doc["engineLocked"] = engineLocked;

  if (fix && lat != 0.0f && lon != 0.0f) {
    lastLat = lat; lastLon = lon;
    doc["latitude"]   = serialized(String(lat, 6));
    doc["longitude"]  = serialized(String(lon, 6));
    doc["speed"]      = serialized(String(spd, 2));
    doc["altitude"]   = serialized(String(alt, 2));
    doc["accuracy"]   = serialized(String(acc, 2));
    doc["satellites"] = usat;
    Serial.printf("[GPS] Fix: %.6f, %.6f  Speed: %.1f km/h  Sats: %d\n",
                  lat, lon, spd, usat);
  } else {
    Serial.println("[GPS] No fix yet — sending online-only ping");
    doc["noFix"] = true;
  }

  // Optional: battery voltage via ADC (uncomment if wired)
  // float vbat = analogRead(34) * (3.3f / 4095.0f) * (12.0f / 3.3f);
  // doc["batteryVoltage"] = serialized(String(vbat, 2));

  String json;
  serializeJson(doc, json);
  Serial.print("[MQTT] Publishing telemetry: ");
  Serial.println(json);

  bool ok = mqtt.publish(TOPIC_TELEMETRY, json.c_str(), false);
  Serial.println(ok ? "[MQTT] Published OK" : "[MQTT] Publish FAILED");
}

// ─── MQTT Connect ─────────────────────────────────────────────────────────────
bool connectMQTT() {
  Serial.printf("[MQTT] Connecting to %s:%d ...", MQTT_HOST, MQTT_PORT);
  String clientId = "ESP32_" + String(DEVICE_TOKEN).substring(0, 8);

  bool ok = mqtt.connect(clientId.c_str(), DEVICE_TOKEN, DEVICE_TOKEN);
  if (ok) {
    Serial.println(" CONNECTED");

    // Subscribe to ping and command topics
    mqtt.subscribe(TOPIC_PING,    1);
    mqtt.subscribe(TOPIC_COMMAND, 1);
    Serial.println("[MQTT] Subscribed to ping + command topics");

    // Announce online
    mqtt.publish(TOPIC_TELEMETRY,
      "{\"online\":true,\"event\":\"device_connected\"}", false);
  } else {
    Serial.printf(" FAILED rc=%d\n", mqtt.state());
    // rc=5 means bad credentials — check your DEVICE_TOKEN
  }
  return ok;
}

// ─── GPRS Connect ─────────────────────────────────────────────────────────────
bool connectGPRS() {
  Serial.println("[GPRS] Connecting...");
  if (modem.gprsConnect(APN, APN_USER, APN_PASS)) {
    Serial.print("[GPRS] Connected. IP: ");
    Serial.println(modem.localIP().toString());
    return true;
  }
  Serial.println("[GPRS] FAILED");
  return false;
}

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);

  // Build topic strings from device token
  snprintf(TOPIC_TELEMETRY, sizeof(TOPIC_TELEMETRY), "artic/%s/telemetry", DEVICE_TOKEN);
  snprintf(TOPIC_PONG,      sizeof(TOPIC_PONG),      "artic/%s/pong",      DEVICE_TOKEN);
  snprintf(TOPIC_PING,      sizeof(TOPIC_PING),      "artic/%s/ping",      DEVICE_TOKEN);
  snprintf(TOPIC_COMMAND,   sizeof(TOPIC_COMMAND),   "artic/%s/command",   DEVICE_TOKEN);

  // Relay pin setup — starts unlocked
  if (RELAY_PIN > 0) {
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);  // LOW = relay off = engine allowed
  }

  Serial.println("=============================");
  Serial.println("  ARTIC VMS GPS Tracker v2.0");
  Serial.print  ("  Vehicle Type: "); Serial.println(VEHICLE_TYPE);
  Serial.print  ("  Fuel Type:    "); Serial.println(FUEL_TYPE);
  Serial.print  ("  Server:       "); Serial.println(MQTT_HOST);
  Serial.print  ("  Telemetry:    "); Serial.println(TOPIC_TELEMETRY);
  Serial.println("=============================");

  SerialAT.begin(9600, SERIAL_8N1, RXD2, TXD2);
  delay(2000);

  Serial.println("[MODEM] Restarting SIM808...");
  modem.restart();
  delay(3000);

  Serial.print("[MODEM] Info: ");
  Serial.println(modem.getModemInfo());
  Serial.print("[MODEM] Signal: ");
  Serial.println(modem.getSignalQuality());  // >10 usable, >20 good, >30 excellent

  Serial.println("[GPS] Enabling GPS...");
  modem.enableGPS();

  while (!connectGPRS()) {
    Serial.println("[GPRS] Retrying in 5s...");
    delay(5000);
  }

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setKeepAlive(60);
  mqtt.setSocketTimeout(30);
  connectMQTT();
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
  // Reconnect GPRS if lost
  if (!modem.isGprsConnected()) {
    Serial.println("[GPRS] Lost — reconnecting...");
    modem.gprsDisconnect();
    delay(2000);
    connectGPRS();
  }

  // Reconnect MQTT if lost
  if (!mqtt.connected()) {
    unsigned long now = millis();
    if (now - lastReconnectAt > RECONNECT_INTERVAL_MS) {
      lastReconnectAt = now;
      connectMQTT();
    }
  } else {
    mqtt.loop();  // Process incoming messages (ping/command)
  }

  // Publish GPS telemetry every 15 seconds
  publishGPS();
}
```

---

## 4. WIRING DIAGRAM

```
ESP32 Pin    Direction   SIM808 Pin    Purpose
──────────────────────────────────────────────────────
GPIO16 (RX2)  ←────────  TX            Receive from SIM808
GPIO17 (TX2)  ─────────►  RX            Send to SIM808
GPIO5         ─────────►  Relay IN      Engine cut-off relay
GND           ─────────►  GND           Common ground
External 4.2V ─────────►  VCC           SIM808 power (2A peak!)

⚠ WARNING: SIM808 draws up to 2A during GSM transmission.
Use a dedicated LiPo 18650 cell with TP4056 charger.
Do NOT power from ESP32 3.3V pin — it can only source ~500mA.

Relay wiring:
  Relay COM → Battery positive
  Relay NO  → Engine ignition line (normally connected = engine allowed)
  When GPIO5 HIGH → relay energised → connection broken → engine cut
  When GPIO5 LOW  → relay de-energised → engine allowed
```

---

## 5. HOW TO GET A VEHICLE DEVICE TOKEN

1. Log in to ARTIC VMS dashboard
2. Navigate to **Vehicles** in the sidebar
3. Click the 👁 (view) icon on the vehicle row
4. On the **Vehicle Detail** page, find the **Device Token** section
5. Click **Copy** to copy the full token
6. Paste into `DEVICE_TOKEN` in the Arduino code

To regenerate a token (if device is lost/stolen):
- Vehicle Detail → click **Regenerate Token**
- The old token immediately stops working
- Flash the new token to the replacement device

---

## 6. TESTING THE CONNECTION

With Arduino Serial Monitor open at **115200 baud**, you should see:

```
=============================
  ARTIC VMS GPS Tracker v2.0
  Vehicle Type: CAR
  Fuel Type:    PETROL
  Server:       fleet.yourcompany.com
  Telemetry:    artic/a1b2c3d4.../telemetry
=============================
[MODEM] Restarting SIM808...
[MODEM] Info: SIM808 R14.18
[MODEM] Signal: 22
[GPS] Enabling GPS...
[GPRS] Connecting...
[GPRS] Connected. IP: 100.115.92.13
[MQTT] Connecting to fleet.yourcompany.com:1883... CONNECTED
[MQTT] Subscribed to ping + command topics
[GPS] No fix yet — sending online-only ping
[MQTT] Published OK
...
[GPS] Fix: -1.286389, 36.817223  Speed: 0.0 km/h  Sats: 6
[MQTT] Published OK
```

When the backend pings the device:
```
[MQTT] Received on artic/.../ping: {"ts":1720000000000}
[GPS] Ping received — sending pong
```

On the ARTIC VMS dashboard:
- Vehicle status changes from OFFLINE → IDLE (engine on, speed = 0)
- The Live Map shows the vehicle pin at GPS coordinates
- **GPS Module Status** badge shows "GPS Online" in real time

---

## 7. WHAT THE LIVE MAP SHOWS

Vehicle pin colours on the live map:
- **GREEN**  = ACTIVE (speed > 2 km/h, engine on)
- **YELLOW** = IDLE   (speed ≤ 2 km/h, engine on)
- **GREY**   = OFFLINE (no telemetry in last 2 minutes)

Only vehicles that have reported GPS coordinates appear as pins.
Vehicles without a GPS fix are listed in the sidebar but not shown on the map.

The **GPS Module Status** on the Vehicle Detail page shows whether the
physical GPS device is connected via MQTT right now — this is separate from
whether the vehicle has GPS coordinates. A device can be connected but
waiting for a satellite fix.

Use **Ping GPS** on the Vehicle Detail page to actively check if the
device will respond within 8 seconds.

---

## 8. VEHICLE TYPES SUPPORTED

| VEHICLE_TYPE | Description                                |
|--------------|--------------------------------------------|
| CAR          | Passenger car (Toyota, Subaru, Mercedes…) |
| MOTORCYCLE   | Moto-taxi (common in Rwanda)               |
| TRUCK        | Heavy goods vehicle                        |
| VAN          | Cargo van (Toyota Hiace, Ford Transit)     |
| BUS          | Passenger bus (Coaster, Rosa, full coach)  |
| MINIBUS      | Matatu / minibus (14–33 seats)             |
| PICKUP       | Pickup truck (Toyota Hilux)                |
| OTHER        | Any other type                             |

| FUEL_TYPE | Description                              |
|-----------|------------------------------------------|
| PETROL    | Gasoline / petrol engine                 |
| DIESEL    | Diesel engine                            |
| ELECTRIC  | Full electric vehicle (BEV)              |
| HYBRID    | Petrol + electric (Toyota Prius, etc.)   |

---

## 9. GPS ONLINE/OFFLINE DETECTION

The system uses two complementary mechanisms:

### A. MQTT Connection State (Real-time)
When the ESP32 connects to the MQTT broker, the backend receives a
`client connect` event and broadcasts `gps:online` via Socket.IO to
the dashboard. When the device disconnects, `gps:offline` is broadcast.

This is shown as a live badge on the Vehicle Detail page:
- **"GPS Connected"** (green) — MQTT session is active
- **"GPS Disconnected"** (red) — MQTT session dropped

### B. Active Ping/Pong Check (On-demand)
The Vehicle Detail page has a **Ping GPS** button. When clicked:
1. Backend publishes `{"ts": <timestamp>}` to `artic/<token>/ping`
2. ESP32 receives it and immediately publishes to `artic/<token>/pong`
3. Backend waits up to 8 seconds for the pong
4. Result shown: **GPS Online ✅** or **GPS Offline ❌**

This is more reliable than MQTT connection state because it tests the
full round-trip through GPRS to the device and back.

### C. Telemetry Timeout (Background)
Every 60 seconds, the backend checks for vehicles with status ACTIVE or
IDLE whose last telemetry is older than 3 minutes. Those are marked OFFLINE
automatically and the dashboard is notified.

---

## 10. TROUBLESHOOTING

**Problem:** `rc=5` (bad credentials) when connecting MQTT
**Solution:** Wrong DEVICE_TOKEN. Double-check the exact token from the dashboard.
             Tokens are case-sensitive UUIDs: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Problem:** GPRS connects but MQTT fails with `rc=-2`
**Solution:** MQTT_HOST is incorrect or port 1883 is blocked by firewall.
             Test: `telnet fleet.yourcompany.com 1883` from another device.
             Server fix: `sudo ufw allow 1883`

**Problem:** GPS never gets a fix
**Solution:** Move device outdoors. Cold start = 3–10 min. Warm start = 30–60 sec.
             Check that the GPS antenna is active (powered).

**Problem:** Ping GPS shows "offline" but vehicle is active
**Solution:** Check RELAY_PIN wiring. Ping requires a full MQTT round-trip.
             If the broker is Mosquitto (external), ensure the backend's
             mqttClient connects to the same broker instance.

**Problem:** Engine lock command not received by device
**Solution:** Confirm the device subscribed to `artic/<TOKEN>/command`.
             Serial Monitor should show the subscription message.
             Check QoS — commands use QoS 1 (at least once delivery).

**Problem:** "GPS Disconnected" badge even though telemetry arrives
**Solution:** The gps:online event is only sent when MQTT broker tracks the
             connection. If using an external Mosquitto broker, the backend
             cannot see connect/disconnect events — use Ping GPS instead.
