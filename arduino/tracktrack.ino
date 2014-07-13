#include "SIM900.h"
#include <SoftwareSerial.h>
#include "TCP.h"

TCP tcp;
boolean gsmReady = false;

// SETUP
void setup()
{
    Serial.begin(9600);
  
    // establish serial connection to gps module
    gps.begin(9600);
    Serial.println("GSM Shield testing.");
    if(gsm.begin(2400)) 
    {
        Serial.println("\nstatus=READY");
        gsmReady = true;
    }
    else 
    {
        Serial.println("\nstatus=IDLE"); 
    } 
  
    // GSM shield is ready
    if(gsmReady)
    {
        // GPRS attach, put in order APN, username and password.
        // If no needed auth let them blank.
        if(tcp.attachGPRS("pinternet.interkom.de", "", ""))
        {
            Serial.println("status=ATTACHED");
        }
        else 
        {
            Serial.println("status=ERROR");
        }
    
        delay(1000);

        // Read IP address.
        gsm.SimpleWriteln("AT+CIFSR");
        delay(5000);
    
        gsm.WhileSimpleRead();
    }
};

// LOOP
void loop() 
{
    tcp.connect("tracktrack.io", 8100);

    char *msg = "Dies ist meine erste Nachricht";
    tcp.send(msg, 30);

    tcp.disconnect();
};