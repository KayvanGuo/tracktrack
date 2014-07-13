#include "TCP.h"

//
// CONSTRUCTOR
//
TCP::TCP() 
{
	_logger = new LOG(1);
} 

//
// ATTACH GPRS
//
int TCP::attachGPRS(char *apn, char *user, char *pass)
{
    int i = 0;
    delay(5000);

    gsm.WaitResp(50, 50);
    gsm.SimpleWriteln("AT+CIFSR");

    if(gsm.WaitResp(5000, 50, "ERROR") != RX_FINISHED_STR_RECV) 
    {
     	_logger.CRITICAL("ALREADY HAVE AN IP")

     	// close will always throw an error
    	gsm.SimpleWriteln("AT+CIPCLOSE");
    	gsm.WaitResp(5000, 50, "ERROR");
      	
      	delay(2000);
      	gsm.SimpleWriteln("AT+CIPSERVER=0");
      	gsm.WaitResp(5000, 50, "ERROR");

      	return 1;
    } 
    else 
    {
    	_logger.INFO("STARTING NEW CONNECTION");

        gsm.SimpleWriteln("AT+CIPSHUT");

        switch(gsm.WaitResp(500, 50, "SHUT OK")) 
        {
			case RX_TMOUT_ERR:
            	return 0;
               	break;
          
          	case RX_FINISHED_STR_NOT_RECV:
            	return 0;
            	break;
        }

        _logger.INFO("SHUTTED OK");
        delay(1000);

		gsm.SimpleWrite("AT+CSTT=\"");
		gsm.SimpleWrite(apn);
		gsm.SimpleWrite("\",\"");
		gsm.SimpleWrite(user);
		gsm.SimpleWrite("\",\"");
		gsm.SimpleWrite(pass);
		gsm.SimpleWrite("\"\r");

        switch(gsm.WaitResp(500, 50, "OK")) 
        {
        	case RX_TMOUT_ERR:
            	return 0;
               	break;
          
          	case RX_FINISHED_STR_NOT_RECV:
            	return 0;
              	break;
        }

        _logger.INFO("APN OK");

        delay(5000);

        gsm.SimpleWriteln("AT+CIICR");

		switch(gsm.WaitResp(10000, 50, "OK")) 
		{
			case RX_TMOUT_ERR:
		   		return 0;
		   		break;
		
			case RX_FINISHED_STR_NOT_RECV:
		   		return 0;
		   		break;
		}

		_logger.INFO("CONNECTION OK");
        
        delay(1000);

        gsm.SimpleWriteln("AT+CIFSR");
        if(gsm.WaitResp(5000, 50, "ERROR")!=RX_FINISHED_STR_RECV) 
        {
        	_logger.INFO("ASSIGNED AN IP");
            gsm.setStatus(gsm.ATTACHED);
            return 1;
        }

        _logger.CRITICAL("NO IP AFTER CONNECTION");
        return 0;
     }
}

//
// DEATTACH GPRS
//
int TCP::dettachGPRS()
{
    if (gsm.getStatus()==gsm.IDLE) 
    {
    	return 0;
    }

    // GPRS dettachment
    gsm.SimpleWriteln("AT+CGATT=0");
    if(gsm.WaitResp(5000, 50, "OK") != RX_FINISHED_STR_NOT_RECV) 
    {
        gsm.setStatus(gsm.ERROR);
        return 0;
    }
    
    delay(500);

    gsm.setStatus(gsm.READY);
    return 1;
}

// 
// CONNECT
//
int TCP::connect(const char *server, int port)
{
    // Visit the remote TCP server.
    gsm.SimpleWrite("AT+CIPSTART=\"TCP\",\"");
    gsm.SimpleWrite(server);
    gsm.SimpleWrite("\",");
    gsm.SimpleWriteln(port);

    switch(gsm.WaitResp(1000, 200, "OK")) 
    {
    	case RX_TMOUT_ERR:
        	return 0;
          	break;
     	
     	case RX_FINISHED_STR_NOT_RECV:
        	return 0;
         	break;
    }

    _logger.INFO("RECVD CMD");

    if(!gsm.IsStringReceived("CONNECT OK")) 
    {
        switch(gsm.WaitResp(15000, 200, "OK")) 
        {
        	case RX_TMOUT_ERR:
            	return 0;
               	break;
          
          	case RX_FINISHED_STR_NOT_RECV:
            	return 0;
              	break;
        }
    }

    _logger.INFO("OK TCP");

    return 1;
}

//
// SEND
//
int send(char *msg, int msglength) 
{
	delay(3000);

    gsm.SimpleWrite("AT+CIPSEND=");
    gsm.SimpleWriteln(msglength);

    switch(gsm.WaitResp(5000, 200, ">")) 
    { 
     	case RX_TMOUT_ERR:
        	return 0;
          	break;
     
     	case RX_FINISHED_STR_NOT_RECV:
        	return 0;
        	break;
    }

    // send the message
    gsm.SimpleWriteln(msg);

    // wait for the send to be done
    switch(gsm.WaitResp(10000, 10, "SEND OK")) 
    {
    	case RX_TMOUT_ERR:
        	return 0;
        	break;
     	
     	case RX_FINISHED_STR_NOT_RECV:
         	return 0;
          	break;
    }

    return 1;
}

//
// DISCONNECT
//
int TCP::disconnect()
{
    //Close TCP client and deact.
    gsm.SimpleWriteln("AT+CIPCLOSE");

    switch(gsm.WaitResp(1000, 200, "OK")) 
    {
    	case RX_TMOUT_ERR:
        	return 0;
          	break;
     	
     	case RX_FINISHED_STR_NOT_RECV:
        	return 0;
          	break;
    }

    if(gsm.getStatus() == gsm.TCPCONNECTEDCLIENT) 
    {
    	gsm.setStatus(gsm.ATTACHED);
    }
    else
    {
        gsm.setStatus(gsm.TCPSERVERWAIT);
    }

    return 1;
}