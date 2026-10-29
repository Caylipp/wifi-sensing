# WLAN-Sensing (Prototyp)

Visualisiert, wie Menschen die WLAN-Funkstrecke stören. Zwei Datenquellen, gleiche Anzeige:

| Modus | Daten | Start |
|---|---|---|
| Simulation | vereinfachtes CSI-Modell (52 Unterträger) in `core.js` | `index.html` direkt im Browser öffnen |
| Live (Mac-RSSI) | echte Signalstärke des MacBook-WLANs zum Router | `node server.js`, dann http://localhost:8787/?live |

## Live-Modus
- `rssi.swift` liest per CoreWLAN RSSI (dBm) mit ~10 Hz Abfrage; der Wert ändert sich real ~3-5x pro Sekunde, Auflösung 1 dB. Läuft ohne sudo. `server.js` kompiliert es beim ersten Start.
- `server.js` pingt das Gateway (5 Hz), damit die RSSI laufend aktualisiert wird, und streamt per SSE an den Browser.
- Erst **Kalibrieren** (15 s, Strecke frei), dann Bewegung nahe der Linie Mac-Router.

## Grenzen
- Nur eine Zahl pro Messung, keine CSI: Bewegung ja, ruhige Person/Atmung/Position nein.
- Echtes CSI braucht einen ESP32 (Datenquelle in `index.html` austauschbar, siehe Kommentar bei `onFrame`).
- Simulation ist ein selbst gebautes Modell, keine Messung.

## Beenden
`./stop.sh` im Projektordner (oder Aktivitätsanzeige: `node`, `ping`, `rssi`). Nichts davon läuft nach einem Neustart weiter.
