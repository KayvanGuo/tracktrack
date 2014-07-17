#include <string.h>
#include <stdint.h>
#include <SoftwareSerial.h>
#include "SIM900.h"
#include "TCP.h"
#include "TinyGPS.h"

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

// PIN SETTINGS
int GPS_TX = 7;
int GPS_RX = 8;
int GPS_SPEAKER = 9;
int GPS_ANCHOR_BUTTON = 10;
int GPS_ANCHOR_LED = 11;

// CONSTANTS
int HDOP_THRESHOLD = 200;
float ANCHOR_RANGE = 4;

// INSTANCES
TinyGPS gpsencoder;
SoftwareSerial gps(GPS_TX, GPS_RX);
boolean guardAnchor = false;
struct trackdata lastValidPosition;
struct trackdata guardedPosition;

TCP tcp;
boolean gsmReady = false;

// SETUP
void setup()
{
    // configure pins
    pinMode(GPS_SPEAKER, OUTPUT);
    pinMode(GPS_ANCHOR_BUTTON, INPUT);
    digitalWrite(GPS_ANCHOR_BUTTON, HIGH);
    pinMode(GPS_ANCHOR_LED, OUTPUT);

    Serial.begin(9600);

    // establish serial connection to gps module
    gps.begin(9600);
  
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

    struct trackdata d = getPosition();
    if (d.hdop < HDOP_THRESHOLD)
    {
        // check if anchor guard is active
        anchorGuard(lastValidPosition);
        d.anchored = guardAnchor;

        lastValidPosition = d;
        printPosition(lastValidPosition);

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
    }
    else
    {
        Serial.print("Bad HDOP: ");
        Serial.println(d.hdop);
    }

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

void anchorGuard(struct trackdata position)
{
    boolean buttonPressed = (digitalRead(GPS_ANCHOR_BUTTON) == LOW);
    if (buttonPressed)
    {
        if (guardAnchor)
        {
            guardAnchor = false;
            digitalWrite(GPS_ANCHOR_LED,LOW);
            digitalWrite(GPS_SPEAKER, LOW);
            Serial.println("Anchor Guard deactivated.");
        }
        else
        {
            guardAnchor = true;
            guardedPosition = position;
            digitalWrite(GPS_ANCHOR_LED,HIGH);      
            Serial.println("Anchor Guard activated.");    
        }
    }
    if (guardAnchor)
    {
        float distance = gpsencoder.distance_between(guardedPosition.lat, guardedPosition.lon, position.lat, position.lon);
        if (distance > ANCHOR_RANGE)
        {
            digitalWrite(GPS_SPEAKER, HIGH);
            Serial.print("Distance from guarded anchor position: ");
            Serial.print(distance);   
            Serial.println(". Alarm activated.");
        }
        else
        {
            digitalWrite(GPS_SPEAKER, LOW);
            Serial.print("Distance from guarded anchor position: ");
            Serial.println(distance);   
        }
    }
}

// GET POSITION
struct trackdata getPosition()
{
    readGPS(700);

    float flat, flon, fspeed;
    int16_t icourse, ihdop, iyear;
    int8_t ihundredths, iseconds, iminutes, ihours, iday, imonth;
    unsigned long age;

    // get received position data
    gpsencoder.f_get_position(&flat, &flon, &age);
    // crack received date and time data into seperate variables
    crack_datetime(&iyear, &imonth, &iday, &ihours, &iminutes, &iseconds, &ihundredths, &age);
    // get received speed in knots
    fspeed = gpsencoder.f_speed_knots();
    // get received course
    icourse = (int16_t) gpsencoder.course()/100;
    // get received HDOP value
    ihdop = gpsencoder.hdop();

    struct trackdata position = {3,flat, flon, fspeed, icourse, ihdop, iseconds, iminutes, ihours, iday, imonth, iyear};
    return position;
}

// PRINT POSTION
void printPosition(struct trackdata position)
{       
    Serial.print("LAT=");
    Serial.print(position.lat == TinyGPS::GPS_INVALID_F_ANGLE ? 0.0 : position.lat, 6);
    Serial.print(" LON=");
    Serial.print(position.lon == TinyGPS::GPS_INVALID_F_ANGLE ? 0.0 : position.lon, 6);
    Serial.print(" SPEED=");
    Serial.print(position.speed);
    Serial.print(" COURSE=");
    Serial.print(position.course);
    Serial.print(" HDOP=");
    Serial.print(position.hdop);
    Serial.print(" DATE=");
    char sz[32];
    sprintf(sz, "%02d-%02d-%02d %02d:%02d:%02d ", position.year, position.month, position.day, position.hours, position.minutes, position.seconds);
    Serial.print(sz);
    Serial.println();
}  

// CRACK DATE AND TIME
void crack_datetime(int16_t *year, int8_t *month, int8_t *day, int8_t *hour, int8_t *minute, int8_t *second, int8_t *hundredths, unsigned long *age)
{
    unsigned long date, time;
    gpsencoder.get_datetime(&date, &time, age);
    if (year) 
    {
        *year = date % 100;
        *year += *year > 80 ? 1900 : 2000;
    }
    if (month) *month = (date / 100) % 100;
    if (day) *day = date / 10000;
    if (hour) *hour = time / 1000000;
    if (minute) *minute = (time / 10000) % 100;
    if (second) *second = (time / 100) % 100;
    if (hundredths) *hundredths = time % 100;
}

// READ GPS
static void readGPS(unsigned long ms)
{
    unsigned long start = millis();
    do 
    {
        while (gps.available())
            gpsencoder.encode(gps.read());
    } while (millis() - start < ms);
}