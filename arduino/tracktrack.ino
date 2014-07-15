#include <SoftwareSerial.h>
#include <string.h>
#include <stdint.h>
#include "SIM900.h"
#include "TCP.h"

TCP tcp;
boolean gsmReady = false;

struct trackdata
{
    int32_t hwid;
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
    boolean anchored;
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

    trackdata d;

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
    d.year = 2014;
    //d.anchored = true;
    
    unsigned char pos[32];
    pos[0] = 'M';
    pos[1] = 'C';
    pos[2] = 'G';
    pos[3] = 'P';

    // hardware id
    unsigned char hwidBuf[4];
    int32ToBuffer(hwidBuf, d.hwid);

    pos[4]  = hwidBuf[0];
    pos[5]  = hwidBuf[1];
    pos[6]  = hwidBuf[2];
    pos[7]  = hwidBuf[3];

    // latitude
    unsigned char latBuf[4];
    floatToBuffer(latBuf, d.lat);

    pos[8] = latBuf[0];
    pos[9] = latBuf[1];
    pos[10] = latBuf[2];
    pos[11] = latBuf[3];

    // longitude
    unsigned char lonBuf[4];
    floatToBuffer(lonBuf, d.lon);

    pos[12] = lonBuf[0];
    pos[13] = lonBuf[1];
    pos[14] = lonBuf[2];
    pos[15] = lonBuf[3];

    // speed
    unsigned char speedBuf[4];
    floatToBuffer(speedBuf, d.speed);

    pos[16] = speedBuf[0];
    pos[17] = speedBuf[1];
    pos[18] = speedBuf[2];
    pos[19] = speedBuf[3];

    // course
    unsigned char courseBuf[2];
    int16ToBuffer(courseBuf, d.course);

    pos[20] = courseBuf[0];
    pos[21] = courseBuf[1];

    // hdop
    unsigned char hdopBuf[2];
    int16ToBuffer(hdopBuf, d.hdop);

    pos[22] = hdopBuf[0];
    pos[23] = hdopBuf[1];

    // utc
    pos[24] = d.seconds;
    pos[25] = d.minutes;
    pos[26] = d.hours;
    pos[27] = d.day;
    pos[28] = d.month;

    unsigned char yearBuf[2];
    int16ToBuffer(yearBuf, d.year);
    pos[29] = yearBuf[0];
    pos[30] = yearBuf[1];

    pos[31] = 0;

    // send the position via tcp to server
    tcp.connect("tracktrack.io", 8100);
    tcp.send(pos, 32);
    tcp.disconnect();

    delay(10000);
};

// INT32 TO BUFFER
void int32ToBuffer(unsigned char *buf, int32_t value) 
{
    buf[0] = value & 0xFF;
    buf[1] = (value >> 8) & 0xFF;
    buf[2] = (value >> 16) & 0xFF;
    buf[3] = (value >> 24) & 0xFF;
}

// INT16 TO BUFFER
void int16ToBuffer(unsigned char *buf, int16_t value) 
{
    buf[0] = value & 0xFF;
    buf[1] = (value >> 8) & 0xFF;
}

// FLOAT TO BUFFER
void floatToBuffer(unsigned char *buf, float value) 
{
    memcpy(buf, &value, 4);
}