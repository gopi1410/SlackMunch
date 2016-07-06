'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3').verbose();
var Bot = require('slackbots');
var SlackClient = require('slack-client');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

var MyBot = function Constructor(settings) {
    this.settings = settings;
    this.settings.name = 'slackmunch';
    this.dbPath = settings.dbPath || path.resolve(__dirname, '..', 'data', 'norrisbot.db');

    this.token = this.settings.token;
    this.name = "slackmunch";
    this.user = null;
    this.db = null;
    this.welcomeBool = true;
};

// inherits methods and properties from the Bot constructor
util.inherits(MyBot, Bot);

var getChannelHistory = function() {  
  this.get = function(token, channelId, callback) {
  var xhr = new XMLHttpRequest();
  // This builds the actual structure of the API call using our provided variables
  var family = "channels";
  var d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0,0,0);
  var oldest = (d/1000|0);

  var url = "https://slack.com/api/" + family + ".history?token=" + token + "&channel=" + channelId + "&oldest=" + oldest;
  xhr.onreadystatechange = function() { 
    if (xhr.readyState == 4 && xhr.status == 200)
      callback(xhr.responseText);
    }
    xhr.open("GET", url, true); 
    xhr.send();
  }
}

MyBot.prototype.run = function () {
    MyBot.super_.call(this, this.settings);

    this.on('start', this._onStart);
    this.on('message', this._onMessage);

    //var slackClient = new SlackClient(this.token, true);

};

/**
 * On Start callback, called when the bot connects to the Slack server and access the channel
 * @private
 */
MyBot.prototype._onStart = function () {
    this._loadBotUser();
    this._loadBotChannels();
    this._connectDb();
    console.log('Started');
    console.log(this.channels.length);
    console.log(this.users.length);
};

/**
 * Called when a message (of any type) is detected with the real time messaging API
 */
MyBot.prototype._onMessage = function (message) {
    console.log('Message received: ');
    console.log('From: ' + message.user + ', Type: ' + message.type + ', Channel: ' + message.channel);
    console.log(message.text);

    if(message.type === 'presence_change' && !this.welcomeBool) {
        this.welcomeBool = true;
        this._welcomeMessage();
        return;
    }

    /*if(message.type === 'channel_joined') {
        this._welcomeMessageToChannel(message);
        return;
    }*/

    if(typeof message.user == "undefined" || typeof message.text == "undefined")
        return;

    if (this._isChatMessage(message) && !this._isFromMyBot(message) 
        && this._isChannelConversation(message)) {

        if(this._isRequestingMunch(message)) {
            this._replyWithMunch(message);
            return;
        }

        if(this._isFunny(message)) {
            this._replyWithRandomJoke(message);
            return;
        }

        if(message.text.toLowerCase().indexOf("xkcd") > -1) {
            this._replyWithXkcd(message);
            return;
        }
    }

    if (this._isChatMessage(message) && !this._isFromMyBot(message)
        && this._isDirectConversation(message)) {

        var user = this._getUserById(message.user);
        if(user.name === "gopi1410") {
            // post to a channel
            if(message.text.toLowerCase().indexOf('admin') > -1) {
                this._sendAdminMessage(message);
                return;
            }

            if(message.text.toLowerCase().indexOf('usera') > -1) {
                this._sendAdminMessageToUser(message);
                return;
            }
        }

        if(this._isRequestingMunch(message)) {
            this._replyWithMunch(message);
            return;
        }

        this.postMessage(message.user, "Hey "+ user.name + "! You wrote " + message.text + ", but sorry I can't decipher it yet", {as_user: true});
        return;
    }
};

MyBot.prototype._sendAdminMessageToUser = function(originalMessage) {
    var self = this;
    var msg = originalMessage.text.replace("usera ","");
    msg = msg.replace("Usera ","");
    msg = msg.replace("UserA ","");
    msg = msg.replace("USERA ","");
    var wrds = msg.split(" ");
    var uName = wrds[wrds.length-1];
    msg = msg.replace(uName, "");
    msg = msg.trim();
    self.postMessageToUser(uName, msg, {as_user: true});
}

MyBot.prototype._sendAdminMessage = function(originalMessage) {
    var self = this;
    var msg = originalMessage.text.replace("admin ","");
    msg = msg.replace("Admin ","");
    msg = msg.replace("ADMIN ","");
    var wrds = msg.split(" ");
    var chName = wrds[wrds.length-1];
    msg = msg.replace(chName, "");
    msg = msg.trim();
    self.postMessageToChannel(chName, msg, {as_user: true});
}

MyBot.prototype._replyWithRandomJoke = function (originalMessage) {
    var self = this;
    self.db.get('SELECT id, joke FROM jokes ORDER BY used ASC, RANDOM() LIMIT 1', function (err, record) {
        if (err) {
            return console.error('DATABASE ERROR:', err);
        }

        var channel = self._getChannelById(originalMessage.channel);
        self.postMessageToChannel(channel.name, "Since you're so laughing, here is a Chuck Norris joke I read on the internet\n_" + record.joke + "_", {as_user: true});
    });
};

MyBot.prototype._replyWithMunch = function (originalMessage) {
    var self = this;
    var channel = self._getChannelByName("general");

    var history = new getChannelHistory();
    history.get(this.token, channel.id, function(response) {
        var json = JSON.parse(response);
        var mymessages = json['messages'];

        var linkmsgs = [];

        for (var i = 0; i < mymessages.length; i++) {
            if(typeof mymessages[i]['bot_id'] == "undefined"  && 
                !(typeof mymessages[i]['attachments'] == "undefined")) {
                linkmsgs.push(mymessages[i]);
            }
        };

        var myCount = linkmsgs.length;
        var list="";
        for (var i = 0; i<myCount; i++) {
            var txt = linkmsgs[i]['attachments'][0]['text'];
            console.log(typeof txt);
            list += "*" + linkmsgs[i]['attachments'][0]['title'] + "*\n";
            if(typeof txt != "undefined")
                list += "_" + txt.substring(0,300) + "_\n";
            list += "Link: " + linkmsgs[i]['attachments'][0]['title_link'] + "\n";
            list += "Message: " + linkmsgs[i]['text'] + "\n";
            list += "Thumbnail: " + linkmsgs[i]['attachments'][0]['image_url'] + "\n";
            list += "\n\n";
        }
        
        var msg = "Enjoy your munch! \n\n" + list;
        self.postMessage(originalMessage.user, msg, {as_user: true});
    });

};

MyBot.prototype._replyWithXkcd = function (originalMessage) {
    var self = this;
    var id = Math.floor((Math.random() * 1702) + 1);
            
    var xhr = new XMLHttpRequest();
    var url = "http://xkcd.com/" + id + "/info.0.json";
    xhr.onreadystatechange = function() { 
        if (xhr.readyState == 4 && xhr.status == 200) {
            var xkcdJson = xhr.responseText;
            var xkcd = JSON.parse(xkcdJson);
            var msg = "*"+xkcd['title']+"* \n_" + xkcd['alt'] + "_ \n" + xkcd['img'];
            var channel = self._getChannelById(originalMessage.channel);
            self.postMessageToChannel(channel.name, "Hey, I too was browsing xkcd! Here's a random comic for you \n" + msg, {as_user: true});
        }
    }
    xhr.open("GET", url, true); 
    xhr.send();
}

MyBot.prototype._loadBotUser = function () {
    var self = this;
    this.user = this.users.filter(function (user) {
        return user.name === self.name;
    })[0];
};

MyBot.prototype._loadBotChannels = function () {
    this.botChannels = this.channels.filter(function (channel) {
        return channel.is_member === true;
    });
    console.log("Groups this bot is in: " + this.botChannels.length);
};

MyBot.prototype._connectDb = function () {
    if (!fs.existsSync(this.dbPath)) {
        console.error('Database path ' + '"' + this.dbPath + '" does not exists or it\'s not readable.');
        process.exit(1);
    }

    this.db = new SQLite.Database(this.dbPath);
};

MyBot.prototype._welcomeMessage = function () {
    var i;
    for(i=0;i<this.botChannels.length;i++) {
        this.postMessageToChannel(this.botChannels[i].name, 'Hey guys,\n' +
            'I am SlackMunch and I will send you weekly summaries of links. I will try to keep up to the mark and provide the best summary, but I am a bot after all (thanks anyways to my cool creator). I will be gradually learning more functionalities. Just say *Get Munch* (yeah, its case-insensitive) to invoke me anytime in the channel! I will also TRY to randomly pop in between your conversations in some time.',
            {as_user: true});
    }
};

MyBot.prototype._welcomeMessageToChannel = function (originalMessage) {
    var channel = self._getChannelById(originalMessage.channel);
    this.postMessageToChannel(channel.name, 'Hey guys,\n' +
        'I am SlackMunch and I will send you weekly summaries of links. I will try to keep up to the mark and provide the best summary, but I am a bot after all (thanks anyways to my cool creator). I will be gradually learning more functionalities. Just say *Get Munch* (yeah, its case-insensitive) to invoke me anytime in the channel! I will also TRY to randomly pop in between your conversations in some time.',
        {as_user: true});
};

MyBot.prototype._isChatMessage = function (message) {
    return message.type === 'message' && message.text.length >= 0;
};

MyBot.prototype._isChannelConversation = function (message) {
    return typeof message.channel === 'string' &&
        message.channel[0] === 'C'
        ;
};

MyBot.prototype._isDirectConversation = function (message) {
    return typeof message.channel === 'string' &&
        message.channel[0] === 'D'
        ;
};

MyBot.prototype._isRequestingMunch = function (message) {
    return message.text.toLowerCase().indexOf("getmunch") > -1 ||
        message.text.toLowerCase().indexOf('get munch') > -1;
};

MyBot.prototype._isFunny = function (message) {
    return message.text.toLowerCase().indexOf(':joy:') > -1 ||
        message.text.toLowerCase().indexOf(':laughing:') > -1;
};

MyBot.prototype._isHappy = function (message) {
    return message.text.toLowerCase().indexOf(":smile:") > -1 ||
        message.text.toLowerCase().indexOf(':smiley:') > -1;
};

MyBot.prototype._isFromMyBot = function (message) {
    return message.user === this.user.id;
};

MyBot.prototype._getChannelById = function (channelId) {
    return this.channels.filter(function (item) {
        return item.id === channelId;
    })[0];
};

MyBot.prototype._getChannelByName = function (cName) {
    return this.channels.filter(function (item) {
        return item.name === cName;
    })[0];
};

MyBot.prototype._getUserById = function (userId) {
    return this.users.filter(function (user) {
        return user.id === userId;
    })[0];
};

module.exports = MyBot;
