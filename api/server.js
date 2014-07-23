var http			= require("http");
var express 		= require("express");
var mysql 			= require("mysql");	
var fs				= require("fs");
var zlib			= require("zlib");
var net				= require("net");
var moment 			= require("moment");
var geolib  		= require("geolib");
var async 			= require("async");
var shortid 		= require("shortid");
var passport 		= require("passport");
var BasicStrategy 	= require("passport-http").BasicStrategy;
var bcrypt  		= require("bcrypt");
var bodyParser 		= require("body-parser");
var geohash			= require("ngeohash");
var tzwhere 		= require("tzwhere");

/*
 _    _ _______ _______ _____     _____ ______ _______      ________ _____  
| |  | |__   __|__   __|  __ \   / ____|  ____|  __ \ \    / /  ____|  __ \ 
| |__| |  | |     | |  | |__) | | (___ | |__  | |__) \ \  / /| |__  | |__) |
|  __  |  | |     | |  |  ___/   \___ \|  __| |  _  / \ \/ / |  __| |  _  / 
| |  | |  | |     | |  | |       ____) | |____| | \ \  \  /  | |____| | \ \ 
|_|  |_|  |_|     |_|  |_|      |_____/|______|_|  \_\  \/   |______|_|  \_\
*/

tzwhere.init();

// MySQL connection pool
var pool  = mysql.createPool({
	connectionLimit : 100,
	host     		: "localhost",
	user     		: "root",
	password 		: "InMe1337",
	database 		: "boattracker",
	timezone 		: "Z"
});

//LOGIN
var loginFn = function(username, password, done) {

	// get mysql connection from pool
	pool.getConnection(function(err, c) {

		if(err) return done(err);

		// find user by username
		c.query("SELECT * FROM users WHERE email = " + pool.escape(username), function(err, rows) {

			if (err)  return done(err);
	      	if (rows.length == 0) return done(null, false);
	      	if (rows[0].password != password) return done(null, false);
	      	return done(null, rows[0]);
		});
	});
};

passport.use(new BasicStrategy(loginFn));

var app 	= express();
var server 	= http.createServer(app);
var io 		= require("socket.io")(server);

app.use("/css", express.static("/var/www/boattrack/web/css"));
app.use("/js", express.static("/var/www/boattrack/web/js"));
app.use("/img", express.static("/var/www/boattrack/web/img"));
app.use(passport.initialize());
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded());

// start server
server.listen(8097);
console.log("Listening on port 8897. Ready to serve...");

// Serve a static html file with gzip compression
function serveHtml(res, file, next) {
	// read index.html
  	fs.readFile("/var/www/boattrack/web/" + file, function (err, html) {
		zlib.gzip(html, function(err, result) {
			
			res.set("Content-Type", "text/html");
			res.set("Content-Encoding", "gzip");
			
			return next(result);
		});
	}); 
}

// HOME
app.get("/", function(req, res) { serveHtml(res, "login.html", function(html) { return res.send(html); }); });
app.get("/trips", function(req, res) { serveHtml(res, "trips.html", function(html) { return res.send(html); }); });
app.get("/dashboard", function(req, res) { serveHtml(res, "dashboard.html", function(html) { return res.send(html); }); });

// LOGIN
app.post("/login", function(req, res) {

	//do the login
	loginFn(req.body.email, req.body.password, function(err, user) {

		console.log(err, user);

		if(!err && user) res.redirect("/trips");
		else res.redirect("/");

	});
});

// EMBED
app.get("/embed/:key/", function(req, res) {

	serveHtml(res, "embed.html", function(html) {
		return res.send(html);
	});
});

// GET /BOATS
app.get("/api/boats/:owner", passport.authenticate("basic", { session: false }), function(req, res) {

	if(req.user.owner != parseInt(req.params.owner)) {
		return res.send(403);
	}

	// get connaction from pool
	pool.getConnection(function(err, c) {

		if(err) throw err;

		// fetch all boats
	  	c.query("SELECT * FROM boats WHERE owner = " + pool.escape(req.params.owner), function(err, rows) {

	  		if(err) throw err;
	    	c.release();

	    	return res.send(rows);
	  	});
	});
});

// GET /trips
app.get("/api/trips/:boat", passport.authenticate("basic", { session: false }), function(req, res) {

	// get connaction from pool
	pool.getConnection(function(err, c) {

		if(err) throw err;

		// fetch all boats
	  	c.query("SELECT t.*, (SELECT COUNT(p.id) FROM positions AS p WHERE p.trip = t.id) AS amount FROM trips AS t WHERE t.boat = " + pool.escape(req.params.boat) + " ORDER BY t.start DESC", function(err, rows) {

	  		if(err) throw err;
	    	c.release();

	    	return res.send(rows);
	  	});
	});
});

// GET /trip/:key
app.get("/api/trip/:key", function(req, res) {

	// get connaction from pool
	pool.getConnection(function(err, c) {

		if(err) throw err;

		// fetch all boats
	  	c.query("SELECT t.*, b.name, b.owner FROM trips AS t JOIN boats AS b ON t.boat = b.id WHERE t.key = " + pool.escape(req.params.key), function(err, rows) {

	  		if(err) throw err;
	    	c.release();

	    	return res.send(rows[0]);
	  	});
	});
});

// GET /trips/delete/
app.get("/api/trips/delete/:id", passport.authenticate("basic", { session: false }),  function(req, res) {

	// get connaction from pool
	pool.getConnection(function(err, c) {

		if(err) throw err;

		// fetch all boats
	  	c.query("DELETE FROM trips WHERE id = " + pool.escape(req.params.id), function(err, result) {

	  		if(!err && result.affectedRows == 1) return res.send({success: true});
			else return res.send({success: false});
	  	});
	});
});

// GET positions
app.get("/api/positions/:trip", function(req, res) {

	async.parallel({

		// positions
		positions: function(callback) {

			// get connection from pool
			pool.getConnection(function(err, c) {

				if(err) throw err;

				c.query("SELECT latitude, longitude, speed, course, timestamp FROM positions WHERE trip = " + pool.escape(req.params.trip) + " ORDER BY timestamp", function(err, rows) {
					if(err) throw err;
			    	c.release();

			    	return callback(null, rows);
				});
			});
		},

		// labels
		labels: function(callback) {

			// get connection from pool
			pool.getConnection(function(err, c) {

				if(err) throw err;

				// get the start and finish time for the trip
				c.query("SELECT start, finish FROM trips WHERE id = " + pool.escape(req.params.trip), function(err, rows) {
					if(err) throw err;

					if(rows.length == 1) {
						
						// compose the query for fetching the labels
						var q = "SELECT latitude, longitude, title FROM labels WHERE timestamp >= " + pool.escape(rows[0].start);
						if(rows[0].finish) q += " AND timestamp <= " + pool.escape(rows[0].finish);
						
						// get labels
						c.query(q, function(err, rows) {
							if(err) throw err;

							c.release();
							return callback(null, rows);
						});

					}
					else {
						c.release();
						return callback(null, null);
					}
				});
			});
		}
	},
	function(err, results) {
		return res.send(results);
	});	
});

// GET position
app.get("/api/position/:trip/:latitude/:longitude", function(req, res) {

	pool.getConnection(function(err, c) {

		if(err) throw err;

		// TODO: umstellen auf geohash
		c.query("SELECT p.*, (POW(69.1 * (latitude - " + pool.escape(req.params.latitude) +"), 2) + POW(69.1 * (" + pool.escape(req.params.longitude) + " - longitude) * COS(latitude / 57.3), 2)) AS distance FROM positions AS p WHERE p.trip = " + pool.escape(req.params.trip) + " ORDER BY distance LIMIT 1", function(err, rows) {

			if(err) throw err;
	    	c.release();

	    	return (rows.length == 1) ? res.send(rows[0]) : res.send(null);
		});
	});
});

// POST label/add
app.post("/api/label/add", function(req, res) {

	pool.getConnection(function(err, c) {

		if(err) throw err;

		var data = {
			"boat": req.body.boat,
			"title": req.body.title,
			"timestamp": req.body.timestamp || moment().utc().toDate(),
			"latitude": parseFloat(req.body.latitude),
			"longitude": parseFloat(req.body.longitude)
		};

		c.query("INSERT INTO labels SET ?", data, function(err, results) {

			c.release();

			// check if the boat has a current trip, ...
			c.query("SELECT currentTrip FROM boats WHERE id = " + pool.escape(data.boat), function(err, rows) {
				if(!err && rows.length == 1) {

					// ... if so, push the new label to the trip socket group
					if(rows[0].currentTrip) {

						io.sockets.in("trip_" + rows[0].currentTrip).emit("label", data);
					}
				}
			});

			if(!err) return res.send(true);
			else return res.send(false);
		});
	});
});

// GET /assets/
app.get("/api/assets/:owner", function(req, res) {

	async.parallel({

		// fetch all boats
		boats: function(callback) {

			// get connection from pool
			pool.getConnection(function(err, c) {
			  	c.query("SELECT p.*, b.name FROM boats AS b JOIN positions AS p ON b.lastPosition = p.id WHERE b.owner = " + pool.escape(req.params.owner), function(err, rows) {
			  		if(err) throw err;

			  		var boats = [];
			  		for(var i in rows) {
			  			boats.push({
			  				"id": rows[i].boat,
			  				"coord": [rows[i].latitude, rows[i].longitude],
			  				"timestamp": rows[i].timestamp,
			  				"name": rows[i].name,
			  				"type": "boat"
			  			});
			  		}

					c.release();
			    	callback(null, boats);
			  	});
			});
		},

		// fetch all marinas
		marinas: function(callback) {

			// get connection from pool
			pool.getConnection(function(err, c) {
				c.query("SELECT * FROM marinas", function(err, rows) {
					if(err) throw err;

					var marinas = [];
			  		for(var i in rows) {
			  			marinas.push({
			  				"id": rows[i].id,
			  				"coord": [rows[i].latitude, rows[i].longitude],
			  				"name": rows[i].name,
			  				"type": "marina"
			  			});
			  		}

					c.release();
			    	callback(null, marinas);
				});
			});
		},

		// fetch all moorings
		moorings: function(callback) {

			// get connection from pool
			pool.getConnection(function(err, c) {
				c.query("SELECT m.* FROM moorings AS m JOIN boats AS b ON b.id = m.boat WHERE b.owner = " + pool.escape(req.params.owner), function(err, rows) {
					if(err) throw err;

					var moorings = [];
					for(var i in rows) {
						moorings.push({
							"id": rows[i].id,
							"coord": [rows[i].latitude, rows[i].longitude],
							"name": rows[i].pier + " " + rows[i].position,
							"radius": rows[i].radius,
							"type": "mooring" 
						})
					}

					c.release();
					callback(null, moorings);
				});
			});
		}
	}, 
	function(err, results) {

		var assets = results.boats.concat(results.marinas).concat(results.moorings);
		return res.send(assets);
	});
});

// GET /tileproxy
app.get("/api/tileproxy", function(req, res) {

	if(req.query.url.indexOf("tile") == -1) {
		return res.send(403, null);
	}

	// fetch the url
	http.get(req.query.url, function(imgres) {

		res.header("Content-Type", "image/png");
		return imgres.pipe(res);
	});
});

/*
  _____            _        _     _____ ____  
 / ____|          | |      | |   |_   _/ __ \ 
| (___   ___   ___| | _____| |_    | || |  | |
 \___ \ / _ \ / __| |/ / _ \ __|   | || |  | |
 ____) | (_) | (__|   <  __/ |_ _ _| || |__| |
|_____/ \___/ \___|_|\_\___|\__(_)_____\____/ 
*/

io.on("connection", function (socket) {
	socket.on("join", function (data) {

		if(data.owner) {
			socket.join("owner_" + data.owner);
		}

		if(data.trip) {
			socket.join("trip_" + data.trip);
		}
	});
});

/*
 _______ _____ _____     _____ ______ _______      ________ _____  
|__   __/ ____|  __ \   / ____|  ____|  __ \ \    / /  ____|  __ \ 
   | | | |    | |__) | | (___ | |__  | |__) \ \  / /| |__  | |__) |
   | | | |    |  ___/   \___ \|  __| |  _  / \ \/ / |  __| |  _  / 
   | | | |____| |       ____) | |____| | \ \  \  /  | |____| | \ \ 
   |_|  \_____|_|      |_____/|______|_|  \_\  \/   |______|_|  \_\
*/

// zerofill
function zero(n) { return (n < 10) ? "0" + n : n }

net.createServer(function(c) {

	var buf = null;

	c.on("error", function(err) {
		console.log("Caught flash policy server socket error: ");
	    console.log(err.stack);
	});

	// DATA
	c.on("data", function(data) {

		//console.log(data);
		//c.send("ok");

		if(buf == null) {
			buf = data;
		}
		else {
			var tmp = new Buffer(buf.length + data.length);

			// buf.copy(targetBuffer, [targetStart], [sourceStart], [sourceEnd])
			buf.copy(tmp, 0);
			data.copy(tmp, buf.length);

			buf = tmp;
		}
	});

	// END
	c.on("end", function() {

		//console.log(buf);

		pool.getConnection(function(err, c) {

			if(err) throw err;

			var boatPositions = {};

			// store the raw data, for error logging purposes
			c.query("INSERT INTO rawdata SET ?", {
				"timestamp": moment.utc().toDate(),
				"data": buf
			});

			// check for the first occurance of "AAA"
			for(var i = 0; i < buf.length; i++) {

				// not enough data anyway, break out of the loop
				if(i + 4 >= buf.length) break;

				// is this a valid "MCGP" message?
				if(buf[i] == 77 && buf[i + 1] == 67 && buf[i + 2] == 71 && buf[i + 3] == 80) {

					// slice a message piece out?
					var working = buf.slice(i, i + 32);

					// interpret and store working buffer
					var dateString = working.readInt16LE(29) + "-" + zero(working.readInt8(28)) + "-" + zero(working.readInt8(27)) + " " + zero(working.readInt8(26)) + ":" + zero(working.readInt8(25)) + ":" + zero(working.readInt8(24));

					var position = {
						"hwid": working.readInt32LE(4),
						"latitude": working.readFloatLE(8),
						"longitude": working.readFloatLE(12),
						"speed": working.readFloatLE(16),
						"course": working.readInt16LE(20),
						"hdop": working.readInt16LE(22),
						"timestamp": dateString,
						"geohash": geohash.encode(working.readFloatLE(8), working.readFloatLE(12), 10)
					};

					// add new array to positions dict
					if(!(position.hwid in boatPositions)) {
						boatPositions[position.hwid] = [];
					}

					boatPositions[position.hwid].push(position);

					i += 31;
				}
			}

			// loop all keys of boat positions
			for(var key in boatPositions) {

				// FN: analyses the trip and stores its results
				var tripAnalysis = function(rows, c) {

					c.query("SELECT latitude, longitude, speed FROM positions WHERE trip = " + rows[0].currentTrip + " ORDER BY timestamp", function(err, positions) {

						// store the distance of the trip
						var dist = 0.0;
						var vmax = 0.0;
						for(var i = 0; i < positions.length - 1; i++) {
							dist += geolib.getDistance(positions[i], positions[i + 1]);
							if(positions[i].speed > vmax) vmax = positions[i].speed;
						}

						// meters to nautical miles
						dist = dist * 0.000539956803;

						c.query("UPDATE trips SET distance = " + dist + " WHERE id = " + rows[0].currentTrip);
						c.query("UPDATE trips SET vmax = " + vmax + " WHERE id = " + rows[0].currentTrip);
					});
				};

				// fn: find a trip out of this position
				var findTrip = function(rows, c, position, next) {

					// check if a row exists
					if(rows.length >= 1) {

						// decide by triptype to check what to do
						switch(rows[0].tripType) {

							// every day a new trip
							case 0: 

								// not tour yet, so there definitly has to be one created
								if(rows[0].currentTrip == null) {

									var newTrip = {
										"key": shortid.generate(),
										"boat": position.boat,
										"type": 0,
										"start": position.timestamp,
										"finish": null
									};

									// ... create new trip
									c.query("INSERT INTO trips SET ?", newTrip, function(err, tripResult) {

										if(err) {
											console.log(err);
											return next(null);
										}

										var newTripId = tripResult.insertId;
										c.query("UPDATE boats SET currentTrip = " + newTripId + " WHERE id = " + position.boat);
										return next(newTripId);
									});
								}

								// there is a tour yet, should it be closed and  
								// a new one, for a new day beeing started
								else {

									// find last boat position
									c.query("SELECT latitude, longitude, timestamp FROM boats AS b JOIN positions AS p ON p.id = b.lastPosition WHERE b.id = " + position.boat, function(err, lastPos) {

										if(!err && lastPos.length == 1) {

											var lastLocalTime = moment(lastPos[0]);
											var currLocalTime = position.timestamp;
											var tzOffsetHours = tzwhere.tzOffsetAt(lastPos[0]["latitude"], lastPos[0]["longitude"]);
											
											// add or subtract the offset to local time
											if(tzOffsetHours > 0) {

												lastLocalTime = lastLocalTime.add("ms", tzOffsetHours);
												currLocalTime = currLocalTime.add("ms", tzOffsetHours);
											}
											else if(tzOffsetHours < 0) {	

												lastLocalTime = lastLocalTime.subtract("ms", tzOffsetHours);
												currLocalTime = currLocalTime.subtract("ms", tzOffsetHours);
											}

											// check if a new day started, or the last position is longer then 24 hours old ...
											if (lastLocalTime.date() != currLocalTime.date() || 
												Math.abs(lastLocalTime.diff(currLocalTime)) / 1000 > 86400) {

												// store analysis on the old tour
												tripAnalysis(rows, c);

												var newTrip = {
													"key": shortid.generate(),
													"boat": position.boat,
													"type": 0,
													"start": position.timestamp,
													"finish": null
												};

												// ... create new trip
												c.query("INSERT INTO trips SET ?", newTrip, function(err, tripResult) {

													if(err) {
														console.log(err);
														return next(null);
													}

													var newTripId = tripResult.insertId;
													c.query("UPDATE trips SET finish = '" + position.timestamp + "' WHERE id = " + rows[0].currentTrip);
													c.query("UPDATE boats SET currentTrip = " + newTripId + " WHERE id = " + position.boat);
													return next(newTripId);
												});
											}

											// no new day started
											else {
												return next(rows[0].currentTrip);
											}
										}
										else {

											console.log(err);
											return next(null);
										}
									});
								}

								break;

							// leaving mooring
							case 1: 

								var isAtMooring = geolib.isPointInCircle(
								    position,
								    rows[0], 
								    rows[0].radius
								);

								// boat is not at the mooring ...
								if(!isAtMooring) {

									// ... and currently not on a trip, ...
									if(rows[0].currentTrip == null) {

										var newTrip = {
											"key": shortid.generate(),
											"boat": position.boat,
											"type": 1,
											"start": position.timestamp,
											"finish": null
										};

										// ... create new trip
										c.query("INSERT INTO trips SET ?", newTrip, function(err, tripResult) {

											var newTripId = tripResult.insertId;
											c.query("UPDATE boats SET currentTrip = " + newTripId + " WHERE id = " + position.boat);
											return next(newTripId);
										});
									}

									// there is currently a trip going on
									else {
										return next(rows[0].currentTrip);
									}
								}

								// boat is back at the mooring ...
								else {

									// ... and there is currently a trip going on, ...
									if(rows[0].currentTrip != null) {

										// do some calculations on the trip
										tripAnalysis(rows, c);

										// ... stop it
										c.query("UPDATE boats SET currentTrip = NULL WHERE id = " + position.boat);
										c.query("UPDATE trips SET finish = '" + position.timestamp + "' WHERE id = " + rows[0].currentTrip);

										return next(null);
									}
								}

								break;

							// manually
							case 2: 
								return next(null);
								break;
						}
					}
					else return next(null);
				};

				async.eachSeries(boatPositions[key], function(position, callback) {

					// get boat id from devices via hwid
					c.query("SELECT boat FROM devices WHERE hwid = ?", [position.hwid], function(err, devices) {

						if(err || devices.length != 1) return callback(err, null);

						position.boat = devices[0].boat;
						delete position.hwid;

						//console.log(position);

						// check which triptype is selected and where the mooring is
						c.query("SELECT b.tripType, b.currentTrip, m.latitude, m.longitude, m.radius, b.owner FROM boats as b JOIN moorings as m ON m.boat = b.id WHERE b.id = " + position.boat, function(err, rows) {

							if(err) throw err;

							// find trip and then insert position
							findTrip(rows, c, position, function(trip) {

								// insert new position
								position["trip"] = trip;
								c.query("INSERT INTO positions SET ?", position, function(err, result) {

									// set the pointer to the last known position 
									c.query("UPDATE boats SET lastPosition = " + result.insertId + " WHERE id = " + position.boat);
								});

								// populate to websocket
								io.sockets.in("owner_" + rows[0].owner).emit("position", position);
								if(trip) io.sockets.in("trip_" + trip).emit("position", position);

								callback();

							}, function(err) {
								if (err) throw err;
							});

						});
					});
				});
			}

			c.release();

		});
	});

}).listen(8100);
