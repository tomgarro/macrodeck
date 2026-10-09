// simulador.js - Un Macrodeck virtual: habla EXACTAMENTE con las mismas tramas que la placa real.
// Sirve para probar todo sin la placa ni el celu. Muestra la OLED (64x128), la e-Paper (mapa de teclas) y las 10 teclas.
window.MD = window.MD || {};
(function (MD) {
  const NOMBRES = ['A1', 'B1', 'C1', 'D1', 'E1', 'A2', 'B2', 'C2', 'D2', 'E2'];
  const TECLADO = { q: 0, w: 1, e: 2, r: 3, t: 4, a: 5, s: 6, d: 7, f: 8, g: 9 };
  const COLOR_EPAPER = { blanco: '#f1efe6', negro: '#161616', rojo: '#c8281e', amarillo: '#e6c21c' };
  const CAT_COLOR = [COLOR_EPAPER.amarillo, COLOR_EPAPER.rojo, COLOR_EPAPER.negro, COLOR_EPAPER.negro];
  const GLIFO_LETRA = ['', 'L', '?', 'H', '>', 'X', 'F', 'D'];
  const txt = (f, desde, hasta) => String.fromCharCode.apply(null, Array.from(f.slice(desde, hasta)).filter(c => c));

  class Simulador {
    constructor(raiz) {
      this.tipo = 'sim'; this.estado = 'desconectado'; this.raiz = raiz;
      this.onFrame = () => {}; this.onEstado = () => {}; this.onConectado = () => {};
      this.leds = new Array(10).fill(0); this.filas = ['', '', '', ''];
      this.teclas = Array.from({ length: 10 }, () => ({ nombre: '', cat: 3, glifo: 0, hayIcono: false, icono: new Uint8Array(72) }));
      this.escenas = []; this.actual = 0; this.firma = 0; this.mapaListo = false;
      this.vol = 128; this.dado = null; this.selector = false; this.abajo = new Set(); this.log = [];
      this._construir();
      this._ultimoVol = 0;
    }
    get conectado() { return this.estado === 'conectado'; }
    _estado(e) { this.estado = e; this.onEstado(e, ''); this._dibujar(); }
    async conectar() {
      this._estado('conectado');
      setTimeout(() => { this.onFrame(Uint8Array.of(0x57, 1)); this.onFrame(Uint8Array.of(0x52)); this.onConectado(); }, 50);
    }
    desconectar() { this._estado('desconectado'); this.leds.fill(0); this.filas = ['', '', '', '']; this.mapaListo = false; this._dibujar(); }

    // ---- lo que manda la app ----
    send(f) {
      if (!this.conectado || !f || !f.length) return;
      this.log.push(Array.from(f));
      switch (f[0]) {
        case 0x6c: for (let i = 0; i < 10; i++) this.leds[i] = f[1 + i] & 7; break;
        case 0x6f: if (f[1] < 4) this.filas[f[1]] = txt(f, 2, f.length); break;
        case 0x61: { const t = this.teclas[f[1]]; if (t) { t.cat = f[2]; t.glifo = f[3]; t.hayIcono = !!f[4]; if (!f[4]) t.icono = new Uint8Array(72); t.nombre = ''; } break; }
        case 0x62: { const t = this.teclas[f[1]]; if (t) t.nombre = txt(f, 2, f.length); break; }
        case 0x69: { const t = this.teclas[f[1]]; if (t) for (let k = 3; k < f.length && f[2] + k - 3 < 72; k++) t.icono[f[2] + k - 3] = f[k]; break; }
        case 0x6d: this.firma = (f[1] | f[2] << 8 | f[3] << 16 | f[4] << 24) >>> 0; this.mapaListo = true; break;
        case 0x73: { const i = f[1]; if (i === 0) this.escenas = []; this.escenas[i] = txt(f, 3, f.length); this.escenas.length = Math.min(f[2], 10); break; }
        case 0x63: this.actual = f[1]; this.selector = false; break;
        case 0x64: this.dado = { v: f[1], c: f[2], hasta: performance.now() + 4000 }; setTimeout(() => this._dibujar(), 4100); break;
      }
      this._dibujar();
    }
    sendVarias(a) { a.forEach(x => this.send(x)); }

    // ---- lo que hace el "usuario" ----
    _tecla(i, abajo) {
      if (!this.conectado) return;
      if (abajo) this.abajo.add(i); else this.abajo.delete(i);
      if (this.selector) {                       // en el selector, tocar una tecla elige esa escena
        if (abajo && this.escenas[i] != null) { this.selector = false; this.onFrame(Uint8Array.of(0x53, i)); this._dibujar(); }
        return;
      }
      if (this.abajo.has(4) && this.abajo.has(9)) { this.selector = true; this.abajo.clear(); this._dibujar(); return; }
      this.onFrame(Uint8Array.of(0x4b, i, abajo ? 1 : 0));
    }
    _perilla(v) { this.vol = v; const t = performance.now(); if (t - this._ultimoVol > 40) { this._ultimoVol = t; this.onFrame(Uint8Array.of(0x50, v)); } else { clearTimeout(this._tv); this._tv = setTimeout(() => this.onFrame(Uint8Array.of(0x50, this.vol)), 45); } this._dibujar(); }

    _construir() {
      const r = this.raiz; r.innerHTML = '';
      r.classList.add('sim');
      r.innerHTML = `
        <div class="sim-pantallas">
          <canvas class="sim-oled" width="64" height="128"></canvas>
          <canvas class="sim-epaper" width="296" height="128"></canvas>
        </div>
        <div class="sim-teclas"></div>
        <div class="sim-pie">
          <label>Perilla <input type="range" min="0" max="255" value="128" class="sim-perilla"></label>
          <button type="button" class="sim-home">Selector de escenas (E1+E2)</button>
        </div>
        <p class="sim-ayuda">Teclado: <kbd>Q W E R T</kbd> arriba y <kbd>A S D F G</kbd> abajo.</p>`;
      this.cOled = r.querySelector('.sim-oled'); this.cEp = r.querySelector('.sim-epaper');
      const cont = r.querySelector('.sim-teclas');
      this.btn = NOMBRES.map((n, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'sim-tecla'; b.dataset.led = '0';
        b.innerHTML = `<span class="sim-n">${n}</span><i class="sim-led"></i>`;
        const dn = (e) => { e.preventDefault(); b.classList.add('abajo'); this._tecla(i, true); };
        const up = (e) => { e.preventDefault(); b.classList.remove('abajo'); this._tecla(i, false); };
        b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', (e) => { if (b.classList.contains('abajo')) up(e); }); b.addEventListener('pointercancel', up);
        cont.appendChild(b); return b;
      });
      r.querySelector('.sim-perilla').addEventListener('input', (e) => this._perilla(+e.target.value));
      r.querySelector('.sim-home').addEventListener('click', () => { if (this.conectado) { this.selector = !this.selector; this._dibujar(); } });
      this._kd = (e) => { if (/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return; const i = TECLADO[e.key.toLowerCase()]; if (i != null && r.offsetParent !== null) { this.btn[i].classList.add('abajo'); this._tecla(i, true); } };
      this._ku = (e) => { const i = TECLADO[e.key.toLowerCase()]; if (i != null && this.btn[i].classList.contains('abajo')) { this.btn[i].classList.remove('abajo'); this._tecla(i, false); } };
      window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
      this._dibujar();
    }

    _dibujar() {
      this.btn.forEach((b, i) => { b.dataset.led = this.conectado ? String(this.leds[i]) : '0'; });
      this._oled(); this._epaper();
    }

    _oled() {
      const c = this.cOled.getContext('2d'); c.imageSmoothingEnabled = false;
      c.fillStyle = '#05080a'; c.fillRect(0, 0, 64, 128);
      const col = '#8fe3ff';
      c.fillStyle = col; c.font = '8px monospace'; c.textBaseline = 'top';
      const t = (s, x, y) => c.fillText(String(s).slice(0, 10), x, y);
      if (!this.conectado) { t('Buscando', 2, 40); t('Macrodeck..', 2, 52); return; }
      if (this.selector) {
        t('ESCENAS', 2, 2);
        this.escenas.forEach((n, i) => { t(NOMBRES[i] + ' ' + n.slice(0, 7), 2, 16 + i * 10); });
        t('Toca una', 2, 118); return;
      }
      c.fillRect(0, 0, 64, 11); c.fillStyle = '#05080a'; t(this.filas[0] || (this.escenas[this.actual] || ''), 2, 2); c.fillStyle = col;
      t(this.filas[1], 2, 16); t(this.filas[2], 2, 26); t(this.filas[3], 2, 40);
      // mini panel de LEDs
      for (let i = 0; i < 10; i++) { const x = 6 + (i % 5) * 11, y = 58 + Math.floor(i / 5) * 10; c.globalAlpha = this.leds[i] ? 1 : 0.25; c.fillRect(x, y, 7, 6); }
      c.globalAlpha = 1;
      if (this.dado && performance.now() < this.dado.hasta) {
        c.fillStyle = '#05080a'; c.fillRect(4, 40, 56, 48); c.strokeStyle = col; c.strokeRect(4.5, 40.5, 55, 47);
        c.fillStyle = col; c.font = '20px monospace'; c.fillText(String(this.dado.v), 32 - String(this.dado.v).length * 6, 52); c.font = '8px monospace'; t('d' + this.dado.c, 24, 76);
      }
      t('VOL', 2, 100); c.strokeStyle = col; c.strokeRect(2.5, 109.5, 59, 7); c.fillRect(4, 111, Math.round(this.vol / 255 * 56), 4);
    }

    _epaper() {
      const c = this.cEp.getContext('2d'); c.imageSmoothingEnabled = false;
      c.fillStyle = COLOR_EPAPER.blanco; c.fillRect(0, 0, 296, 128);
      c.textBaseline = 'top';
      if (!this.conectado || !this.mapaListo) { c.fillStyle = COLOR_EPAPER.negro; c.font = '12px monospace'; c.fillText(this.conectado ? 'Esperando el mapa...' : 'Abri la app y toca Conectar', 14, 54); return; }
      const w = 58, h = 62;
      for (let i = 0; i < 10; i++) {
        const t = this.teclas[i], x = 3 + (i % 5) * (w + 0.5), y = 2 + Math.floor(i / 5) * (h + 1);
        const vacio = !t.nombre && !t.hayIcono && t.glifo === 0 && t.cat === 3;
        c.strokeStyle = CAT_COLOR[t.cat] || '#000'; c.lineWidth = 3; c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
        if (vacio) continue;
        c.fillStyle = COLOR_EPAPER.negro; c.font = '8px monospace'; c.fillText(NOMBRES[i], x + 5, y + 5);
        if (t.hayIcono) MD.Iconos.pintar(c, t.icono, x + w - 29, y + 5, 1, COLOR_EPAPER.negro);
        if (t.glifo) { c.fillStyle = COLOR_EPAPER.rojo; c.font = 'bold 10px monospace'; c.fillText(GLIFO_LETRA[t.glifo], x + 5, y + 16); }
        c.fillStyle = COLOR_EPAPER.negro; c.font = '9px monospace';
        const pal = t.nombre.split(' '); let l1 = '', l2 = '';
        pal.forEach(p => { if ((l1 + ' ' + p).trim().length <= 8 && !l2) l1 = (l1 + ' ' + p).trim(); else l2 = (l2 + ' ' + p).trim(); });
        c.fillText(l1.slice(0, 8), x + 5, y + 36); c.fillText(l2.slice(0, 8), x + 5, y + 47);
      }
    }
    destruir() { window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku); }
  }
  MD.Simulador = Simulador;
})(window.MD);
