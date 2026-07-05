/*
 * ============================================================
 *  ARTIC VMS — ESP32 GPS Tracker
 *  
 *  Hardware required:
 *    - ESP32 (any variant)
 *    - NEO-6M / NEO-8M GPS module  → UART2 (RX=16, TX=17)
 *    - OBD-II ELM327 (optional)   → UART1 (RX=4,  TX=5)
 *    - Ignition wire sense         → GPIO 34 (INPUT, 3.3V logic)
 *    - Engine lock relay           → GPIO 26 (OUTPUT)
 *
 *  Libraries (install via Arduino Library Manager):
 *    - PubSubClient   by Nick O'Leary
 *    - TinyGPSPlus    by Mikal Hart
 *    - ArduinoJson    by Benoit Blanchon  (v6.x)
 * ============================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <TinyGPSPlus.h>
#include <ArduinoJson.h>
#include <HardwareSerial.h>

// ─── CONFIGURE THESE ────────────────────────────────────────
#define WIFI_SSID        "YOUR_WIFI_SSID"
#define WIFI_PASSWORD    "YOUR_WIFI_PASSWORD"

// MQTT broker = your server (mosquitto is running on port 1883)
#define MQTT_HOST        "172.209.217.176"
#define MQTT_PORT        1883

// Get this from the Vehicle detail page in the dashboard
// It is the vehicle's deviceToken field
#define DEVICE_TOKEN     "PASTE_VEHICLE_DEVICE_TOKEN_HERE"

// A unique client ID for this device (use plate number or chip ID)
#define MQTT_CLIENT_ID   "ESP32_VMS_001"

// How often to send telemetry (milliseconds)
#define SEND_INTERVAL_MS 5000
// ────────────────────────────────────────────────────────────

// ─── PIN DEFINITIONS ────────────────────────────────────────
#define GPS_RX_PIN       16
#define GPS_TX_PIN       17
#define IGNITION_PIN     34   // HIGH = ignition on
#define ENGINE_LOCK_PIN  26   // HIGH = lock engine (relay)
// ────────────────────────────────────────────────────────────

// MQTT topic — must match "artic/<anything>/telemetry"
// The broker checks: topic.startsWith('artic/') && topic.endsWith('/telemetry')
char MQTT_TOPIC_TELEMETRY[64];
char MQTT_TOPIC_COMMAND[64];   // subscribe for remote commands

HardwareSerial gpsSerial(2);   // UART2
TinyGPSPlus    gps;
WiFiClient     wifiClient;
PubSubClient   mqtt(wifiClient);

// ─── Telemetry state ────────────────────────────────────────
float    lastLat = 0, lastLon = 0;
float    odometer    = 0.0;   // accumulated km
uint32_t lastSendMs  = 0;
uint32_t lastGpsMs   = 0;
bool     engineLocked = false;

// ─── Haversine distance (meters) ────────────────────────────
float haversineM(float lat1, float lon1, float lat2, float lon2) {
  const float R = 6371000.0;
  float dLat = radians(lat2 - lat1);
  float dLon = radians(lon2 - lon1);
  float a = sin(dLat/2)*sin(dLat/2)
          + cos(radians(lat1))*cos(radians(lat2))
          * sin(dLon/2)*sin(dLon/2);
  return R * 2.0 * atan2(sqrt(a), sqrt(1-a));
}

// ─── WiFi ────────────────────────────────────────────────────
void connectWifi() {
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Connected. IP: %s\n", WiFi.localIP().toString().c_str());
}

// ─── MQTT incoming command handler ───────────────────────────
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  // Null-terminate the payload
  char msg[256] = {0};
  memcpy(msg, payload, min((unsigned int)255, length));

  Serial.printf("[MQTT] Command received on %s: %s\n", topic, msg);

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, msg) != DeserializationError::Ok) return;

  const char* cmd = doc["command"];
  if (!cmd) return;

  if (strcmp(cmd, "LOCK_ENGINE") == 0) {
    engineLocked = true;
    digitalWrite(ENGINE_LOCK_PIN, HIGH);
    Serial.println("[CMD] Engine LOCKED");
  } else if (strcmp(cmd, "UNLOCK_ENGINE") == 0) {
    engineLocked = false;
    digitalWrite(ENGINE_LOCK_PIN, LOW);
    Serial.println("[CMD] Engine UNLOCKED");
  } else if (strcmp(cmd, "REBOOT") == 0) {
    Serial.println("[CMD] Rebooting...");
    delay(500);
    ESP.restart();
  }
}

// ─── MQTT connect ─────────────────────────────────────────────
void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.printf("[MQTT] Connecting to %s:%d ...\n", MQTT_HOST, MQTT_PORT);

    // clientId = MQTT_CLIENT_ID
    // username = MQTT_CLIENT_ID  (can be anything)
    // password = DEVICE_TOKEN    (this is what the broker authenticates with)
    if (mqtt.connect(MQTT_CLIENT_ID, MQTT_CLIENT_ID, DEVICE_TOKEN)) {
      Serial.println("[MQTT] Connected");
      // Subscribe to command topic for remote lock/unlock
      mqtt.subscribe(MQTT_TOPIC_COMMAND);
      Serial.printf("[MQTT] Subscribed to %s\n", MQTT_TOPIC_COMMAND);
    } else {
      Serial.printf("[MQTT] Failed, rc=%d. Retry in 5s...\n", mqtt.state());
      delay(5000);
    }
  }
}

// ─── Read ADC voltage (for battery voltage via divider) ───────
// If you have a voltage divider: Vin──[R1=100k]──A0──[R2=27k]──GND
// Adjust the multiplier accordingly. Remove if not used.
float readBatteryVoltage() {
  int raw = analogRead(35);                    // GPIO35 = ADC input
  float v = (raw / 4095.0) * 3.3;             // ESP32 ADC reference
  float vBat = v * ((100.0 + 27.0) / 27.0);   // voltage divider ratio
  return vBat;
}

// ─── Build and publish telemetry JSON ─────────────────────────
void publishTelemetry() {
  bool ignitionOn = (digitalRead(IGNITION_PIN) == HIGH);

  StaticJsonDocument<512> doc;

  // GPS fields
  if (gps.location.isValid() && gps.location.age() < 3000) {
    float lat = gps.location.lat();
    float lon = gps.location.lng();

    // Accumulate odometer
    if (lastLat != 0 && lastLon != 0) {
      float distM = haversineM(lastLat, lastLon, lat, lon);
      if (distM < 500) {           // ignore GPS jumps > 500m
        odometer += distM / 1000.0;
      }
    }
    lastLat = lat;
    lastLon = lon;

    doc["latitude"]  = serialized(String(lat,  6));
    doc["longitude"] = serialized(String(lon,  6));
    doc["altitude"]  = serialized(String(gps.altitude.isValid() ? gps.altitude.meters() : 0.0, 1));
    doc["heading"]   = serialized(String(gps.course.isValid()   ? gps.course.deg()       : 0.0, 1));
    doc["speed"]     = serialized(String(gps.speed.isValid()    ? gps.speed.kmph()       : 0.0, 1));
    doc["accuracy"]  = serialized(String(gps.hdop.isValid()     ? gps.hdop.hdop()        : 99.9, 1));
    doc["odometer"]  = serialized(String(odometer, 3));
  } else {
    // No GPS fix — still send engine/sensor data with nulls for location
    doc["latitude"]  = nullptr;
    doc["longitude"] = nullptr;
    doc["speed"]     = 0;
    doc["heading"]   = 0;
    doc["altitude"]  = 0;
    doc["odometer"]  = odometer;
  }

  // Engine / ignition
  doc["ignition"]  = ignitionOn;
  doc["engineOn"]  = ignitionOn;

  // Battery voltage
  doc["batteryVoltage"] = serialized(String(readBatteryVoltage(), 2));

  // Fuel level — if you have a fuel sensor on ADC pin, read it here.
  // Otherwise remove this line or hardcode a value for testing.
  // doc["fuelLevel"] = 75.0;  // percentage

  // GPS satellite count
  if (gps.satellites.isValid()) {
    doc["satellites"] = gps.satellites.value();
  }

  // Timestamp (GPS time if available, else skip — server uses DB NOW())
  if (gps.date.isValid() && gps.time.isValid()) {
    char ts[25];
    snprintf(ts, sizeof(ts), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             gps.date.year(), gps.date.month(), gps.date.day(),
             gps.time.hour(), gps.time.minute(), gps.time.second());
    doc["timestamp"] = ts;
  }

  //

