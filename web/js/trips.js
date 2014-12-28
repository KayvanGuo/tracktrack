$(function() {

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
						that.assets[i].angle = position.course;

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
			L.tileLayer("https://tracktrack.io/api/tileproxy?url=http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
				maxZoom: 17,
				minZoom: 10
			}).addTo(this.map);

			/*L.tileLayer('http://{s}.tile.openweathermap.org/map/wind/{z}/{x}/{y}.png', {
			    maxZoom: 18
			}).addTo(this.map);*/

			// load assets
			var that = this;
			$.getJSON("/api/assets/" + this.params.owner, function(data) {

				console.log(data);
				
				var bounds = [];
				for(var i in data) {

					var marker;
					switch(data[i].type) {
						case "marina":

							marker = L.marker(data[i].coord, {
								icon: that.icons[data[i].type],
								alt: data[i].type + "_" + data[i].id
							})
							.bindLabel(data[i].name, { noHide: true })
							.addTo(that.map);
						
							break;


						case "boat":

							marker = L.rotatedMarker(data[i].coord, {
								icon: that.icons[data[i].type],
								alt: data[i].type + "_" + data[i].id
							})
							.bindLabel(data[i].name, { noHide: true })
							.addTo(that.map);

							window.boat = marker;

							// set course of boat icon
							if("course" in data[i]) {
								marker.options.angle = data[i].course;
							}
						
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
		tripData: [],
		tripBoat: null,

		events: {
			"click .loadTrip"			: "load",
			"click .showTrip"			: "show",
			"click .deleteTrip"			: "delete",
			"click .embedTrip"			: "embed",
			"click .analyseTrip"		: "analysis",
			"change .embedPreviewChange": "updatePreview",
			"focus #embedCode"			: "codeSelect",
			"input #positionSliderRange": "moveBoatTo"
		},

		// INITIALIZE
		initialize: function(params) {

			var that = this;

			$.getJSON("/api/boats/" + params.owner, function(boats) {
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
			$.getJSON("/api" + $(e.target).attr("href").replace("#", ""), function(data) {
				
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
			var that = this;

			window.mapView.removeBoatPath();

			if(window.mapView.currentTrip == $e.data("id")) {
				window.mapView.removeBoatPath();
				$(e.target).text("anzeigen");
				$("#positionSlider").fadeOut();
			}
			else {
				$.getJSON("/api/positions/" + $e.data("id"), function(p) {

					console.log(p);

					that.tripData = p.positions;
					window.mapView.addBoatPath($e.data("id"), p);
					$("html, body").animate({ scrollTop: 0}, "fast");
					$(".showTrip").text("anzeigen");
					$(e.target).text("ausblenden");	

					$("#positionSlider").fadeIn();
					$("#positionSliderRange").attr("max", p.positions.length);	
					$("#positionSliderRange").val(p.positions.length);	
				});
			}
		},

		moveBoatTo: function() {
			var idx = parseInt($("#positionSliderRange").val());
			var pos = this.tripData[idx];
			var l = [pos.latitude, pos.longitude];
			window.boat.setLatLng(l);
			window.boat.options.angle = pos.course;
			window.mapView.map.panTo(l);
		},

		// DELETE
		delete: function(e) {
			var $e = $(e.target).parents(".actions");

			if(confirm("Wirklich löschen?") == true) {
				$.getJSON("/api/trips/delete/" + $e.data("id"), function(result) {
					
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

		// ANALYSIS
		analysis: function(e) {
			var $e = $(e.target).parents(".actions");

			var key = $e.data("key");
			var id = $e.data("id");
			
			// launch modal view
			$("#modalAnalysis").modal("show");

			$.getJSON("/api/positions/" + id, function(p) {

				var speeds = [], courses = [], times = [];
				var lastSpeed = 0, lastCourse = 0;
				for(var i in p.positions) {

					speeds.push([moment(p.positions[i].timestamp).toDate(), p.positions[i].speed]);	
					courses.push([moment(p.positions[i].timestamp).toDate(), p.positions[i].course]);
				}

				$("#speedChart").highcharts({
			        chart: {
			            type: "spline"
			        },
			        title: {
			            text: "Geschwindigkeit"
			        },
			        subtitle: {
			            text: "über Grund"
			        },
			        xAxis: {
			            type: "datetime",
			            dateTimeLabelFormats: { // don't display the dummy year
			                month: '%e. %b',
			                year: '%b'
			            },
			            title: {
			                text: "Date"
			            }
			        },
			        yAxis: {
			            title: {
			                text: "Geschwindkeit in Knoten"
			            },
			            min: 0
			        },
			        tooltip: {
			            headerFormat: '<b>{series.name}</b><br>',
			            pointFormat: '{point.y:.2f}'
			        },

			        series: [{
			            name: "Geschwindigkeiten",
			            // Define the data points. All series have a dummy year
			            // of 1970/71 in order to be compared on the same x axis. Note
			            // that in JavaScript, months start at 0 for January, 1 for February etc.
			            data: speeds
			        }]
			    });

				$("#courseChart").highcharts({
			        chart: {
			            type: "spline"
			        },
			        title: {
			            text: "Kurs"
			        },
			        subtitle: {
			            text: ""
			        },
			        xAxis: {
			            type: "datetime",
			            dateTimeLabelFormats: { // don't display the dummy year
			                month: '%e. %b',
			                year: '%b'
			            },
			            title: {
			                text: "Date"
			            }
			        },
			        yAxis: {
			            title: {
			                text: "Kurse in Grad"
			            },
			            min: 0
			        },
			        tooltip: {
			            headerFormat: '<b>{series.name}</b><br>',
			            pointFormat: '{point.y:.0f}'
			        },

			        series: [{
			            name: "Kurse",
			            // Define the data points. All series have a dummy year
			            // of 1970/71 in order to be compared on the same x axis. Note
			            // that in JavaScript, months start at 0 for January, 1 for February etc.
			            data: courses
			        }]
			    });


			});
		},

		// UPDATE PREVIEW
		updatePreview: function() {
			var key = $("#embedKey").val();
			var url = "https://tracktrack.io/embed/" + key + "/?f=";

			url += $(".followVals input[type='radio']:checked").val();	// follow
			url += "&a=";
			url += ($("#assets").prop("checked")) ? "1" : "0";	// assets
			url += "&l=";
			url += ($("#labels").prop("checked")) ? "1" : "0";	// labels

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
	});

	// ROUTER
    var AppRouter = Backbone.Router.extend({
        routes: {
            "*actions": "index"
        },

        // ROUTES
        index: function() {

        	var owner = 2;

        	window.mapView = new IndexMapView({
        		"owner": owner
        	});

        	window.tripView = new TripView({
        		"owner": owner
        	});
        }
    });

    window.validate = function(input) {
        if(input) {
            if(input.length > 1) {
                if(input.indexOf("undefined") == -1) {
                    return input;
                }
            }
        }

        return null;
    };

	// setup the http-basic auth
    $.ajaxSetup({
        cache: false,
        beforeSend: function(xhr) { 
            var e = localStorage.getItem("e");
			var p = localStorage.getItem("p");

            // if we have a username / password stored, use it for http-basic-auth
            if (window.validate(e) && window.validate(p)) {
                xhr.setRequestHeader("Authorization", "Basic " + btoa(e + ":" + p)); 
            }
            else {
                location.href = "/";
            }
        }
    });

    // start backbone app
    workspace = new AppRouter;
    Backbone.history.start();
});