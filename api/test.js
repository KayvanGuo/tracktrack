 
var net = require("net");
 
var client = new net.Socket();
client.connect(8100, "tracktrack.io", function() {
	console.log("Connected");

	var buf = new Buffer(38);
	buf[0] = 77;
	buf[1] = 67;
	buf[2] = 71;
	buf[3] = 80;

	buf.write();

	client.write('Hello, server! Love, Client.');
});
 
client.on("data", function(data) {
	console.log("Received: " + data);
	client.destroy(); // kill client after server's response
});
 
client.on("close", function() {
	console.log("Connection closed");
});