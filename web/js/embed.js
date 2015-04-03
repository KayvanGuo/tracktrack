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

			var path = window.location.pathname.split("/");
			var key = path[path.length - 2];
			var search = window.location.search.replace("?", "").split("&");
			
			for(var i in search) {
				var s = search[i].split("=");
				this.options[s[0]] = (s[1] == "1") ? true : false;
			}

			var that = this;

			// fetch the trip id from key
			$.getJSON("/api/trip/" + key, function(trip) {
				that.trip = trip;

				document.title = document.title.replace("Törn", trip.name);

				if(that.trip.id) {
					that.$el.empty();
					that.render();

					var socket = io.connect("/");
					socket.emit("join", { trip: that.trip.id });

					// get new position update
					socket.on("position", function(position) {

						for(var i in that.assets) {
							if(that.assets[i].options.alt == "boat_" + position.boat) {

								var l = L.latLng(position.latitude, position.longitude);

								// set boat to new position
								that.assets[i].setLatLng(l);
								that.assets[i].setHeading(position.course);

								if(position["windspeed"] != null && position["winddirection"] != null) {
									that.assets[i].setHeadingWind(position.course, position.windspeed, position.winddirection);
								}
								else {
									that.assets[i].setHeading(position.course);
								}

								that.map.panTo(l, {
									animate: true
								});

								// if there is a boatpath available, add to this
								if(that.boatpath) {
									that.boatpath.addLatLng(l);
								}
							}
						}
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

			$(".leaflet-control-attribution").html("<a href='//tracktrack.io' target='_blank'>TrackTrack.io</a>");

			// add an OpenStreetMap tile layer
			if(navigator.userAgent.toLowerCase().indexOf('firefox') == -1 && mapboxgl.util.supported()) {

				var gl = L.mapboxGL({
				    accessToken: "pk.eyJ1IjoidG9tYXN6YnJ1ZSIsImEiOiJ5dXV3N3A0In0.1RNvzTlGXJVR_SCoKGQ3nA",
				    style: "/libs/outdoors-v7.json"
				}).addTo(this.map);
			}
			else {
				L.tileLayer("//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(this.map);
			}

			// add seamark layer
			L.tileLayer("https://tracktrack.io/seamark/{z}/{x}/{y}.png", {
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
				
				for(var i in data) {

					if(data[i].type == "boat" || (data[i].type == "marina" && that.options.a == true)) {

						var marker;

						if(data[i].type == "boat") {
							marker = L.boatMarker(data[i].coord, {
								color: "#f1c40f",
								alt: data[i].type + "_" + data[i].id
							});
						}
						else {
							marker = L.marker(data[i].coord, {
								icon: that.icons[data[i].type],
								alt: data[i].type + "_" + data[i].id
							});
						} 

						marker.bindLabel(data[i].name, { noHide: true })
						marker.addTo(that.map);

						// set course of boat icon
						if(data[i].type == "boat" || "course" in data[i]) {

							if("wind" in data[i]) {
								if(data[i]["wind"]["speed"] != null && data[i]["wind"]["direction"] != null) {
									marker.setHeadingWind(data[i].course, data[i].wind.speed, data[i].wind.direction);
								}
								else {
									marker.setHeading(data[i].course);
								}
							}
							else {
								marker.setHeading(data[i].course);
							}
						}

						that.assets.push(marker);

						// zoom to boat
						if (data[i].type == "boat" && 
							that.options.f == true) 
						{
							that.map.setView(marker.getLatLng(), 16, {animate: true});
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