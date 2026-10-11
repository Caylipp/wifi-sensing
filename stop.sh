#!/bin/sh
# Beendet Server, Ping und RSSI-Sampler dieses Prototyps.
pkill -f "node server.js"; pkill -f "ping -i 0.2"; pkill -x rssi
pgrep -fl "server.js|ping -i 0.2|/rssi" || echo "Alles beendet."
