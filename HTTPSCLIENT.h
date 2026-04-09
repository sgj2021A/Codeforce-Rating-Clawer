#ifndef __HTTPSCLIENT_H
#define __HTTPSCLIENT_H

// include
#include <string>
#include <cstddef>     
#include <curl/curl.h>
#include <iostream>

class HTTPSCLIENT {
private:
    CURL *curl;
public:
    HTTPSCLIENT();
    ~HTTPSCLIENT();

    std::string operator>>(const std::string& url);

    static size_t WriteCallback(void* contents, size_t size, size_t num, std::string* output);
};

#endif // !__HTTPSCLIENT_H