#include "HTTP.h"

// 跨平台获取错误号
int HTTP::getLastError() {
#ifdef _WIN32
    return WSAGetLastError();
#else
    return errno;
#endif
}

/*
 * 函数 : getFileSize
 * 类   : HTTP
 * 作用 : 返回文件大小
 * 输入 : const std::string &path 文件路径
 * 返回 : unsigned long long 文件大小(字节)
 */
unsigned long long HTTP::getFileSize(const std::string& path) {
    try {
        return std::filesystem::file_size(path);
    }
    catch (const std::filesystem::filesystem_error& e) {
        std::string error_msg = "get file size error for path: " + e.path1().string() + " - " + e.what();
        throw std::runtime_error(error_msg);
        return HTTP_SLLONG_MAX;
    }
}

// 初始化函数
HTTP::HTTP() {
    running = true;  // 设置运行状态

#ifdef _WIN32
    int err = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (err != 0) {
        throw std::runtime_error("WSAStartup failed: " + std::to_string(err));
    }
#endif

    server = socket(AF_INET, SOCK_STREAM, 0);
    if (server == INVALID_SOCKET) {
        int err = getLastError();
        throw std::runtime_error("Socket creating failed! error number: " + std::to_string(err));
    }

    // 设置 socket 重用
    int opt = 1;
#ifdef _WIN32
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR, (char*)&opt, sizeof(opt));
#else
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

    memset(&address, 0, sizeof(address));
    address.sin_family = AF_INET;
    address.sin_port = htons(HTTP_PORT);

#ifdef _WIN32
    inet_pton(AF_INET, HTTP_SERVERADDR, &address.sin_addr);
#else
    inet_pton(AF_INET, HTTP_SERVERADDR, &address.sin_addr);
#endif

    if (bind(server, (struct sockaddr*)&address, sizeof(address)) == SOCKET_ERROR) {
        int err = getLastError();
        closesocket(server);
        throw std::runtime_error("Socket bind failed! error number: " + std::to_string(err) +
            " (Port " + std::to_string(HTTP_PORT) + " may be in use)");
    }

    if (listen(server, HTTP_LISTEN_MAX) == SOCKET_ERROR) {
        int err = getLastError();
        closesocket(server);
        throw std::runtime_error("Socket listen failed! error number: " + std::to_string(err));
    }
}

// 析构函数
HTTP::~HTTP() {
    if (server != INVALID_SOCKET) {
        closesocket(server);
    }
#ifdef _WIN32
    WSACleanup();
#endif
}

// 停止服务器
void HTTP::stop() {
    running = false;
    // 主动关闭 server socket，让 accept 立即返回
    if (server != INVALID_SOCKET) {
        closesocket(server);
        server = INVALID_SOCKET;
    }
}

// reserve 函数，添加超时支持
HTTPHeaders HTTP::reserve(int timeout_seconds) {
    std::string content;
    HTTPHeaders res;

    // 如果服务器已停止，直接返回空
    if (!running) {
        return res;
    }

    // 设置 select 超时
    fd_set readfds;
    FD_ZERO(&readfds);
    FD_SET(server, &readfds);

    struct timeval tv;
    tv.tv_sec = timeout_seconds;
    tv.tv_usec = 0;

    // 等待连接，有超时控制
    int ret = select(server + 1, &readfds, NULL, NULL, &tv);
    if (ret <= 0) {
        // 超时或无新连接，返回空让主循环有机会检查状态
        return res;
    }

    struct sockaddr_in clientAddr;
    socklen_t clientAddrLen = sizeof(clientAddr);

    SocketType client = accept(server, (struct sockaddr*)&clientAddr, &clientAddrLen);

    if (client == INVALID_SOCKET) {
        return res;
    }

    char clientIp[INET_ADDRSTRLEN];
    inet_ntop(AF_INET, &clientAddr.sin_addr, clientIp, INET_ADDRSTRLEN);

    // 读取头部
    while (1) {
        int r = recv(client, buff, HTTP_BUFFSIZE_MAX - 1, 0);
        if (r <= 0) break;
        buff[r] = '\0';
        content += buff;
        if (content.find("\r\n\r\n") != std::string::npos) {
            break;
        }
    }

    // 解析头部
    std::istringstream stream(content);
    std::string line;
    if (std::getline(stream, line) && !line.empty()) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        std::istringstream request_line(line);
        request_line >> res.method >> res.path >> res.version;
    }

    // 解析其他头部
    int content_length = 0;
    while (std::getline(stream, line) && !line.empty()) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        size_t colon_pos = line.find(':');
        if (colon_pos != std::string::npos) {
            std::string key = line.substr(0, colon_pos);
            std::string value = line.substr(colon_pos + 1);
            size_t start = value.find_first_not_of(" \t");
            if (start != std::string::npos) {
                value = value.substr(start);
            }
            res.headers[key] = value;

            if (key == "Content-Length" || key == "content-length") {
                content_length = std::stoi(value);
            }
        }
    }

    // 读取 body
    std::string body_content;
    if (content_length > 0) {
        size_t header_end = content.find("\r\n\r\n");
        size_t body_already_read = content.length() - (header_end + 4);

        if (body_already_read < static_cast<size_t>(content_length)) {
            int remaining = content_length - body_already_read;
            while (remaining > 0) {
                int r = recv(client, buff, (std::min)(remaining, HTTP_BUFFSIZE_MAX - 1), 0);
                if (r <= 0) break;
                buff[r] = '\0';
                body_content += buff;
                remaining -= r;
            }
        }
        else {
            body_content = content.substr(header_end + 4);
        }

        res.body = body_content;
    }
    else {
        res.body = "";
    }

    // 处理请求
    std::string funcName = res.path;
    if (!funcName.empty() && funcName[0] == '/') {
        funcName = funcName.substr(1);
    }

    std::string response;
    auto func = functions.find(funcName);
    if (func != functions.end()) {
        if (res.method == "POST") {
            response = func->second(res.body);
        }
        else {
            response = func->second("");
        }
        send(client, response.c_str(), response.length(), 0);
        closesocket(client);
    }
    else {
        bool ok = handleGetRequest(res, client);
        if (ok) std::cout << std::string(clientIp) << " response:" << res.path << " status:ok" << std::endl;
        else std::cout << std::string(clientIp) << " response:" << res.path << " status:fail" << std::endl;
    }

    return res;
}

// 注册函数
void HTTP::registerFuncation(const std::string& name, FunctionType func) {
    functions[name] = func;
}

/*
 * 函数 : handleGetRequest
 * 类   : HTTP
 * 作用 : 获取静态资源
 * 输入 : const HTTPHeaders& header   表头
 *        SocketType& client          客户端socket
 * 返回 : bool                        返回状态 true 成功 false 失败
 */
bool HTTP::handleGetRequest(const HTTPHeaders& header, SocketType& client) {
    // 是否成功构建
    bool ok = true;

    // 构建文件路径
    std::string path = header.path;
    if (path == "/") {
        path = HTTP_DEFAULT_FILE;
    }

    std::string basePath = std::string(HTTP_PATH);
    if (basePath.empty()) basePath = "./";
    std::string filename = basePath + path;

    std::ifstream file(filename, std::ios::binary);
    if (!file.is_open()) {
        std::string error_response = "HTTP/1.1 404 Not Found\r\n\r\nFile not found";
        send(client, error_response.c_str(), error_response.length(), 0);
        closesocket(client);
        return false;
    }

    // 查询文件大小
    unsigned long long fileSize = getFileSize(filename);
    if (fileSize == HTTP_SLLONG_MAX) {
        ok = false;
    }

    // 响应添加类型
    auto getContentType = [](const std::string& path_) -> std::string {
        if (path_.find(".html") != std::string::npos) return "text/html";
        if (path_.find(".css") != std::string::npos) return "text/css";
        if (path_.find(".js") != std::string::npos) return "application/javascript";
        if (path_.find(".png") != std::string::npos) return "image/png";
        if (path_.find(".jpg") != std::string::npos) return "image/jpeg";
        if (path_.find(".ico") != std::string::npos) return "image/x-icon";
        return "text/plain";
        };

    // 返回响应头
    std::string response =
        "HTTP/1.1 200 OK\r\n"
        "Content-Length: " + std::to_string(fileSize) + "\r\n"
        "Content-Type: " + getContentType(path) + "\r\n"
        "Connection: close\r\n"
        "\r\n";

    send(client, response.c_str(), response.length(), 0);

    // 返回主体内容
    while (file.read(buffStatic, HTTP_BUFFSTATICSIZE_MAX) || file.gcount() > 0) {
        if (send(client, buffStatic, file.gcount(), 0) == SOCKET_ERROR) {
            ok = false;
            break;
        }
    }

    closesocket(client);
    return ok;
}