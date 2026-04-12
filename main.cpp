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
	//std::cout << body << std::endl;
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

// /addUser
std::function<std::string(const std::string&)> AddUserFuncation = [](const std::string& body) {
	if (u.add_user(body) != USER_ADDUSER_ABLE) {
		std::string error_body = "{\"status\":\"error\",\"comment\":\"add user error\"}";
		std::string response =
			"HTTP/1.1 400 Bad Request\r\n"
			"Content-Length: " + std::to_string(error_body.size()) + "\r\n"
			"Content-Type: application/json\r\n"
			"\r\n" +
			error_body;
		return response;
	}

	std::cout << "添加用户: " + body << std::endl;

	// 成功时返回用户列表
	std::string content = u.user_JSON();
	std::string success_body = "{\"status\":\"ok\",\"users\":" + content + "}";

	std::string response =
		"HTTP/1.1 200 OK\r\n"
		"Content-Length: " + std::to_string(success_body.size()) + "\r\n"
		"Content-Type: application/json\r\n"
		"\r\n" +
		success_body;

	return response;
};

// /deleteUser
std::function<std::string(const std::string&)> DeleteUserFuncation = [](const std::string& body) {
	if (u.delete_user(body) != USER_DELETEUSER_ABLE) {
		std::string error_body = "{\"status\":\"error\",\"comment\":\"delete user error\"}";
		std::string response =
			"HTTP/1.1 400 Bad Request\r\n"
			"Content-Length: " + std::to_string(error_body.size()) + "\r\n"
			"Content-Type: application/json\r\n"
			"\r\n" +
			error_body;
		return response;
	}

	std::cout << "删除用户: " + body << std::endl;

	// 成功时返回用户列表
	std::string content = u.user_JSON();
	std::string success_body = "{\"status\":\"ok\",\"users\":" + content + "}";

	std::string response =
		"HTTP/1.1 200 OK\r\n"
		"Content-Length: " + std::to_string(success_body.size()) + "\r\n"
		"Content-Type: application/json\r\n"
		"\r\n" +
		success_body;

	return response;
};


int main() {
	int err = 0;
	SetConsoleOutputCP(CP_UTF8);
	SetConsoleCP(CP_UTF8);
	http.registerFuncation("get", GetHttpsFuncation);
	http.registerFuncation("getUserList", GetLocalhostFuncation);
	http.registerFuncation("addUser", AddUserFuncation);
	http.registerFuncation("deleteUser", DeleteUserFuncation);
	std::cout << "HTTP服务器已经开启在 http://" << HTTP_SERVERADDR << ":" << HTTP_PORT << std::endl;
	std::cout << "系统运行中请不要关闭窗口..." << std::endl;
	system("start http://localhost:8080");
	while (1) {
		http.reserve();
	}
	return 0;
}