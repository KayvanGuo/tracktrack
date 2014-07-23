$(function() {
	var key = "";
	var h = "<article class='post'>";
		h += "<iframe src=\"https://tracktrack.io/embed/" + key + "/?f=1&a=1&l=1\" width=\"100%\" height=\"250\" frameborder=\"0\"></iframe>";
		h += "</article>";
	
	if(key != "") $("main[class='content']").prepend(h);
});