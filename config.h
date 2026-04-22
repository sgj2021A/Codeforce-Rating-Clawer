#pragma once
#ifndef __CONFIG_H

#define HTTP_PATH                 "./www"        // 注意:相对路径使用 ./为开头，绝对路径无视
#define HTTP_SERVERADDR           "0.0.0.0"
#define HTTP_PORT                 8080
#define HTTP_LISTEN_MAX           3
#define HTTP_BUFFSIZE_MAX         1024
#define HTTP_BUFFSTATICSIZE_MAX   1024
#define HTTP_DEFAULT_FILE         "/index.html"
#define HTTP_SLLONG_MAX           0x7FFFFFFFFFFFFFFF

#endif // !__CONFIG_H
