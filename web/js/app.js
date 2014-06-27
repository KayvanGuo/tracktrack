$(function() {

	// MENU VIEW
	var MenuView = Backbone.View.extend({
		el: "#menu",

		// INITIALIZE
		initialize: function(owner) {
			this.render();
		},

		// RENDER
		render: function() {
			var t = _.template($("#menuTpl").html());
            this.$el.html(t);
		}
	});

	// MAP VIEW
	var MapView = Backbone.View.extend({
		el: "#map",
		map: null,
		icons: {},
		assets: [],
		params: null,
		boatpath: null,
		pathpopup: null,

		// INITIALIZE
		initialize: function(params) {

			this.params = params;
			this.icons = {
				boat: L.icon({
				    iconUrl: "/img/sailing.png",
				    iconSize: [32, 37], 
				    iconAnchor:   [16, 37],
				    labelAnchor: [10, -20]
				}),

				marina: L.icon({
				    iconUrl: "/img/harbor.png",
				    iconSize: [32, 37], 
				    iconAnchor:   [16, 37],
				    labelAnchor: [10, -20]
				})
			};

			this.render();

			var that = this;
		    var socket = io.connect("/");
			socket.emit("join", { owner: this.params.owner });

			// get new position update
			socket.on("position", function(position) {

				for(var i in that.assets) {
					if(that.assets[i].options.alt == "boat_" + position.boat) {

						// set boat to new position
						that.assets[i].setLatLng(L.latLng(position.latitude, position.longitude));
					}
				}
			});
		},

		// RENDER
		render: function() {
			// create a map in the "map" div, set the view to a given place and zoom
			this.map = L.map("map", {
				measureControl: true
			}).setView([51.505, -0.09], 2);

			// add an OpenStreetMap tile layer
			L.tileLayer("//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(this.map);

			// add seamark layer
			L.tileLayer("http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
				maxZoom: 17,
				minZoom: 10
			}).addTo(this.map);

			// add wind vectors
			/*L.tileLayer("http://www.openportguide.org/tiles/actual/wind_vector/9/{z}/{x}/{y}.png", {
				maxZoom: 5
			}).addTo(this.map);*/

			// load assets
			var that = this;
			$.getJSON("/assets/" + this.params.owner, function(data) {
				
				var bounds = [];
				for(var i in data) {

					var marker;
					switch(data[i].type) {
						case "marina":
						case "boat":

							marker = L.marker(data[i].coord, {
								icon: that.icons[data[i].type],
								alt: data[i].type + "_" + data[i].id
							})
							.bindLabel(data[i].name, { noHide: true })
							.addTo(that.map);
						
							break;

						case "mooring":

							marker = L.circle(data[i].coord, data[i].radius).addTo(that.map);

							break;
					}
					

					bounds.push(data[i].coord);
					that.assets.push(marker);
				}

				that.map.fitBounds(bounds);
			});
		},

		// ADD BOAT PATH
		addBoatPath: function(trip, positions) {
				
			var that = this;

			// delete old path
			if(this.boatpath) {
				this.map.removeLayer(this.boatpath);
				this.boatpath = null;
			}

			var coords = [];
			for(var i in positions) {
				coords.push(L.latLng(positions[i].latitude, positions[i].longitude));
			}

			// create polyline
			this.boatpath = L.polyline(coords, {
				color: "red"
			});

			// a click on the path
			this.boatpath.on("click", function(e) {
				$.getJSON("/position/" + trip + "/" + e.latlng.lat + "/" + e.latlng.lng, function(data) {
					that.addPathPopup(data);
				});
			});

			this.boatpath.addTo(this.map);

			// center map arond trip
			this.map.fitBounds(L.latLngBounds(coords), {
				padding: new L.point(5, 5)
			});
		},

		// ADD PATH POPUP
		addPathPopup: function(position) {

			if(!this.pathpopup) {
				this.pathpopup = L.popup();
			}

			var tpl = _.template($("#pathPopupTpl").html(), {
				"position": position
			});

			this.pathpopup
				.setLatLng(L.latLng(position.latitude, position.longitude))
			    .setContent(tpl)
			    .openOn(this.map);
		}
	});

	// TRIP VIEW
	var TripView = Backbone.View.extend({
		el: "#trips",
		boats: [],

		events: {
			"click .loadTrip": "load",
			"click .showTrip": "show",
			"click .deleteTrip": "delete"
		},

		// INITIALIZE
		initialize: function(params) {

			var that = this;

			$.getJSON("/boats/" + params.owner, function(boats) {
				that.boats = boats;
				that.render();
			});
		},

		// RENDER
		render: function() {
			var t = _.template($("#tripsTpl").html(), {
				boats: this.boats
			});

            this.$el.html(t);

            $(".loadTrip").first().trigger("click");
		},

		// LOAD
		load: function(e) {

			var that = this;

			// load the trips for this boat
			$.getJSON($(e.target).attr("href").replace("#", ""), function(data) {
				var t = _.template($("#tripContentTpl").html(), {
					trips: data
				});

	           	that.$el.find("#tripContent").html(t);

            	$(".actions > a").tooltip();
			});
		},

		// SHOW
		show: function(e) {
			var $e = $(e.target).parents(".actions");
			$.getJSON("/positions/" + $e.data("id"), function(positions) {
				window.mapView.addBoatPath($e.data("id"), positions);
			});
		},

		// DELETE
		delete: function(e) {
			var $e = $(e.target).parents(".actions");

			if(confirm("Wirklich löschen?") == true) {
				/*$.getJSON("/trips/delete/" + $e.data("id"), function(result) {
					
					// deletion went well, remove row
					if(result.success) {*/
						$e.parents("tr").remove();
					//}
				//});
			}
		}
	})

	// FLEET VIEW
	var FleetView = Backbone.View.extend({
		el: "#fleet",
		boats: null,

		// INITIALIZE
		initialize: function(params) {
			this.boats = params.boats;
			this.render();
		},

		// RENDER
		render: function() {

			var t = _.template($("#fleetTpl").html(), {
				boats: this.boats
			});

            this.$el.html(t);
		}
	});

	// ROUTER
    var AppRouter = Backbone.Router.extend({
        routes: {
            "*actions": "index"
        },

        // ROUTES
        index: function() {

        	var owner = 2;

        	window.menuView = new MenuView();
        	window.mapView = new MapView({
        		"owner": owner
        	});

        	window.tripView = new TripView({
        		"owner": owner
        	});
        }
    });

	// start backbone app
    workspace = new AppRouter;
    Backbone.history.start();
});