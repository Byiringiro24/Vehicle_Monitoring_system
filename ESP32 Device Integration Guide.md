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
9. Troubleshooting

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

The device authenticates using the vehicle''s unique deviceToken.
This token is found in the ARTIC VMS dashboard under:
Vehicle Detail page → Device Token field (or Settings → Regenerate Token)

Connection flow:
1. ESP32 powers on → initialises SIM808 via AT commands
2. SIM808 connects to GSM network and registers on the APN
3. GPRS data session opened (internet access via SIM card)
4. ESP32 connects to your ARTIC VMS MQTT broker (port 1883)
   - Server: your backend hostname or IP
   - Username: deviceToken
   - Password: deviceToken
   - ClientId: any unique string (e.g. "ESP32_<vehicleId>")
5. GPS fix acquired (can take 30-90 seconds cold start)
6. Every 15 seconds:
   a. Read GPS coordinates, speed, altitude
   b. Build JSON payload
   c. Publish to topic: artic/<vehicleId>/telemetry
7. Backend receives the MQTT message and:
   - Saves telemetry to database
   - Updates live map
   - Checks alert rules
   - Broadcasts to dashboard via Socket.IO

---

## 3. COMPLETE ESP32 ARDUINO CODE

Save this as artic_vms_device.ino in Arduino IDE.
Install libraries: TinyGSM, PubSubClient (via Library Manager)

```cpp
/*
 * ARTIC VMS — ESP32 + SIM808 GPS Tracker
 * Connects to ARTIC VMS backend via MQTT over GPRS
 * Supports: Car, Motorcycle, Truck, Van, Bus, Electric, Diesel, Petrol vehicles
 *
 * Wiring:
 *   ESP32 GPIO16 (RX2) → SIM808 TX
 *   ESP32 GPIO17 (TX2) → SIM808 RX
 *   ESP32 GPIO5        → Relay IN (engine cut-off, optional)
 *   ESP32 3.3V         → SIM808 VCC (or use separate 4.2V supply for SIM808)
 *   ESP32 GND          → SIM808 GND
 */

#define TINY_GSM_MODEM_SIM808
#include <TinyGsmClient.h>
#include <PubSubClient.h>

// ─── Pin Configuration ────────────────────────────────────────────────────────
#define RXD2        16          // ESP32 RX2 ← SIM808 TX
#define TXD2        17          // ESP32 TX2 → SIM808 RX
#define RELAY_PIN   5           // Engine cut-off relay (optional, set to -1 to disable)
#define PWR_PIN     4           // SIM808 power key (optional, -1 to skip)

// ─── Network Configuration ────────────────────────────────────────────────────
// Rwanda APNs: MTN="internet"  Airtel="airtelgprs.com"  RwandaTel="rwandatel"
const char APN[]      = "internet";
const char APN_USER[] = "";
const char APN_PASS[] = "";

// ─── ARTIC VMS Backend Configuration ─────────────────────────────────────────
// Replace with your actual server hostname or IP address
// Examples:
//   Local dev (same WiFi/LAN): "192.168.1.100"
//   Server with domain:         "fleet.yourcompany.com"
//   ngrok tunnel (testing):     "0.tcp.ngrok.io"  port=12345
const char MQTT_HOST[] = "YOUR_SERVER_HOST";   // CHANGE THIS
const int  MQTT_PORT   = 1883;

// ─── Vehicle Identity ─────────────────────────────────────────────────────────
// Get this from ARTIC VMS Dashboard → Vehicles → [your vehicle] → Device Token
// IMPORTANT: Each vehicle has a UNIQUE token. Never share tokens between vehicles.
const char DEVICE_TOKEN[] = "PASTE_YOUR_DEVICE_TOKEN_HERE";  // CHANGE THIS

// Vehicle metadata (sent with first ping for identification)
const char VEHICLE_TYPE[] = "CAR";         // CAR, MOTORCYCLE, TRUCK, VAN, BUS, PICKUP
const char FUEL_TYPE[]    = "PETROL";      // PETROL, DIESEL, ELECTRIC, HYBRID

// ─── Timing ───────────────────────────────────────────────────────────────────
const unsigned long TELEMETRY_INTERVAL_MS = 15000;  // 15 seconds between GPS pings
const unsigned long RECONNECT_INTERVAL_MS = 5000;   // retry connection every 5s

// ─── Globals ─────────────────────────────────────────────────────────────────
HardwareSerial SerialAT(2);
TinyGsm        modem(SerialAT);
TinyGsmClient  mqttClient(modem);
PubSubClient   mqtt(mqttClient);

unsigned long lastTelemetryAt     = 0;
unsigned long lastReconnectAt     = 0;
bool          gpsEnabled          = false;
float         lastLat = 0, lastLon = 0;

String telemetryTopic = String("artic/") + DEVICE_TOKEN + "/telemetry";
// Note: the backend extracts vehicleId from the authenticated client,
// the topic is used for routing only.

// ─── Publish Telemetry ────────────────────────────────────────────────────────
void publishTelemetry(const String& json) {
  Serial.print("[MQTT] Publishing: ");
  Serial.println(json);
  if (mqtt.connected()) {
    bool ok = mqtt.publish(telemetryTopic.c_str(), json.c_str(), false);
    Serial.println(ok ? "[MQTT] Published OK" : "[MQTT] Publish FAILED");
  }
}

// ─── Build GPS JSON Payload ───────────────────────────────────────────────────
void publishGPS() {
  if (millis() - lastTelemetryAt < TELEMETRY_INTERVAL_MS) return;
  lastTelemetryAt = millis();

  float lat = 0, lon = 0, spd = 0, alt = 0, acc = 0;
  int vsat = 0, usat = 0;
  bool fix = modem.getGPS(&lat, &lon, &spd, &alt, &vsat, &usat, &acc);

  String json = "{";
  json += "\"online\":true";
  json += ",\"vehicleType\":\"" + String(VEHICLE_TYPE) + "\"";
  json += ",\"fuelType\":\"" + String(FUEL_TYPE) + "\"";
  json += ",\"engineOn\":true";

  if (fix && lat != 0 && lon != 0) {
    lastLat = lat; lastLon = lon;
    json += ",\"latitude\":"  + String(lat, 6);
    json += ",\"longitude\":" + String(lon, 6);
    json += ",\"speed\":"     + String(spd, 2);
    json += ",\"altitude\":"  + String(alt, 2);
    json += ",\"accuracy\":"  + String(acc, 2);
    json += ",\"satellites\":" + String(usat);
    Serial.printf("[GPS] Fix: %.6f, %.6f  Speed: %.1f km/h  Sats: %d\n", lat, lon, spd, usat);
  } else {
    Serial.println("[GPS] No fix yet — sending online-only ping");
  }

  // Battery voltage (if you have ADC wired to measure 12V supply via divider)
  // float vbat = analogRead(34) * (3.3 / 4095.0) * (12.0 / 3.3);
  // json += ",\"batteryVoltage\":" + String(vbat, 2);

  json += "}";
  publishTelemetry(json);
}

// ─── MQTT Connect ─────────────────────────────────────────────────────────────
bool connectMQTT() {
  Serial.print("[MQTT] Connecting to " + String(MQTT_HOST) + ":" + String(MQTT_PORT) + "...");
  String clientId = "ESP32_" + String(DEVICE_TOKEN).substring(0, 8);
  // Username AND password are both the deviceToken — this is how ARTIC VMS authenticates devices
  bool ok = mqtt.connect(clientId.c_str(), DEVICE_TOKEN, DEVICE_TOKEN);
  if (ok) {
    Serial.println(" CONNECTED");
    publishTelemetry("{\"online\":true,\"event\":\"device_connected\"}");
  } else {
    Serial.print(" FAILED, rc=");
    Serial.println(mqtt.state());
    // rc=-2 = no connection  rc=-4 = timeout  rc=5 = bad credentials (wrong deviceToken)
  }
  return ok;
}

// ─── GPRS Connect ────────────────────────────────────────────────────────────
bool connectGPRS() {
  Serial.println("[GPRS] Connecting...");
  if (modem.gprsConnect(APN, APN_USER, APN_PASS)) {
    Serial.println("[GPRS] Connected. IP: " + modem.localIP().toString());
    return true;
  }
  Serial.println("[GPRS] FAILED");
  return false;
}

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(100);

  if (RELAY_PIN > 0) {
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);  // Relay OFF = engine allowed
  }

  Serial.println("=============================");
  Serial.println("  ARTIC VMS GPS Tracker");
  Serial.println("  Vehicle Type: " + String(VEHICLE_TYPE));
  Serial.println("  Fuel Type:    " + String(FUEL_TYPE));
  Serial.println("  Server:       " + String(MQTT_HOST));
  Serial.println("=============================");

  SerialAT.begin(9600, SERIAL_8N1, RXD2, TXD2);
  delay(2000);

  Serial.println("[MODEM] Restarting SIM808...");
  modem.restart();
  delay(2000);

  Serial.println("[MODEM] Info: " + modem.getModemInfo());
  Serial.print  ("[MODEM] Signal quality: ");
  Serial.println(modem.getSignalQuality());  // >10 = usable, >20 = good, >30 = excellent

  Serial.println("[GPS] Enabling GPS...");
  modem.enableGPS();
  gpsEnabled = true;

  while (!connectGPRS()) {
    Serial.println("[GPRS] Retrying in 5s...");
    delay(5000);
  }

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setKeepAlive(60);
  mqtt.setSocketTimeout(30);
  connectMQTT();
}

// ─── Loop ────────────────────────────────────────────────────────────────────
void loop() {
  // Reconnect GPRS if lost
  if (!modem.isGprsConnected()) {
    Serial.println("[GPRS] Connection lost — reconnecting...");
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
    mqtt.loop();
  }

  // Publish GPS every 15 seconds
  publishGPS();
}
```

---

## 4. WIRING DIAGRAM

```
ESP32 Pin   Direction   SIM808 Pin     Purpose
─────────────────────────────────────────────────────
GPIO16 (RX2)  ←────────  TX             Receive from SIM808
GPIO17 (TX2)  ─────────►  RX             Send to SIM808
GPIO5         ─────────►  Relay IN       Engine cut-off (optional)
GND           ─────────►  GND            Common ground
3.3V / 5V     ─────────►  VCC            Power (SIM808 needs 3.7-4.2V for TX)

Note: SIM808 draws up to 2A during GSM TX. Use a dedicated power supply
(18650 LiPo cell with TP4056 charger) rather than the ESP32 3.3V rail.
```

---

## 5. HOW TO GET A VEHICLE DEVICE TOKEN

1. Log in to ARTIC VMS at http://your-server or http://localhost:3000
2. Navigate to Vehicles in the sidebar
3. Click the eye icon (👁) on the vehicle row to open Vehicle Details
4. Scroll down to "Vehicle Details" section
5. Copy the "Device Token" value (first 16 chars shown + "...")
6. For the full token: use API endpoint GET /api/v1/vehicles/:id (returns full token)
7. Paste the full token into DEVICE_TOKEN in the Arduino code

To regenerate a token (if device is lost/stolen):
- Go to Vehicle Detail → click "Regenerate Token" (Admin only)
- The old token immediately stops working
- Flash the new token to the replacement device

---

## 6. TESTING THE CONNECTION

With the Arduino Serial Monitor open at 115200 baud, you should see:

Successful connection:
```
[MODEM] Restarting SIM808...
[MODEM] Info: SIM808 R14.18
[MODEM] Signal quality: 22
[GPS] Enabling GPS...
[GPRS] Connecting...
[GPRS] Connected. IP: 100.115.92.13
[MQTT] Connecting to fleet.yourcompany.com:1883... CONNECTED
[MQTT] Publishing: {"online":true,"event":"device_connected"}
[MQTT] Published OK
[GPS] No fix yet — sending online-only ping
[GPS] Fix: -1.286389, 36.817223  Speed: 0.0 km/h  Sats: 6
[MQTT] Publishing: {"online":true,"vehicleType":"CAR","fuelType":"PETROL",...}
```

On the ARTIC VMS dashboard:
- The vehicle status changes from OFFLINE to IDLE (engine on, speed=0)
- The Live Map shows the vehicle pin at the GPS coordinates
- Speed, fuel level (if wired), and engine status update every 15 seconds

---

## 7. WHAT THE LIVE MAP SHOWS

When your ESP32 device is sending data:

Vehicle pin colours:
- GREEN  = ACTIVE (speed > 2 km/h, engine on)
- YELLOW = IDLE   (speed < 2 km/h, engine on)
- GREY   = OFFLINE (no data received)
- ORANGE = MAINTENANCE

Click a pin to see:
- Vehicle name and license plate
- Current speed
- Fuel level (if your device sends fuelLevel)
- Engine state (ON/OFF)
- Last update timestamp

The position updates every 15 seconds (matching the TELEMETRY_INTERVAL_MS setting).
Reduce to 5000ms (5 seconds) for smoother tracking — but note higher data costs.

---

## 8. VEHICLE TYPES SUPPORTED

The system supports both the vehicle type and fuel type.
These are stored in the database and shown in reports.

| VEHICLE_TYPE  | Description                                |
|---------------|--------------------------------------------|
| CAR           | Passenger car (Toyota, Subaru, Mercedes...) |
| MOTORCYCLE    | Moto-taxi (common in Rwanda — "moto")      |
| TRUCK         | Heavy goods vehicle (Isuzu, Mercedes Actros) |
| VAN           | Cargo van (Toyota Hiace, Ford Transit)     |
| BUS           | Passenger bus (Coaster, Rosa, full coach)  |
| MINIBUS       | Matatu / minibus (14-33 seats)             |
| PICKUP        | Pickup truck (Toyota Hilux, Mitsubishi L200) |
| OTHER         | Any other vehicle type                     |

| FUEL_TYPE  | Description                                  |
|------------|----------------------------------------------|
| PETROL     | Gasoline / petrol engine                     |
| DIESEL     | Diesel engine (most trucks and buses)        |
| ELECTRIC   | Full electric vehicle (BEV)                  |
| HYBRID     | Petrol + electric (Toyota Prius, etc.)       |
| CNG        | Compressed Natural Gas                       |
| LPG        | Liquefied Petroleum Gas                      |

For electric vehicles: the fuelLevel field can be repurposed as battery percentage (0-100%).
Set fuelType = "ELECTRIC" and send batteryLevelPct instead of fuelLevel.

---

## 9. TROUBLESHOOTING

Problem: rc=5 (bad credentials) when connecting MQTT
Solution: Wrong DEVICE_TOKEN. Double-check the exact token from the dashboard.
         Note: tokens are case-sensitive UUIDs like "a1b2c3d4-e5f6-..."

Problem: GPRS connects but MQTT fails with rc=-2 (no connection)
Solution: MQTT_HOST is incorrect or port 1883 is blocked by your server firewall.
         Check: sudo ufw allow 1883 on the server.
         Test from another device: telnet fleet.yourcompany.com 1883

Problem: GPS never gets a fix
Solution: Move the device outdoors or near a window. GPS needs clear sky view.
         Cold start can take 3-10 minutes. Subsequent starts are faster (warm fix).
         Check: Serial Monitor shows "No fix yet" until first fix.

Problem: No data appearing on Live Map
Solution: Check the vehicle exists in the database with a matching deviceToken.
         Check the backend logs for MQTT messages.
         Test with: npm run simulate (runs virtual vehicles with real tokens).

Problem: Vehicle shows OFFLINE immediately after connection
Solution: The backend sets status to OFFLINE when engineOn = false.
         Send "engineOn": true in the payload. If using actual ignition sensing,
         wire ignition voltage to an ADC pin and read it.

Problem: SIM808 not responding to AT commands
Solution: Check baud rate (9600), TX/RX wiring (cross TX↔RX), power supply.
         Try modem.testAT() in setup and check Serial Monitor.