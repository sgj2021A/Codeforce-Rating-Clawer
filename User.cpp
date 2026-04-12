#include "User.h"
#include <algorithm>
#include <cctype>

// 辅助函数：转小写
std::string toLower(const std::string& str) {
    std::string result = str;
    std::transform(result.begin(), result.end(), result.begin(),
        [](unsigned char c) { return std::tolower(c); });
    return result;
}

user::user() {
    path = "./" + std::string(USERPATH);

    std::ifstream file(path + "/user.txt", std::ios::in);

    if (!file)
        throw std::runtime_error("user.txt open failed");

    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());

    cJSON* json = cJSON_Parse(content.c_str());

    if (json == NULL)
        throw std::runtime_error("user.txt json parse failed");

    try {
        cJSON* userItem = cJSON_GetObjectItemCaseSensitive(json, "user");
        int userItemSize = cJSON_GetArraySize(userItem);
        for (int i = 0; i < userItemSize; i++) {
            cJSON* item = cJSON_GetArrayItem(userItem, i);
            // 统一转为小写存储
            std::string name = toLower(item->valuestring);
            userName.insert(name);
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
    // 转小写后查找
    std::string lowerName = toLower(findName);

    auto it = std::find_if(user::userName.begin(), user::userName.end(),
        [&lowerName](const std::string& name) {
            return toLower(name) == lowerName;
        });

    if (it != user::userName.end()) {
        findName = *it;  // 返回存储的用户名
        return USER_FIND;
    }
    return USER_UNFIND;
}

USERSTATE user::add_user(const std::string& addName) {
    // 转为小写
    std::string lowerName = toLower(addName);

    // 检查是否已存在（忽略大小写）
    auto it = std::find_if(user::userName.begin(), user::userName.end(),
        [&lowerName](const std::string& name) {
            return toLower(name) == lowerName;
        });

    if (it != user::userName.end()) {
        return USER_ADDUSER_EXIST;
    }

    // 存储小写版本
    user::userName.insert(lowerName);

    // 保存到文件
    cJSON* root = cJSON_CreateObject();
    cJSON* userNameArray = cJSON_CreateArray();

    for (const auto& name : user::userName) {
        cJSON_AddItemToArray(userNameArray, cJSON_CreateString(name.c_str()));
    }
    cJSON_AddItemToObject(root, "user", userNameArray);

    char* jsonStr = cJSON_Print(root);
    std::string content = jsonStr;
    free(jsonStr);
    cJSON_Delete(root);

    std::ofstream out(path + "/user.txt", std::ios::out | std::ios::trunc);
    if (!out.is_open()) {
        return USER_ADDUSER_UNABLE;
    }

    out << content;
    out.close();

    return USER_ADDUSER_ABLE;
}

std::string user::user_JSON(void) {
    std::ifstream file(path + "/user.txt", std::ios::in);
    if (!file)
        throw std::runtime_error("user.txt open failed");
    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    return content;
}

USERSTATE user::delete_user(const std::string& deleteName) {
    // 转为小写
    std::string lowerDeleteName = toLower(deleteName);

    // 查找（忽略大小写）
    auto it = std::find_if(user::userName.begin(), user::userName.end(),
        [&lowerDeleteName](const std::string& name) {
            return toLower(name) == lowerDeleteName;
        });

    if (it == user::userName.end()) {
        return USER_DELETEUSER_UNABLE;
    }

    // 删除用户
    user::userName.erase(it);

    // 保存到文件
    cJSON* root = cJSON_CreateObject();
    cJSON* userNameArray = cJSON_CreateArray();

    for (const auto& name : user::userName) {
        cJSON_AddItemToArray(userNameArray, cJSON_CreateString(name.c_str()));
    }
    cJSON_AddItemToObject(root, "user", userNameArray);

    char* jsonStr = cJSON_Print(root);
    std::string content = jsonStr;
    free(jsonStr);
    cJSON_Delete(root);

    std::ofstream out(path + "/user.txt", std::ios::out | std::ios::trunc);
    if (!out.is_open()) {
        return USER_DELETEUSER_UNABLE;
    }

    out << content;
    out.close();

    return USER_DELETEUSER_ABLE;
}