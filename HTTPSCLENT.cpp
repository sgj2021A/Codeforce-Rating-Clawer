#include "HTTPSCLIENT.h"

size_t HTTPSCLIENT::WriteCallback(void* contents, size_t size, size_t num, std::string* output) {
	size_t totalSize = size * num;
	output->append((char*)contents, totalSize);
	return totalSize;
}

HTTPSCLIENT::HTTPSCLIENT() {
	curl_global_init(CURL_GLOBAL_ALL);
	curl = curl_easy_init();
	if (!curl) {
		throw std::runtime_error("libcurl error");
	}

}

HTTPSCLIENT::~HTTPSCLIENT() {
	if (curl) {
		curl_easy_cleanup(curl);
	}
	curl_global_cleanup();

}

std::string HTTPSCLIENT::operator>>(const std::string& url) {
	std::string response;

	if (!curl) {
		throw std::runtime_error("curl error");
	}

	curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);
	curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
	curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, HTTPSCLIENT::WriteCallback);
	curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
	curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
	curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 2L);

	CURLcode res = curl_easy_perform(curl);

	if (res != CURLE_OK) {
		curl_easy_cleanup(curl);
		throw std::runtime_error("perform error");
	}

	return response;
}