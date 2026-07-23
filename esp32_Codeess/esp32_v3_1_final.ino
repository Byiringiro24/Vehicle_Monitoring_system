/*
 * ============================================================
 *  ARTIC VMS — ESP32 + SIM808 GPS Tracker  v3.1
 *
 *  CHANGES FROM v3.0:
 *   - SIM number is registered in this sketch (SIM_NUMBER below)
 *   - SIM number is sent in every telemetry packet
 *   - Server saves and verifies it — only valid for THIS vehicle's token
 *   - Sends GPS every 2 seconds (always, even when stationary)
 *   - Supports all remote commands: lock, unlock, check_internet,
 *     restart, ussd, ping
 *
 *  CHANGE ONLY:
 *    1. DEVICE_TOKEN → Dashboard → Vehicles → Overview → Copy
 *    2. SIM_NUMBER   → the phone number of the SIM in this device
 *    3. APN          → "internet" for Airtel/MTN Rwanda
 *    4. MQTT_HOST    → your server IP
 *
 *  WIRING:
 *    ESP32 GPIO16 (RX2) ← SIM808 TX
 *    ESP32 GPIO17 (TX2) → SIM808 RX
 *    ESP32 GND          — SIM808 GND
 *    SIM808 VCC         → 4.0–4.2V supply (min 2A, NOT from ESP32)
 *    ESP32 GPIO26       → Relay IN
 *    ESP32 5V (VIN)     → Relay VCC
 *    ESP32 GND          — Relay GND
 *    Relay COM          — one side of ignition wire
 *    Relay NC           — other side of ignition wire
 *
 *  RELAY LOGIC (active LOW):
 *    GPIO26 HIGH = relay OFF = engine RUNS  (boot default)
 *    GPIO26 LOW  = relay ON  = engine CUT   (locked)
 *
 *  LIBRARIES (Tools → Manage Libraries):
 *    TinyGSM      by Volodymyr Shymanskyy  v0.12.0+
 *    PubSubClient by Nick O'Leary          v2.8
 *    ArduinoJson  by Benoit Blanchon       v7.x
 *
 *  BOARD: esp32 → ESP32 Dev Module | Baud: 115200
 * ============================================================
 */

#define TINY_GSM_MODEM_SIM808
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ============================================================
//  !! CHANGE THESE FOUR LINES !!
// ============================================================

// 1. Vehicle device token — Dashboard → Vehicles → Overview → Copy button
const char DEVICE_TOKEN[] = "5466f18d-ffd6-4267-ad81-93583d1bbaa4";

// 2. SIM card phone number in this GPS device (for verification)
//    Format: +250780123456  or  0780123456
const char SIM_NUMBER[]   = "+250733768958";

// 3. SIM card APN
const char APN[]          = "internet";

// 4. Server IP
const char MQTT_HOST[]    = "172.209.217.176";

// ============================================================
//  DO NOT CHANGE BELOW THIS LINE
// ============================================================

const char APN_USER[]  = "";
const char APN_PASS[]  = "";
const int  MQTT_PORT   = 1883;

#define RXD2        16
#define TXD2        17
#define RELAY_PIN   26

// Timing
const unsigned long TELEMETRY_MS  = 2000;   // send GPS every 2 seconds
const unsigned long RECONNECT_MS  = 3000;   // retry MQTT after 3 seconds
const unsigned long KEEPALIVE_MS  = 30000;  // AT keepalive every 30s
const unsigned long GPS_CHECK_MS  = 60000;  // GPS health check every 60s

// MQTT Topics (built from token in setup)
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
    Serial.println("[GPS] OFF - restarting...");
    gpsModuleOn = false;
    if (sendAT("AT+CGNSPWR=1", "OK", 3000)) {
      gpsModuleOn = true;
      Serial.println("[GPS] Restarted OK");
    }
  }
}

// ─── MQTT Message Callback ────────────────────────────────────────────────────
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

  // Commands
  if (t == String(TOPIC_COMMAND)) {
    JsonDocument doc;
    if (deserializeJson(doc, p) != DeserializationError::Ok) return;
    const char* cmd = doc["command"];
    if (!cmd) return;

    // Lock engine (relay ON)
    if (strcmp(cmd, "lock") == 0) {
      engineLocked = true;
      digitalWrite(RELAY_PIN, LOW);
      Serial.println("[RELAY] LOCKED");
      JsonDocument ack;
      ack["ack"] = "lock"; ack["engineLocked"] = true; ack["simNumber"] = SIM_NUMBER;
      char buf[96]; serializeJson(ack, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);

    // Unlock engine (relay OFF)
    } else if (strcmp(cmd, "unlock") == 0) {
      engineLocked = false;
      digitalWrite(RELAY_PIN, HIGH);
      Serial.println("[RELAY] UNLOCKED");
      JsonDocument ack;
      ack["ack"] = "unlock"; ack["engineLocked"] = false; ack["simNumber"] = SIM_NUMBER;
      char buf[96]; serializeJson(ack, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);

    // Check internet / signal quality
    } else if (strcmp(cmd, "check_internet") == 0) {
      int csq = modem.getSignalQuality();
      bool gprsOk = modem.isGprsConnected();
      JsonDocument resp;
      resp["cmd"]        = "internet_status";
      resp["signal"]     = csq;
      resp["signalPct"]  = min(100, (csq * 100) / 31);
      resp["gprsOk"]     = gprsOk;
      resp["gpsOn"]      = gpsModuleOn;
      resp["locked"]     = engineLocked;
      resp["simNumber"]  = SIM_NUMBER;
      resp["ip"]         = modem.localIP().toString();
      char buf[256]; serializeJson(resp, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);
      Serial.print("[CMD] Signal="); Serial.print(csq);
      Serial.println(gprsOk ? " GPRS=OK" : " GPRS=OFF");

    // Restart SIM808
    } else if (strcmp(cmd, "restart") == 0) {
      Serial.println("[CMD] Restarting SIM808...");
      JsonDocument resp; resp["cmd"] = "restarting"; resp["simNumber"] = SIM_NUMBER;
      char buf[96]; serializeJson(resp, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);
      delay(500);
      modem.restart(); delay(3000);
      sendAT("AT+CSCLK=0", "OK", 2000);
      checkGps(); modem.enableGPS();
      connectGPRS(); connectMQTT();
      Serial.println("[CMD] Restart complete");

    // Send USSD code
    } else if (strcmp(cmd, "ussd") == 0) {
      const char* code = doc["code"];
      if (code) {
        Serial.print("[USSD] "); Serial.println(code);
        String result = modem.sendUSSD(code);
        JsonDocument resp;
        resp["cmd"]           = "ussd_response";
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

// ─── Publish GPS Telemetry ────────────────────────────────────────────────────
// Speed smoothing — average last 3 readings to reduce GPS noise
float speedHistory[3] = {0, 0, 0};
int   speedIdx = 0;

float smoothSpeed(float raw) {
  speedHistory[speedIdx % 3] = raw;
  speedIdx++;
  float sum = 0;
  for (int i = 0; i < 3; i++) sum += speedHistory[i];
  return sum / 3.0f;
}

void publishGPS() {
  if (millis() - lastTelemetryAt < TELEMETRY_MS) return;
  lastTelemetryAt = millis();

  float lat = 0, lon = 0, spd = 0, alt = 0, acc = 0;
  int   vsat = 0, usat = 0;
  bool  fix  = modem.getGPS(&lat, &lon, &spd, &alt, &vsat, &usat, &acc);

  // Apply smoothing and noise floor — SIM808 reports 0.5–2.5 km/h even when stationary
  // Only report non-zero speed if smoothed value reaches 3 km/h (real movement threshold)
  float smoothedSpd = smoothSpeed(fix ? spd : 0.0f);
  float reportedSpd = (smoothedSpd >= 3.0f) ? smoothedSpd : 0.0f;

  JsonDocument doc;
  doc["online"]        = true;
  doc["deviceOnline"]  = true;
  doc["engineOn"]      = !engineLocked;
  doc["ignition"]      = !engineLocked;
  doc["engineLocked"]  = engineLocked;
  doc["gpsModuleOn"]   = gpsModuleOn;
  doc["signalQuality"] = modem.getSignalQuality();
  doc["simNumber"]     = SIM_NUMBER;   // always include for server-side verification

  if (fix && lat != 0.0f && lon != 0.0f) {
    doc["latitude"]   = serialized(String(lat, 6));
    doc["longitude"]  = serialized(String(lon, 6));
    doc["speed"]      = serialized(String(reportedSpd, 2));  // smoothed, noise-filtered
    doc["altitude"]   = serialized(String(alt, 2));
    doc["accuracy"]   = serialized(String(acc, 2));
    doc["heading"]    = nullptr;
    doc["satellites"] = usat;
    Serial.print("[GPS] ");
    Serial.print(lat, 6); Serial.print(", "); Serial.print(lon, 6);
    Serial.print("  raw:"); Serial.print(spd, 1);
    Serial.print(" smooth:"); Serial.print(reportedSpd, 1); Serial.print("km/h");
    Serial.print("  Sats:"); Serial.println(usat);
  } else {
    doc["latitude"]  = nullptr; doc["longitude"] = nullptr;
    doc["speed"]     = nullptr; doc["altitude"]  = nullptr;
    doc["accuracy"]  = nullptr; doc["heading"]   = nullptr;
    doc["noFix"]     = true;
    static int hb = 0;
    if (++hb % 10 == 1) Serial.println("[GPS] No fix - heartbeat");
  }

  doc["fuelLevel"] = nullptr; doc["fuelUsed"]       = nullptr;
  doc["engineTemp"]= nullptr; doc["rpm"]            = nullptr;
  doc["batteryVoltage"] = nullptr; doc["batteryLevelPct"] = nullptr;

  char json[512];
  serializeJson(doc, json);
  bool ok = mqtt.publish(TOPIC_TELEMETRY, json, false);
  if (!ok) Serial.println("[MQTT] FAIL - will reconnect");
}

// ─── MQTT Connect ─────────────────────────────────────────────────────────────
bool connectMQTT() {
  Serial.print("[MQTT] ");
  Serial.print(MQTT_HOST); Serial.print(":"); Serial.print(MQTT_PORT);
  Serial.print(" ...");
  String cid = "ESP32_" + String(DEVICE_TOKEN).substring(0, 8);
  if (mqtt.connect(cid.c_str(), DEVICE_TOKEN, DEVICE_TOKEN)) {
    Serial.println(" OK");
    mqtt.subscribe(TOPIC_PING,    1);
    mqtt.subscribe(TOPIC_COMMAND, 1);
    JsonDocument a; a["online"] = true; a["event"] = "device_connected"; a["simNumber"] = SIM_NUMBER;
    char buf[96]; serializeJson(a, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
    return true;
  }
  Serial.print(" FAIL rc="); Serial.println(mqtt.state());
  return false;
}

// ─── GPRS Connect ─────────────────────────────────────────────────────────────
bool connectGPRS() {
  Serial.print("[GPRS] APN '"); Serial.print(APN); Serial.print("' ...");
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

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);   // boot unlocked

  Serial.println("\n======================");
  Serial.println("  ARTIC VMS  v3.1");
  Serial.print  ("  Server : "); Serial.println(MQTT_HOST);
  Serial.print  ("  Token  : "); Serial.println(String(DEVICE_TOKEN).substring(0,8)+"...");
  Serial.print  ("  SIM    : "); Serial.println(SIM_NUMBER);
  Serial.print  ("  Interval: "); Serial.print(TELEMETRY_MS); Serial.println("ms");
  Serial.println("======================\n");

  SerialAT.begin(9600, SERIAL_8N1, RXD2, TXD2);
  delay(2000);

  Serial.println("[MODEM] Restarting...");
  modem.restart(); delay(3000);

  Serial.println("[MODEM] " + modem.getModemInfo());
  Serial.print("[MODEM] Signal: "); Serial.println(modem.getSignalQuality());

  sendAT("AT+CSCLK=0", "OK", 2000);   // disable sleep
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
  mqtt.setSocketTimeout(15);
  mqtt.setBufferSize(512);
  connectMQTT();
}

// ─── Main Loop ────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  if (!modem.isGprsConnected()) {
    Serial.println("[GPRS] Lost - reconnecting...");
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
