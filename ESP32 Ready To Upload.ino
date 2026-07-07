/*
 * ============================================================
 *  ARTIC VMS — ESP32 + SIM808 GPS Tracker
 *  Ready-to-upload sketch
 *
 *  ONLY CHANGE:
 *    1. DEVICE_TOKEN  → copy from Dashboard → Vehicles → Overview
 *    2. APN           → "internet" for Airtel/MTN Rwanda
 *    3. MQTT_HOST     → your server IP
 *
 *  WIRING:
 *    ESP32 GPIO16 (RX2) ← SIM808 TX
 *    ESP32 GPIO17 (TX2) → SIM808 RX
 *    ESP32 GND          — SIM808 GND
 *    SIM808 VCC         → 4.0–4.2V supply (min 2A — NOT from ESP32)
 *    ESP32 GPIO26       → Relay IN
 *    ESP32 5V (VIN)     → Relay VCC
 *    ESP32 GND          — Relay GND
 *    Relay COM          — one side of ignition wire
 *    Relay NC           — other side of ignition wire
 *
 *  RELAY LOGIC (active LOW):
 *    GPIO26 HIGH = relay OFF = engine RUNS  (default on boot)
 *    GPIO26 LOW  = relay ON  = engine CUT   (locked)
 *
 *  LIBRARIES (Arduino IDE → Manage Libraries):
 *    - TinyGSM        by Volodymyr Shymanskyy  v0.12.0+
 *    - PubSubClient   by Nick O'Leary          v2.8
 *    - ArduinoJson    by Benoit Blanchon        v7.x  (NOT v6)
 *
 *  BOARD: ESP32 Dev Module | Upload Speed: 921600 | Baud: 115200
 * ============================================================
 */

#define TINY_GSM_MODEM_SIM808
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ============================================================
//  !! CHANGE THESE THREE LINES !!
// ============================================================

// 1. Paste device token from Dashboard → Vehicles → Overview → Copy
const char DEVICE_TOKEN[] = "5466f18d-ffd6-4267-ad81-93583d1bbaa4";

// 2. SIM card APN
const char APN[]          = "internet";   // Airtel or MTN Rwanda

// 3. Server IP
const char MQTT_HOST[]    = "172.209.217.176";

// ============================================================
//  DO NOT CHANGE BELOW UNLESS YOU KNOW WHAT YOU ARE DOING
// ============================================================

const char APN_USER[]  = "";
const char APN_PASS[]  = "";
const int  MQTT_PORT   = 1883;

const char VEHICLE_TYPE[] = "CAR";
const char FUEL_TYPE[]    = "PETROL";

#define RXD2        16
#define TXD2        17
#define RELAY_PIN   26

const unsigned long TELEMETRY_MS  = 15000;
const unsigned long RECONNECT_MS  = 5000;
const unsigned long KEEPALIVE_MS  = 30000;
const unsigned long GPS_CHECK_MS  = 60000;

char TOPIC_TELEMETRY[128];
char TOPIC_PONG[128];
char TOPIC_PING[128];
char TOPIC_COMMAND[128];

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

// ─── AT helper ───────────────────────────────────────────────────────────────
bool sendAT(const char* cmd, const char* expected, unsigned long ms = 2000) {
  while (SerialAT.available()) SerialAT.read();
  SerialAT.println(cmd);
  String r = "";
  unsigned long dl = millis() + ms;
  while (millis() < dl) {
    while (SerialAT.available()) r += (char)SerialAT.read();
    if (r.indexOf(expected) != -1) return true;
    delay(20);
  }
  return false;
}

// ─── GPS health check ─────────────────────────────────────────────────────────
void checkGps() {
  SerialAT.println("AT+CGNSPWR?");
  String r = "";
  unsigned long dl = millis() + 2000;
  while (millis() < dl) {
    while (SerialAT.available()) r += (char)SerialAT.read();
    delay(20);
  }
  if (r.indexOf("+CGNSPWR: 1") != -1 || r.indexOf("+CGNSPWR:1") != -1) {
    if (!gpsModuleOn) Serial.println("[GPS] ON");
    gpsModuleOn = true;
  } else {
    Serial.println("[GPS] OFF — restarting...");
    gpsModuleOn = false;
    if (sendAT("AT+CGNSPWR=1", "OK", 3000)) {
      gpsModuleOn = true;
      Serial.println("[GPS] Restarted OK");
    }
  }
}

// ─── MQTT callback ────────────────────────────────────────────────────────────
void onMessage(char* topic, byte* payload, unsigned int len) {
  String t = String(topic);
  String p = String((char*)payload, len);
  Serial.printf("[MQTT<-] %s : %s\n", topic, p.c_str());

  if (t == String(TOPIC_PING)) {
    JsonDocument pong;
    pong["pong"]        = true;
    pong["gpsModuleOn"] = gpsModuleOn;
    pong["locked"]      = engineLocked;
    pong["ts"]          = millis();
    char buf[128];
    serializeJson(pong, buf);
    mqtt.publish(TOPIC_PONG, buf, false);
    Serial.println("[MQTT] Pong sent");
    return;
  }

  if (t == String(TOPIC_COMMAND)) {
    JsonDocument doc;
    if (deserializeJson(doc, p) != DeserializationError::Ok) return;
    const char* cmd = doc["command"];
    if (!cmd) return;

    if (strcmp(cmd, "lock") == 0) {
      engineLocked = true;
      digitalWrite(RELAY_PIN, LOW);    // LOW = relay ON = engine CUT
      Serial.println("[RELAY] LOCKED");
      JsonDocument ack;
      ack["ack"] = "lock"; ack["engineLocked"] = true;
      char buf[64]; serializeJson(ack, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);

    } else if (strcmp(cmd, "unlock") == 0) {
      engineLocked = false;
      digitalWrite(RELAY_PIN, HIGH);   // HIGH = relay OFF = engine RUNS
      Serial.println("[RELAY] UNLOCKED");
      JsonDocument ack;
      ack["ack"] = "unlock"; ack["engineLocked"] = false;
      char buf[64]; serializeJson(ack, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);
    }
  }
}

// ─── Publish GPS ──────────────────────────────────────────────────────────────
void publishGPS() {
  if (millis() - lastTelemetryAt < TELEMETRY_MS) return;
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
    doc["latitude"]   = serialized(String(lat, 6));
    doc["longitude"]  = serialized(String(lon, 6));
    doc["speed"]      = serialized(String(spd, 2));
    doc["altitude"]   = serialized(String(alt, 2));
    doc["accuracy"]   = serialized(String(acc, 2));
    doc["heading"]    = nullptr;
    doc["satellites"] = usat;
    Serial.printf("[GPS] %.6f, %.6f  %.1f km/h  Sats:%d\n", lat, lon, spd, usat);
  } else {
    doc["latitude"]  = nullptr; doc["longitude"] = nullptr;
    doc["speed"]     = nullptr; doc["altitude"]  = nullptr;
    doc["accuracy"]  = nullptr; doc["heading"]   = nullptr;
    doc["noFix"]     = true;
    Serial.println("[GPS] No fix — heartbeat");
  }

  doc["fuelLevel"] = nullptr; doc["fuelUsed"]        = nullptr;
  doc["engineTemp"]= nullptr; doc["rpm"]             = nullptr;
  doc["batteryVoltage"] = nullptr; doc["batteryLevelPct"] = nullptr;

  char json[512];
  serializeJson(doc, json);
  bool ok = mqtt.publish(TOPIC_TELEMETRY, json, false);
  Serial.printf("[MQTT] Telemetry %s\n", ok ? "OK" : "FAIL");
}

// ─── MQTT connect ─────────────────────────────────────────────────────────────
bool connectMQTT() {
  Serial.printf("[MQTT] Connecting %s:%d ...", MQTT_HOST, MQTT_PORT);
  String cid = "ESP32_" + String(DEVICE_TOKEN).substring(0, 8);
  if (mqtt.connect(cid.c_str(), DEVICE_TOKEN, DEVICE_TOKEN)) {
    Serial.println(" OK");
    mqtt.subscribe(TOPIC_PING,    1);
    mqtt.subscribe(TOPIC_COMMAND, 1);
    Serial.println("[MQTT] Subscribed");
    JsonDocument a; a["online"] = true; a["event"] = "device_connected";
    char buf[64]; serializeJson(a, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
    return true;
  }
  Serial.printf(" FAIL rc=%d\n", mqtt.state());
  return false;
}

// ─── GPRS connect ─────────────────────────────────────────────────────────────
bool connectGPRS() {
  Serial.printf("[GPRS] APN '%s'...", APN);
  if (modem.gprsConnect(APN, APN_USER, APN_PASS)) {
    Serial.println(" OK IP:" + modem.localIP().toString());
    return true;
  }
  Serial.println(" FAIL");
  return false;
}

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(300);

  snprintf(TOPIC_TELEMETRY, 128, "artic/%s/telemetry", DEVICE_TOKEN);
  snprintf(TOPIC_PONG,      128, "artic/%s/pong",      DEVICE_TOKEN);
  snprintf(TOPIC_PING,      128, "artic/%s/ping",      DEVICE_TOKEN);
  snprintf(TOPIC_COMMAND,   128, "artic/%s/command",   DEVICE_TOKEN);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);   // Boot unlocked — engine can run

  Serial.println("=== ARTIC VMS ===");
  Serial.printf("Server : %s:%d\n", MQTT_HOST, MQTT_PORT);
  Serial.printf("Token  : %.8s...\n", DEVICE_TOKEN);
  Serial.printf("Topic  : %s\n", TOPIC_TELEMETRY);
  Serial.println("=================\n");

  SerialAT.begin(9600, SERIAL_8N1, RXD2, TXD2);
  delay(2000);

  Serial.println("[MODEM] Restarting...");
  modem.restart();
  delay(3000);

  Serial.println("[MODEM] " + modem.getModemInfo());
  Serial.printf("[MODEM] Signal: %d\n", modem.getSignalQuality());

  sendAT("AT+CSCLK=0", "OK", 2000);   // disable auto-sleep
  sendAT("AT+CFUN=1",  "OK", 3000);   // full functionality

  Serial.println("[GPS] Powering on...");
  sendAT("AT+CGNSPWR=1", "OK", 3000);
  delay(1000);
  checkGps();
  modem.enableGPS();

  while (!connectGPRS()) {
    Serial.println("[GPRS] Retry in 5s...");
    delay(5000);
  }

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
  mqtt.setKeepAlive(60);
  mqtt.setSocketTimeout(30);
  mqtt.setBufferSize(512);

  connectMQTT();
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  if (!modem.isGprsConnected()) {
    Serial.println("[GPRS] Lost, reconnecting...");
    modem.gprsDisconnect();
    delay(1000);
    connectGPRS();
  }

  if (!mqtt.connected()) {
    if (now - lastReconnectAt > RECONNECT_MS) {
      lastReconnectAt = now;
      connectMQTT();
    }
  } else {
    mqtt.loop();
  }

  if (now - lastKeepAliveAt > KEEPALIVE_MS) {
    lastKeepAliveAt = now;
    if (!sendAT("AT", "OK", 1500)) {
      Serial.println("[MODEM] Not responding");
      gpsModuleOn = false;
    }
  }

  if (now - lastGpsCheckAt > GPS_CHECK_MS) {
    lastGpsCheckAt = now;
    checkGps();
  }

  if (mqtt.connected()) publishGPS();

  delay(50);
}
