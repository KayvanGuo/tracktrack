#include <SoftwareSerial.h>
#include <string.h>
#include "SIM900.h"
#include "TCP.h"

TCP tcp;
boolean gsmReady = false;

struct trackdata
{
    int hwid;
    float lat;
    float lon; 
    float speed; 
    int16_t course; 
    int16_t hdop;
    int8_t seconds;
    int8_t minutes;
    int8_t hours;
    int8_t day;
    int8_t month;
    int16_t year;
};

// SETUP
void setup()
{
    Serial.begin(9600);
  
    // establish serial connection to gps module
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
    Serial.println("Start loop");

    /*trackdata d;

    d.hwid = 100000;
    d.lat = 50.54637829;
    d.lon = 7.9876323;
    d.speed = 3.1;
    d.course = 128;
    d.hdop = 10;
    d.seconds = 3;
    d.minutes = 19;
    d.hours = 12;
    d.day = 14;
    d.month = 7;
    d.year = 2014;*/

    char hwidBuf[4];
    int hwid = 100000;
    memcpy(hwidBuf, &hwid, sizeof(int));

    //Serial.write(hwidBuf);

    tcp.connect("tracktrack.io", 8100);

    tcp.send(hwidBuf, 4);
    tcp.disconnect();

    delay(10000);
};