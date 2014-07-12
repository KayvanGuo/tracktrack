$(function() {

	// MENU VIEW
	var MenuView = Backbone.View.extend({
		el: "#menu",

		events: {
			"click .logout": "logout"
		},

		// INITIALIZE
		initialize: function(owner) {
			this.render();
		},

		// RENDER
		render: function() {
			var t = _.template($("#menuTpl").html());
            this.$el.html(t);
		},

		// LOGOUT
		logout: function() {
			localStorage.removeItem("e");
			localStorage.removeItem("p");
			location.href = "/";
		}
	});

	// MAP VIEW
	var IndexMapView = MapView.extend({
		el: "#map",
		params: null,

		// INITIALIZE
		initialize: function(params) {

			this.params = params;

			this.render();

			var that = this;
		    var socket = io.connect("/");
			socket.emit("join", { owner: this.params.owner });

			// get new position update
			socket.on("position", function(position) {

				for(var i in that.assets) {
					if(that.assets[i].options.alt == "boat_" + position.boat) {

						var l = L.latLng(position.latitude, position.longitude);

						// set boat to new position
						that.assets[i].setLatLng(l);

						// if there is a boatpath available, add to this
						if(that.boatpath && position.trip == that.currentTrip) {
							that.boatpath.addLatLng(l);
						}
					}
				}
			});
		},

		// RENDER
		render: function() {
			// create a map in the "map" div, set the view to a given place and zoom
			this.map = L.map("map", {
				measureControl: true
			});

			$(".leaflet-control-attribution").hide();

			// add an OpenStreetMap tile layer
			L.tileLayer("//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(this.map);

			// add seamark layer
			L.tileLayer("https://tracktrack.io/tileproxy?url=http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
				maxZoom: 17,
				minZoom: 10
			}).addTo(this.map);

			/*L.tileLayer('http://{s}.tile.openweathermap.org/map/wind/{z}/{x}/{y}.png', {
			    maxZoom: 18
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

				that.map.fitBounds(bounds, {
					padding: new L.point(5, 5)
				});
			});
		}
	});

	// TRIP VIEW
	var TripView = Backbone.View.extend({
		el: "#trips",
		boats: [],

		events: {
			"click .loadTrip"			: "load",
			"click .showTrip"			: "show",
			"click .deleteTrip"			: "delete",
			"click .embedTrip"			: "embed",
			"change .embedPreviewChange": "updatePreview",
			"focus #embedCode"			: "codeSelect"
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

			console.log(window.mapView.currentTrip);
			if(window.mapView.currentTrip == $e.data("id")) {
				window.mapView.removeBoatPath();
				$(e.target).text("anzeigen");
			}
			else {
				$.getJSON("/positions/" + $e.data("id"), function(positions) {
					window.mapView.addBoatPath($e.data("id"), positions);
					$("html, body").animate({ scrollTop: 0}, "fast");
					$(".showTrip").text("anzeigen");
					$(e.target).text("ausblenden");			
				});
			}
		},

		// DELETE
		delete: function(e) {
			var $e = $(e.target).parents(".actions");

			if(confirm("Wirklich löschen?") == true) {
				$.getJSON("/trips/delete/" + $e.data("id"), function(result) {
					
					// deletion went well, remove row
					if(result.success) {
						$e.parents("tr").remove();
					}
				});
			}
		},

		// EMBED
		embed: function(e) {
			var $e = $(e.target).parents(".actions");

			var key = $e.data("key");
			var id = $e.data("id");
			
			// launch modal view
			$("#modalEmbed").modal("show");
			$("#embedKey").val(key);
			this.updatePreview();

			/*$(document).on("change", "", function() {
			 	console.log("updatePreview");
			});*/
		},

		// UPDATE PREVIEW
		updatePreview: function() {
			var key = $("#embedKey").val();
			var url = "https://tracktrack.io/embed/" + key + "/?f=";

			url += $(".followVals input[type='radio']:checked").val();	// follow
			url += "&a=";
			url += ($("#assets").prop("checked")) ? "1" : "0";	// assets

			var iframe = "<iframe src=\"" + url + "\" width=\"" + $("#embedWidth").val() + "\" height=\"" + $("#embedHeight").val() + "\" frameborder=\"0\"></iframe>";

			$("#embedPreview").prop("src", url);
			$("#embedCode").val(iframe);
		},

		// CODE SELECT
		codeSelect: function(event) {
			event.preventDefault();
  			setTimeout(function() { 
  				$(event.target).select(); 
  			}, 1); 
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
        	window.mapView = new IndexMapView({
        		"owner": owner
        	});

        	window.tripView = new TripView({
        		"owner": owner
        	});
        }
    });

    var e = localStorage.getItem("e");
    var p = localStorage.getItem("p");

    if(!e || !p) {
    	location.href="/";
    }
    else {
    	$.ajaxSetup({
			headers: {
				"Authorization": "Basic " + btoa(e + ":" + p)
			}
		});

		// start backbone app
	    workspace = new AppRouter;
	    Backbone.history.start();
    }

});