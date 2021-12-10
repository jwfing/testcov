'use strict';

var express = require('express');
var timeout = require('connect-timeout');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var AV = require('leanengine');
var moment = require('moment');

// Loads cloud function definitions.
// You can split it into multiple files but do not forget to load them in the main file.
require('./cloud');

var TestCovReport = AV.Object.extend('TapTestCovReport');

var app = express();

// Configures template engine.
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Configures default timeout.
app.use(timeout('15s'));

// Loads LeanEngine middleware.
app.use(AV.express());

app.enable('trust proxy');
// Uncomment the following line to redirect all HTTP requests to HTTPS.
// app.use(AV.Cloud.HttpsRedirect());

app.use(express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.get('/', function(req, res, next) {
  var queryMods = ["TapSDK(Android)", "TapSDK(Objective-C)", "LC Storage SDK(Objective-C)",
   "LC Storage SDK(Java)", "LC Storage SDK(JavaScript)", "LC Realtime SDK(JavaScript)"];

  Promise.all(queryMods.map(function(mod) {
    var query = new AV.Query(TestCovReport);
    query.descending('createdAt');
    query.equalTo('module', mod);
    return query.first();
  })).then(function(results) {
    res.render('index', {
        currentTime: new Date(),
        moment: moment,
        testReports: results
      });
  }, function(err) {
    if (err.code === 101) {
      // Todo class does not exist in the cloud yet.
      res.render('index', {
        currentTime: new Date(),
        moment: moment,
        testReports: []
      });
    } else {
      next(err);
    }
  }).catch(next);
  
//  res.render('index', { currentTime: new Date() });
});

app.get('/details', function(req, res, next) {
  var modName = req.query.module;
  var query = new AV.Query(TestCovReport);
  query.equalTo("module", modName);
  query.descending('createdAt');
  query.find().then(function(results) {
    res.render('details', {
      module: modName,
      moment: moment,
      testReports: results
    });
  }, function(err) {
    if (err.code === 101) {
      // Todo class does not exist in the cloud yet.
      res.render('details', {
        module: modName,
        moment: moment,
        testReports: []
      });
    } else {
      next(err);
    }
  }).catch(next);
});

app.use(function(req, res, next) {
  // If there is no routing answering, throw a 404 exception to exception handlers.
  if (!res.headersSent) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  }
});

// error handlers
app.use(function(err, req, res, next) {
  if (req.timedout && req.headers.upgrade === 'websocket') {
    // Ignores websocket timeout.
    return;
  }

  var statusCode = err.status || 500;
  if (statusCode === 500) {
    console.error(err.stack || err);
  }
  if (req.timedout) {
    console.error('Request timeout: url=%s, timeout=%d, please check whether its execution time is too long, or the response callback is invalid.', req.originalUrl, err.timeout);
  }
  res.status(statusCode);
  // Do not output exception details by default.
  var error = {};
  if (app.get('env') === 'development') {
    // Displays exception stack on page if running in the development enviroment.
    error = err;
  }
  res.render('error', {
    message: err.message,
    error: error
  });
});

module.exports = app;
