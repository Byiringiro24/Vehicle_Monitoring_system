/*
 * ============================================================
 *  ARTIC VMS — ESP32 + Air780E + GT-U7  v2.0  ← UPLOAD THIS
 *
 *  Hardware:
 *    ESP32 DevKit v1 (30-pin)
 *    Air780E — LTE Cat.1 modem (handles SIM, GPRS, MQTT)
 *    GT-U7   — standalone GPS module (parses NMEA sentences)
 *    Relay module (active LOW, 5V)
 *
 * ── WHAT YOU MUST CHANGE BEFORE UPLOADING ────────────────────
 *  1. DEVICE_TOKEN → Dashboard → Vehicles → Overview → Copy
 *  2. SIM_NUMBER   → phone number on the SIM card in Air780E
 *  3. APN          → "internet" for MTN / Airtel Rwanda
 *
 * ── WIRING ───────────────────────────────────────────────────
 *
 *  Air780E (LTE modem) ↔ ESP32 — use Serial2 (UART2)
 *    Air780E TX  → ESP32 GPIO16 (RX2)
 *    Air780E RX  → ESP32 GPIO17 (TX2)
 *    Air780E GND → ESP32 GND
 *    Air780E VCC → 5V external (min 1.5A — DO NOT use ESP32 3.3V!)
 *    Air780E PWRKEY → ESP32 GPIO4  (pull HIGH 1.2s to power on)
 *    Air780E RST    → ESP32 GPIO5  (optional hardware reset)
 *
 *  GT-U7 (GPS) ↔ ESP32 — use Serial1 (UART1) remapped
 *    GT-U7 TX → ESP32 GPIO14  (RX1)
 *    GT-U7 RX → ESP32 GPIO12  (TX1 — not needed, GPS is read-only)
 *    GT-U7 VCC → ESP32 3.3V
 *    GT-U7 GND → ESP32 GND
 *    Baud: 9600
 *
 *    ⚠ IMPORTANT — UART1 conflict:
 *    If you use GPIO14/GPIO12 for GPS, there is no USB conflict.
 *    If you wired GPS to GPIO3/GPIO1 (the default UART0/USB pins),
 *    disconnect the GT-U7 TX wire from GPIO3 BEFORE uploading,
 *    then reconnect it after upload is done.
 *    Using GPIO14 (RX1) avoids this issue entirely.
 *
 *  Relay ↔ ESP32
 *    Relay IN  → ESP32 GPIO26
 *    Relay VCC → ESP32 VIN (5V)
 *    Relay GND → ESP32 GND
 *    Relay COM → ignition wire side A
 *    Relay NC  → ignition wire side B
 *    Logic: GPIO26 HIGH = relay off = engine runs (boot default)
 *           GPIO26 LOW  = relay on  = engine cut  (locked)
 *
 *  Power supply:
 *    12V → 5V DC-DC step-down → ESP32 VIN + Air780E VCC
 *    Use PERMANENT 12V (not ignition line) so GPS stays on after lock.
 *
 * ── LIBRARIES ─────────────────────────────────────────────────
 *  TinyGSM      by Volodymyr Shymanskyy  ≥ v0.12.0
 *  TinyGPSPlus  by Mikal Hart             ≥ v1.0.3
 *  PubSubClient by Nick O'Leary           ≥ v2.8
 *  ArduinoJson  by Benoit Blanchon        v7.x
 *
 * ── BOARD SETTINGS ───────────────────────────────────────────
 *  Board: ESP32 Dev Module | Speed: 115200
 * ============================================================
 */

// Air780E is compatible with SIM7600 AT commands in TinyGSM
#define TINY_GSM_MODEM_SIM7600
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>

// ═══════════════════════════════════════════════════════════════
//  ↓↓  CHANGE ONLY THESE 3 LINES  ↓↓
// ═══════════════════════════════════════════════════════════════
const char DEVICE_TOKEN[] = "PASTE-YOUR-TOKEN-HERE";
const char SIM_NUMBER[]   = "+250700000000";
const char APN[]          = "internet";
// ═══════════════════════════════════════════════════════════════

const char MQTT_HOST[]  = "185.208.207.100";   // articvms.ddnsgeek.com
const char APN_USER[]   = "";
const char APN_PASS[]   = "";
const int  MQTT_PORT    = 1883;

// ── Pins ─────────────────────────────────────────────────────
#define AIR_RXD    16   // ESP32 GPIO16 ← Air780E TX
#define AIR_TXD    17   // ESP32 GPIO17 → Air780E RX
#define AIR_PWRKEY  4   // power on/off key
#define AIR_RST     5   // hardware reset (optional)
#define GPS_RXD    14   // GT-U7 TX → GPIO14 (RX1 remapped)
#define GPS_TXD    12   // GT-U7 RX ← GPIO12 (TX1 remapped, not used)
#define RELAY_PIN  26

// ── Timing ───────────────────────────────────────────────────
const unsigned long TELEMETRY_MS = 2000;
const unsigned long RECONNECT_MS = 5000;
const unsigned long KEEPALIVE_MS = 30000;

// ── MQTT topics ──────────────────────────────────────────────
char TOPIC_TELEMETRY[128];
char TOPIC_PONG[128];
char TOPIC_PING[128];
char TOPIC_COMMAND[128];

HardwareSerial SerialAT (2);    // Air780E — UART2, GPIO16/17
HardwareSerial SerialGPS(1);    // GT-U7   — UART1 remapped to GPIO14/12

TinyGsm       modem(SerialAT);
TinyGsmClient gsmClient(modem);
PubSubClient  mqtt(gsmClient);
TinyGPSPlus   gps;

unsigned long lastTelemetryAt = 0;
unsigned long lastReconnectAt = 0;
unsigned long lastKeepAliveAt = 0;
bool          engineLocked    = false;

// ─── AT helper ────────────────────────────────────────────────
bool sendAT(const char* cmd, const char* expected, unsigned long ms = 3000) {
  while (SerialAT.available()) SerialAT.read();
  SerialAT.println(cmd);
  String r = "";
  unsigned long dl = millis() + ms;
  while (millis() < dl) {
    while (SerialAT.available()) r += (char)SerialAT.read();
    if (r.indexOf(expected) >= 0) return true;
    delay(20);
  }
  return false;
}

// ─── Power on Air780E ─────────────────────────────────────────
void powerOnAir780E() {
  Serial.println(F("[Air780E] Powering on..."));
  pinMode(AIR_PWRKEY, OUTPUT);
  digitalWrite(AIR_PWRKEY, LOW);
  delay(100);
  digitalWrite(AIR_PWRKEY, HIGH);
  delay(1200);
  digitalWrite(AIR_PWRKEY, LOW);
  delay(3000);
  Serial.println(F("[Air780E] Power on sequence done"));
}

// ─── Read GT-U7 GPS NMEA data ─────────────────────────────────
// Call continuously to keep parser fed
void readGPS() {
  while (SerialGPS.available()) {
    gps.encode(SerialGPS.read());
  }
}

// ─── MQTT message callback ────────────────────────────────────
void onMQTTMessage(char* topic, byte* payload, unsigned int len) {
  String t = String(topic);
  String p = "";
  for (unsigned int i = 0; i < len; i++) p += (char)payload[i];

  if (t == String(TOPIC_PING)) {
    JsonDocument pong;
    pong["pong"]      = true;
    pong["locked"]    = engineLocked;
    pong["simNumber"] = SIM_NUMBER;
    pong["uptime"]    = millis() / 1000;
    pong["gpsAge"]    = gps.location.isValid() ? (int)gps.location.age() : -1;
    char buf[200]; serializeJson(pong, buf);
    mqtt.publish(TOPIC_PONG, buf, false);
    return;
  }

  if (t != String(TOPIC_COMMAND)) return;

  JsonDocument cmd;
  if (deserializeJson(cmd, p) != DeserializationError::Ok) return;
  const char* command = cmd["command"];
  if (!command) return;
  Serial.print(F("[CMD] ")); Serial.println(command);

  if (strcmp(command, "lock") == 0) {
    engineLocked = true;
    digitalWrite(RELAY_PIN, LOW);
    Serial.println(F("[RELAY] LOCKED"));
    JsonDocument ack;
    ack["ack"] = "lock"; ack["engineLocked"] = true; ack["simNumber"] = SIM_NUMBER;
    char buf[100]; serializeJson(ack, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);

  } else if (strcmp(command, "unlock") == 0) {
    engineLocked = false;
    digitalWrite(RELAY_PIN, HIGH);
    Serial.println(F("[RELAY] UNLOCKED"));
    JsonDocument ack;
    ack["ack"] = "unlock"; ack["engineLocked"] = false; ack["simNumber"] = SIM_NUMBER;
    char buf[100]; serializeJson(ack, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);

  } else if (strcmp(command, "check_internet") == 0) {
    int  signal = modem.getSignalQuality();
    bool gprsOk = modem.isGprsConnected();
    JsonDocument resp;
    resp["cmd"]       = "internet_status";
    resp["signal"]    = signal;
    resp["signalPct"] = min(100, (signal * 100) / 31);
    resp["gprsOk"]    = gprsOk;
    resp["gpsOn"]     = gps.location.isValid();
    resp["locked"]    = engineLocked;
    resp["simNumber"] = SIM_NUMBER;
    resp["ip"]        = modem.localIP().toString();
    char buf[280]; serializeJson(resp, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);

  } else if (strcmp(command, "restart") == 0) {
    JsonDocument resp;
    resp["cmd"] = "restarting"; resp["simNumber"] = SIM_NUMBER;
    char buf[96]; serializeJson(resp, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
    delay(300);
    modem.restart(); delay(3000);
    connectGPRS(); connectMQTT();

  } else if (strcmp(command, "ussd") == 0) {
    const char* code = cmd["code"];
    if (!code) return;
    String result = modem.sendUSSD(code);
    JsonDocument resp;
    resp["cmd"] = "ussd_response"; resp["code"] = code;
    resp["ussd_response"] = result; resp["simNumber"] = SIM_NUMBER;
    char buf[520]; serializeJson(resp, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
    Serial.print(F("[USSD] ")); Serial.println(result);
  }
}

// ─── GPRS connect ─────────────────────────────────────────────
bool connectGPRS() {
  Serial.print(F("[GPRS] Connecting... "));
  if (modem.gprsConnect(APN, APN_USER, APN_PASS)) {
    Serial.print(F("OK IP=")); Serial.println(modem.localIP());
    return true;
  }
  Serial.println(F("FAIL"));
  return false;
}

// ─── MQTT connect ─────────────────────────────────────────────
bool connectMQTT() {
  Serial.print(F("[MQTT] Connecting... "));
  String cid = "artic_" + String(DEVICE_TOKEN).substring(0, 8);
  if (mqtt.connect(cid.c_str(), DEVICE_TOKEN, DEVICE_TOKEN)) {
    Serial.println(F("OK"));
    mqtt.subscribe(TOPIC_PING, 1);
    mqtt.subscribe(TOPIC_COMMAND, 1);
    JsonDocument a;
    a["online"] = true; a["event"] = "device_connected"; a["simNumber"] = SIM_NUMBER;
    char buf[100]; serializeJson(a, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
    return true;
  }
  Serial.print(F("FAIL rc=")); Serial.println(mqtt.state());
  return false;
}

// ─── Send telemetry ───────────────────────────────────────────
void sendTelemetry() {
  if (millis() - lastTelemetryAt < TELEMETRY_MS) return;
  lastTelemetryAt = millis();

  readGPS();

  // Valid fix: location is valid AND updated within the last 2s
  bool hasFix = gps.location.isValid() && gps.location.age() < 2000;
  double lat  = hasFix ? gps.location.lat()   : 0.0;
  double lon  = hasFix ? gps.location.lng()   : 0.0;
  double spd  = hasFix ? gps.speed.kmph()     : 0.0;
  double alt  = hasFix ? gps.altitude.meters(): 0.0;
  int    sats = hasFix ? (int)gps.satellites.value() : 0;
  // Accuracy: HDOP × 5m (rough approximation for typical GPS)
  double acc  = hasFix ? gps.hdop.hdop() * 5.0 : 0.0;

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
    doc["satellites"] = sats;
    doc["heading"]    = nullptr;
    doc["noFix"]      = false;
    Serial.printf("[GPS] %.6f, %.6f  %.1fkm/h  sats:%d\n", lat, lon, spd, sats);
  } else {
    doc["latitude"] = nullptr; doc["longitude"] = nullptr;
    doc["speed"]    = nullptr; doc["altitude"]  = nullptr;
    doc["accuracy"] = nullptr; doc["heading"]   = nullptr;
    doc["noFix"]    = true;
    static int hb = 0;
    if (++hb % 15 == 1) Serial.println(F("[GPS] No fix — heartbeat"));
  }

  doc["fuelLevel"]       = nullptr; doc["fuelUsed"]    = nullptr;
  doc["engineTemp"]      = nullptr; doc["rpm"]         = nullptr;
  doc["batteryVoltage"]  = nullptr; doc["batteryLevelPct"] = nullptr;

  char json[560];
  serializeJson(doc, json);
  if (!mqtt.publish(TOPIC_TELEMETRY, json, false))
    Serial.println(F("[MQTT] Publish FAILED"));
}

// ─── setup ────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(400);

  snprintf(TOPIC_TELEMETRY, 128, "artic/%s/telemetry", DEVICE_TOKEN);
  snprintf(TOPIC_PONG,      128, "artic/%s/pong",      DEVICE_TOKEN);
  snprintf(TOPIC_PING,      128, "artic/%s/ping",      DEVICE_TOKEN);
  snprintf(TOPIC_COMMAND,   128, "artic/%s/command",   DEVICE_TOKEN);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);   // default: unlocked

  Serial.println(F("\n========================================="));
  Serial.println(F("  ARTIC VMS v2.0 — Air780E + GT-U7"));
  Serial.print  (F("  Server : ")); Serial.println(MQTT_HOST);
  Serial.print  (F("  Token  : ")); Serial.println(String(DEVICE_TOKEN).substring(0, 12) + "...");
  Serial.print  (F("  SIM    : ")); Serial.println(SIM_NUMBER);
  Serial.println(F("=========================================\n"));

  if (String(DEVICE_TOKEN) == "PASTE-YOUR-TOKEN-HERE") {
    Serial.println(F("ERROR: Set DEVICE_TOKEN before uploading!"));
    pinMode(2, OUTPUT);
    while (true) { digitalWrite(2, HIGH); delay(250); digitalWrite(2, LOW); delay(250); }
  }

  // GT-U7 GPS serial — using GPIO14 (RX1) to avoid UART0 conflict
  SerialGPS.begin(9600, SERIAL_8N1, GPS_RXD, GPS_TXD);
  Serial.println(F("[GT-U7] GPS serial started on GPIO14/12"));

  // Air780E modem serial
  SerialAT.begin(115200, SERIAL_8N1, AIR_RXD, AIR_TXD);
  delay(500);
  powerOnAir780E();

  Serial.println(F("[Air780E] Initialising..."));
  modem.restart(); delay(3000);

  String info = modem.getModemInfo();
  Serial.print(F("[Air780E] ")); Serial.println(info);
  Serial.printf("[Air780E] Signal: %d/31 (%d%%)\n",
    modem.getSignalQuality(), min(100, (modem.getSignalQuality()*100)/31));

  sendAT("AT+CSCLK=0", "OK");
  sendAT("AT+CFUN=1",  "OK", 5000);

  while (!connectGPRS()) { delay(5000); }

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMQTTMessage);
  mqtt.setKeepAlive(60);
  mqtt.setSocketTimeout(15);
  mqtt.setBufferSize(1024);
  connectMQTT();

  Serial.println(F("\n[READY] Streaming GPS every 2s. Open Dashboard → Live Map.\n"));
}

// ─── Main loop ────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // Feed GPS parser continuously (critical — never skip this)
  readGPS();

  if (!modem.isGprsConnected()) {
    Serial.println(F("[GPRS] Lost — reconnecting"));
    modem.gprsDisconnect(); delay(300);
    if (!connectGPRS()) { delay(5000); return; }
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
    if (!sendAT("AT", "OK", 2000)) {
      Serial.println(F("[Air780E] No response — restarting"));
      modem.restart(); delay(3000);
      connectGPRS(); connectMQTT();
    }
  }

  if (mqtt.connected()) sendTelemetry();

  delay(10);
}
