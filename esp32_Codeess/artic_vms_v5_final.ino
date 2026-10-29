/*
 * ============================================================
 *  ARTIC VMS — ESP32 + SIM808  v5.0  ← UPLOAD THIS FILE
 *
 *  Hardware: ESP32 Dev Module + SIM808 (GPS + GSM/GPRS)
 *
 * ── WHAT YOU MUST CHANGE BEFORE UPLOADING ────────────────────
 *  1. DEVICE_TOKEN → Dashboard → Vehicles → your vehicle → Overview tab → Copy token
 *  2. SIM_NUMBER   → the phone number printed on the SIM card
 *  3. APN          → "internet" for MTN Rwanda / Airtel Rwanda
 *                    (ask your operator if unsure)
 *
 *  The server IP (185.208.207.100) is already correct for
 *  the ARTIC VMS production server.
 *
 * ── WIRING ───────────────────────────────────────────────────
 *
 *  SIM808 module:
 *    ESP32 GPIO16 (RX2) ← SIM808 TX
 *    ESP32 GPIO17 (TX2) → SIM808 RX
 *    ESP32 GND          ─ SIM808 GND
 *    SIM808 VCC         → 4.0–4.2V, min 2A  ← DEDICATED supply, NOT 3.3V
 *
 *  Relay module (active-LOW, e.g. HW-307):
 *    ESP32 GPIO26       → Relay IN
 *    ESP32 VIN (5V)     → Relay VCC
 *    ESP32 GND          ─ Relay GND
 *    Relay COM          ─ one ignition wire
 *    Relay NC           ─ other ignition wire
 *
 *  Relay logic:
 *    GPIO26 HIGH → relay OPEN  → engine RUNS     (default on boot)
 *    GPIO26 LOW  → relay CLOSED → engine CUT     (locked)
 *
 *  Power supply — CRITICAL:
 *    Use a 12V → 5V step-down converter (LM2596, MP1584, etc.)
 *    Connect to a PERMANENT 12V line (not the ignition-switched wire).
 *    This keeps GPS tracking live even when the relay cuts the engine.
 *
 *    12V permanent fuse → converter IN+
 *    Chassis GND        → converter IN−
 *    Converter OUT+     → ESP32 VIN   AND separate 4.2V regulator for SIM808
 *    Converter OUT−     → ESP32 GND   AND SIM808 GND
 *
 * ── LIBRARIES (Arduino IDE → Tools → Manage Libraries) ───────
 *  TinyGSM      by Volodymyr Shymanskyy  ≥ v0.12.0
 *  PubSubClient by Nick O'Leary          ≥ v2.8
 *  ArduinoJson  by Benoit Blanchon       v7.x
 *
 * ── BOARD SETTINGS ───────────────────────────────────────────
 *  Board:  ESP32 Dev Module
 *  Speed:  115200
 *  Upload Speed: 921600
 *
 * ── HOW STATUS APPEARS ON DASHBOARD ──────────────────────────
 *  ONLINE  = device sending packets (MQTT alive)
 *  OFFLINE = no packet received for > 30s
 *  ACTIVE  = ONLINE + GPS speed ≥ 2 km/h
 *  IDLE    = ONLINE + GPS speed < 2 km/h
 *  LOCKED / UNLOCKED = relay state, independent of online/offline
 *
 * ── TROUBLESHOOTING ───────────────────────────────────────────
 *  rc=-2  → TCP timeout — check MQTT_HOST / port 1883 accessible
 *  rc= 4  → Wrong credentials — check DEVICE_TOKEN
 *  rc= 5  → Not authorised — vehicle not registered in dashboard
 *  No GPS → move device outdoors, wait 2–3 min for first fix
 *  GPRS fails → check APN, SIM has data plan, signal > 5
 * ============================================================
 */

#define TINY_GSM_MODEM_SIM808
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ═══════════════════════════════════════════════════════════════
//  ↓↓  CHANGE ONLY THESE 3 LINES  ↓↓
// ═══════════════════════════════════════════════════════════════
const char DEVICE_TOKEN[] = "PASTE-YOUR-TOKEN-HERE";   // from Dashboard → Vehicles → Overview
const char SIM_NUMBER[]   = "+250700000000";             // phone number on the SIM card
const char APN[]          = "internet";                  // MTN/Airtel Rwanda data APN
// ═══════════════════════════════════════════════════════════════

// Server — do NOT change unless you moved the server
const char MQTT_HOST[]    = "185.208.207.100";   // articvms.ddnsgeek.com
const char APN_USER[]     = "";
const char APN_PASS[]     = "";
const int  MQTT_PORT      = 1883;

// Pins
#define RXD2       16   // SIM808 TX → this pin
#define TXD2       17   // SIM808 RX ← this pin
#define RELAY_PIN  26   // Relay IN (active LOW — HIGH = unlocked, LOW = locked)

// Timing
const unsigned long TELEMETRY_MS  = 2000;    // Send packet every 2s
const unsigned long RECONNECT_MS  = 5000;    // MQTT reconnect interval
const unsigned long KEEPALIVE_MS  = 30000;   // AT keepalive check interval
const unsigned long GPS_CHECK_MS  = 60000;   // GPS module health check interval

// MQTT topics (filled in setup)
char TOPIC_TELEMETRY[128];
char TOPIC_PONG[128];
char TOPIC_PING[128];
char TOPIC_COMMAND[128];

HardwareSerial SerialAT(2);
TinyGsm        modem(SerialAT);
TinyGsmClient  gsmClient(modem);
PubSubClient   mqtt(gsmClient);

unsigned long lastTelemetryAt = 0;
unsigned long lastReconnectAt = 0;
unsigned long lastKeepAliveAt = 0;
unsigned long lastGpsCheckAt  = 0;

bool engineLocked  = false;
bool gpsModuleOn   = false;
bool setupComplete = false;

// ─── AT command helper ─────────────────────────────────────────────────────────
bool sendAT(const char* cmd, const char* expected, unsigned long timeoutMs = 2000) {
  while (SerialAT.available()) SerialAT.read();   // flush
  SerialAT.println(cmd);
  String response = "";
  unsigned long deadline = millis() + timeoutMs;
  while (millis() < deadline) {
    while (SerialAT.available()) response += (char)SerialAT.read();
    if (response.indexOf(expected) >= 0) return true;
    delay(20);
  }
  return false;
}

// ─── GPS module health check and restart ──────────────────────────────────────
void checkAndRestartGPS() {
  SerialAT.println("AT+CGNSPWR?");
  String r = "";
  unsigned long dl = millis() + 2000;
  while (millis() < dl) {
    while (SerialAT.available()) r += (char)SerialAT.read();
    delay(20);
  }
  if (r.indexOf("+CGNSPWR: 1") >= 0 || r.indexOf("+CGNSPWR:1") >= 0) {
    if (!gpsModuleOn) Serial.println("[GPS] Module ON");
    gpsModuleOn = true;
    return;
  }
  // Module is off or not responding — restart it
  Serial.println("[GPS] Module OFF — restarting...");
  gpsModuleOn = false;
  if (sendAT("AT+CGNSPWR=1", "OK", 4000)) {
    delay(1500);
    modem.enableGPS();
    gpsModuleOn = true;
    Serial.println("[GPS] Restarted OK");
  } else {
    Serial.println("[GPS] Restart FAILED — will retry next check");
  }
}

// ─── MQTT callback — receives commands from server ───────────────────────────
void onMQTTMessage(char* topic, byte* payload, unsigned int length) {
  String t = String(topic);
  String p = "";
  for (unsigned int i = 0; i < length; i++) p += (char)payload[i];

  // ── Ping → reply with pong ──────────────────────────────────
  if (t == String(TOPIC_PING)) {
    JsonDocument pong;
    pong["pong"]        = true;
    pong["gpsModuleOn"] = gpsModuleOn;
    pong["locked"]      = engineLocked;
    pong["simNumber"]   = SIM_NUMBER;
    pong["uptime"]      = millis() / 1000;
    char buf[200];
    serializeJson(pong, buf);
    mqtt.publish(TOPIC_PONG, buf, false);
    return;
  }

  // ── Command channel ─────────────────────────────────────────
  if (t != String(TOPIC_COMMAND)) return;

  JsonDocument cmd;
  if (deserializeJson(cmd, p) != DeserializationError::Ok) {
    Serial.println("[CMD] JSON parse error");
    return;
  }

  const char* command = cmd["command"];
  if (!command) return;
  Serial.print("[CMD] "); Serial.println(command);

  // LOCK — cut engine
  if (strcmp(command, "lock") == 0) {
    engineLocked = true;
    digitalWrite(RELAY_PIN, LOW);   // active-LOW: LOW = relay ON = engine cut
    Serial.println("[RELAY] LOCKED (GPIO26=LOW, relay=ON, engine=CUT)");
    JsonDocument ack;
    ack["ack"]          = "lock";
    ack["engineLocked"] = true;
    ack["simNumber"]    = SIM_NUMBER;
    char buf[100]; serializeJson(ack, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
  }

  // UNLOCK — allow engine to run
  else if (strcmp(command, "unlock") == 0) {
    engineLocked = false;
    digitalWrite(RELAY_PIN, HIGH);  // HIGH = relay OFF = engine runs
    Serial.println("[RELAY] UNLOCKED (GPIO26=HIGH, relay=OFF, engine=RUNS)");
    JsonDocument ack;
    ack["ack"]          = "unlock";
    ack["engineLocked"] = false;
    ack["simNumber"]    = SIM_NUMBER;
    char buf[100]; serializeJson(ack, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
  }

  // CHECK_INTERNET — respond with signal and connectivity status
  else if (strcmp(command, "check_internet") == 0) {
    int  signal = modem.getSignalQuality();   // 0–31, 99=unknown
    bool gprsOk = modem.isGprsConnected();
    JsonDocument resp;
    resp["cmd"]       = "internet_status";    // key the backend parser expects
    resp["signal"]    = signal;
    resp["signalPct"] = min(100, (signal * 100) / 31);   // 0–100%
    resp["gprsOk"]    = gprsOk;
    resp["gpsOn"]     = gpsModuleOn;
    resp["locked"]    = engineLocked;
    resp["simNumber"] = SIM_NUMBER;
    resp["ip"]        = modem.localIP().toString();
    char buf[280]; serializeJson(resp, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
    Serial.printf("[INET] Signal=%d (%d%%) GPRS=%s\n",
                  signal, min(100, (signal*100)/31), gprsOk ? "OK" : "FAIL");
  }

  // RESTART — reboot the SIM808 module (not the ESP32)
  else if (strcmp(command, "restart") == 0) {
    Serial.println("[CMD] Restarting SIM808 module...");
    JsonDocument resp;
    resp["cmd"]       = "restarting";
    resp["simNumber"] = SIM_NUMBER;
    char buf[96]; serializeJson(resp, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
    delay(400);
    modem.restart();
    delay(3000);
    sendAT("AT+CSCLK=0", "OK", 2000);
    checkAndRestartGPS();
    connectGPRS();
    connectMQTT();
    Serial.println("[CMD] Restart complete");
  }

  // USSD — send a USSD code (e.g. to buy data: *175# on MTN Rwanda)
  else if (strcmp(command, "ussd") == 0) {
    const char* code = cmd["code"];
    if (!code) return;
    Serial.print("[USSD] Sending: "); Serial.println(code);
    String result = modem.sendUSSD(code);
    JsonDocument resp;
    resp["cmd"]           = "ussd_response";   // key the backend parser expects
    resp["code"]          = code;
    resp["ussd_response"] = result;
    resp["simNumber"]     = SIM_NUMBER;
    char buf[520]; serializeJson(resp, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
    Serial.print("[USSD] Response: "); Serial.println(result);
  }
}

// ─── Connect to GPRS/internet ─────────────────────────────────────────────────
bool connectGPRS() {
  Serial.print("[GPRS] Connecting APN='");
  Serial.print(APN); Serial.print("'... ");
  if (modem.gprsConnect(APN, APN_USER, APN_PASS)) {
    Serial.print("OK  IP=");
    Serial.println(modem.localIP());
    return true;
  }
  Serial.println("FAIL");
  return false;
}

// ─── Connect to MQTT broker ────────────────────────────────────────────────────
bool connectMQTT() {
  Serial.print("[MQTT] Connecting to ");
  Serial.print(MQTT_HOST); Serial.print(":"); Serial.print(MQTT_PORT);
  Serial.print(" ... ");

  // Client ID: unique per device (first 8 chars of token)
  String clientId = "artic_" + String(DEVICE_TOKEN).substring(0, 8);

  // Username = Password = DEVICE_TOKEN (backend validates this)
  if (mqtt.connect(clientId.c_str(), DEVICE_TOKEN, DEVICE_TOKEN)) {
    Serial.println("OK");
    mqtt.subscribe(TOPIC_PING,    1);
    mqtt.subscribe(TOPIC_COMMAND, 1);

    // Announce we are online
    JsonDocument announce;
    announce["online"]    = true;
    announce["event"]     = "device_connected";
    announce["simNumber"] = SIM_NUMBER;
    char buf[100]; serializeJson(announce, buf);
    mqtt.publish(TOPIC_TELEMETRY, buf, false);
    return true;
  }

  int rc = mqtt.state();
  Serial.print("FAIL  rc="); Serial.println(rc);
  // Common error codes:
  //  -2 = network error / port 1883 unreachable
  //   4 = wrong username/password → check DEVICE_TOKEN
  //   5 = not authorised → vehicle not registered in dashboard
  return false;
}

// ─── Send GPS telemetry packet ─────────────────────────────────────────────────
// Runs every 2s. Sends a packet even without a GPS fix (heartbeat) so the
// server never marks the device OFFLINE while it is actually connected.
void sendTelemetry() {
  if (millis() - lastTelemetryAt < TELEMETRY_MS) return;
  lastTelemetryAt = millis();

  float lat = 0, lon = 0, speed = 0, alt = 0, accuracy = 0;
  int   visibleSats = 0, usedSats = 0;

  // getGPS returns true only when a valid fix exists
  bool hasFix = modem.getGPS(&lat, &lon, &speed, &alt,
                              &visibleSats, &usedSats, &accuracy);
  // Sanity check: (0,0) is the Gulf of Guinea, not Rwanda
  if (hasFix && lat == 0.0f && lon == 0.0f) hasFix = false;

  JsonDocument doc;

  // ── Fields that are always present ──────────────────────────
  doc["online"]        = true;
  doc["deviceOnline"]  = true;
  doc["engineOn"]      = !engineLocked;    // relay open = engine can run
  doc["ignition"]      = !engineLocked;
  doc["engineLocked"]  = engineLocked;
  doc["gpsModuleOn"]   = gpsModuleOn;
  doc["signalQuality"] = modem.getSignalQuality();
  doc["simNumber"]     = SIM_NUMBER;

  // ── GPS fields — only set when we have a fix ─────────────────
  if (hasFix) {
    doc["latitude"]   = serialized(String(lat,   6));
    doc["longitude"]  = serialized(String(lon,   6));
    doc["speed"]      = serialized(String(speed, 2));   // km/h from GPS NMEA
    doc["altitude"]   = serialized(String(alt,   2));   // metres
    doc["accuracy"]   = serialized(String(accuracy, 2));// metres
    doc["satellites"] = usedSats;
    doc["heading"]    = nullptr;    // SIM808 doesn't provide heading in this mode
    doc["noFix"]      = false;

    Serial.printf("[GPS OK] %.6f, %.6f  %.1fkm/h  acc:%.1fm  sats:%d\n",
                  lat, lon, speed, accuracy, usedSats);
  } else {
    // No fix — send heartbeat so backend stays ONLINE
    doc["latitude"]   = nullptr;
    doc["longitude"]  = nullptr;
    doc["speed"]      = nullptr;
    doc["altitude"]   = nullptr;
    doc["accuracy"]   = nullptr;
    doc["satellites"] = nullptr;
    doc["heading"]    = nullptr;
    doc["noFix"]      = true;

    static uint32_t noFixCount = 0;
    if (++noFixCount % 15 == 1)   // log every 30s to avoid flooding serial
      Serial.println("[GPS] No fix — heartbeat sent (device stays ONLINE)");
  }

  // ── Optional sensor fields — set to null (SIM808 has no OBD) ─
  doc["fuelLevel"]      = nullptr;
  doc["fuelUsed"]       = nullptr;
  doc["engineTemp"]     = nullptr;
  doc["rpm"]            = nullptr;
  doc["batteryVoltage"] = nullptr;
  doc["batteryLevelPct"]= nullptr;

  // ── Publish ──────────────────────────────────────────────────
  char json[560];
  size_t len = serializeJson(doc, json);
  if (!mqtt.publish(TOPIC_TELEMETRY, json, false)) {
    Serial.println("[MQTT] Publish FAILED — will reconnect on next cycle");
  }
}

// ─── setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(400);

  // Build MQTT topic strings from the device token
  snprintf(TOPIC_TELEMETRY, sizeof(TOPIC_TELEMETRY), "artic/%s/telemetry", DEVICE_TOKEN);
  snprintf(TOPIC_PONG,      sizeof(TOPIC_PONG),      "artic/%s/pong",      DEVICE_TOKEN);
  snprintf(TOPIC_PING,      sizeof(TOPIC_PING),       "artic/%s/ping",      DEVICE_TOKEN);
  snprintf(TOPIC_COMMAND,   sizeof(TOPIC_COMMAND),    "artic/%s/command",   DEVICE_TOKEN);

  // Relay: default HIGH = relay OFF = engine runs
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  Serial.println(F("\n============================================"));
  Serial.println(F("  ARTIC VMS  v5.0 — ESP32 + SIM808"));
  Serial.print  (F("  Server : ")); Serial.println(MQTT_HOST);
  Serial.print  (F("  Token  : ")); Serial.println(String(DEVICE_TOKEN).substring(0, 12) + "...");
  Serial.print  (F("  SIM    : ")); Serial.println(SIM_NUMBER);
  Serial.print  (F("  APN    : ")); Serial.println(APN);
  Serial.println(F("  Relay  : GPIO26  HIGH=unlock  LOW=lock"));
  Serial.println(F("============================================\n"));

  // Validate token placeholder
  if (String(DEVICE_TOKEN) == "PASTE-YOUR-TOKEN-HERE") {
    Serial.println(F("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"));
    Serial.println(F("  ERROR: DEVICE_TOKEN not set!"));
    Serial.println(F("  Open this file and replace PASTE-YOUR-TOKEN-HERE"));
    Serial.println(F("  with the token from Dashboard → Vehicles → Overview"));
    Serial.println(F("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"));
    // Blink the built-in LED to signal configuration error
    pinMode(2, OUTPUT);
    while (true) { digitalWrite(2, HIGH); delay(200); digitalWrite(2, LOW); delay(200); }
  }

  // ── Start SIM808 serial ──────────────────────────────────────
  SerialAT.begin(9600, SERIAL_8N1, RXD2, TXD2);
  delay(2000);

  // ── Init modem ───────────────────────────────────────────────
  Serial.println(F("[MODEM] Restarting SIM808..."));
  modem.restart();
  delay(3000);

  String info = modem.getModemInfo();
  Serial.print(F("[MODEM] ")); Serial.println(info.length() ? info : "no info");

  int signal = modem.getSignalQuality();
  Serial.printf("[MODEM] Signal quality: %d / 31  (%d%%)\n",
                signal, min(100, (signal * 100) / 31));
  if (signal < 3)
    Serial.println(F("[MODEM] ⚠ Signal very weak — move to better location"));

  // Disable sleep, ensure full functionality
  sendAT("AT+CSCLK=0", "OK", 2000);
  sendAT("AT+CFUN=1",  "OK", 4000);

  // ── Start GPS module ─────────────────────────────────────────
  Serial.println(F("[GPS] Powering on GPS module..."));
  if (sendAT("AT+CGNSPWR=1", "OK", 4000)) {
    Serial.println(F("[GPS] Power on OK"));
    gpsModuleOn = true;
    delay(1000);
    modem.enableGPS();
  } else {
    Serial.println(F("[GPS] Power on FAILED — will retry"));
    gpsModuleOn = false;
  }

  // ── Connect to GPRS ──────────────────────────────────────────
  int gprsAttempts = 0;
  while (!connectGPRS()) {
    gprsAttempts++;
    Serial.printf("[GPRS] Attempt %d failed — retrying in 5s...\n", gprsAttempts);
    if (gprsAttempts >= 10) {
      Serial.println(F("[GPRS] 10 attempts failed — restarting modem"));
      modem.restart(); delay(5000);
      gprsAttempts = 0;
    }
    delay(5000);
  }

  // ── Configure MQTT client ────────────────────────────────────
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMQTTMessage);
  mqtt.setKeepAlive(60);
  mqtt.setSocketTimeout(15);
  mqtt.setBufferSize(1024);   // large enough for USSD responses

  // ── Connect to MQTT broker ───────────────────────────────────
  int mqttAttempts = 0;
  while (!connectMQTT()) {
    mqttAttempts++;
    Serial.printf("[MQTT] Attempt %d failed — retrying in 5s...\n", mqttAttempts);
    delay(5000);
    if (mqttAttempts >= 5) {
      // After 5 attempts, check GPRS is still alive
      if (!modem.isGprsConnected()) {
        Serial.println(F("[GPRS] Dropped during MQTT setup — reconnecting"));
        connectGPRS();
      }
      mqttAttempts = 0;
    }
  }

  setupComplete = true;
  Serial.println(F("\n[READY] Sending GPS every 2s. Open Dashboard → Live Map to see this vehicle.\n"));
}

// ─── Main loop ────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // ── 1. Maintain GPRS connection ─────────────────────────────
  if (!modem.isGprsConnected()) {
    Serial.println(F("[GPRS] Connection lost — reconnecting..."));
    modem.gprsDisconnect();
    delay(500);
    if (!connectGPRS()) {
      delay(5000);  // wait before full loop retry
      return;
    }
  }

  // ── 2. Maintain MQTT connection ──────────────────────────────
  if (!mqtt.connected()) {
    if (now - lastReconnectAt > RECONNECT_MS) {
      lastReconnectAt = now;
      Serial.println(F("[MQTT] Disconnected — reconnecting..."));
      connectMQTT();
    }
  } else {
    // Let PubSubClient process incoming messages and keepalive PINGs
    mqtt.loop();
  }

  // ── 3. AT keepalive — detect modem hang ──────────────────────
  if (now - lastKeepAliveAt > KEEPALIVE_MS) {
    lastKeepAliveAt = now;
    if (!sendAT("AT", "OK", 2000)) {
      Serial.println(F("[MODEM] No response to AT — restarting SIM808"));
      modem.restart();
      delay(3000);
      gpsModuleOn = false;
      connectGPRS();
      connectMQTT();
    }
  }

  // ── 4. GPS health check every 60s ────────────────────────────
  if (now - lastGpsCheckAt > GPS_CHECK_MS) {
    lastGpsCheckAt = now;
    checkAndRestartGPS();
  }

  // ── 5. Send GPS telemetry every 2s ───────────────────────────
  if (mqtt.connected()) sendTelemetry();

  delay(10);   // yield to background tasks
}
