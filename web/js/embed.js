$(function() {

	var EmbedView = MapView.extend({
		el: "#map",
		map: null,
		boatpath: null,
		options: {
			"f": false,
			"a": false
		},
		trip: null,

		// INITIALIZE
		initialize: function() {

			window.pad = function(n, width, z) {
				z = z || '0';
				n = n + '';
				return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
			};

			var path = window.location.pathname.split("/");
			var key = path[path.length - 2];
			var search = window.location.search.replace("?", "").split("&");

			for (var i in search) {
				var s = search[i].split("=");
				this.options[s[0]] = (s[1] == "1") ? true : false;
			}

			var that = this;

			// fetch the trip id from key
			$.getJSON("/api/trip/" + key, function(trip) {
				that.trip = trip;

				document.title = document.title.replace("Törn", trip.name);

				if (that.trip.id) {
					that.$el.empty();
					that.render();

					// set sidebar image
					$("#status img").attr("src", trip.photo);

					// start socket
					var socket = io.connect("/");
					socket.emit("join", {
						trip: that.trip.id
					});

					// get new position update
					socket.on("position", function(position) {

						console.log(position);

						for (var i in that.assets) {
							if (that.assets[i].options.alt == "boat_" + position.boat) {

								var l = L.latLng(position.latitude, position.longitude);

								// set boat to new position
								that.assets[i].setLatLng(l);
								that.assets[i].setHeading(position.course);

								if (position["windspeed"] != null && position["winddirection"] != null) {
									that.assets[i].setHeadingWind(position.course, position.windspeed, position.winddirection);
								} else {
									that.assets[i].setHeading(position.course);
								}

								that.map.panTo(l, {
									animate: true
								});

								// if there is a boatpath available, add to this
								if (that.boatpath) {
									that.boatpath.addLatLng(l);
								}
							}
						}

						// update status
						$("#status #speed span").html(position.speed.toFixed(1));
						$("#status #course span").html(window.pad(Math.abs(position.course.toFixed(0)), 3));
						$("#status #wind-speed span").html(position.windspeed.toFixed(1));
						$("#status #wind-dir span").html(window.pad(Math.abs(position.winddirection.toFixed(0)), 3));
					});

					// get new label update
					socket.on("label", function(data) {
						console.log(data);
						that.addLabelMarker(data);
					});
				}
			});
		},

		// RENDER
		render: function() {
			this.map = L.map("map", {
				measureControl: true
			});

			// add an OpenStreetMap tile layer
			//L.tileLayer("//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(this.map);
			L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
				attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
				maxZoom: 18,
				id: 'tomaszbrue.mgh2cfc0',
				accessToken: "pk.eyJ1IjoidG9tYXN6YnJ1ZSIsImEiOiJXWmNlSnJFIn0.xvLReqNnXy_wndeZ8JGOEA"
			}).addTo(this.map);

			// add seamark layer
			L.tileLayer("http://tracker.rubio-segeln.de/seamark/{z}/{x}/{y}.png", {
				maxZoom: 17,
				minZoom: 10
			}).addTo(this.map);

			var that = this;

			// fetch the positions of this trip
			$.getJSON("/api/positions/" + this.trip.id, function(p) {
				that.addBoatPath(that.trip.id, p, {
					fit: !that.options.f,
					labels: that.options.l
				});
			});

			// fetch the assets
			$.getJSON("/api/assets/" + this.trip.owner, function(data) {

				for (var i in data) {

					if (data[i].type == "boat" || (data[i].type == "marina" && that.options.a == true)) {

						var marker;

						if (data[i].type == "boat") {
							marker = L.boatMarker(data[i].coord, {
								color: "#f1c40f",
								alt: data[i].type + "_" + data[i].id
							});
						} else {
							marker = L.marker(data[i].coord, {
								icon: that.icons[data[i].type],
								alt: data[i].type + "_" + data[i].id
							});
						}

						marker.bindLabel(data[i].name, {
							noHide: true
						})
						marker.addTo(that.map);

						// set course of boat icon
						if (data[i].type == "boat" || "course" in data[i]) {

							if ("wind" in data[i]) {
								if (data[i]["wind"]["speed"] != null && data[i]["wind"]["direction"] != null) {
									marker.setHeadingWind(data[i].course, data[i].wind.speed, data[i].wind.direction);
								} else {
									marker.setHeading(data[i].course);
								}
							} else {
								marker.setHeading(data[i].course);
							}
						}

						that.assets.push(marker);

						// zoom to boat
						if (data[i].type == "boat" &&
							that.options.f == true) {
							that.map.setView(marker.getLatLng(), 16, {
								animate: true
							});
						}
					}
				}
			});
		}
	});

	// ROUTER
	var AppRouter = Backbone.Router.extend({
		routes: {
			"*actions": "index"
		},

		// ROUTES
		index: function() {
			var embedView = new EmbedView();
		}
	});

	// start backbone app
	workspace = new AppRouter;
	Backbone.history.start();

});