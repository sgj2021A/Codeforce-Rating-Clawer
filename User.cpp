#include "User.h"

user::user() {
	path = "./" + std::string(USERPATH);
	
	std::ifstream file(path + "/user.txt",std::ios::in);
	
	if (!file)
		throw std::runtime_error("user.txt open failed");
	
	std::string content((std::istreambuf_iterator<char>(file)),std::istreambuf_iterator<char>());

	cJSON* json = cJSON_Parse(content.c_str());

	if (json == NULL) 
		throw std::runtime_error("user.txt json parse failed");
	try {
		cJSON* userItem = cJSON_GetObjectItemCaseSensitive(json, "user");
		int userItemSize = cJSON_GetArraySize(userItem);
		for (int i = 0;i < userItemSize;i++) {
			cJSON* item = cJSON_GetArrayItem(userItem, i);
			userName.insert(item->valuestring);
		}
	}
	catch (...) {
		cJSON_Delete(json);
		throw;
	}
	
	cJSON_Delete(json);
	content.clear();
	file.close();
}

user::~user() {

}

USERSTATE user::find_user(std::string& findName) {
	if (user::userName.find(findName) != user::userName.end())return USER_FIND;
	else return USER_UNFIND;
}

USERSTATE user::add_user(const std::string& addName) {
	if (user::userName.find(addName) != user::userName.end())return USER_ADDUSER_EXIST;
	user::userName.insert(addName);

	cJSON* root = cJSON_CreateObject();
	cJSON* userNameArray = cJSON_CreateArray();
	for (const auto& name : userName) {
		cJSON_AddItemToArray(userNameArray, cJSON_CreateString(name.c_str()));
	}
	cJSON_AddItemToObject(root, "user", userNameArray);

	std::string content = cJSON_Print(root);

	cJSON_Delete(root);

	std::ofstream out(path + "/user.txt", std::ios::out);
	out << content;
	out.close();
	return USER_ADDUSER_ABLE;
}

std::string user::user_JSON(void) {
	path = "./" + std::string(USERPATH);
	std::ifstream file(path + "/user.txt", std::ios::in);
	if (!file)
		throw std::runtime_error("user.txt open failed");
	std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
	return content;
}