// Reference initialization only; physical integration is pending.
#include <Arduino.h>
#include <Adafruit_PN532.h>

// GPIO assignments
#define ENTRY_RX   16
#define ENTRY_TX   17
#define EXIT_RX    18
#define EXIT_TX    21
#define ENTRY_RST   4
#define EXIT_RST    5

// Independent UART peripherals
HardwareSerial entrySerial(1);
HardwareSerial exitSerial(2);

// Hardware UART PN532 interfaces
Adafruit_PN532 entryReader(ENTRY_RST, &entrySerial);
Adafruit_PN532 exitReader(EXIT_RST, &exitSerial);

void startReader(Adafruit_PN532 &reader, HardwareSerial &port,
                 int rx, int tx, const char *name) {
  port.setPins(rx, tx);          // reader.begin() opens the port at 115200
  reader.begin();
  if (!reader.getFirmwareVersion()) {
    Serial.printf("%s reader not found\n", name);
    return;
  }
  reader.SAMConfig();
  Serial.printf("%s reader ready\n", name);
}

void setup() {
  Serial.begin(115200);
  startReader(entryReader, entrySerial, ENTRY_RX, ENTRY_TX, "ENTRY");
  startReader(exitReader,  exitSerial,  EXIT_RX,  EXIT_TX,  "EXIT");
}

void loop() {
  // Initialization reference only. Reader polling, RTC and SD logging are not implemented here.
}
