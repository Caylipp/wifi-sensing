# Wi-Fi Sensing

[Deutsche Version](README.de.md)

A prototype that visualizes how people **disturb a Wi-Fi radio link**, the basic idea behind Wi-Fi-based motion detection. Two data sources feed the same visualization:

| Mode | Data | Start |
|---|---|---|
| Simulation | simplified CSI model (52 subcarriers) in `core.js` | open `index.html` in a browser |
| Live | real signal strength (RSSI) between the MacBook and the router | `node server.js`, then http://localhost:8787/?live |

## How the live mode works

- `rssi.swift` reads RSSI via **CoreWLAN** at ~10 Hz without root. `server.js` compiles it on first start.
- `server.js` pings the gateway at 5 Hz to keep the RSSI value fresh and streams the samples to the browser via **Server-Sent Events**.
- Calibrate for 15 s with the path clear, then movement near the Mac–router line becomes visible.

## Limits (honestly)

- RSSI is a single number per sample, not full CSI: it detects motion, but not stationary people, breathing or position.
- Real CSI needs dedicated hardware such as an ESP32; the data source in `index.html` is swappable (see `onFrame`).
- The simulation is a self-built model, not a measurement.
