#include <string.h>
#include <stdint.h>
#include <SoftwareSerial.h>
#include "SIM900.h"
#include "TCP.h"
#include <TinyGPS.h>
#include <TimerOne.h>

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
    float windspeed;
    int16_t winddirection;
};

// PIN SETTINGS
int GPS_SPEAKER = 9;
int GPS_ANCHOR_BUTTON = 10;
int BAD_POSITION_LED = 12;
int INTERRUPT_PIN = 21;
int INTERRUPT_INPUT = 2;

int pulse_counter = 0;

// CONSTANTS
float ANCHOR_RANGE = 15; // meters
int DISTANCE_FILTER = 1; // meters
float CUP_RADIUS = 0.068;
float DAMM_COEFF = 3.0;
int PULSE_SAMPLING_RATE = 1; // seconds
int WIND_DIR_BIAS = 145;

// INSTANCES
TinyGPS gpsencoder;

boolean guardAnchor = false;
struct trackdata lastValidPosition;
struct trackdata guardedPosition;

float wind_speed = 0.0;
float wind_dir_buffer[10] = { 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0 };
int wind_dir_buffer_idx = 0;
int wind_direction = 0;

TCP tcp;
boolean gsmReady = false;
boolean debug = false;

// SETUP
void setup()
{
    // configure pins
    pinMode(GPS_SPEAKER, OUTPUT);
    pinMode(GPS_ANCHOR_BUTTON, INPUT);
    digitalWrite(GPS_ANCHOR_BUTTON, HIGH);
    digitalWrite(GPS_SPEAKER, LOW);
    pinMode(BAD_POSITION_LED, OUTPUT);

    // For noise suppression, enable pullup on interrupt pin
    digitalWrite(INTERRUPT_PIN, HIGH);
    attachInterrupt(INTERRUPT_INPUT,
                    pulse_interrupt,
                    RISING);
  
    Timer1.initialize(PULSE_SAMPLING_RATE * 1000000);
    Timer1.attachInterrupt(calcWind);

    lastValidPosition.hwid = 100000;
    lastValidPosition.lat = 0.0;
    lastValidPosition.lon = 0.0;
    lastValidPosition.course = -1;
    lastValidPosition.hdop = -1;
    lastValidPosition.speed = -1;

    guardedPosition.lat = 0.0;
    guardedPosition.lon = 0.0;

    Serial.begin(9600);
  
    // init GPS serial connection
    Serial2.begin(9600);

    // establish serial connection to gsm module
    if(debug) Serial.println("GSM Shield...");
    if(gsm.begin(2400)) 
    {
        if(debug) Serial.println("\nstatus=READY");
        gsmReady = true;
    }
    else 
    {
        if(debug) Serial.println("\nstatus=IDLE"); 
    } 
  
    // GSM shield is ready
    if(gsmReady)
    {
        // GPRS attach, put in order APN, username and password.

        if(tcp.attachGPRS("live.vodafone.com", "vodafone", "vodafone"))
        //if(tcp.attachGPRS("internet.eplus.de", "simyo", "simyo"))
        //if(tcp.attachGPRS("internet.t-mobile", "tm", "tm"))
        {
            if(debug) Serial.println("status=ATTACHED");
        }
        else 
        {
            if(debug) Serial.println("status=ERROR");
        }
    
        delay(300);

        // Read IP address.
        gsm.SimpleWriteln("AT+CIFSR");
        delay(300);
    
        gsm.WhileSimpleRead();
    }
};

// LOOP
void loop() 
{
    struct trackdata d = getPosition();

    if(debug) printPosition(d);

    // position valid?
    if (validatePosition(d) == true)
    {
        // check if anchor guard is active
        anchorGuard(d);

        // check distance filter
        /*float distance = 50;
        if(validatePosition(lastValidPosition) == true) {
            distance = gpsencoder.distance_between(lastValidPosition.lat, lastValidPosition.lon, d.lat, d.lon);
        }

        Serial.print("Distance:");
        Serial.println(distance);

        // only move if the distance between the current and 
        // the last position is
        //if(distance >= DISTANCE_FILTER && distance <= 150000)*/
        if(true)
        {
            digitalWrite(BAD_POSITION_LED, LOW);

            // check if anchor guard is active
            anchorGuard(d);

            lastValidPosition = d;
            if(debug) printPosition(d);

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

            if(guardAnchor == true) {
            	pos[31] = 1;
            }
            else {
            	pos[31] = 0;
            }

            // wind speed
            unsigned char windSpeedBuf[4];
            floatToBuffer(windSpeedBuf, d.windspeed);

            pos[32] = windSpeedBuf[0];
            pos[33] = windSpeedBuf[1];
            pos[34] = windSpeedBuf[2];
            pos[35] = windSpeedBuf[3];

            // wind direction
            unsigned char windDirBuf[2];
            int16ToBuffer(windDirBuf, d.winddirection);

            pos[36] = windDirBuf[0];
            pos[37] = windDirBuf[1];

            gsm.listen();

            // send the position via tcp to server
            if(debug) Serial.println("Senden!");
            tcp.connect("tracker.rubio-segeln.de", 8100);
            tcp.send(pos, 38);
            tcp.disconnect();

            // LED blink
            digitalWrite(BAD_POSITION_LED, HIGH);
            delay(50);
            digitalWrite(BAD_POSITION_LED, LOW);
            delay(100);
            digitalWrite(BAD_POSITION_LED, HIGH);
            delay(50);
            digitalWrite(BAD_POSITION_LED, LOW);

            if(debug) Serial.println("Sent!");
        }

        // wait 8 sec if speed is below 1 knot,
        // wait 0.7 sec if speed is above 1 knot
        int waiting = 700;
        if(d.speed < 1.0) {
            //waiting = 8000;
        }

        // if anchor guard is active speed up the waiting
        if(guardAnchor == true) {
            waiting = 500;
        }

        delay(waiting);
    }
    else
    {
        if(debug) Serial.print("Bad Position: ");
        digitalWrite(BAD_POSITION_LED, HIGH);
        if(debug) printPosition(d);
    }
};

// CALC WIND
void calcWind() 
{
    if (pulse_counter > 0)
    {
        // calculate windspeed from spinning cups counter
        float wind_speed_m_s = 2 * PI * CUP_RADIUS * pulse_counter * DAMM_COEFF / PULSE_SAMPLING_RATE; // m per second
        float wind_speed_tmp = wind_speed_m_s * 1.949; // knots

        // store windspeed in buffer
        wind_dir_buffer[wind_dir_buffer_idx] = wind_speed_tmp;
        wind_dir_buffer_idx = (wind_dir_buffer_idx + 1) % 10;

        // sum up windspeed
        float wind_speed_sum = 0.0;
        for(int i = 0; i < 10; i++) 
        {
            wind_speed_sum += wind_dir_buffer[i];
        }

        // calculate average wind speed of last 10 positions
        wind_speed = wind_speed_sum / 10.0;

        if(debug) Serial.println(wind_speed);

        // reset pulse counter
        pulse_counter = 0;
    }

    double x = ((analogRead(0) - 150.0) / 375) - 1;
    double y = ((analogRead(1) - 150.0) / 375) - 1;
  
    wind_direction = 360 - (int)(atan2(y, x) * (180.0 / PI) + 180 + WIND_DIR_BIAS) % 360;
}

// PULSE INTERRUPT
void pulse_interrupt()
{
    pulse_counter = pulse_counter + 1;
}

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

// VALIDATE POSITION
boolean validatePosition(struct trackdata pos) 
{
    if(pos.lat >= -90.0 && pos.lat <= 90.0 && pos.lon >= -180.0 && pos.lon <= 180.0)
    {
        return true;
    }

    return false;
}

// ANCHOR GUARD
void anchorGuard(struct trackdata position)
{
    guardAnchor = (digitalRead(GPS_ANCHOR_BUTTON) == HIGH);

    if (guardAnchor)
    {
    	// init guarded position
    	if(guardedPosition.lat == 0.0 && guardedPosition.lon == 0.0) 
    	{
    		guardedPosition = position;
    	}

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
            if(debug) Serial.print("Distance from guarded anchor position: ");
            if(debug) Serial.println(distance);   
        }
    }
    else {
    	guardedPosition.lat = 0.0;
    	guardedPosition.lon = 0.0;
    	digitalWrite(GPS_SPEAKER, LOW);
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
    icourse = (int16_t) gpsencoder.course() / 100;

    // get received HDOP value
    ihdop = (int16_t) gpsencoder.hdop() / 100;

    if(ihdop == 0) 
    {
    	ihdop = 1;
    }

    /*if(debug) 
    {
        struct trackdata position = {100000, 51.0000, 7.4000, 2.5, 120, 0, 0, 25, 16, 14, 2, 2015, wind_speed, wind_direction};
        return position;
    }
    else
    {*/
        struct trackdata position = {100000, flat, flon, fspeed, icourse, ihdop, iseconds, iminutes, ihours, iday, imonth, iyear, wind_speed, wind_direction};
        return position;
    //}
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
    Serial.print(position.hdop);
    Serial.print(" WINDIDR=");
    Serial.print(position.winddirection);
    Serial.print(" WINDSPD=");
    Serial.print(position.windspeed);
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
        while (Serial2.available())
        gpsencoder.encode(Serial2.read());
    } while (millis() - start < ms);
}
