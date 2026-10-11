// Gibt ~10x pro Sekunde eine JSON-Zeile mit RSSI/Noise der aktuellen WLAN-Verbindung aus.
import CoreWLAN
import Foundation

setvbuf(stdout, nil, _IOLBF, 0)
guard let iface = CWWiFiClient.shared().interface() else {
    FileHandle.standardError.write(Data("Kein WLAN-Interface gefunden\n".utf8)); exit(1)
}
while true {
    let ts = Date().timeIntervalSince1970
    print("{\"t\":\(ts),\"rssi\":\(iface.rssiValue()),\"noise\":\(iface.noiseMeasurement()),\"ch\":\(iface.wlanChannel()?.channelNumber ?? -1)}")
    Thread.sleep(forTimeInterval: 0.1)
}
