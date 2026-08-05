/*
 * ============================================================
 *  ARTIC VMS — ESP32 DevKit + Air780E + GT-U7 GPS  v1.0
 *
 * ── HARDWARE ─────────────────────────────────────────────────
 *  ESP32 DevKit v1 (30-pin)
 *  Air780E LTE Cat.1 module  (handles GPRS + MQTT)
 *  GT-U7  GPS module         (handles GPS coordinates via NMEA)
 *  Relay module (active LOW, 5V)
 *
 * ── WIRING ───────────────────────────────────────────────────
 *
 *  1.  Air780E ↔ ESP32  (LTE modem — Serial2 on ESP32)
 *      Air780E TX  → ESP32 GPIO16 (RX2)
 *      Air780E RX  → ESP32 GPIO17 (TX2)
 *      Air780E GND → ESP32 GND
 *      Air780E VCC → 5V external supply (min 1.5A — do NOT use ESP32 3.3V)
 *      Air780E PWRKEY → ESP32 GPIO4  (optional: pull HIGH 1s to power on)
 *      Air780E RESET  → ESP32 GPIO5  (optional: pull LOW 200ms to reset)
 *      NOTE: Air780E UART is 3.3V compatible but needs 5V on VCC.
 *
 *  2.  GT-U7 GPS ↔ ESP32  (GPS — Serial1 on ESP32)
 *      GT-U7  TX  → ESP32 GPIO14 (RX1)
 *      GT-U7  RX  → ESP32 GPIO12 (TX1 — optional, not needed for read-only)
 *      GT-U7  VCC → ESP32 3.3V or 5V (module supports both)
 *      GT-U7  GND → ESP32 GND
 *      GT-U7  PPS → not connected (optional 1-PPS pulse, not used here)
 *      Baud rate: 9600 (GT-U7 default)
 *
 *  3.  Relay ↔ ESP32
 *      Relay IN  → ESP32 GPIO26
 *      Relay VCC → ESP32 VIN (5V)
 *      Relay GND → ESP32 GND
 *      Relay COM → ignition wire side A
 *      Relay NC  → ignition wire side B
 *      LOGIC (active LOW module):
 *        GPIO26 HIGH → relay OFF → engine RUNS  (boot default)
 *        GPIO26 LOW  → relay ON  → engine CUT   (locked)
 *
 *  4.  POWER
 *      Use a 12V → 5V DC-DC step-down converter (LM2596 or MP1584):
 *        12V permanent fuse → converter IN+
 *        chassis GND        → converter IN-
 *        converter OUT+     → ESP32 VIN  AND  Air780E VCC
 *        converter OUT-     → ESP32 GND  AND  Air780E GND
 *      Power from PERMANENT 12V (not ignition-switched) so GPS stays
 *      online even when the relay cuts the engine.
 *
 * ── SOFTWARE ─────────────────────────────────────────────────
 *  TinyGSM   by Volodymyr Shymanskyy  — select EC600/EC800 type
 *  TinyGPSPlus by Mikal Hart          — NMEA parser for GT-U7
 *  PubSubClient by Nick O'Leary
 *  ArduinoJson by Benoit Blanchon     v7.x
 *
 *  Install in Arduino IDE:
 *    Tools → Manage Libraries → search and install each
 *
 *  Board: ESP32 Dev Module | Baud: 115200
 *
 * ── CHANGE THESE 4 LINES ────────────────────────────────────
 *  DEVICE_TOKEN → Dashboard → Vehicles → Overview → Copy
 *  SIM_NUMBER   → phone number of SIM in Air780E
 *  APN          → "internet" for Airtel/MTN Rwanda
 *  MQTT_HOST    → your server IP (102.37.128.81)
 * ============================================================
 */

// ── Define modem BEFORE including TinyGSM ───────────────────
// Air780E (EC618) is compatible with SIM7600 AT command set
// TinyGSM v0.12 supports SIM7600 which covers EC618/Air780E
#define TINY_GSM_MODEM_SIM7600
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>   // NMEA parser for GT-U7

// ── CHANGE THESE 4 LINES ────────────────────────────────────
const char DEVICE_TOKEN[] = "PASTE-YOUR-VEHICLE-TOKEN-HERE";
const char SIM_NUMBER[]   = "+250780000000";   // SIM in Air780E
const char APN[]          = "internet";
const char MQTT_HOST[]    = "102.37.128.81";
// ────────────────────────────────────────────────────────────

const char APN_USER[] = "";
const char APN_PASS[] = "";
const int  MQTT_PORT  = 1883;

// ── Pin definitions ──────────────────────────────────────────
// Air780E UART (Serial2)
#define AIR_RXD     16   // ESP32 GPIO16 ← Air780E TX
#define AIR_TXD     17   // ESP32 GPIO17 → Air780E RX
#define AIR_PWRKEY   4   // Optional power-on pin
#define AIR_RESET    5   // Optional reset pin

// GT-U7 GPS UART (Serial1)
#define GPS_RXD     14   // ESP32 GPIO14 ← GT-U7 TX
#define GPS_TXD     12   // ESP32 GPIO12 → GT-U7 RX (not needed)

// Relay (active LOW)
#define RELAY_PIN   26   // GPIO26 HIGH=unlock, LOW=lock

// ── Timing ───────────────────────────────────────────────────
const unsigned long TELEMETRY_MS = 2000;   // Send every 2s
const unsigned long RECONNECT_MS = 3000;
const unsigned long KEEPALIVE_MS = 30000;
const unsigned long GPS_CHECK_MS = 60000;

// ── MQTT topics (built from token in setup) ──────────────────
char TOPIC_TELEMETRY[128];
char TOPIC_PONG[128];
char TOPIC_PING[128];
char TOPIC_COMMAND[128];

// ── Serial ports ─────────────────────────────────────────────
HardwareSerial SerialAT(2);   // Air780E — UART2
HardwareSerial SerialGPS(1);  // GT-U7   — UART1

// ── Objects ──────────────────────────────────────────────────
TinyGsm        modem(SerialAT);
TinyGsmClient  gsm(modem);
PubSubClient   mqtt(gsm);
TinyGPSPlus    gps;          // NMEA parser

// ── State ────────────────────────────────────────────────────
unsigned long lastTelemetryAt = 0;
unsigned long lastReconnectAt = 0;
unsigned long lastKeepAliveAt = 0;
unsigned long lastGpsCheckAt  = 0;
bool engineLocked = false;

// ─── Power on Air780E ─────────────────────────────────────────
// Pull PWRKEY HIGH for 1.2s to turn on module
void powerOnAir780E() {
  if (digitalRead(AIR_PWRKEY) != HIGH) {
    Serial.println("[AIR780E] Powering on...");
    pinMode(AIR_PWRKEY, OUTPUT);
    digitalWrite(AIR_PWRKEY, HIGH);
    delay(1200);
    digitalWrite(AIR_PWRKEY, LOW);
    delay(3000);  // wait for module to boot
  }
}

// ─── AT helper ────────────────────────────────────────────────
bool sendAT(const char* cmd, const char* expected, unsigned long ms = 3000) {
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

// ─── Read GPS from GT-U7 ──────────────────────────────────────
// Call this regularly to feed NMEA sentences to the TinyGPSPlus parser.
// Returns true if a new valid fix is available after this call.
bool readGPS() {
  bool updated = false;
  while (SerialGPS.available()) {
    if (gps.encode(SerialGPS.read())) updated = true;
  }
  return updated;
}

// ─── Publish GPS telemetry ────────────────────────────────────
void publishGPS() {
  if (millis() - lastTelemetryAt < TELEMETRY_MS) return;
  lastTelemetryAt = millis();

  // Pull any waiting NMEA data
  readGPS();

  bool hasFix  = gps.location.isValid() && gps.location.age() < 2000;
  double lat   = hasFix ? gps.location.lat()  : 0.0;
  double lon   = hasFix ? gps.location.lng()  : 0.0;
  double spd   = hasFix ? gps.speed.kmph()    : 0.0;   // km/h directly
  double alt   = hasFix ? gps.altitude.meters() : 0.0;
  int    sats  = hasFix ? (int)gps.satellites.value() : 0;
  double hdop  = hasFix ? gps.hdop.hdop() : 0.0;       // accuracy proxy
  // Convert HDOP to metres accuracy (rough: acc ≈ HDOP × 5m for typical GPS)
  double acc   = hasFix ? hdop * 5.0 : 0.0;

  JsonDocument doc;
  doc["online"]        = true;
  doc["deviceOnline"]  = true;
  doc["engineOn"]      = !engineLocked;
  doc["ignition"]      = !engineLocked;
  doc["engineLocked"]  = engineLocked;
  doc["gpsModuleOn"]   = true;
  doc["signalQuality"] = modem.getSignalQuality();
  doc["simNumber"]     = SIM_NUMBER;

  if (hasFix) {
    doc["latitude"]   = serialized(String(lat, 6));
    doc["longitude"]  = serialized(String(lon, 6));
    doc["speed"]      = serialized(String(spd, 2));
    doc["altitude"]   = serialized(String(alt, 2));
    doc["accuracy"]   = serialized(String(acc, 2));
    doc["heading"]    = nullptr;
    doc["satellites"] = sats;
    doc["noFix"]      = false;
    Serial.printf("[GPS] %.6f, %.6f  %.1fkm/h  Sats:%d  HDOP:%.1f\n",
                  lat, lon, spd, sats, hdop);
  } else {
    doc["latitude"]   = nullptr; doc["longitude"]  = nullptr;
    doc["speed"]      = nullptr; doc["altitude"]   = nullptr;
    doc["accuracy"]   = nullptr; doc["heading"]    = nullptr;
    doc["noFix"]      = true;
    static int hb = 0;
    if (++hb % 10 == 1) Serial.println("[GPS] No fix — heartbeat");
  }

  doc["fuelLevel"]      = nullptr; doc["fuelUsed"]        = nullptr;
  doc["engineTemp"]     = nullptr; doc["rpm"]             = nullptr;
  doc["batteryVoltage"] = nullptr; doc["batteryLevelPct"] = nullptr;

  char json[512];
  serializeJson(doc, json);
  if (!mqtt.publish(TOPIC_TELEMETRY, json, false))
    Serial.println("[MQTT] Publish FAILED");
}

// ─── MQTT message callback ────────────────────────────────────
void onMessage(char* topic, byte* payload, unsigned int len) {
  String t = String(topic);
  String p = "";
  for (unsigned int i = 0; i < len; i++) p += (char)payload[i];
  Serial.println("[MQTT<-] " + t + " : " + p);

  // Ping → pong
  if (t == String(TOPIC_PING)) {
    JsonDocument pong;
    pong["pong"]      = true;
    pong["locked"]    = engineLocked;
    pong["simNumber"] = SIM_NUMBER;
    pong["ts"]        = millis();
    char buf[192]; serializeJson(pong, buf);
    mqtt.publish(TOPIC_PONG, buf, false);
    Serial.println("[MQTT] Pong sent");
    return;
  }

  if (t == String(TOPIC_COMMAND)) {
    JsonDocument doc;
    if (deserializeJson(doc, p) != DeserializationError::Ok) return;
    const char* cmd = doc["command"];
    if (!cmd) return;

    // LOCK
    if (strcmp(cmd, "lock") == 0) {
      engineLocked = true;
      digitalWrite(RELAY_PIN, LOW);
      Serial.println("[RELAY] LOCKED");
      JsonDocument ack;
      ack["ack"]          = "lock";
      ack["engineLocked"] = true;
      ack["simNumber"]    = SIM_NUMBER;
      char buf[96]; serializeJson(ack, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);

    // UNLOCK
    } else if (strcmp(cmd, "unlock") == 0) {
      engineLocked = false;
      digitalWrite(RELAY_PIN, HIGH);
      Serial.println("[RELAY] UNLOCKED");
      JsonDocument ack;
      ack["ack"]          = "unlock";
      ack["engineLocked"] = false;
      ack["simNumber"]    = SIM_NUMBER;
      char buf[96]; serializeJson(ack, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);

    // CHECK_INTERNET
    } else if (strcmp(cmd, "check_internet") == 0) {
      int  csq    = modem.getSignalQuality();
      bool gprsOk = modem.isGprsConnected();
      JsonDocument resp;
      resp["cmd"]       = "internet_status";
      resp["signal"]    = csq;
      resp["signalPct"] = min(100, (csq * 100) / 31);
      resp["gprsOk"]    = gprsOk;
      resp["gpsOn"]     = true;
      resp["locked"]    = engineLocked;
      resp["simNumber"] = SIM_NUMBER;
      resp["ip"]        = modem.localIP().toString();
      char buf[256]; serializeJson(resp, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);
      Serial.printf("[CMD] Signal=%d %s\n", csq, gprsOk ? "GPRS=OK" : "GPRS=OFF");

    // RESTART
    } else if (strcmp(cmd, "restart") == 0) {
      Serial.println("[CMD] Restarting Air780E...");
      JsonDocument resp;
      resp["cmd"]       = "restarting";
      resp["simNumber"] = SIM_NUMBER;
      char buf[96]; serializeJson(resp, buf);
      mqtt.publish(TOPIC_TELEMETRY, buf, false);
      delay(300);
      modem.restart(); delay(3000);
      connectGPRS(); connectMQTT();
      Serial.println("[CMD] Restart done");

    // USSD
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

// ─── GPRS connect ─────────────────────────────────────────────
bool connectGPRS() {
  Serial.print("[GPRS] APN '"); Serial.print(APN); Serial.print("'...");
  if (modem.gprsConnect(APN, APN_USER, APN_PASS)) {
    Serial.print(" OK  IP:"); Serial.println(modem.localIP());
    return true;
  }
  Serial.println(" FAIL");
  return false;
}

// ─── MQTT connect ─────────────────────────────────────────────
bool connectMQTT() {
  Serial.print("[MQTT] Connecting "); Serial.print(MQTT_HOST);
  Serial.print(":"); Serial.print(MQTT_PORT); Serial.print("...");
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
  return false;
}

// ─── Setup ────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(300);

  snprintf(TOPIC_TELEMETRY, 128, "artic/%s/telemetry", DEVICE_TOKEN);
  snprintf(TOPIC_PONG,      128, "artic/%s/pong",      DEVICE_TOKEN);
  snprintf(TOPIC_PING,      128, "artic/%s/ping",      DEVICE_TOKEN);
  snprintf(TOPIC_COMMAND,   128, "artic/%s/command",   DEVICE_TOKEN);

  // Relay — default UNLOCKED
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  Serial.println("\n==============================");
  Serial.println("  ARTIC VMS — Air780E + GT-U7");
  Serial.print  ("  Server  : "); Serial.println(MQTT_HOST);
  Serial.print  ("  Token   : "); Serial.println(String(DEVICE_TOKEN).substring(0,8)+"...");
  Serial.print  ("  SIM     : "); Serial.println(SIM_NUMBER);
  Serial.println("  Relay   : GPIO26  LOW=LOCK  HIGH=UNLOCK");
  Serial.println("==============================\n");

  // ── Start GPS serial (GT-U7 default baud: 9600) ────────────
  SerialGPS.begin(9600, SERIAL_8N1, GPS_RXD, GPS_TXD);
  Serial.println("[GT-U7] GPS serial started (9600 baud)");

  // ── Start Air780E serial (default 115200 baud) ─────────────
  SerialAT.begin(115200, SERIAL_8N1, AIR_RXD, AIR_TXD);
  delay(1000);

  // Power on the module if PWRKEY is connected
  pinMode(AIR_PWRKEY, OUTPUT);
  powerOnAir780E();

  // ── Init modem ──────────────────────────────────────────────
  Serial.println("[Air780E] Initialising...");
  modem.restart();
  delay(3000);

  String info = modem.getModemInfo();
  Serial.println("[Air780E] " + info);
  Serial.print  ("[Air780E] Signal: "); Serial.println(modem.getSignalQuality());

  // Disable sleep, full functionality
  sendAT("AT+CSCLK=0", "OK");
  sendAT("AT+CFUN=1",  "OK", 5000);

  // ── Connect GPRS ────────────────────────────────────────────
  while (!connectGPRS()) {
    Serial.println("[GPRS] Retry in 5s...");
    delay(5000);
  }

  // ── Setup MQTT ──────────────────────────────────────────────
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
  mqtt.setKeepAlive(60);
  mqtt.setSocketTimeout(15);
  mqtt.setBufferSize(1024);
  connectMQTT();
}

// ─── Main loop ────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // Feed GPS parser continuously
  readGPS();

  // Keep GPRS alive
  if (!modem.isGprsConnected()) {
    Serial.println("[GPRS] Lost — reconnecting...");
    modem.gprsDisconnect(); delay(300);
    connectGPRS();
  }

  // Keep MQTT alive
  if (!mqtt.connected()) {
    if (now - lastReconnectAt > RECONNECT_MS) {
      lastReconnectAt = now;
      connectMQTT();
    }
  } else {
    mqtt.loop();
  }

  // AT keepalive every 30s
  if (now - lastKeepAliveAt > KEEPALIVE_MS) {
    lastKeepAliveAt = now;
    if (!sendAT("AT", "OK", 1500))
      Serial.println("[Air780E] Not responding");
  }

  // Send GPS every 2s
  if (mqtt.connected()) publishGPS();

  delay(10);
}
