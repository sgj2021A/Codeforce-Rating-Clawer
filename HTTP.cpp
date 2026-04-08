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
	std::cout << "HTTP Server started on http://" << HTTP_SERVERADDR << ":" << HTTP_PORT << std::endl;
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
	std::cout << "New Link\n";
	while (1) {
		int r = recv(client, buff, HTTP_BUFFSIZE_MAX - 1, 0);
		if (r <= 0) break; 
		buff[r] = '\0';    
		content += buff;
		if (content.find("\r\n\r\n") != std::string::npos) {
			break;
		}
	}

	std::istringstream stream(content);
	std::string line;
	if (std::getline(stream, line) && !line.empty()) {
		if (!line.empty() && line.back() == '\r') {
			line.pop_back();
		}
		std::istringstream request_line(line);
		request_line >> res.method >> res.path >> res.version;
	}

	while (std::getline(stream, line) && !line.empty()) {
		if (!line.empty() && line.back() == '\r') {
			line.pop_back();
		}
		size_t colon_pos = line.find(':');
		if (colon_pos != std::string::npos) {
			std::string key = line.substr(0, colon_pos);
			std::string value = line.substr(colon_pos + 1);
			size_t start = value.find_first_not_of(" \t");
			if (start != std::string::npos) {
				value = value.substr(start);
			}

			res.headers[key] = value;
		}
	}

	std::string body_content;
	std::string remaining;
	while (std::getline(stream, remaining)) {
		if (!body_content.empty()) {
			body_content += "\n";
		}
		body_content += remaining;
	}
	res.body = body_content;
	
	// 调用部分
	std::string funcName = res.path;
	if (!funcName.empty() && funcName[0] == '/') {
		funcName = funcName.substr(1);
	}

	// 调用函数部分 (调用函数要求 /函数名称 )
	auto func = funcations.find(funcName);
	if (func != funcations.end()) {
		std::string funcResult = func->second(res.body);
		send(client, funcResult.c_str(), funcResult.length(), 0);
		return res;
	}

	// 获取静态资源
	std::string resource = handleGetRequest(res);
	send(client, resource.c_str(), resource.length(), 0);

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