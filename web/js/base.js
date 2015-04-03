
// MAP VIEW
var MapView = Backbone.View.extend({

	map: null,
	boatpath: null,
	currentTrip: null,
	assets: [],
	labels: [],
	pathpopup: null,
	currentPosition: null,
	icons: {
		boat: L.icon({
		    iconUrl: "/img/rubio_icon.png",
		    iconSize: [15, 50], 
		    iconAnchor:   [7, 25],
		    labelAnchor: [20, 0]
		}),

		marina: L.icon({
		    iconUrl: "/img/harbor.png",
		    iconSize: [32, 37], 
		    iconAnchor:   [16, 37],
		    labelAnchor: [10, -20]
		}),

		info: L.icon({
			iconUrl: "/img/information.png",
			iconSize: [16, 16]
		}),

		blank: L.icon({
			iconUrl: "/img/blank.png",
			iconSize: [3, 2]
		})
	},

	// EVENTS
	events: {
		"click .addLabelBtn": "addLabel"
	},

	// ADD BOAT PATH
	addBoatPath: function(trip, data, params) {
			
		this.currentTrip = trip;

		var options = $.extend({
			fit: true,
			labels: true
		}, params);

		var that = this;

		// delete old path
		if(this.boatpath) {
			this.map.removeLayer(this.boatpath);
			this.boatpath = null;
		}

		var coords = [];
		var speeds = {};
		for(var i in data.positions) {
			speeds[data.positions[i].latitude * data.positions[i].longitude] = data.positions[i].speed;
			coords.push(L.latLng(data.positions[i].latitude, data.positions[i].longitude));
		}

		if(options.labels == true) {
			for(var i in data.labels) {
				this.addLabelMarker(data.labels[i]);
			}
		}

		// create polyline
		/*this.boatpath = L.polyline(coords, {
			color: "red"
		});*/

		this.boatpath = L.multiOptionsPolyline(coords, {
		    multiOptions: {
		        optionIdxFn: function (latLng) {

		        	var spd = speeds[latLng.lat * latLng.lng];
		            return parseInt(spd);
		        },
		        options: [
		            {color: "#0ecd7b"}, {color: "#65c961"}, {color: "#aac64c"},
		            {color: "#edc340"}, {color: "#ef9839"}, {color: "#ec6e3a"},
		            {color: "#e94841"}, {color: "#e94841"}, {color: "#e94841"}
		        ]
		    },
		    weight: 5,
		    lineCap: "round",
		    opacity: 0.9,
		    smoothFactor: 1
		}).addTo(this.map);

		// a click on the path
		this.boatpath.on("click", function(e) {
			$.getJSON("/api/position/" + trip + "/" + e.latlng.lat + "/" + e.latlng.lng, function(data) {
				that.addPathPopup(data);
			});
		});

		//this.boatpath.addTo(this.map);

		// center map arond trip
		if(options.fit == true) {
			this.map.fitBounds(L.latLngBounds(coords));
		}
	},

	// ADD LABEL
	addLabelMarker: function(data) {
		var l = L.marker([data.latitude, data.longitude])
			.setIcon(this.icons.blank)
			.bindLabel(data.title, { noHide: true, direction: "auto" })
			.addTo(this.map);

		this.labels.push(l);
	},

	// REMOVE BOAT PATH
	removeBoatPath: function() {
		this.currentTrip = null;
		for(var i in this.labels) {
			this.map.removeLayer(this.labels[i]);
		}

		if(this.boatpath)
			this.map.removeLayer(this.boatpath);
	},

	// ADD PATH POPUP
	addPathPopup: function(position) {

		this.currentPosition = position;

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
	},

	// ADD LABEL
	addLabel: function() {
		var that = this;
		var lbl = prompt("Was soll hier für ein Text angezeigt werden?", "");
		if(lbl) {
			$.post("/api/label/add", {
				"boat": 3,
				"latitude": that.currentPosition.latitude,
				"longitude": that.currentPosition.longitude,
				"timestamp": that.currentPosition.timestamp,
				"title": lbl
			}, function(data) {
				if(data) {
					var l = L.marker([that.currentPosition.latitude, that.currentPosition.longitude])
						.setIcon(that.icons.blank)
						.bindLabel(lbl, { noHide: true, direction: "auto" })
						.addTo(that.map);

					that.labels.push(l);
				}
			})	
		}
	}
});

$(function() {

	// logout
	$(document).on("click", "a.logout", function() {
		localStorage.removeItem("e");
		localStorage.removeItem("p");
		location.href = "/";
	});
});

function decToCoord (deg) {
   var d = Math.floor (deg);
   var minfloat = (deg-d)*60;
   var m = Math.floor(minfloat);
   var secfloat = (minfloat-m)*60;
   var s = Math.round(secfloat);
   // After rounding, the seconds might become 60. These two
   // if-tests are not necessary if no rounding is done.
   if (s==60) {
     m++;
     s=0;
   }
   if (m==60) {
     d++;
     m=0;
   }
   return d + "° " + m + "' " + secfloat.toFixed(1) + "\"";
}


(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-53219959-1', 'auto');
ga('send', 'pageview');