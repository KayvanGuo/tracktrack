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
			this.map = L.map("map", {
				measureControl: true
			});

			$(".leaflet-control-attribution").html("<a href='//tracktrack.io' target='_blank'>TrackTrack.io</a>");

			// add an OpenStreetMap tile layer
			L.tileLayer("//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(this.map);

			// add seamark layer
			L.tileLayer("//tracktrack.io/api/tileproxy?url=http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
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