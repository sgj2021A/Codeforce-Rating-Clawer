#include "HTTP.h"


// 初始化函数
HTTP::HTTP() {
	int err;
	err = WSAStartup(MAKEWORD(2, 2), &wsaData);
	if (err != 0) {
		throw std::runtime_error("WSAStartup failed: " + std::to_string(err));
	}

	server = socket(AF_INET, SOCK_STREAM, 0);
	if (server == INVALID_SOCKET) {
		err = WSAGetLastError();
		throw std::runtime_error("Socket creating failed ! error numble : " + std::to_string(err));
	}

	address.sin_family = AF_INET;
	address.sin_port = htons(HTTP_PORT);
	inet_pton(AF_INET, HTTP_SERVERADDR, &address.sin_addr);

	if (bind(server, (sockaddr*)&address, sizeof(address)) == SOCKET_ERROR) {
		err = WSAGetLastError();
		throw std::runtime_error("Socket bind failed ! error numble : " + std::to_string(err));
	}
	if (listen(server, HTTP_LISTEN_MAX) == SOCKET_ERROR) {
		err = WSAGetLastError();
		throw std::runtime_error("Socket listen failed ! error numble : " + std::to_string(err));
	}
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

// 结束函数
HTTP::~HTTP() {
	if (server != INVALID_SOCKET) {
		closesocket(server);
	}
	WSACleanup();
}

// 接收函数 返回头HTTPHeader
HTTPHeaders HTTP::reserve() {
    std::string content;
    HTTPHeaders res;
    sockaddr_in clientAddr;
    int clientAddrLen = sizeof(clientAddr);

    SOCKET client = accept(server, (sockaddr*)&clientAddr, &clientAddrLen);

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

    //std::cout << "=== Headers ===" << std::endl;
    //std::cout << content << std::endl;

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

            // 获取 Content-Length
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

        if (body_already_read < content_length) {
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
        //std::cout << "=== Body ===" << std::endl;
        //std::cout << body_content << std::endl;
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
    auto func = funcations.find(funcName);
    if (func != funcations.end()) {
        // 对于 POST 请求，传入 body
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
        // 静态资源 (直接发送即可)
        bool ok = handleGetRequest(res, client);

        // 测试代码
        if(ok)std::cout << std::string(clientIp) << " "<< "response:" << res.path << " " << "status:ok" << std::endl;
        else std::cout << std::string(clientIp) << " " << "response:" << res.path << " " << "status:fail" << std::endl;
    }

    return res;
}

// 注册函数
void HTTP::registerFuncation(const std::string& name, FuncationType func) {
	funcations[name] = func;
}

/*
 * 函数 : handleGetRequest
 * 类   : HTTP
 * 作用 : 获取静态资源
 * 输入 : const HTTPHeaders& header   表头
 *        SOCKET& client               客户端socket
 * 返回 : bool                        返回状态 true 成功 false 失败
 * 备注 : 默认文件路径                HTTP_DEFAULT_FILE
 *        选择文件夹路径              HTTP_PATH
 *        相对路径使用                ./为开头，绝对路径无视,如果为空默认.exe文件路径
 */
bool HTTP::handleGetRequest(const HTTPHeaders& header, SOCKET& client) {
    // 是否成功构建
    bool ok = true;

	// 构建文件路径
    std::string path = header.path;
	if (path == "/") {
		path = HTTP_DEFAULT_FILE;
	}
    std::string basePath = std::string(HTTP_PATH);
	if (basePath.empty())basePath = "./";
	std::string filename = basePath + path;  

	std::ifstream file(filename, std::ios::binary);
	if (!file.is_open()) {
		return "HTTP/1.1 404 Not Found\r\n\r\nFile not found";
        ok = false;
	}

    // 查询文件大小
    unsigned long long fileSize = HTTP::getFileSize(filename);
    if (fileSize == HTTP_SLLONG_MAX)ok = false;
	std::stringstream buffer;
    
    // 响应添加类型
	auto getContentType = [](const std::string& path)->std::string {
		if (path.find(".html") != std::string::npos) return "text/html";
		if (path.find(".css") != std::string::npos) return "text/css";
		if (path.find(".js") != std::string::npos) return "application/javascript";
		if (path.find(".png") != std::string::npos) return "image/png";
		if (path.find(".jpg") != std::string::npos) return "image/jpeg";
		if (path.find(".ico") != std::string::npos) return "image/x-icon";
		return "text/plain";
	};

	// 返回响应头
    std::string response =
        "HTTP/1.1 200 OK\r\n"
        "Content-Length: " + std::to_string(fileSize) + "\r\n"
        "Content-Type: " + getContentType(path) + "\r\n"
        "\r\n";

    send(client, response.c_str(), response.length(), 0);

    // 返回主体内容
    while (file.read(buffStatic, HTTP_BUFFSIZE_MAX) || file.gcount() > 0) {
        if (send(client, buffStatic, file.gcount(), 0) == SOCKET_ERROR) {
            ok = false;
            break;
        }
    }

    closesocket(client);

    return ok;
}