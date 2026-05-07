#include "HTTP.h"
#include "HTTPSCLIENT.h"
#include "User.h"
#include <iostream>
#include <string>
#include <functional>
#include <cstdlib>
#include <atomic>
#include <chrono>
#include <thread>
#include <signal.h>

#ifdef _WIN32
#include <windows.h>
#else
#include <cstdlib>
#include <unistd.h>
#include <sys/wait.h>
#include <fstream>
#endif

HTTP http;
HTTPSCLIENT https;
user u;

// 全局运行标志
std::atomic<bool> running(true);

// 信号处理函数
void signalHandler(int signum) {
    std::cout << "\nreceive the stopping sign (" << signum << "),stopping server..." << std::endl;
    running = false;
    http.stop();
}

// 路由函数定义
std::function<std::string(const std::string&)> GetHttpsFunction = [](const std::string& body) {
    std::string content = https >> body;
    std::string response =
        "HTTP/1.1 200 OK\r\n"
        "Content-Length: " + std::to_string(content.size()) + "\r\n"
        "Content-Type: application/json\r\n"
        "\r\n" +
        content;
    return response;
};

std::function<std::string(const std::string&)> GetLocalhostFunction = [](const std::string& body) {
    std::string content = u.user_JSON();
    std::string response =
        "HTTP/1.1 200 OK\r\n"
        "Content-Length: " + std::to_string(content.size()) + "\r\n"
        "Content-Type: application/json\r\n"
        "\r\n" +
        content;
    return response;
};

std::function<std::string(const std::string&)> AddUserFunction = [](const std::string& body) {
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

    std::cout << "Add user: " + body << std::endl;
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

std::function<std::string(const std::string&)> DeleteUserFunction = [](const std::string& body) {
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

    std::cout << "Delete user: " + body << std::endl;
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

void openBrowser(const std::string& url) {
#ifdef _WIN32
    ShellExecuteA(NULL, "open", url.c_str(), NULL, NULL, SW_SHOWNORMAL);
#elif defined(__APPLE__)
    std::string command = "open " + url;
    system(command.c_str());
#else
    // Linux: 打开浏览器
    std::string command = "xdg-open \"" + url + "\" 2>/dev/null &";
    system(command.c_str());
#endif
}

void setConsoleEncoding() {
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
#endif
}

int main(int argc, char* argv[]) {
    
    // 注册信号处理
    signal(SIGINT, signalHandler);
    signal(SIGTERM, signalHandler);

    setConsoleEncoding();

    http.registerFuncation("get", GetHttpsFunction);
    http.registerFuncation("getUserList", GetLocalhostFunction);
    http.registerFuncation("addUser", AddUserFunction);
    http.registerFuncation("deleteUser", DeleteUserFunction);

    std::cout << "========================================" << std::endl;
    std::cout << "HTTP Server started at http://" << HTTP_SERVERADDR << ":" << HTTP_PORT << std::endl;
    std::cout << "Server is running, please do not close this window..." << std::endl;
    std::cout << "Press Ctrl+C (Linux) or close this window (Windows) to stop the server" << std::endl;
    std::cout << "========================================" << std::endl;

    std::string url = "http://localhost:" + std::to_string(HTTP_PORT);
    openBrowser(url);

    // 主循环
    while (running && http.isRunning()) {
        http.reserve(1);  // 1秒超时
    }
    
    std::cout << "http server has stopped" << std::endl;
    return 0;
}
