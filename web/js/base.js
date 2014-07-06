
// MAP VIEW
var MapView = Backbone.View.extend({

	map: null,
	boatpath: null,
	currentTrip: null,
	assets: [],
	pathpopup: null,
	icons: {
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
	},

	// ADD BOAT PATH
	addBoatPath: function(trip, positions, params) {
			
		this.currentTrip = trip;

		var options = $.extend({
			fit: true
		}, params);

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
		if(options.fit == true) {
			this.map.fitBounds(L.latLngBounds(coords));
		}
	},

	// REMOVE BOAT PATH
	removeBoatPath: function() {
		this.currentTrip = null;
		this.map.removeLayer(this.boatpath);
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