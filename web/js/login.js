$(function() {

	// MAP VIEW
	var LoginMapView = MapView.extend({
		el: "#map",
		map: null,

		// INITIALIZE
		initialize: function() {
			this.render();
		},

		// RENDER
		render: function() {
			// create a map in the "map" div, set the view to a given place and zoom
			this.map = L.map("map", {
			    center: [51.19208, 5.977859],
			    zoom: 13
			});

			$(".leaflet-control-attribution").hide();
			$(".leaflet-control-container").hide();

			// add an OpenStreetMap tile layer
			if(navigator.userAgent.toLowerCase().indexOf('firefox') == -1 && mapboxgl.util.supported()) {
				var gl = L.mapboxGL({
				    accessToken: "pk.eyJ1IjoidG9tYXN6YnJ1ZSIsImEiOiJ5dXV3N3A0In0.1RNvzTlGXJVR_SCoKGQ3nA",
				    style: "https://www.mapbox.com/mapbox-gl-styles/styles/outdoors-v6.json"
				}).addTo(this.map);
			}
			else {
				L.tileLayer("//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(this.map);
			}
		}
	});

	// LOGIN VIEW
	var LoginView = Backbone.View.extend({
		el: "#loginPanel",

		events: {
			"click button[type='button']": "login",
			"keyup input[name='nothing']": "checkKey"
		},

		// INITIALIZE
		initialize: function() {
			this.$el.fadeIn();
			$("input[name='email']").focus();
		},

		// CHECK KEY
		checkKey: function(e) {
			if(e.which == 13) {
				this.login();
			}
		},

		// LOGIN
		login: function() {
			var e = $("input[name='email']").val();
			var p = $("input[name='nothing']").val();

			var hash = CryptoJS.SHA512(p);

			$("input[name='password']").val(hash.toString());
			$("input[name='nothing']").val("");

			localStorage.setItem("e", e);
			localStorage.setItem("p", hash.toString());

			$("#loginForm").submit();
		}
	});

	// ROUTER
    var AppRouter = Backbone.Router.extend({
        routes: {
            "*actions": "index"
        },

        // ROUTES
        index: function() {

        	var mapView = new LoginMapView();
        	var loginView = new LoginView();
        }
    });

    var e = localStorage.getItem("e");
    var p = localStorage.getItem("p");

    if(!e || !p) {
 
		// start backbone app
	    workspace = new AppRouter;
	    Backbone.history.start();
    }
    else {
    	location.href = "/trips";
	}
});