const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

// Set some defaults (required if your JSON file is empty)
	
class Database {
	constructor() {
		this.adapter = new FileSync('db.json');
		this.db = low(this.adapter);
		this.db.defaults({ users: [] }).write();
	}
	findName(name) {
		var re = this.db.get('users')
		  .find({ name: name })
		  .value()
		if (re) {return re;}
		else return false;
	}

	addUser(name, restbpm) {
		var filename = "./log/" + name + ".log";
		if (!this.findName(name)) { // add new user
			this.db.get('users')
  			.push({ name: name, restbpm: restbpm})
  			.write()
		}
		else{ // update user's restbpm
  			this.db.get('users')
			  .find({ name: name})
			  .assign({ restbpm: restbpm})
			  .write()
		}
		return filename;
	}
}

var DB = new Database()
module.exports = DB;