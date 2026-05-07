#ifndef __HTTP_H
#define __HTTP_H

#include <iostream>
#include <string>
#include <map>
#include <sstream>
#include <functional>
#include <fstream>
#include <filesystem>
#include <string.h>
#include <algorithm>

// 跨平台网络头文件
#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#pragma comment(lib,"ws2_32.lib")
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/select.h>
#define SOCKET int
#define INVALID_SOCKET -1
#define SOCKET_ERROR -1
#define closesocket close
#endif

#include "config.h"

// 跨平台类型别名
#ifdef _WIN32
typedef SOCKET SocketType;
#else
typedef int SocketType;
#endif

// 标头结构体
struct HTTPHeaders {
    std::string method;
    std::string path;
    std::string version;
    std::map<std::string, std::string> headers;
    std::string body;
};

using FunctionType = std::function<std::string(const std::string&)>;

class HTTP {
private:
#ifdef _WIN32
    WSADATA wsaData;
#endif
    SocketType server;
    struct sockaddr_in address;
    char buff[HTTP_BUFFSIZE_MAX];
    char buffStatic[HTTP_BUFFSTATICSIZE_MAX];
    std::map<std::string, FunctionType> functions;
    std::string rootDirectory;
    bool running;

    int getLastError();

public:
    HTTP();
    ~HTTP();
    unsigned long long getFileSize(const std::string& path);
    HTTPHeaders reserve(int timeout_seconds = 1);  // 添加超时参数
    void registerFuncation(const std::string& name, FunctionType func);
    bool handleGetRequest(const HTTPHeaders& header, SocketType& client);
    void stop();
    bool isRunning() const { return running; }
};

#endif // !__HTTP_H