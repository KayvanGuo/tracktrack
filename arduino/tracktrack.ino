#include "SIM900.h"
#include <SoftwareSerial.h>
#include "inetGSM.h"
#include <TinyGPS.h>

InetGSM inet;
boolean started = false;
TinyGPS gpsencoder;
SoftwareSerial gps(12, 13);

// SETUP
void setup()
{
  Serial.begin( 9600);
  // establish serial connection to gps module
  gps.begin(9600);
  Serial.println("GSM Shield testing.");
  if(gsm.begin(2400)) 
  {
    Serial.println("\nstatus=READY");
    started = true;
  }
  else 
  {
    Serial.println("\nstatus=IDLE"); 
  } 
  
  // GSM shield is ready
  if(started)
  {
    // GPRS attach, put in order APN, username and password.
    // If no needed auth let them blank.
    if (inet.attachGPRS("pinternet.interkom.de", "", ""))
    {
      Serial.println("status=ATTACHED");
    }
    else 
    {
      Serial.println("status=ERROR");
    }
    
    delay(100);

    // Read IP address.
    gsm.SimpleWriteln("AT+CIFSR");
    delay(500);
    
    gsm.WhileSimpleRead();
  }
};

// LOOP
void loop() 
{
   bool newData = false;

  // parse gps data for one second
  for (unsigned long start = millis(); millis() - start < 1000;)
  {
    while (gps.available())
    {
	  // read from gps module
      char c = gps.read();
	  // try to encode received data
      if (gpsencoder.encode(c)) 
        newData = true;
    }
  }

  // if valid data was received
  if (newData)
  {
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
	icourse = (int16_t) gpsencoder.course();
	// get received HDOP value
	ihdop = gpsencoder.hdop();

    Serial.print("LAT=");
    Serial.print(flat == TinyGPS::GPS_INVALID_F_ANGLE ? 0.0 : flat, 6);
    Serial.print(" LON=");
    Serial.print(flon == TinyGPS::GPS_INVALID_F_ANGLE ? 0.0 : flon, 6);
    Serial.print(" SPEED=");
    Serial.print(fspeed);
    Serial.print(" COURSE=");
    Serial.print(icourse);
    Serial.print(" HDOP=");
    Serial.print(ihdop);
    Serial.print(" DATE=");
	char sz[32];
    sprintf(sz, "%02d/%02d/%02d %02d:%02d:%02d ",
        imonth, iday, iyear, ihours, iminutes, iseconds);
	Serial.print(sz);
	Serial.println();
  }
};

void crack_datetime(int16_t *year, int8_t *month, int8_t *day, 
  int8_t *hour, int8_t *minute, int8_t *second, int8_t *hundredths, unsigned long *age)
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

// SEND POSTION
void sendPosition(int boatId, 
                  float lat, 
                  float lon, 
                  float speed, 
                  int16_t course, 
                  int16_t hdop,
                  int8_t seconds,
                  int8_t minutes,
                  int8_t hours,
                  int8_t day,
                  int8_t month,
                  int16_t year)
{
	char msg[50];
	int numdata;
	char url[200];
	sprintf(url, "https://tracktrack.io/reception?boat=3&lat=%02d&lon=%02d&speed=%02d&course=%02d&hdop=%02d&timestamp=%02d-%02d-%02d %02d:%02d:%02d",
        lat, lon, speed, course, hdop, year, month, day, hours, minutes, seconds);
	Serial.println(url);
   //TCP Client GET, send a GET request to the server and
	//save the reply.
	numdata=inet.httpGET("www.google.com", 80, "/", msg, 50);
	//Print the results.
	Serial.println("\nNumber of data received:");
	Serial.println(numdata);
	Serial.println("\nData received:");
	Serial.println(msg);
}  

