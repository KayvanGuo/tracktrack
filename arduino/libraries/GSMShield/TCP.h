#ifndef TCP_h
#define TCP_h

#include "SIM900.h"

class TCP {

public:
	TCP();
    int attachGPRS(char *apn, char *user, char *pass);
    int dettachGPRS();
    int connect(const char *server, int port);
    int disconnect();
    int send(char msg[], int msglength);
};

#endif