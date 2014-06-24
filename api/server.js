var http	= require("http");
var express = require("express");
var mysql 	= require("mysql");	
var fs		= require("fs");
var zlib	= require("zlib");
var net		= require("net");
var moment 	= require("moment");
var geolib  = require("geolib");
var async 	= require("async");

/*
 _    _ _______ _______ _____     _____ ______ _______      ________ _____  
| |  | |__   __|__   __|  __ \   / ____|  ____|  __ \ \    / /  ____|  __ \ 
| |__| |  | |     | |  | |__) | | (___ | |__  | |__) \ \  / /| |__  | |__) |
|  __  |  | |     | |  |  ___/   \___ \|  __| |  _  / \ \/ / |  __| |  _  / 
| |  | |  | |     | |  | |       ____) | |____| | \ \  \  /  | |____| | \ \ 
|_|  |_|  |_|     |_|  |_|      |_____/|______|_|  \_\  \/   |______|_|  \_\
*/

var app 	= express();
var server 	= http.createServer(app);

app.use("/css", express.static("/var/www/boattrack/web/css"));
app.use("/js", express.static("/var/www/boattrack/web/js"));
app.use("/img", express.static("/var/www/boattrack/web/img"));

// start server
server.listen(8097);
console.log("Listening on port 8897. Ready to serve...");

var pool  = mysql.createPool({
	host     : "localhost",
	user     : "root",
	password : "InMe1337",
	database : "boattracker",
	timezone : "Z"
});

// HOME
app.get("/", function(req, res) {

	// read index.html
  	fs.readFile("/var/www/boattrack/web/index.html", function (err, html) {
		zlib.gzip(html, function(err, result) {
			
			res.set("Content-Type", "text/html");
			res.set("Content-Encoding", "gzip");
			
			return res.send(result);
		});
	}); 
});

// GET /BOATS
app.get("/boats/:owner", function(req, res) {

	// get connaction from pool
	pool.getConnection(function(err, c) {

		if(err) throw err;

		// fetch all boats
	  	c.query("SELECT * FROM boats WHERE owner = " + req.params.owner, function(err, rows) {

	  		if(err) throw err;
	    	c.release();

	    	return res.send(rows);
	  	});
	});
});

// GET /trips
app.get("/trips/:boat", function(req, res) {

	// get connaction from pool
	pool.getConnection(function(err, c) {

		if(err) throw err;

		// fetch all boats
	  	c.query("SELECT t.*, (SELECT COUNT(p.id) FROM positions AS p WHERE p.trip = t.id) AS amount FROM trips AS t WHERE t.boat = " + req.params.boat, function(err, rows) {

	  		if(err) throw err;
	    	c.release();

	    	return res.send(rows);
	  	});
	});

});

// GET positions
app.get("/positions/:trip", function(req, res) {

	// get connection from pool
	pool.getConnection(function(err, c) {

		if(err) throw err;

		c.query("SELECT latitude, longitude, speed, course, timestamp, anchored FROM positions WHERE trip = " + req.params.trip + " ORDER BY timestamp", function(err, rows) {
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

		c.query("SELECT p.*, (POW(69.1 * (latitude - " + req.params.latitude +"), 2) + POW(69.1 * (" + req.params.longitude + " - longitude) * COS(latitude / 57.3), 2)) AS distance FROM positions AS p WHERE p.trip = " + req.params.trip + " ORDER BY distance LIMIT 1", function(err, rows) {

			if(err) throw err;
	    	c.release();

	    	return (rows.length == 1) ? res.send(rows[0]) : res.send(null);
		});
	});
});

// GET /position
app.get("/assets/:owner", function(req, res) {

	// get connection from pool
	pool.getConnection(function(err, c) {

		if(err) throw err;

		async.parallel({

			// fetch all boats
			boats: function(callback) {

			  	c.query("SELECT p.*, b.name FROM positions AS p JOIN boats as b ON p.boat = b.id WHERE p.id IN (SELECT MAX(pp.id) FROM positions as pp JOIN boats as bb ON pp.boat = bb.id JOIN owners as oo ON oo.id = bb.owner WHERE oo.id = " + req.params.owner + " GROUP BY pp.boat)", function(err, rows) {
			  		if(err) throw err;

			  		var boats = [];
			  		for(var i in rows) {
			  			boats.push({
			  				"id": rows[i].boat,
			  				"coord": [rows[i].latitude, rows[i].longitude],
			  				"name": rows[i].name,
			  				"type": "boat"
			  			});
			  		}

			    	callback(null, boats);
			  	});
			},

			// fetch all marinas
			marinas: function(callback) {

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

			    	callback(null, marinas);
				});
			},

			// fetch all moorings
			moorings: function(callback) {

				c.query("SELECT m.* FROM moorings AS m JOIN boats AS b ON b.id = m.boat WHERE b.owner = " + req.params.owner, function(err, rows) {
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

					callback(null, moorings);
				});

			}
		}, 
		function(err, results) {

			c.release();

			var assets = results.boats.concat(results.marinas).concat(results.moorings);

			return res.send(assets);
		});
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

	// DATA
	c.on("data", function(data) {

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

		pool.getConnection(function(err, c) {

			if(err) throw err;

			var boatPositions = {};

			// check for the first occurance of "AAA"
			for(var i = 0; i < buf.length; i++) {

				// not enough data anyway, break out of the loop
				if(i + 2 >= buf.length) break;

				// is this a valid "AAA" message?
				if(buf[i] == 65 && buf[i + 1] == 65 && buf[i + 2] == 65) {

					// slice a message piece out?
					var working = buf.slice(i, i + 28);

					// interpret and store working buffer
					var dateString = working.readInt16LE(26) + "-" + zero(working.readInt8(25)) + "-" + zero(working.readInt8(24)) + " " + zero(working.readInt8(23)) + ":" + zero(working.readInt8(22)) + ":" + zero(working.readInt8(21));

					var position = {
						"boat": working.readInt32LE(3),
						"latitude": working.readFloatLE(7),
						"longitude": working.readFloatLE(11),
						"speed": working.readFloatLE(15),
						"course": working.readInt16LE(19),
						"timestamp": dateString
					};

					// add new array to positions dict
					if(!(position.boat in boatPositions)) {
						boatPositions[position.boat] = [];
					}

					boatPositions[position.boat].push(position);

					i += 27;
				}
			}

			// loop all keys of boat positions
			for(var key in boatPositions) {

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

				async.eachSeries(boatPositions[key], function(position, callback) {

					// check which triptype is selected and where the mooring is
					c.query("SELECT b.tripType, b.currentTrip, m.latitude, m.longitude, m.radius, b.owner FROM boats as b JOIN moorings as m ON m.boat = b.id WHERE b.id = " + key, function(err, rows) {

						if(err) throw err;

						// find trip and then insert position
						findTrip(rows, c, position, function(newTripId) {

							// insert new position
							position["trip"] = newTripId;
							c.query("INSERT INTO positions SET ?", position);
							callback();

						}, function(err) {
							if (err) throw err;
						});

					});
				});
			}

			c.release();

		});
	});

}).listen(8100);
