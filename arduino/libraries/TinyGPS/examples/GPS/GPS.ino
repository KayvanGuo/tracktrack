#include <SoftwareSerial.h>

#include <TinyGPS.h>

TinyGPS gpsencoder;
SoftwareSerial gps(7, 8);

void setup()
{
  Serial.begin(9600);
  // establish serial connection to gps module
  gps.begin(9600);
}

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

	sendPosition(3,flat, flon, fspeed, icourse, ihdop, iseconds, iminutes, ihours, iday, imonth, iyear);

	delay(2000);
  }
}

// SEND POSTION
void sendPosition(int8_t boatId, 
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
	 char tmpboat[8];
    sprintf(tmpboat, "?boat=%i", boatId);

	char tmplat[16] = "&lat=";
	dtostrf(lat,3,7, &tmplat[5]);
	
	char tmplon[16] = "&lon=";
	dtostrf(lon,3,7, &tmplon[5]);
	
	char tmpspeed[15] = "&speed=";
	dtostrf(speed,2,2, &tmpspeed[7]);

	char tmpcourse[10];
    sprintf(tmpcourse, "&course=%i", course);
	
	char tmphdop[10];
    sprintf(tmphdop, "&hdop=%i", hdop);

	char tmptimestamp[32];
    sprintf(tmptimestamp, "&timestamp=%02d-%02d-%02d %02d:%02d:%02d", year, month, day, hours, minutes, seconds);
	
	char tmpurl[200] = "http://tracktrack.io/reception";
	strcat(tmpurl, tmpboat);
	strcat(tmpurl, tmplat);
	strcat(tmpurl, tmplon);
	strcat(tmpurl, tmpspeed);
	strcat(tmpurl, tmpcourse);
	strcat(tmpurl, tmphdop);
	strcat(tmpurl, tmptimestamp);

    Serial.println(tmpurl);
}  

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