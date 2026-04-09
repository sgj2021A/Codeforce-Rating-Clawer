//#include "HTTP.h"
//#include <iostream>
//
//int main() {
//	int err = 0;
//	HTTP http;
//	
//	//std::cout << "Server Start in http://172.17.86.49:8080\n" << std::endl;
//	while (1) {
//		http.reserve();
//	}
//	return 0;
//}

#include "HTTPSCLIENT.h"
#include "HTTP.h"
#include <iostream>
#include <windows.h>


int main() {
	SetConsoleOutputCP(CP_UTF8);
	SetConsoleCP(CP_UTF8);

	HTTPSCLIENT https;
	std::string response = https >> "https://codeforces.com/api/user.info?handles=hoO_Ooh&checkHistoricHandles=false";
	std::cout << response << std::endl;

	return 0;
}