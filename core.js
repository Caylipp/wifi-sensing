// Vereinfachtes CSI-Modell + Auswertung. Kein DOM, damit es auch unter Node testbar ist.
(function (root) {
  const N_SC = 52;        // Unterträger (wie 20-MHz-WLAN, ohne Pilot/Null)
  const RATE = 20;        // Frames pro Sekunde
  const LAMBDA = 0.125;   // ~2,4 GHz

  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // Simulator: Person im Raum stört die Funkstrecke Router (tx) -> Empfänger (rx).
  // Modell: Der Umweg der Reflexion (excess) bestimmt Stärke und Phase der Störung pro Unterträger.
  class Simulator {
    constructor() {
      this.room = { w: 6, h: 4 };
      this.tx = { x: 0.4, y: 3.5 };   // Router
      this.rx = { x: 5.6, y: 0.5 };   // Empfänger (später: ESP32)
      this.person = { x: 3, y: 2, present: true, mode: 'walk' }; // walk | still | drag
      this.target = { x: 3, y: 2 };
      this.t = 0;
      this.base = Array.from({ length: N_SC }, (_, k) => 1 + 0.3 * Math.sin(k * 0.4) + 0.2 * Math.sin(k * 1.1 + 1));
    }
    step(dt) {
      const p = this.person;
      if (p.present && p.mode === 'walk') {
        if (dist(p, this.target) < 0.15) this.target = { x: 0.4 + Math.random() * (this.room.w - 0.8), y: 0.4 + Math.random() * (this.room.h - 0.8) };
        const d = dist(p, this.target), v = 0.9 * dt;
        p.x += (this.target.x - p.x) / d * Math.min(v, d);
        p.y += (this.target.y - p.y) / d * Math.min(v, d);
      }
      this.t += dt;
    }
    frame() {
      const p = this.person, amp = new Array(N_SC);
      const excess = dist(p, this.tx) + dist(p, this.rx) - dist(this.tx, this.rx);
      const infl = p.present ? Math.exp(-excess * excess / (2 * 0.6 * 0.6)) : 0;
      const moving = p.mode === 'walk';
      for (let k = 0; k < N_SC; k++) {
        let a = this.base[k];
        a += infl * 0.5 * Math.cos(2 * Math.PI * excess / LAMBDA + 0.3 * k);       // Ganz-Körper-Effekt
        if (p.present && !moving) a += infl * 0.12 * Math.sin(2 * Math.PI * 0.25 * this.t + 0.1 * k); // Atmung
        amp[k] = a + 0.02 * gauss();
      }
      return { t: this.t, amp, truth: { x: p.x, y: p.y, present: p.present, moving } };
    }
  }

  // Auswertung: schnelles Fenster (1 s) -> Bewegung, langsames (4 s) -> ruhige Anwesenheit.
  class Analyzer {
    constructor() { this.buf = []; this.motion = 0; this.slow = 0; this.state = 'leer'; }
    static colStd(rows) {
      const n = rows.length; let sum = 0;
      for (let k = 0; k < N_SC; k++) {
        let m = 0; for (const r of rows) m += r[k]; m /= n;
        let s = 0; for (const r of rows) s += (r[k] - m) ** 2;
        sum += Math.sqrt(s / n);
      }
      return sum / N_SC;
    }
    push(amp) {
      this.buf.push(amp); if (this.buf.length > RATE * 4) this.buf.shift();
      if (this.buf.length < RATE) return this;
      this.motion = Analyzer.colStd(this.buf.slice(-RATE));
      this.slow = Analyzer.colStd(this.buf);
      const T = Analyzer.THRESH;
      const next = this.motion > T.motion ? 'Bewegung' : this.slow > T.presence ? 'ruhig anwesend' : 'leer';
      // Hysterese: Zustand erst nach 10 gleichen Ergebnissen wechseln
      this._c = next === this._n ? (this._c || 0) + 1 : 0; this._n = next;
      if (this._c >= 10) this.state = next;
      return this;
    }
  }
  Analyzer.THRESH = { motion: 0.12, presence: 0.035 };

  // Auswertung für Mac-RSSI (1 Zahl in dBm, ~4 Hz, 1-dB-Auflösung): Streuung im Zeitfenster -> Bewegung.
  class RssiAnalyzer {
    constructor() { this.buf = []; this.motion = 0; this.slow = 0; this.state = 'leer'; this.thresh = { motion: 1.5 }; this.cal = null; this.maxv = 3; }
    static std(a) { if (a.length < 3) return 0; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); }
    // Kalibrierung: `sec` Sekunden bei leerer Strecke messen, Schwelle = 2x typische Streuung (min. +0,4 dB).
    calibrate(sec) { this.cal = { until: Date.now() + sec * 1000, vals: [] }; }
    push(t, rssi) {
      this.buf.push({ t, rssi }); while (this.buf.length && t - this.buf[0].t > 10) this.buf.shift();
      const w = this.buf.filter(s => t - s.t <= 3).map(s => s.rssi);
      this.motion = RssiAnalyzer.std(w); this.slow = RssiAnalyzer.std(this.buf.map(s => s.rssi));
      if (this.cal) {
        if (this.motion > 0) this.cal.vals.push(this.motion);
        if (Date.now() >= this.cal.until) { const v = this.cal.vals, m = v.reduce((x, y) => x + y, 0) / (v.length || 1); this.thresh.motion = Math.max(m * 2, m + 0.4); this.cal = null; }
        this.state = 'kalibriere ...'; return this;
      }
      const next = this.motion > this.thresh.motion ? 'Bewegung' : 'leer';
      this._c = next === this._n ? (this._c || 0) + 1 : 0; this._n = next;
      if (this._c >= 4) this.state = next;
      return this;
    }
  }

  root.WifiSensing = { N_SC, RATE, Simulator, Analyzer, RssiAnalyzer };
  if (typeof module !== 'undefined') module.exports = root.WifiSensing;
})(typeof window !== 'undefined' ? window : globalThis);
