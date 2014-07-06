import socket

# INT TO BYTES
def int_to_bytes(val, num_bytes):
	return [(val & (0xff << pos*8)) >> pos*8 for pos in range(num_bytes)]

# MSG
def msg():

	# AAA
	m = [0x65, 0x65, 0x65]

	# Boat ID
	m += int_to_bytes(3, 4)

	# Latitude
	
