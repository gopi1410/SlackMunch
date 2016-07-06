#!/usr/bin/env node

'use strict';

var MyBot = require('../lib/slackmunch');

var token = 'xoxb-57049836742-8Cn7L5EZUEk36Ejho2tD9F2J';
var dbPath = process.env.BOT_DB_PATH;
var name = 'slackmunch';

var superBot = new MyBot({
    token: token,
    dbPath: dbPath,
    name: name
});

superBot.run();
