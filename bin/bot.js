#!/usr/bin/env node

'use strict';

var MyBot = require('../lib/slackmunch');

var token = require('../token');
var dbPath = process.env.BOT_DB_PATH;
var name = 'slackmunch';

var superBot = new MyBot({
    token: token,
    dbPath: dbPath,
    name: name
});

superBot.run();
