var fs = require('fs');
var url = require('url')
var path = require('path');
var util = require('util');
var bunyan = require('bunyan');
var restify = require('restify');
var socketio = require('socket.io');
var request = require("request");
var async = require('async');
var moment = require('moment');
var _ = require('underscore');
var tasksDb = require('./tasks.config');


/**
 * API Clients
 */

var apiRequest = request.defaults({
  baseUrl: 'http://rain.okta1.com:1802/api/v1/',
  headers: {
    authorization: 'SSWS {{token}}',
    accept: 'application/json',
    'content-type': 'application/json'
  }
});

var asanaBearerRequest = request.defaults({
  baseUrl: 'https://app.asana.com/api/1.0/',
  headers: {
    authorization: 'Bearer {{token}}',
    accept: 'application/json',
  }
});

var asanaBasicRequest = request.defaults({
  baseUrl: 'https://app.asana.com/api/1.0/',
  headers: {
    authorization: 'Basic {{token}}',
    accept: 'application/json',
  }
});



/**
 * Configuration
 */

var ServerPort = process.env.PORT || 3456;
var PublicWebHookBaseUrl = 'https://d8149192.ngrok.io';
var Workspace = '45612600456189';

/**
 * Globals
 */

var log = bunyan.createLogger({
    name: 'Spiderman'
});

/**
 * Our Server
 */

var server = restify.createServer({
    name: 'Spiderman Server',
    version: '0.0.1'
});
var app, io;

// Ensure we don't drop data on uploads
server.pre(restify.pre.pause());

// Clean up sloppy paths like //todo//////1//
server.pre(restify.pre.sanitizePath());

// Handles annoying user agents (curl)
server.pre(restify.pre.userAgentConnection());

// Set a per request bunyan logger (with requestid filled in)
server.use(restify.requestLogger());

// Allow 5 requests/second by IP, and burst to 10
server.use(restify.throttle({
    burst: 10,
    rate: 5,
    ip: true,
}));

// Use the common stuff you probably want
server.use(restify.acceptParser(server.acceptable));
server.use(restify.dateParser());
server.use(restify.queryParser());
/*
server.use(restify.gzipResponse());
*/

server.use(restify.bodyParser({
    mapParams: true
})); // Allows for JSON mapping to REST

server.pre(function(req, res, next) {
  req.headers.accept = 'application/json';  // screw you client!
  req.headers["content-type"] = 'application/json';
  return next();
});

/*
server.on('uncaughtException', function(req, res, route, err) {
  log.error(err);
  res.send(err);
});
*/

/**
 * Handlers
 */

var createTask = function(task, callback) {
  log.info({task: task}, 'creating asana task');

  asanaBearerRequest.post('/workspaces/' + Workspace + '/tasks', {
    form: {
      assignee: task.assignee,
      name: _.template(task.name)(task),
      notes: _.template(task.note)(task),
      due_on: moment().add(task.dueDays, 'days').format('YYYY-MM-DD')
    }
   }, function (error, response, body) {
    if (response.statusCode === 201) {
      log.info({result: body});
      var result = JSON.parse(body);
      var taskId = result.data.id;

      // Add Project
      if (task.project) {
        log.info('adding project %s to task %s', task.project, taskId);
        asanaBasicRequest.post('/tasks/' + taskId + '/addProject', {
          form: {
            project: tasksDb.projects[task.project]
          }
         }, function (error, response, body) {
          if (response.statusCode !== 200) {
            log.info({response: response}, 'Unable to add project to task in Asana');
          }
        });
      }

      // Add Tags
      _.each(task.tags, function(tag) {
        log.info('adding tag %s to task %s', tag, taskId);
        asanaBasicRequest.post('/tasks/' + taskId + '/addTag', {
          form: {
            tag: tasksDb.tags[tag],
          }
         }, function (error, response, body) {
          if (response.statusCode !== 200) {
            log.info({response: response}, 'Unable to add task tag in Asana');
          }
        });
      });

      // Add webhooks
      if (task.triggers && task.triggers.completed) {
        _.each(task.triggers.completed, function(trigger) {
          log.info({trigger: trigger}, 'adding webhook for task %s', taskId);
          asanaBearerRequest.post('/webhooks', {
            json: true,
            body: {
              "data": {
                "resource": taskId,
                "events": "task.changed",
                "target": PublicWebHookBaseUrl + "/hooks/asana"
              }
            }
          }, function (error, response, body) {
            if (response.statusCode === 201) {

              trigger = _.clone(trigger);
              trigger.resource = trigger.resource || task.resource;

              if (!_.isArray(tasksDb.hooks.completed[taskId])) {
                tasksDb.hooks.completed[taskId] = [];
              }
              tasksDb.hooks.completed[taskId].push(trigger);
            } else {
              log.info({response: response}, 'Unable to create task webhook in Asana');
            }
          });
        })
      }
    } else {
      log.info({response: response}, 'Unable to create task in Asana');
    }
  })
};

var handleActivation = function(userId, callback) {
  var user;

  async.waterfall([
    function(cb) {
      apiRequest.get('/users/' + userId, function (error, response, body) {
        if (error) return cb(error);
        if (response.statusCode === 200) {
          user = JSON.parse(body);
          if (!_.isString(user.profile.department)) {
            user.profile.department = 'Corp';
          };
          log.info({user: user}, "fetched activated user");
          return cb(null);
        }
        return cb(new Error('Unable to fetch activated user' + userId));
      });
    },
    function(cb) {
      apiRequest.get('/apps/' + tasksDb.apps.asana + '/users/' + userId, function (error, response, body) {
        if (error) return cb(error);
        if (response.statusCode === 200) {
          appUser = JSON.parse(body);
          log.info({asanaUser: appUser}, "fetched asana user");
          return cb(null, appUser);
        }
        return cb(new Error('Unable to fetch asana user' + userId));
      });
    },
    function(appUser, cb) {
      var userTasks = _.union(tasksDb.catalog.activate.HR, tasksDb.catalog.activate.IT);
      switch (user.profile.department.toLowerCase()) {
        case "engineering" :
          userTasks = _.union(userTasks, tasksDb.catalog.activate.Engineering);
          break;
        case "product" :
          userTasks = _.union(userTasks, tasksDb.catalog.activate.Product);
          break;
        default :
          break;
      }

      _.each(userTasks, function(task) {
        task =  _.clone(task);
        task.assignee = task.assignee ? tasksDb.users[task.assignee] : appUser.credentials.userName;
        task.resource = {
          id: appUser.id,
          externalId: user.id,
          userName: appUser.credentials.userName,
          login: user.profile.login,
          name: user.profile.displayName ? user.profile.displayName : (user.firstName + ' ' + user.lastName),
        };
        createTask(task);
      });
      return cb(null);
    }
  ], callback);
}

var handleDeactivation = function(userId, callback) {
  var user;

  async.waterfall([
    function(cb) {
      apiRequest.get('/users/' + userId, function (error, response, body) {
        if (error) return cb(error);
        if (response.statusCode === 200) {
          user = JSON.parse(body);
          if (!_.isString(user.profile.department)) {
            user.profile.department = 'Corp';
          };
          log.info({user: user}, "fetched deactivated user");
          return cb(null);
        }
        return cb(new Error('Unable to fetch deactivated user' + userId));
      });
    },
    function(cb) {
      _.each(tasksDb.catalog.deactivate.IT, function(task) {
        task =  _.clone(task);
        task.assignee = task.assignee ? tasksDb.users[task.assignee] : appUser.credentials.userName;
        task.resource = {
          externalId: user.id,
          login: user.profile.login,
          name: user.profile.displayName ? user.profile.displayName : (user.firstName + ' ' + user.lastName),
        };
        createTask(task);
      });
      return cb(null);
    }
  ], callback);
}

var handleOktaEvent = function(req, res, next) {
  log.info({"event": req.params}, '=> received Okta webhook');

  io.sockets.emit('event', req.params);

  switch (req.params.action) {
    case 'core.user.config.user_activated':
      var user = _.find(req.params.targets, function(target) {
        return (target.objectType === "User");
      });
      handleActivation(user.id, function(err) {
        log.error({ error: err}, 'Unable to process activation event');
      });
      break;
  case 'core.user.config.user_deactivated':
      var user = _.find(req.params.targets, function(target) {
        return (target.objectType === "User");
      });
      handleDeactivation(user.id, function(err) {
        log.error({ error: err}, 'Unable to process deactivation event');
      });
    default :
      break;
  }

  res.status(200);
  res.end();
  next();
};


function handleAsanaEvent(req, res, next) {
  var hookSecret = req.header('X-Hook-Secret');
  var hookSig = req.header('X-Hook-Signature');

  log.info({params: req.params}, '=> received Asana webhook');

  if (hookSecret) {
    // Activate WebHook
    log.info('X-Hook-Secret: ' + hookSecret);
    res.status(200);
    res.set('X-Hook-Secret', hookSecret);
    res.end();
  } else {
    // Receive Events
    res.status(200);
    res.end();
    // Process Events
    _.each(req.params.events, function(event) {
      if (event.type === 'task' && event.action === 'changed' &&
        tasksDb.hooks.completed[event.resource]) {

        asanaBasicRequest.get('/tasks/' + event.resource, function (error, response, body) {
          if (response.statusCode === 200) {
            var task = JSON.parse(body);
            if (task.data.completed) {
              log.info({task: task}, 'task %s was completed', task.data.id);
              var triggers = tasksDb.hooks.completed[task.data.id];

              _.each(triggers, function(trigger) {
                log.info({trigger: trigger}, 'processing completion action')
                switch (trigger.action.toLowerCase()) {
                  case "task" :
                    trigger.data.resource = trigger.data.resource || trigger.resource;
                    createTask(trigger.data);
                    break;
                  case "assign" :
                    if (trigger.targetType.toLowerCase() === 'app') {
                      apiRequest.post('/apps/' + tasksDb.apps[trigger.target] + '/users/' + trigger.resource.externalId,
                        {
                          json: true,
                          body: {}
                        },
                        function (error, response, body) {
                          if (response.statusCode !== 200) {
                            log.error(error, {response: response}, 'Unable to assign application in Okta');
                          }
                      });
                    }
                    break;
                  default :
                    break;
                }
              })
            }
          }
        });
      }
    });
  }

  return next();
}

/**
 * Routes
 */

server.post('/hooks/asana', handleAsanaEvent);
server.post('/hooks/okta', handleOktaEvent);
server.get(/\/?.*/, restify.serveStatic({
  directory: './public',
  default: 'index.html'
}));

/**
 * Launch Server
 */

app = server.listen(ServerPort, function() {
  log.info('starting spiderman server', server.name, server.url);
});

io = socketio.listen(app);

/**
 * Socket Event Handlers
 */

io.on('connection', function(socket){
  log.info('User connected. Socket id %s', socket.id);
});



