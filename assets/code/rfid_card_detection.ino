#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 10
#define RST_PIN 9
#define GREEN_LED 6
#define RED_LED 7
#define BUZZER 8

MFRC522 rfid(SS_PIN, RST_PIN);
const byte registeredUID[] = {0x12, 0x34, 0x56, 0x78}; // replace with your card's UID

bool isRegisteredCard() {
  if (rfid.uid.size != sizeof(registeredUID)) return false;
  for (byte i = 0; i < sizeof(registeredUID); i++)
    if (rfid.uid.uidByte[i] != registeredUID[i]) return false;
  return true;
}

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  pinMode(GREEN_LED, OUTPUT); pinMode(RED_LED, OUTPUT); pinMode(BUZZER, OUTPUT);
  Serial.println("Place an RFID card near the reader");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  Serial.print("UID:");
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(rfid.uid.uidByte[i], HEX);
  }
  bool ok = isRegisteredCard();
  Serial.println(ok ? "  REGISTERED" : "  UNREGISTERED");
  digitalWrite(ok ? GREEN_LED : RED_LED, HIGH);
  digitalWrite(BUZZER, HIGH); delay(150); digitalWrite(BUZZER, LOW);
  delay(850);
  digitalWrite(GREEN_LED, LOW); digitalWrite(RED_LED, LOW);
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}
