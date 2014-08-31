$(function() {
	var h = "<article class='post'>";
		h += "<strong>Rubios Position:</strong>";
		h += "<iframe src=\"https://tracktrack.io/embed/latest/3/?f=1&a=1&l=1\" width=\"100%\" height=\"250\" frameborder=\"0\"></iframe>";
		h += "</article>";
	
	if($(".post-header").length > 0 && document.location.href != "http://www.rubio-segeln.de/") {
		//$(".post-header").append(h);
	}
	else {
		$("main[class='content']").prepend(h);
	}
});