# ARTIC VMS — ESP32 + SIM808 Final Production Codes

**Version:** 2.1  
**Board:** ESP32 Dev Module  
**GPS/GPRS Module:** SIM808  
**Relay:** 1-channel, Active LOW (5V)  
**Last updated:** July 2026

---

## Important Notes Before Uploading

### Relay Logic (Active LOW)
```
GPIO26 = LOW  → Relay energised → NC contact OPEN  → Engine CUT (locked)
GPIO26 = HIGH → Relay off       → NC contact CLOSED → Engine RUNS (unlocked)
```
The relay is **active LOW**. The default state on boot is `HIGH` (engine runs).

### DEVICE_TOKEN
- Get from Dashboard → Vehicles → click your vehicle → Overview tab → Copy button
- Each vehicle has a unique token — never reuse the same token on two devices
- If you regenerate the token in the dashboard, re-upload the sketch with the new token

### Libraries Required (Arduino IDE → Manage Libraries)
| Library | Author | Minimum Version |
|---|---|---|
| TinyGSM | Volodymyr Shymanskyy | 0.12.0 |
| PubSubClient | Nick O'Leary | 2.8 |
| ArduinoJson | Benoit Blanchon | **7.x** (NOT 6.x) |

### Board Settings
- Board: **ESP32 Dev Module**
- Upload Speed: 921600
- CPU Frequency: 240MHz
- Port: whichever COM port your ESP32 is on

---

## Wiring

```
ESP32 GPIO16 (RX2) ←──── SIM808 TX
ESP32 GPIO17 (TX2) ────→ SIM808 RX
ESP32 GND          ──── SIM808 GND
                         SIM808 VCC ← 4.0–4.2V dedicated supply (min 2A)

ESP32 GPIO26       ────→ Relay IN (signal)
ESP32 5V (VIN)     ────→ Relay VCC
ESP32 GND          ──── Relay GND

Relay COM          ──── One side of ignition wire
Relay NC           ──── Other side of ignition wire
```

**Never power SIM808 from ESP32's 3.3V or 5V pins — it needs up to 2A.**

---

## The Code

```cpp
/**
 * ARTIC VMS — ESP32 + SIM808 GPS Tracker v2.1
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
 *   ESP32 GPIO26       → Relay IN  (active LOW: LOW = relay ON = engine CUT)
 *   SIM808 VCC         → 4.0–4.2V dedicated supply (NOT from ESP32)
 *   ESP32 GND          → SIM808 GND
 *
 * Relay logic (active LOW):
 *   GPIO26 LOW  = relay ON  = engine CUT  (locked)
 *   GPIO26 HIGH = relay OFF = engine RUNS (unlocked)
 */

#define TINY_GSM_MODEM_SIM808
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ─── Pin Configuration ────────────────────────────────────────────────────────
#define RXD2        16
#define TXD2        17
#define RELAY_PIN   26    // Active LOW: LOW = relay ON = engine cut

// ─── Network Configuration ────────────────────────────────────────────────────
const char APN[]      = "internet";   // Airtel / MTN Rwanda
const char APN_USER[] = "";
const char APN_PASS[] = "";

// ─── ARTIC VMS Backend ────────────────────────────────────────────────────────
const char MQTT_HOST[] = "172.209.217.176";
const int  MQTT_PORT   = 1883;

// ─── Vehicle Identity ─────────────────────────────────────────────────────────
// Get from: Dashboard → Vehicles → click vehicle → Overview → Copy button
const char DEVICE_TOKEN[] = "PASTE-YOUR-DEVICE-TOKEN-HERE";

const char VEHICLE_TYPE[] = "CAR";
const char FUEL_TYPE[]    = "PETROL";

// ─── Timing ───────────────────────────────────────────────────────────────────
const unsigned long TELEMETRY_INTERVAL_MS = 15000;  // Send GPS every 15 seconds
const unsigned long RECONNECT_INTERVAL_MS = 5000;   // Retry MQTT after 5 seconds
const unsigned long KEEPALIVE_INTERVAL_MS = 30000;  // AT ping every 30s (prevents SIM808 sleep)
const unsigned long GPS_CHECK_INTERVAL_MS = 60000;  // GPS health check every 60s

// ─── MQTT Topics (built from token in setup) ──────────────────────────────────
char TOPIC_TELEMETRY[128];
char TOPIC_PONG[128];
char TOPIC_PING[128];
char TOPIC_COMMAND[128];

// ─── Globals ──────────────────────────────────────────────────────────────────
HardwareSerial SerialAT(2);
TinyGsm        modem(SerialAT);
TinyGsmClient  gsm(modem);
PubSubClient   mqtt(gsm);

unsigned long lastTelemetryAt = 0;
unsigned long lastReconnectAt = 0;
unsigned long lastKeepAliveAt = 0;
unsigned long lastGpsCheckAt  = 0;
bool          engineLocked    = false;
bool          gpsModuleOn     = false;

// ─── AT Command Helper ────────────────────────────────────────────────────────
// Sends an AT command, returns true if the response contains `expected`
bool sendAT(const char* cmd, const char* expected, unsigned long timeoutMs = 2000) {
  while (SerialAT.available()) SerialAT.read();   // flush buffer
  SerialAT.println(cmd);
  String resp = "";
  unsigned long deadline = millis() + timeoutMs;
  while (millis() < deadline) {
    while (SerialAT.available()) resp += (char)SerialAT.read();
    if (resp.indexOf(expected) != -1) return true;
    delay(20);
  }
  return false;
}

// ─── GPS Health Check ─────────────────────────────────────────────────────────
// Asks SIM808 if GPS is powered. Restarts it if not responding.
void checkGpsModule() {
  SerialAT.println("AT+CGNSPWR?");
  String resp = "";
  unsigned long deadline = millis() + 2000;
  while (millis() < deadline) {
    while (SerialAT.available()) resp += (char)SerialAT.read();
    delay(20);
  }
  if (resp.indexOf("+CGNSPWR: 1") != -1 || resp.indexOf("+CGNSPWR:1") != -1) {
    if (!gpsModuleOn) Serial.println("[GPS] Module confirmed ON");
    gpsModuleOn = true;
  } else {
    Serial.println("[GPS] Module OFF or unresponsive — restarting...");
    gpsModuleOn = false;
    if (sendAT("AT+CGNSPWR=1", "OK", 3000)) {
      gpsModuleOn = true;
      Serial.println("[GPS] Module restarted OK");
    } else {
      Serial.println("[GPS] WARNING: Could not restart GPS module");
    }
  }
}

// ─── MQTT Message Callback ────────────────────────────────────────────────────
// Handles incoming ping requests and lock/unlock commands from the dashboard
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String topicStr   = String(topic);
  String payloadStr = String((char*)payload, length);
  Serial.printf("[MQTT <-] %s : %s\n", topic, payloadStr.c_str());

  // ── Ping → respond with pong (confirms device is online) ─────────────────
  if (topicStr == String(TOPIC_PING)) {
    Serial.println("[GPS] Ping received — sending pong");
    JsonDocument pong;
    pong["pong"]        = true;
    pong["gpsModuleOn"] = gpsModuleOn;
    pong["locked"]      = engineLocked;
    pong["ts"]          = millis();
    char buf[128];
    serializeJson(pong, buf);
    mqtt.publish(TOPIC_PONG, buf, false);
    return;
  }

  // ── Command → lock / unlock engine ───────────────────────────────────────
  if (topicStr == String(TOPIC_COMMAND)) {
    JsonDocument doc;
    if (deserializeJson(doc, payloadStr) != DeserializationError::Ok) {
      Serial.println("[CMD] Invalid JSON");
      return;
    }
    const char* command = doc["command"];
    if (!command) return;

    if (String(command) == "lock") {
      engineLocked = true;
      digitalWrite(RELAY_PIN, LOW);    // LOW = relay ON = engine CUT
      Serial.println("[RELAY] Engine LOCKED 🔒");
      JsonDocument ack;
      ack["ack"] = "lock"; ack["engineLocked"] = true;
      char buf[64]; serializeJson(ack, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);

    } else if (String(command) == "unlock") {
      engineLocked = false;
      digitalWrite(RELAY_PIN, HIGH);   // HIGH = relay OFF = engine RUNS
      Serial.println("[RELAY] Engine UNLOCKED 🔓");
      JsonDocument ack;
      ack["ack"] = "unlock"; ack["engineLocked"] = false;
      char buf[64]; serializeJson(ack, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);
    }
    return;
  }
}

// ─── Publish GPS Telemetry ────────────────────────────────────────────────────
// Reads GPS from SIM808 and sends to backend every 15 seconds.
// GPS status is independent of engine lock state.
void publishGPS() {
  if (millis() - lastTelemetryAt < TELEMETRY_INTERVAL_MS) return;
  lastTelemetryAt = millis();

  float lat = 0, lon = 0, spd = 0, alt = 0, acc = 0;
  int   vsat = 0, usat = 0;
  bool  fix  = modem.getGPS(&lat, &lon, &spd, &alt, &vsat, &usat, &acc);

  JsonDocument doc;
  doc["online"]        = true;
  doc["deviceOnline"]  = true;
  doc["vehicleType"]   = VEHICLE_TYPE;
  doc["fuelType"]      = FUEL_TYPE;
  doc["engineOn"]      = !engineLocked;
  doc["ignition"]      = !engineLocked;
  doc["engineLocked"]  = engineLocked;
  doc["gpsModuleOn"]   = gpsModuleOn;
  doc["signalQuality"] = modem.getSignalQuality();

  if (fix && lat != 0.0f && lon != 0.0f) {
    // GPS fix obtained — send coordinates
    doc["latitude"]   = serialized(String(lat, 6));
    doc["longitude"]  = serialized(String(lon, 6));
    doc["speed"]      = serialized(String(spd, 2));   // km/h
    doc["altitude"]   = serialized(String(alt, 2));   // metres
    doc["accuracy"]   = serialized(String(acc, 2));   // metres
    doc["heading"]    = nullptr;
    doc["satellites"] = usat;
    Serial.printf("[GPS] Fix: %.6f, %.6f  Speed: %.1f km/h  Sats: %d\n",
                  lat, lon, spd, usat);
  } else {
    // No GPS fix yet — send heartbeat so backend knows device is online
    doc["latitude"]  = nullptr;
    doc["longitude"] = nullptr;
    doc["speed"]     = nullptr;
    doc["altitude"]  = nullptr;
    doc["accuracy"]  = nullptr;
    doc["heading"]   = nullptr;
    doc["noFix"]     = true;
    Serial.println("[GPS] No fix yet — sending heartbeat");
  }

  // Sensors not wired — send null (backend accepts these)
  doc["fuelLevel"]       = nullptr;
  doc["fuelUsed"]        = nullptr;
  doc["engineTemp"]      = nullptr;
  doc["rpm"]             = nullptr;
  doc["batteryVoltage"]  = nullptr;
  doc["batteryLevelPct"] = nullptr;

  char json[512];
  serializeJson(doc, json);
  bool ok = mqtt.publish(TOPIC_TELEMETRY, json, false);
  Serial.printf("[MQTT] Telemetry %s\n", ok ? "OK ✓" : "FAILED ✗");
}

// ─── MQTT Connect ─────────────────────────────────────────────────────────────
bool connectMQTT() {
  Serial.printf("[MQTT] Connecting to %s:%d ...", MQTT_HOST, MQTT_PORT);
  String clientId = "ESP32_" + String(DEVICE_TOKEN).substring(0, 8);

  // Backend authenticates by matching password == vehicle.deviceToken in DB
  bool ok = mqtt.connect(clientId.c_str(), DEVICE_TOKEN, DEVICE_TOKEN);
  if (ok) {
    Serial.println(" OK ✓");
    mqtt.subscribe(TOPIC_PING,    1);   // QoS 1 = at least once
    mqtt.subscribe(TOPIC_COMMAND, 1);
    Serial.printf("[MQTT] Subscribed to:\n  %s\n  %s\n", TOPIC_PING, TOPIC_COMMAND);
    // Announce device online
    JsonDocument announce;
    announce["online"] = true; announce["event"] = "device_connected";
    char buf[64]; serializeJson(announce, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
  } else {
    Serial.printf(" FAILED rc=%d\n", mqtt.state());
    // rc = 4 → wrong DEVICE_TOKEN (bad credentials)
    // rc = 5 → token not found in database
    // rc = -2 → TCP timeout (check server IP, port 1883 open in Azure NSG)
  }
  return ok;
}

// ─── GPRS Connect ─────────────────────────────────────────────────────────────
bool connectGPRS() {
  Serial.printf("[GPRS] Connecting on APN '%s'...", APN);
  if (modem.gprsConnect(APN, APN_USER, APN_PASS)) {
    Serial.println(" OK ✓ IP: " + modem.localIP().toString());
    return true;
  }
  Serial.println(" FAILED");
  return false;
}

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(300);

  // Build per-token MQTT topics
  snprintf(TOPIC_TELEMETRY, sizeof(TOPIC_TELEMETRY), "artic/%s/telemetry", DEVICE_TOKEN);
  snprintf(TOPIC_PONG,      sizeof(TOPIC_PONG),      "artic/%s/pong",      DEVICE_TOKEN);
  snprintf(TOPIC_PING,      sizeof(TOPIC_PING),      "artic/%s/ping",      DEVICE_TOKEN);
  snprintf(TOPIC_COMMAND,   sizeof(TOPIC_COMMAND),   "artic/%s/command",   DEVICE_TOKEN);

  // Relay — start UNLOCKED so engine can run on boot
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);  // HIGH = relay OFF = engine allowed

  Serial.println("=====================================");
  Serial.println("  ARTIC VMS GPS Tracker v2.1");
  Serial.printf ("  Server: %s:%d\n", MQTT_HOST, MQTT_PORT);
  Serial.printf ("  Token:  %.8s...\n", DEVICE_TOKEN);
  Serial.printf ("  Topics: %s\n", TOPIC_TELEMETRY);
  Serial.println("=====================================\n");

  // Start UART2 for SIM808 communication
  SerialAT.begin(9600, SERIAL_8N1, RXD2, TXD2);
  delay(2000);

  Serial.println("[MODEM] Restarting SIM808...");
  modem.restart();
  delay(3000);

  Serial.println("[MODEM] Info: " + modem.getModemInfo());
  Serial.printf("[MODEM] Signal quality: %d\n", modem.getSignalQuality());
  // Signal quality guide: 0–10 = poor, 10–20 = OK, 20–30 = good, >30 = excellent

  // Disable SIM808 auto-sleep (prevents GPS module from turning off)
  sendAT("AT+CSCLK=0", "OK", 2000);
  sendAT("AT+CFUN=1",  "OK", 3000);

  // Power on GPS module and verify
  Serial.println("[GPS] Powering on GPS module...");
  sendAT("AT+CGNSPWR=1", "OK", 3000);
  delay(1000);
  checkGpsModule();

  // Enable GPS via TinyGSM
  modem.enableGPS();

  // Connect to GPRS (retry until connected)
  while (!connectGPRS()) {
    Serial.println("[GPRS] Retrying in 5s...");
    delay(5000);
  }

  // Configure MQTT client
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setKeepAlive(60);
  mqtt.setSocketTimeout(30);
  mqtt.setBufferSize(512);

  connectMQTT();
}

// ─── Main Loop ────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // ── Keep GPRS connection alive ────────────────────────────────────────────
  if (!modem.isGprsConnected()) {
    Serial.println("[GPRS] Lost — reconnecting...");
    modem.gprsDisconnect();
    delay(1000);
    connectGPRS();
  }

  // ── Keep MQTT connection alive ────────────────────────────────────────────
  if (!mqtt.connected()) {
    if (now - lastReconnectAt > RECONNECT_INTERVAL_MS) {
      lastReconnectAt = now;
      connectMQTT();
    }
  } else {
    mqtt.loop();  // processes incoming ping and command messages
  }

  // ── AT keep-alive — prevents SIM808 from entering sleep mode ─────────────
  if (now - lastKeepAliveAt > KEEPALIVE_INTERVAL_MS) {
    lastKeepAliveAt = now;
    if (!sendAT("AT", "OK", 1500)) {
      Serial.println("[MODEM] SIM808 not responding — GPS module may have turned off");
      gpsModuleOn = false;
    }
  }

  // ── GPS module health check every 60s ────────────────────────────────────
  if (now - lastGpsCheckAt > GPS_CHECK_INTERVAL_MS) {
    lastGpsCheckAt = now;
    checkGpsModule();
  }

  // ── Publish GPS telemetry every 15s ──────────────────────────────────────
  if (mqtt.connected()) {
    publishGPS();
  }

  delay(50);
}
```

---

## Expected Serial Monitor Output

### On Boot (success)
```
=====================================
  ARTIC VMS GPS Tracker v2.1
  Server: 172.209.217.176:1883
  Token:  5466f18d...
  Topics: artic/5466f18d-ffd6-4267-ad81-93583d1bbaa4/telemetry
=====================================

[MODEM] Restarting SIM808...
[MODEM] Info: SIM808 R14.18
[MODEM] Signal quality: 28
[GPS] Powering on GPS module...
[GPS] Module confirmed ON
[GPRS] Connecting on APN 'internet'... OK ✓ IP: 21.14.32.88
[MQTT] Connecting to 172.209.217.176:1883 ... OK ✓
[MQTT] Subscribed to:
  artic/5466f18d-.../ping
  artic/5466f18d-.../command
[GPS] No fix yet — sending heartbeat
[MQTT] Telemetry OK ✓
```

### After GPS Fix (1–5 minutes outdoors)
```
[GPS] Fix: -1.976342, 30.136665  Speed: 0.6 km/h  Sats: 8
[MQTT] Telemetry OK ✓
[GPS] Fix: -1.976338, 30.136671  Speed: 1.2 km/h  Sats: 9
[MQTT] Telemetry OK ✓
```

### When Dashboard Sends Lock Command
```
[MQTT <-] artic/.../command : {"command":"lock"}
[RELAY] Engine LOCKED 🔒
```

### When Dashboard Sends Unlock Command
```
[MQTT <-] artic/.../command : {"command":"unlock"}
[RELAY] Engine UNLOCKED 🔓
```

### When Backend Pings (every 15s automatically)
```
[MQTT <-] artic/.../ping : {"ts":1783268149,"auto":true}
[GPS] Ping received — sending pong
```

---

## Error Reference

| Serial Output | Meaning | Fix |
|---|---|---|
| `FAILED rc=-2` | TCP timeout — server unreachable | Open port 1883 in Azure NSG firewall |
| `FAILED rc=4` | Wrong password | Check DEVICE_TOKEN matches dashboard |
| `FAILED rc=5` | Token not in database | Get fresh token from dashboard |
| `GPRS FAILED` | No mobile data | Check SIM card, verify APN = "internet" |
| `Signal quality: 0` | No GSM signal | Move to open area, check SIM card |
| `GPS Module OFF` | SIM808 GPS not responding | Check 4V/2A power supply |
| `Telemetry FAILED ✗` | MQTT publish failed | Check MQTT connection (reconnect loop handles it) |
| SIM808 keeps restarting | Power supply too weak | Use dedicated 4.0V 2A supply |

---

## Changing the Device Token

1. Log in to dashboard: `http://172.209.217.176:3000`
2. Go to **Vehicles** → click your vehicle
3. **Overview tab** → Device Token section → click **Copy**
4. In the sketch, replace the value of `DEVICE_TOKEN`:
   ```cpp
   const char DEVICE_TOKEN[] = "your-new-token-here";
   ```
5. Re-upload the sketch to the ESP32

---

*ARTIC VMS v2.1 — Final Production Code — July 2026*
