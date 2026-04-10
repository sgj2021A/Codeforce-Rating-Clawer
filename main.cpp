#include "HTTP.h"
#include "HTTPSCLIENT.h"
#include "User.h"
#include <iostream>
#include <string>
#include <functional>
#include <windows.h>
HTTP http;
HTTPSCLIENT https;
user u;

// /get
std::function<std::string(const std::string&)> GetHttpsFuncation = [](const std::string& body) {
	std::string content = https >> body;
	std::string response =
		"HTTP/1.1 200 OK\r\n"
		"Content-Length: " + std::to_string(content.size()) + "\r\n"
		"Content-Type: application/json\r\n"
		"\r\n" +
		content;
	return response;
};

// /getUserList
std::function<std::string(const std::string&)> GetLocalhostFuncation = [](const std::string& body) {
	std::string content = u.user_JSON();
	std::string response =
		"HTTP/1.1 200 OK\r\n"
		"Content-Length: " + std::to_string(content.size()) + "\r\n"
		"Content-Type: application/json\r\n"
		"\r\n" +
		content;
	return response;
};

// / addUser
std::function<std::string(const std::string&)> AddUserFuncation = [](const std::string& body) {

	if (u.add_user(body) == USER_ADDUSER_EXIST) {
		std::string response =
			"HTTP/1.1 400 Bad Request\r\n"
			"Content-Length: 0\r\n"
			"Content-Type: application/json\r\n"
			"\r\n"
			"{\"status\":\"EXIST\"}";
		return response;
	}

	std::string content = u.user_JSON();
	std::string response =
		"HTTP/1.1 200 OK\r\n"
		"Content-Length: " + std::to_string(content.size()) + "\r\n"
		"Content-Type: application/json\r\n"
		"\r\n" +
		"{\"status\":\"ok\"}\n";
	return response;
};

int main() {
	int err = 0;
	SetConsoleOutputCP(CP_UTF8);
	SetConsoleCP(CP_UTF8);

	http.registerFuncation("get", GetHttpsFuncation);
	http.registerFuncation("getUserList", GetLocalhostFuncation);
	http.registerFuncation("addUser", AddUserFuncation);
	while (1) {
		http.reserve();
	}
	return 0;
}

//#include "HTTPSCLIENT.h"
//#include "HTTP.h"
//#include <iostream>
//#include <windows.h>
//
//
//int main() {
//	SetConsoleOutputCP(CP_UTF8);
//	SetConsoleCP(CP_UTF8);
//
//	HTTPSCLIENT https;
//	std::string response = https >> "https://codeforces.com/api/user.info?handles=hoO_Ooh&checkHistoricHandles=false";
//	std::cout << response << std::endl;
//
//	return 0;
//}

//#include "User.h"
//#include <iostream>
//#include <windows.h>
//#include "cJSON/cJSON.h"
//#include <fstream>
//
//int main() {
//	SetConsoleOutputCP(CP_UTF8);
//	SetConsoleCP(CP_UTF8);
//
//	user u;
//	std::string name = "hoO_Ooh";
//	if (u.add_user(name) == USER_ADDUSER_EXIST) {
//		std::cout << "EXIST\n";
//	}
//	
//	if (u.set_indexuser(name) != USER_SETINDEX_ABLE) {
//		std::cout << "NO\n";
//	}
//	return 0;
//}