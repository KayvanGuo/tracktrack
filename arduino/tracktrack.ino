#include <string.h>
#include <stdint.h>
#include <SoftwareSerial.h>
#include <TimerOne.h>

int pulse_counter = 0;
float wind_speed = 0.0;

int INTERRUPT_PIN = 2;
float CUP_RADIUS = 0.06;
int DAMM_COEFF = 3;
int PULSE_SAMPLING_RATE = 2; // seconds

// SETUP
void setup()
{
    Serial.begin(9600);
    Serial.println("Los gehts!");

     // For noise suppression, enable pullup on interrupt pin
    digitalWrite(INTERRUPT_PIN, HIGH);
    attachInterrupt(INTERRUPT_PIN,
                    pulse_interrupt,
                    RISING);
  
    Timer1.initialize(PULSE_SAMPLING_RATE * 1000000);
    Timer1.attachInterrupt(calcWind);
};

// LOOP
void loop() 
{
    Serial.println(wind_speed);
    delay(1000);
};

// CALC WIND
void calcWind() 
{
    if (pulse_counter > 0)
    {
        float wind_speed_m_s = 2 * PI * CUP_RADIUS * pulse_counter * DAMM_COEFF / PULSE_SAMPLING_RATE; // m per second
        wind_speed = wind_speed_m_s * 1.949; // knots

        // reset pulse counter
        pulse_counter = 0;
    }
}

// PULSE INTERRUPT
void pulse_interrupt()
{
    Serial.println("Pulse!");
    pulse_counter = pulse_counter + 1;
}