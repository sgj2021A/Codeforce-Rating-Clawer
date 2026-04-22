#ifndef __HTTP_H
#define __HTTP_H

#include <iostream>
#include <string>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include "config.h"
#include <map>
#include <sstream>
#include <functional>
#include <fstream>
#include <filesystem>

#pragma comment(lib,"ws2_32.lib")

// 标头结构体
struct HTTPHeaders {
	std::string method;
	std::string path;
	std::string version;
	std::map<std::string, std::string> headers;
	std::string body;
};

using FuncationType = std::function<std::string(const std::string&)>;

class HTTP {
private:
	WSADATA wsaData;
	SOCKET server;
	sockaddr_in address;
	char buff[HTTP_BUFFSIZE_MAX];
	char buffStatic[HTTP_BUFFSTATICSIZE_MAX];
	std::map<std::string, FuncationType> funcations;
	std::string rootDirectory;
public:
	HTTP();
	~HTTP();
	unsigned long long getFileSize(const std::string& path);
	HTTPHeaders reserve();
	void registerFuncation(const std::string& name, FuncationType func); //std::string name(const std::string&)
	bool handleGetRequest(const HTTPHeaders& header, SOCKET& client);
};

#endif // !__HTTP_H
