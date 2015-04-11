#include <string.h>
#include <stdint.h>
#include <SoftwareSerial.h>
#include <TinyGPS.h>

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
};

// PIN SETTINGS
//int GPS_TX = 7;
//int GPS_RX = 8;

int pulse_counter = 0;

// CONSTANTS
int HDOP_THRESHOLD = 150;
int DISTANCE_FILTER = 1; // meters

// INSTANCES
TinyGPS gpsencoder;
//SoftwareSerial gps(GPS_TX, GPS_RX);

struct trackdata lastValidPosition;
struct trackdata guardedPosition;

boolean debug = true;

// SETUP
void setup()
{

    lastValidPosition.hwid = 100000;
    lastValidPosition.lat = 0.0;
    lastValidPosition.lon = 0.0;
    lastValidPosition.course = -1;
    lastValidPosition.hdop = -1;
    lastValidPosition.speed = -1;

    guardedPosition.lat = 0.0;
    guardedPosition.lon = 0.0;

    // init serial connection to board
    Serial.begin(9600);
  
    // init GPS serial connection
    Serial2.begin(9600);

    Serial.println("Los gehts!");
};

// LOOP
void loop() 
{
    //gps.listen();
    struct trackdata d = getPosition();

    // position valid?
    if (validatePosition(d) == true)
    {
        lastValidPosition = d;
        if(debug) printPosition(d);

        delay(1000);
    }
    else
    {
        if(debug) Serial.print("Bad Position: ");
        if(debug) printPosition(d);
    }
};

// VALIDATE POSITION
boolean validatePosition(struct trackdata pos) 
{
    if(pos.lat >= -90.0 && pos.lat <= 90.0 && pos.lon >= -180.0 && pos.lon <= 180.0)
    {
        return true;
    }

    return false;
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

    struct trackdata position = {100000, flat, flon, fspeed, icourse, ihdop, iseconds, iminutes, ihours, iday, imonth, iyear};
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
    Serial.print(position.hdop);
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