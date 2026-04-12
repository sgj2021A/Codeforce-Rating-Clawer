#ifndef __USER_H
#define __USER_H

// define

#define USERPATH "user"

// incldue

#include "HTTP.h"
#include "cJSON/cJSON.h"
#include "HTTPSCLIENT.h"
#include <fstream>
#include <iostream>
#include <map>
#include <set>
#include <algorithm>
#include <cctype>
#include <string>

// enum

enum USERSTATE {
	USER_ENABLE,             // action is enable
	USER_ABLE,               // action is able
					         
	USER_FIND,               // find user
	USER_UNFIND,             // don't find user
					         
	USER_ADDUSER_ABLE,       // add user able
	USER_ADDUSER_EXIST,      // user exitst 
	USER_ADDUSER_UNABLE,     // add user unable

	USER_DELETEUSER_UNABLE,  // delete user unable
	USER_DELETEUSER_ABLE	 // delete user able
};

// class

class user {
private:
	// 
	std::set<std::string> userName; 
	std::string path;
	// funcation

public:
	// variable
	
	// funcation
	user();
	~user();
	USERSTATE find_user(std::string &findName);
	USERSTATE add_user(const std::string& addName);
	USERSTATE delete_user(const std::string& deleteName);
	std::string user_JSON(void);
};

#endif // !__USER_H
