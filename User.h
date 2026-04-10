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

// enum

enum USERSTATE {
	USER_ENABLE,         // action is enable
	USER_ABLE,           // action is able
					     
	USER_FIND,           // find user
	USER_UNFIND,         // don't find user
					     
	USER_ADDUSER_ABLE,   // add user able
	USER_ADDUSER_EXIST,  // user exitst 
					     
	USER_SETINDEX_ABLE,  // set index user able
	USER_SETINDEX_ENABLE,// set index user unable
	USER_SETINDEX_REPEAT // set index user repeat
};

// class

class user {
private:
	// 
	std::string userIndex;
	std::set<std::string> userName; 
	std::string path;

	// funcation

public:
	// variable
	
	// funcation
	user();
	~user();
	USERSTATE find_user(std::string &findName);
	USERSTATE add_user(std::string& addName);
	USERSTATE set_indexuser(std::string& indexUserName);
};

#endif // !__USER_H
