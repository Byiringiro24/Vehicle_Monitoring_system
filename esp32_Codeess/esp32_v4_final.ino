/*
 * ============================================================
 *  ARTIC VMS — ESP32 + SIM808  v4.0  ← UPLOAD THIS ONE
 *
 *  GPS logic: identical to v3.0 (the version that worked)
 *  Added: SIM number in every packet, correct cmd response keys
 *
 * ── HOW STATUS WORKS ─────────────────────────────────────────
 *  ONLINE  = device sending heartbeat/GPS every 2s (MQTT alive)
 *  OFFLINE = no packet received for > 10s
 *  ACTIVE  = ONLINE + speed >= 2 km/h
 *  IDLE    = ONLINE + speed <  2 km/h
 *  LOCKED/UNLOCKED = relay state, INDEPENDENT of online/offline
 *
 * ── RELAY WIRING (active-LOW module) ─────────────────────────
 *  GPIO26 HIGH → relay OFF  → engine RUNS  (default on boot)
 *  GPIO26 LOW  → relay ON   → engine CUT   (locked)
 *
 *  Relay COM ──── ignition wire side A
 *  Relay NC  ──── ignition wire side B
 *  Relay VCC ──── ESP32 VIN (5V)
 *  Relay GND ──── ESP32 GND
 *  Relay IN  ──── ESP32 GPIO26
 *
 * ── POWER — CRITICAL ─────────────────────────────────────────
 *  The ESP32 MUST be powered from a PERMANENT 12V vehicle line
 *  (not the ignition-switched line).
 *  Use a 12V → 5V step-down converter (e.g. LM2596):
 *    12V perm fuse → converter IN+ → converter OUT+ → ESP32 VIN
 *    chassis GND   → converter IN- → converter OUT- → ESP32 GND
 *  This keeps the GPS online even when the relay cuts the engine.
 *
 * ── SIM808 WIRING ────────────────────────────────────────────
 *  ESP32 RX2 (GPIO16) ← SIM808 TX
 *  ESP32 TX2 (GPIO17) → SIM808 RX
 *  ESP32 GND          — SIM808 GND
 *  SIM808 VCC         → 4.0-4.2V, 2A dedicated supply
 *
 * ── CHANGE ONLY THESE 4 LINES ────────────────────────────────
 *  DEVICE_TOKEN → Dashboard → Vehicles → Overview → Copy
 *  SIM_NUMBER   → phone number of the SIM in this device
 *  APN          → "internet" for Airtel/MTN Rwanda
 *  MQTT_HOST    → your server IP
 *
 * ── LIBRARIES ─────────────────────────────────────────────────
 *  TinyGSM      by Volodymyr Shymanskyy  v0.12.0+
 *  PubSubClient by Nick O'Leary          v2.8
 *  ArduinoJson  by Benoit Blanchon       v7.x
 *  Board: ESP32 Dev Module  |  Baud: 115200
 * ============================================================
 */

#define TINY_GSM_MODEM_SIM808
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ── CHANGE THESE 4 ──────────────────────────────────────────
const char DEVICE_TOKEN[] = "5466f18d-ffd6-4267-ad81-93583d1bbaa4";
const char SIM_NUMBER[]   = "+250733768958";
const char APN[]          = "internet";
const char MQTT_HOST[]    = "102.37.128.81"; // new server
// ────────────────────────────────────────────────────────────

const char APN_USER[] = "";
const char APN_PASS[] = "";
const int  MQTT_PORT  = 1883;

#define RXD2      16
#define TXD2      17
#define RELAY_PIN 26

const unsigned long TELEMETRY_MS = 2000;
const unsigned long RECONNECT_MS = 3000;
const unsigned long KEEPALIVE_MS = 30000;
const unsigned long GPS_CHECK_MS = 60000;

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

bool engineLocked = false;
bool gpsModuleOn  = false;

// ─── AT helper ────────────────────────────────────────────────────────────────
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

// ─── GPS module health check ──────────────────────────────────────────────────
void checkGps() {
  SerialAT.println("AT+CGNSPWR?");
  String r = "";
  unsigned long dl = millis() + 2000;
  while (millis() < dl) {
    while (SerialAT.available()) r += (char)SerialAT.read();
    delay(20);
  }
  if (r.indexOf("+CGNSPWR: 1") != -1 || r.indexOf("+CGNSPWR:1") != -1) {
    if (!gpsModuleOn) Serial.println("[GPS] Module ON");
    gpsModuleOn = true;
  } else {
    Serial.println("[GPS] OFF - restarting...");
    gpsModuleOn = false;
    if (sendAT("AT+CGNSPWR=1", "OK", 3000)) {
      gpsModuleOn = true;
      Serial.println("[GPS] Restarted OK");
    }
  }
}

// ─── MQTT message callback ────────────────────────────────────────────────────
void onMessage(char* topic, byte* payload, unsigned int len) {
  String t = String(topic);
  String p = "";
  for (unsigned int i = 0; i < len; i++) p += (char)payload[i];
  Serial.println("[MQTT<-] " + t + " : " + p);

  // Ping → pong
  if (t == String(TOPIC_PING)) {
    JsonDocument pong;
    pong["pong"]        = true;
    pong["gpsModuleOn"] = gpsModuleOn;
    pong["locked"]      = engineLocked;
    pong["simNumber"]   = SIM_NUMBER;
    pong["ts"]          = millis();
    char buf[192];
    serializeJson(pong, buf);
    mqtt.publish(TOPIC_PONG, buf, false);
    Serial.println("[MQTT] Pong sent");
    return;
  }

  // Commands from server
  if (t == String(TOPIC_COMMAND)) {
    JsonDocument doc;
    if (deserializeJson(doc, p) != DeserializationError::Ok) return;
    const char* cmd = doc["command"];
    if (!cmd) return;

    // LOCK: GPIO26 LOW = relay ON = engine cut
    if (strcmp(cmd, "lock") == 0) {
      engineLocked = true;
      digitalWrite(RELAY_PIN, LOW);
      Serial.println("[RELAY] LOCKED (GPIO26=LOW)");
      JsonDocument ack;
      ack["ack"]          = "lock";
      ack["engineLocked"] = true;
      ack["simNumber"]    = SIM_NUMBER;
      char buf[96]; serializeJson(ack, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);

    // UNLOCK: GPIO26 HIGH = relay OFF = engine runs
    } else if (strcmp(cmd, "unlock") == 0) {
      engineLocked = false;
      digitalWrite(RELAY_PIN, HIGH);
      Serial.println("[RELAY] UNLOCKED (GPIO26=HIGH)");
      JsonDocument ack;
      ack["ack"]          = "unlock";
      ack["engineLocked"] = false;
      ack["simNumber"]    = SIM_NUMBER;
      char buf[96]; serializeJson(ack, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);

    // CHECK_INTERNET: signal + GPRS status
    } else if (strcmp(cmd, "check_internet") == 0) {
      int  csq    = modem.getSignalQuality();
      bool gprsOk = modem.isGprsConnected();
      JsonDocument resp;
      resp["cmd"]       = "internet_status";  // key the server parser checks
      resp["signal"]    = csq;
      resp["signalPct"] = min(100, (csq * 100) / 31);
      resp["gprsOk"]    = gprsOk;
      resp["gpsOn"]     = gpsModuleOn;
      resp["locked"]    = engineLocked;
      resp["simNumber"] = SIM_NUMBER;
      resp["ip"]        = modem.localIP().toString();
      char buf[256]; serializeJson(resp, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);
      Serial.print("[CMD] Signal="); Serial.print(csq);
      Serial.println(gprsOk ? " GPRS=OK" : " GPRS=OFF");

    // RESTART: reboot SIM808
    } else if (strcmp(cmd, "restart") == 0) {
      Serial.println("[CMD] Restarting SIM808...");
      JsonDocument resp;
      resp["cmd"]       = "restarting";
      resp["simNumber"] = SIM_NUMBER;
      char buf[96]; serializeJson(resp, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);
      delay(500);
      modem.restart(); delay(3000);
      sendAT("AT+CSCLK=0", "OK", 2000);
      checkGps(); modem.enableGPS();
      connectGPRS(); connectMQTT();
      Serial.println("[CMD] Restart complete");

    // USSD: send USSD code (e.g. *175# to buy data)
    } else if (strcmp(cmd, "ussd") == 0) {
      const char* code = doc["code"];
      if (code) {
        Serial.print("[USSD] "); Serial.println(code);
        String result = modem.sendUSSD(code);
        JsonDocument resp;
        resp["cmd"]           = "ussd_response";  // key the server parser checks
        resp["code"]          = code;
        resp["ussd_response"] = result;
        resp["simNumber"]     = SIM_NUMBER;
        char buf[512]; serializeJson(resp, buf);
        mqtt.publish(TOPIC_TELEMETRY, buf, false);
        Serial.println("[USSD] " + result);
      }
    }
  }
}

// ─── Publish GPS telemetry ────────────────────────────────────────────────────
// Sends every 2s — always, even when stationary.
// Speed comes directly from GPS NMEA data (km/h).
// Server threshold: >= 2 km/h = ACTIVE, < 2 km/h = IDLE.
// When no GPS fix: sends heartbeat (noFix=true) so server stays ONLINE.
void publishGPS() {
  if (millis() - lastTelemetryAt < TELEMETRY_MS) return;
  lastTelemetryAt = millis();

  float lat = 0, lon = 0, spd = 0, alt = 0, acc = 0;
  int   vsat = 0, usat = 0;
  bool  fix  = modem.getGPS(&lat, &lon, &spd, &alt, &vsat, &usat, &acc);

  JsonDocument doc;
  doc["online"]        = true;
  doc["deviceOnline"]  = true;
  doc["engineOn"]      = !engineLocked;
  doc["ignition"]      = !engineLocked;
  doc["engineLocked"]  = engineLocked;
  doc["gpsModuleOn"]   = gpsModuleOn;
  doc["signalQuality"] = modem.getSignalQuality();
  doc["simNumber"]     = SIM_NUMBER;

  if (fix && lat != 0.0f && lon != 0.0f) {
    doc["latitude"]   = serialized(String(lat, 6));
    doc["longitude"]  = serialized(String(lon, 6));
    doc["speed"]      = serialized(String(spd, 2));  // km/h from GPS
    doc["altitude"]   = serialized(String(alt, 2));
    doc["accuracy"]   = serialized(String(acc, 2));
    doc["heading"]    = nullptr;
    doc["satellites"] = usat;
    doc["noFix"]      = false;
    Serial.print("[GPS] ");
    Serial.print(lat, 6); Serial.print(", ");
    Serial.print(lon, 6); Serial.print("  ");
    Serial.print(spd, 1); Serial.print("km/h  Sats:");
    Serial.println(usat);
  } else {
    doc["latitude"]   = nullptr; doc["longitude"]  = nullptr;
    doc["speed"]      = nullptr; doc["altitude"]   = nullptr;
    doc["accuracy"]   = nullptr; doc["heading"]    = nullptr;
    doc["noFix"]      = true;
    static int hb = 0;
    if (++hb % 10 == 1) Serial.println("[GPS] No fix — heartbeat sent");
  }

  doc["fuelLevel"]       = nullptr; doc["fuelUsed"]        = nullptr;
  doc["engineTemp"]      = nullptr; doc["rpm"]             = nullptr;
  doc["batteryVoltage"]  = nullptr; doc["batteryLevelPct"] = nullptr;

  char json[512];
  serializeJson(doc, json);
  if (!mqtt.publish(TOPIC_TELEMETRY, json, false))
    Serial.println("[MQTT] Publish FAILED — will reconnect");
}

// ─── MQTT connect ─────────────────────────────────────────────────────────────
bool connectMQTT() {
  Serial.print("[MQTT] Connecting ");
  Serial.print(MQTT_HOST); Serial.print(":"); Serial.print(MQTT_PORT);
  Serial.print(" ...");
  String cid = "ESP32_" + String(DEVICE_TOKEN).substring(0, 8);
  if (mqtt.connect(cid.c_str(), DEVICE_TOKEN, DEVICE_TOKEN)) {
    Serial.println(" OK");
    mqtt.subscribe(TOPIC_PING,    1);
    mqtt.subscribe(TOPIC_COMMAND, 1);
    JsonDocument a;
    a["online"]    = true;
    a["event"]     = "device_connected";
    a["simNumber"] = SIM_NUMBER;
    char buf[96]; serializeJson(a, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
    return true;
  }
  Serial.print(" FAIL rc="); Serial.println(mqtt.state());
  // rc=-2 → TCP timeout  (port 1883 blocked?)
  // rc= 4 → wrong token  (check DEVICE_TOKEN)
  // rc= 5 → not in DB    (vehicle not registered)
  return false;
}

// ─── GPRS connect ─────────────────────────────────────────────────────────────
bool connectGPRS() {
  Serial.print("[GPRS] APN '"); Serial.print(APN); Serial.print("'...");
  if (modem.gprsConnect(APN, APN_USER, APN_PASS)) {
    Serial.print(" OK  IP:"); Serial.println(modem.localIP());
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

  // Relay default: UNLOCKED (HIGH = off = engine runs)
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  Serial.println("\n======================");
  Serial.println("  ARTIC VMS  v4.0");
  Serial.print  ("  Server  : "); Serial.println(MQTT_HOST);
  Serial.print  ("  Token   : "); Serial.println(String(DEVICE_TOKEN).substring(0,8)+"...");
  Serial.print  ("  SIM     : "); Serial.println(SIM_NUMBER);
  Serial.print  ("  Interval: "); Serial.print(TELEMETRY_MS); Serial.println("ms");
  Serial.println("  Relay   : GPIO26 LOW=LOCK  HIGH=UNLOCK");
  Serial.println("======================\n");

  SerialAT.begin(9600, SERIAL_8N1, RXD2, TXD2);
  delay(2000);

  Serial.println("[MODEM] Restarting...");
  modem.restart(); delay(3000);
  Serial.println("[MODEM] " + modem.getModemInfo());
  Serial.print  ("[MODEM] Signal: "); Serial.println(modem.getSignalQuality());

  sendAT("AT+CSCLK=0", "OK", 2000);
  sendAT("AT+CFUN=1",  "OK", 3000);

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
  mqtt.setSocketTimeout(15);
  mqtt.setBufferSize(512);
  connectMQTT();
}

// ─── Main loop ────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  if (!modem.isGprsConnected()) {
    Serial.println("[GPRS] Lost — reconnecting...");
    modem.gprsDisconnect(); delay(500);
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

  delay(20);
}
