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

			var streetmap = L.tileLayer("//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");

			var satellite = L.tileLayer("//tracktrack.io/api/tileproxy?url=http://otile{s}.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpeg", {
	            attribution: 'Tiles by <a href="http://www.mapquest.com/">MapQuest</a> &mdash; Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
	            subdomains: '1234'
	        }); 

			// add seamark layer
			var seamap = L.tileLayer("//tracktrack.io/api/tileproxy?url=http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
				maxZoom: 17,
				minZoom: 10
			});

			var waveheight = L.tileLayer("http://www.openportguide.org/tiles/actual/significant_wave_height/5/6/30/21.png")

			var baseMaps = {
				"Karte": streetmap,
				"Satellit": satellite
			}

			var overlayMaps = { 
				"Seezeichen": seamap,
				"Wolken": L.OWM.clouds({showLegend: true, opacity: 0.4}),
				"Regen" : L.OWM.rainClassic({showLegend: true, opacity: 0.4}),
				"Isobaren": L.OWM.pressureContour(),
				"Wind": L.OWM.wind({showLegend: true, opacity: 0.4}),
				"Temperatur": L.OWM.temperature({showLegend: true, opacity: 0.4}),
			};

			this.map = L.map("map", {
				measureControl: true,
				layers: [streetmap, seamap]
			});

			var layerControl = L.control.layers(baseMaps, overlayMaps, {
				"collapsed": true
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

						var marker = L.marker(data[i].coord, {
							icon: that.icons[data[i].type],
							alt: data[i].type + "_" + data[i].id
						})
						.bindLabel(data[i].name, { noHide: true })
						.addTo(that.map);

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