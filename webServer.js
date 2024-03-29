"use strict";

/* jshint node: true */

/*
 * This builds on the webServer of previous projects in that it exports the current
 * directory via webserver listing on a hard code (see portno below) port. It also
 * establishes a connection to the MongoDB named 'cs142project6'.
 *
 * To start the webserver run the command:
 *    node webServer.js
 *
 * Note that anyone able to connect to localhost:portNo will be able to fetch any file accessible
 * to the current user in the current directory or any of its children.
 *
 * This webServer exports the following URLs:
 * /              -  Returns a text status message.  Good for testing web server running.
 * /test          - (Same as /test/info)
 * /test/info     -  Returns the SchemaInfo object from the database (JSON format).  Good
 *                   for testing database connectivity.
 * /test/counts   -  Returns the population counts of the cs142 collections in the database.
 *                   Format is a JSON object with properties being the collection name and
 *                   the values being the counts.
 *
 * The following URLs need to be changed to fetch there reply values from the database.
 * /user/list     -  Returns an array containing all the User objects from the database.
 *                   (JSON format)
 * /user/:id      -  Returns the User object with the _id of id. (JSON format).
 * /photosOfUser/:id' - Returns an array with all the photos of the User (id). Each photo
 *                      should have all the Comments on the Photo (JSON format)
 *
 */

var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

var async = require('async');

// Load the Mongoose schema for User, Photo, and SchemaInfo
var User = require('./schema/user.js');
var Photo = require('./schema/photo.js');
var SchemaInfo = require('./schema/schemaInfo.js');

var express = require('express');
var app = express();

// XXX - Your submission should work without this line. Comment out or delete this line for tests and before submission!
// var cs142models = require('./modelData/photoApp.js').cs142models;

mongoose.connect('mongodb://localhost/cs142project6', { useNewUrlParser: true, useUnifiedTopology: true });

// We have the express static module (http://expressjs.com/en/starter/static-files.html) do all
// the work for us.
app.use(express.static(__dirname));


app.get('/', function (request, response) {
    response.send('Simple web server of files from ' + __dirname);
});

/*
 * Use express to handle argument passing in the URL.  This .get will cause express
 * To accept URLs with /test/<something> and return the something in request.params.p1
 * If implement the get as follows:
 * /test or /test/info - Return the SchemaInfo object of the database in JSON format. This
 *                       is good for testing connectivity with  MongoDB.
 * /test/counts - Return an object with the counts of the different collections in JSON format
 */
app.get('/test/:p1', function (request, response) {
    // Express parses the ":p1" from the URL and returns it in the request.params objects.
    console.log('/test called with param1 = ', request.params.p1);

    var param = request.params.p1 || 'info';

    if (param === 'info') {
        // Fetch the SchemaInfo. There should only one of them. The query of {} will match it.
        SchemaInfo.find({}, function (err, info) {
            if (err) {
                // Query returned an error.  We pass it back to the browser with an Internal Service
                // Error (500) error code.
                console.error('Doing /user/info error:', err);
                response.status(500).send(JSON.stringify(err));
                return;
            }
            if (info.length === 0) {
                // Query didn't return an error but didn't find the SchemaInfo object - This
                // is also an internal error return.
                response.status(500).send('Missing SchemaInfo');
                return;
            }

            // We got the object - return it in JSON format.
            console.log('SchemaInfo', info[0]);
            response.end(JSON.stringify(info[0]));
        });
    } else if (param === 'counts') {
        // In order to return the counts of all the collections we need to do an async
        // call to each collections. That is tricky to do so we use the async package
        // do the work.  We put the collections into array and use async.each to
        // do each .count() query.
        var collections = [
            {name: 'user', collection: User},
            {name: 'photo', collection: Photo},
            {name: 'schemaInfo', collection: SchemaInfo}
        ];
        async.each(collections, function (col, done_callback) {
            col.collection.countDocuments({}, function (err, count) {
                col.count = count;
                done_callback(err);
            });
        }, function (err) {
            if (err) {
                response.status(500).send(JSON.stringify(err));
            } else {
                var obj = {};
                for (var i = 0; i < collections.length; i++) {
                    obj[collections[i].name] = collections[i].count;
                }
                response.end(JSON.stringify(obj));

            }
        });
    } else {
        // If we know understand the parameter we return a (Bad Parameter) (400) status.
        response.status(400).send('Bad param ' + param);
    }
});

/*
 * URL /user/list - Return all the User object.
 */
app.get('/user/list', function (request, response) {
    // response.status(200).send(cs142models.userListModel());
    // console.log('/user/list called with param1 = ', request.params);

    User.find({}, function(err, info) {
        if (err) {
            console.error('Doing /user/list error: ', err);
            response.status(500).send(JSON.stringify(err));
            return;
        }
        if (info.length === 0) {
            response.status(500).send('Missing User');
            return;
        }
        let users = [];
        for (var i = 0; i < info.length; i++) {
            users.push( {
                _id: info[i]._id,
                first_name: info[i].first_name,
                last_name: info[i].last_name,
            });
        }
        // We got the object - return it in JSON format.
        console.log('UserInfo', users);
        response.status(200).send(JSON.stringify(users));
    });
    console.log('Returned all the User object.'); 
});

/*
 * URL /user/:id - Return the information for User (id)
 */
app.get('/user/:id', function (request, response) {
    var id = request.params.id;
    // Here we query by findOne()
    User.findOne({_id: id}, function(err, user) {
        if (err) {
            console.error('Doing /user/:id error: ', err);
            response.status(400).send(JSON.stringify(err));
            return;
        }
        if (user === null || user === undefined) {
            console.log('User with id:' + id + ' not found.');
            response.status(400).send('Not found');
            return;
        }
        response.status(200).send(JSON.stringify({
            _id: user._id,
            first_name: user.first_name,
            last_name: user.last_name,
            location: user.location,
            description: user.description,
            occupation: user.occupation
        }));
    });
    console.log('Returned details for user with id: ' + id);

});

/*
 * URL /photosOfUser/:id - Return the Photos for User (id)
 */
app.get('/photosOfUser/:id', function (request, response) {
    var id = request.params.id;
    Photo.find({user_id: id}, function (err, photos) {
        if (err) {
            console.error('Doing /photosOfUser/:id error: ', err);
            response.status(400).send(JSON.stringify(err));
            return;
        }
        if (photos === null || photos === undefined) {
            console.log('Photos of user with id:' + id + ' not found.');
            response.status(400).send('Not found');
            return;
        }

        var photosParsed = JSON.parse(JSON.stringify(photos));
        var photoList = [];
        var fetchUser = [];

        function callback(error) {
            if (error) {
                response.status(500).send(error.message);
            }
        }

        async.each(photosParsed, function (photo) {
            var currentPhoto = {};
            currentPhoto._id = photo._id;
            currentPhoto.user_id = photo.user_id;
            currentPhoto.file_name = photo.file_name;
            currentPhoto.date_time = photo.date_time;
            currentPhoto.comments = [];

            async.each(photo.comments, function (comment) {
                var currentComment = {};
                currentPhoto.comments.push(currentComment);
                currentComment.comment = comment.comment;
                currentComment.date_time = comment.date_time;
                currentComment._id = comment._id;

                fetchUser.push(function(callback1) {
                    var user_id = comment.user_id;
                    User.findOne({_id: user_id}, function(err, author) {
                        if (err) {
                            console.error('Doing /user/:id error: ', err);
                            response.status(400).send(JSON.stringify(err));
                            return;
                        }
                        if (author === null || author === undefined) {
                            console.log('User with _id:' + id + ' not found.');
                            response.status(400).send('Not found');
                            return;
                        }

                        var author_detail = {
                            _id: author._id,
                            first_name: author.first_name,
                            last_name: author.last_name
                        };
                        currentComment.user = author_detail;
                        callback1();
                    });
                });
            }, callback);
            photoList.push(currentPhoto);
        
        }, function (error) {
            if (error) {
                response.status(500).send(JSON.stringify(error));
            }
        });


        async.parallel(fetchUser, function(){
            response.status(200).send(JSON.stringify(photoList));
        });

    });
});



var server = app.listen(3000, function () {
    var port = server.address().port;
    console.log('Listening at http://localhost:' + port + ' exporting the directory ' + __dirname);
});


