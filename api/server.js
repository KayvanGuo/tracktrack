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

/*
 _    _ _______ _______ _____     _____ ______ _______      ________ _____  
| |  | |__   __|__   __|  __ \   / ____|  ____|  __ \ \    / /  ____|  __ \ 
| |__| |  | |     | |  | |__) | | (___ | |__  | |__) \ \  / /| |__  | |__) |
|  __  |  | |     | |  |  ___/   \___ \|  __| |  _  / \ \/ / |  __| |  _  / 
| |  | |  | |     | |  | |       ____) | |____| | \ \  \  /  | |____| | \ \ 
|_|  |_|  |_|     |_|  |_|      |_____/|______|_|  \_\  \/   |______|_|  \_\
*/

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
app.get("/boats/:owner", passport.authenticate("basic", { session: false }), function(req, res) {

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
app.get("/trips/:boat", passport.authenticate("basic", { session: false }), function(req, res) {

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
app.get("/trip/:key", function(req, res) {

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
app.get("/trips/delete/:id", passport.authenticate("basic", { session: false }),  function(req, res) {

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
app.get("/positions/:trip", function(req, res) {

	// get connection from pool
	pool.getConnection(function(err, c) {

		if(err) throw err;

		c.query("SELECT latitude, longitude, speed, course, timestamp, anchored FROM positions WHERE trip = " + pool.escape(req.params.trip) + " ORDER BY timestamp", function(err, rows) {
			if(err) throw err;
	    	c.release();

	    	return res.send(rows);
		});
	});
});

// GET position
app.get("/position/:trip/:latitude/:longitude", function(req, res) {

	pool.getConnection(function(err, c) {

		if(err) throw err;

		c.query("SELECT p.*, (POW(69.1 * (latitude - " + pool.escape(req.params.latitude) +"), 2) + POW(69.1 * (" + pool.escape(req.params.longitude) + " - longitude) * COS(latitude / 57.3), 2)) AS distance FROM positions AS p WHERE p.trip = " + pool.escape(req.params.trip) + " ORDER BY distance LIMIT 1", function(err, rows) {

			if(err) throw err;
	    	c.release();

	    	return (rows.length == 1) ? res.send(rows[0]) : res.send(null);
		});
	});
});

// GET /assets/
app.get("/assets/:owner", function(req, res) {

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
app.get("/tileproxy", function(req, res) {

	var blank = "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAABFUlEQVR4nO3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBPAABPO1TCQAAAABJRU5ErkJggg==";

	if(req.query.url.indexOf("tile") == -1) {
		return res.send(403, null);
	}

	// fetch the url
	http.get(req.query.url, function(imgres) {

		res.header("Content-Type", "image/png");
		return imgres.pipe(res);
	});
});

// RECEPTION
app.get("/reception", function(req, res) {

	var boat = parseInt(req.query.boat);
	var lat = parseFloat(req.query.lat);
	var lon = parseFloat(req.query.lon);
	var speed = parseFloat(req.query.speed);
	var course = parseInt(req.query.course);
	var time = req.query.timestamp;
	var hdop = parseInt(req.query.hdop);

	console.log(req.query);

	res.send("ok");

	pool.getConnection(function(err, c) {

		if(err) throw err;

		var position = {
			"boat": boat,
			"latitude": lat,
			"longitude": lon,
			"speed": speed,
			"course": course,
			"timestamp": time,
			"hdop": hdop,
			"geohash": geohash.encode(lat, lon, 10)
		};

		// fn: find a trip out of this position
		var findTrip = function(rows, c, position, next) {

			// check if a row exists
			if(rows.length >= 1) {

				switch(rows[0].tripType) {
					
					// manuel
					case 0: 
						return next(null);
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
									"start": moment.utc().format("YYYY-MM-DD HH:mm:ss"),
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

								// find last position of trip
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

								// ... stop it
								c.query("UPDATE boats SET currentTrip = NULL WHERE id = " + position.boat);
								c.query("UPDATE trips SET finish = '" + moment.utc().format("YYYY-MM-DD HH:mm:ss") + "' WHERE id = " + rows[0].currentTrip);
							
								return next(null);
							}
						}

						break;

					// timebased
					case 2: 
						return next(null);
						break;
				}
			}
			else return next(null);
		};

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
					c.release();
				});
				
				// populate to websocket
				io.sockets.in("owner_" + rows[0].owner).emit("position", position);
				if(trip) io.sockets.in("trip_" + trip).emit("position", position);

			}, function(err) {
				if (err) throw err;
			});

		});
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

net.createServer(function(c) {

	// DATA
	c.on("data", function(d) {
		console.log(new Date(), d);
		
		console.log(d.readInt32LE(0));
	});

	// END
	c.on("end", function() {
		console.log("end");
	});

}).listen(8100);
