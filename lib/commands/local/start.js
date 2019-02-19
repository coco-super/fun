'use strict';

const path = require('path');

var express = require('express');
var app = express();

const { red } = require('colors');

const httpSupport = require('./http-support');

const { detectTplPath, getTpl } = require('../../tpl');
const validate = require('../../validate/validate');

const definition = require('../../definition');

const { getDebugPort, getDebugIde } = require('../../debug');

const serverPort = 8000;

function registerSigintForExpress(server) {
  var sockets = {}, nextSocketId = 0;

  // close express server 
  // https://stackoverflow.com/questions/14626636/how-do-i-shutdown-a-node-js-https-server-immediately/14636625#14636625
  server.on('connection', function(socket) {
    let socketId = nextSocketId;
    sockets[socketId] = socket;
    socket.on('close', function() {
      delete sockets[socketId];
    });
  });

  process.on('SIGINT', () => {
    server.close();

    for (let socketId in sockets) {
      if (!{}.hasOwnProperty.call(sockets, socketId)) {continue;}

      sockets[socketId].destroy();
    }
  });
}

function startExpress(app) {
    
  const server = app.listen(serverPort, function () {
    console.log(`function compute app listening on port ${serverPort}!`);
    console.log();
  });

  registerSigintForExpress(server);
}

async function start(options) {

  const tplPath = await detectTplPath();

  if (!tplPath) {
    console.error(red('Current folder not a fun project'));
    console.error(red('The folder must contains template.[yml|yaml] or faas.[yml|yaml] .'));
    process.exit(-1);
  } else if (path.basename(tplPath).startsWith('template')) {

    const { valid, ajv } = await validate(tplPath);

    if (!valid) {
      console.error(JSON.stringify(ajv.errors, null, 2));
      process.exit(-1);
    }

    const tpl = await getTpl(tplPath);

    const debugPort = getDebugPort(options);

    const debugIde = getDebugIde(options);

    const httpTriggers = definition.findHttpTriggersInTpl(tpl);

    await httpSupport.registerHttpTriggers(app, serverPort, httpTriggers, debugPort, debugIde, tplPath);

    // filter all non http trigger functions
    const functions = definition.findFunctionsInTpl(tpl, (funcitonName, functionRes) => {
      const events = functionRes.Events;

      if (events) {
        const triggers = definition.findHttpTriggersInFunction(functionRes);
        if (triggers.length) {
          return false;
        }
      }

      return true;
    });

    httpSupport.registerApis(app, serverPort, functions, debugPort, debugIde, tplPath);

    startExpress(app);
  } else {
    console.error(red('The template file name must be template.[yml|yaml].'));
    process.exit(-1);
  }
}

module.exports = start;