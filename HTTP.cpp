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
    SOCKET client = accept(server, nullptr, nullptr);
    //std::cout << "New Link\n";

    // 第一步：读取头部
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

    //读取 body
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
    }
    else {
        // 静态资源
        response = handleGetRequest(res);
    }

    send(client, response.c_str(), response.length(), 0);
    closesocket(client);

    return res;
}

// 注册函数
void HTTP::registerFuncation(const std::string& name, FuncationType func) {
	funcations[name] = func;
}

// 获取静态资源
std::string HTTP::handleGetRequest(const HTTPHeaders& header) {
	//默认文件
	std::string path = header.path;

	if (path == "/") {
		path = "/index.html";
	}

	std::string basePath = ".";
	if (!std::string(HTTP_PATH).empty())basePath = basePath + "/" + HTTP_PATH;
	std::string filename = basePath + path;  // 在HTTP_PATH下

	std::ifstream file(filename, std::ios::binary);
	if (!file.is_open()) {
		return "HTTP/1.1 404 Not Found\r\n\r\nFile not found";
	}

	std::stringstream buffer;
	buffer << file.rdbuf();
	std::string content = buffer.str();

	auto getContentType = [](const std::string& path)->std::string {
		if (path.find(".html") != std::string::npos) return "text/html";
		if (path.find(".css") != std::string::npos) return "text/css";
		if (path.find(".js") != std::string::npos) return "application/javascript";
		if (path.find(".png") != std::string::npos) return "image/png";
		if (path.find(".jpg") != std::string::npos) return "image/jpeg";
		if (path.find(".ico") != std::string::npos) return "image/x-icon";
		return "text/plain";
	};

	// 7. 返回响应
	std::string response =
		"HTTP/1.1 200 OK\r\n"
		"Content-Length: " + std::to_string(content.size()) + "\r\n"
		"Content-Type: " + getContentType(path) + "\r\n"
		"\r\n" +
		content;

	return response;
}