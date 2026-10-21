// simulador.js - Un Macrodeck virtual: habla EXACTAMENTE con las mismas tramas que la placa real.
// Sirve para probar todo sin la placa ni el celu. Muestra la OLED (64x128), la e-Paper (mapa de teclas) y las 10 teclas.
window.MD = window.MD || {};
(function (MD) {
  const NOMBRES = ['A1', 'B1', 'C1', 'D1', 'E1', 'A2', 'B2', 'C2', 'D2', 'E2'];
  const TECLADO = { q: 0, w: 1, e: 2, r: 3, t: 4, a: 5, s: 6, d: 7, f: 8, g: 9 };
  const COLOR_EPAPER = { blanco: '#f1efe6', negro: '#161616', rojo: '#c8281e', amarillo: '#e6c21c' };
  const GLIFO_CLAVE = ['una_vez', 'loop', 'azar', 'mantener', 'secuencia', 'silenciar', 'fadeout', 'intro_loop'];   // glifo del protocolo -> dibujito
  const MARCO = { 0: 'blanco', 1: 'amarillo', 2: 'blanco', 3: 'rojo', 4: 'blanco', 5: 'gris', 6: 'gris', 7: 'amarillo' };      // color del marco segun el modo
  const txt = (f, desde, hasta) => String.fromCharCode.apply(null, Array.from(f.slice(desde, hasta)).filter(c => c));

  class Simulador {
    constructor(raiz) {
      this.tipo = 'sim'; this.estado = 'desconectado'; this.raiz = raiz;
      this.onFrame = () => {}; this.onEstado = () => {}; this.onConectado = () => {};
      this.leds = new Array(10).fill(0); this.filas = ['', '', '', ''];
      this.teclas = Array.from({ length: 10 }, () => ({ nombre: '', glifo: 0, hayIcono: false, ducking: false, icono: new Uint8Array(72) }));
      this.escenas = []; this.actual = 0; this.firma = 0; this.mapaListo = false;
      this.vol = 128; this.selector = false; this.abajo = new Set(); this.log = [];
      // v1.3-dev14: lo que la OLED sabe del celu (tramas 'z' y 'y') y a quien maneja la perilla (0 = SFX sonidos, 1 = CEL volumen de Android)
      this.celu = { bat: 255, flags: 0, vol: 255, rx: 0, titulo: '' };
      this.volDestino = 0; this.agarrado = true; this.potAlCambiar = 50; this.objAgarre = -2; this.ladoAgarre = 0; this.sfxEnv = 50; this.celEnv = -1; this.celEnvEn = 0; this.homeAbajo = false;
      this.agarrePct = 3;
      this._construir();
      this._ultimoVol = 0;
    }
    get conectado() { return this.estado === 'conectado'; }
    _estado(e) { this.estado = e; this.onEstado(e, ''); this._dibujar(); }
    async conectar() {
      this._destinoInicial();
      this._estado('conectado');
      setTimeout(() => { this.onFrame(Uint8Array.of(0x57, 1)); this.onFrame(Uint8Array.of(0x52)); this.onConectado(); }, 50);
    }
    desconectar() { this._estado('desconectado'); this.leds.fill(0); this.filas = ['', '', '', '']; this.mapaListo = false; this.celu = { bat: 255, flags: 0, vol: 255, rx: 0, titulo: '' }; this._dibujar(); }
    get _potPct() { return Math.round(this.vol * 100 / 255); }
    get _celFresco() { return this.celu.rx && Date.now() - this.celu.rx < 15000; }
    get _celPct() { return this._celFresco && this.celu.vol <= 100 ? this.celu.vol : -1; }
    _destinoInicial() { this.volDestino = +this.raiz.querySelector('.sim-dest').value; this.agarrado = this.volDestino === 0; this.potAlCambiar = this._potPct; this.objAgarre = -2; this.ladoAgarre = 0; this.celEnv = -1; }
    _cambiarDestino() { this.volDestino = this.volDestino ? 0 : 1; this.agarrado = false; this.potAlCambiar = this._potPct; this.objAgarre = -2; this.ladoAgarre = 0; this.celEnv = -1; this._dibujar(); }
    // Igual que el Macrodeck: la perilla "agarra" el valor real al quedar cerca o cruzarlo (si no se conoce, al moverse 3 %)
    _evaluarAgarre() {
      if (this.agarrado) return;
      const pot = this._potPct, obj = this.volDestino ? this._celPct : this.sfxEnv;
      if (obj < 0) { if (Math.abs(pot - this.potAlCambiar) >= 3) this.agarrado = true; return; }
      if (Math.abs(pot - obj) <= this.agarrePct) { this.agarrado = true; return; }
      const lado = pot > obj ? 1 : -1;
      if (obj !== this.objAgarre) { this.objAgarre = obj; this.ladoAgarre = lado; return; }
      if (lado !== this.ladoAgarre) this.agarrado = true;
    }

    // ---- lo que manda la app ----
    send(f) {
      if (!this.conectado || !f || !f.length) return;
      this.log.push(Array.from(f));
      switch (f[0]) {
        case 0x6c: for (let i = 0; i < 10; i++) this.leds[i] = f[1 + i] & 7; break;
        case 0x6f: if (f[1] < 4) this.filas[f[1]] = txt(f, 2, f.length); break;
        case 0x61: { const t = this.teclas[f[1]]; if (t) { t.glifo = f[3]; t.hayIcono = !!(f[4] & 1); t.ducking = !!(f[4] & 2); if (!(f[4] & 1)) t.icono = new Uint8Array(72); t.nombre = ''; } break; }
        case 0x62: { const t = this.teclas[f[1]]; if (t) t.nombre = txt(f, 2, f.length); break; }
        case 0x69: { const t = this.teclas[f[1]]; if (t) for (let k = 3; k < f.length && f[2] + k - 3 < 72; k++) t.icono[f[2] + k - 3] = f[k]; break; }
        case 0x6d: this.firma = (f[1] | f[2] << 8 | f[3] << 16 | f[4] << 24) >>> 0; this.mapaListo = true; break;
        case 0x73: { const i = f[1]; if (i === 0) this.escenas = []; this.escenas[i] = txt(f, 3, f.length); this.escenas.length = Math.min(f[2], 10); break; }
        case 0x63: this.actual = f[1]; this.selector = false; break;
        case 0x7a: if (f.length >= 4) { this.celu.bat = f[1]; this.celu.flags = f[2]; this.celu.vol = f[3]; this.celu.rx = Date.now();
                   // en modo CEL, si el volumen cambio por otro lado (a mano en el celu) la perilla suelta el valor
                   if (this.volDestino === 1 && this.agarrado && this.celEnv >= 0 && Date.now() - this.celEnvEn > 1500 && f[3] <= 100 && Math.abs(f[3] - this.celEnv) > 5) { this.agarrado = false; this.potAlCambiar = this._potPct; this.objAgarre = -2; } } break;
        case 0x79: { const parte = f[1]; if (parte === 0) this.celu.titulo = ''; if (parte < 3) this.celu.titulo = this.celu.titulo.slice(0, parte * 18).padEnd(parte * 18, ' ') + txt(f, 2, f.length); break; }
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
      this.onFrame(Uint8Array.of(0x4b, i, abajo ? 1 : 0));
    }
    _perilla(v) {
      this.vol = v;
      if (this.volDestino === 0) {
        this._evaluarAgarre();
        if (this.agarrado) { this.sfxEnv = this._potPct; const t = performance.now(); if (t - this._ultimoVol > 40) { this._ultimoVol = t; this.onFrame(Uint8Array.of(0x50, v)); } else { clearTimeout(this._tv); this._tv = setTimeout(() => this.onFrame(Uint8Array.of(0x50, this.vol)), 45); } }
      } else {
        this._evaluarAgarre();
        const pct = this._potPct;
        if (this.agarrado && (this.celEnv < 0 || Math.abs(pct - this.celEnv) >= 2 || pct === 0 || pct === 100)) { this.celEnv = pct; this.celEnvEn = Date.now(); this.onFrame(Uint8Array.of(0x51, pct)); }
      }
      this._dibujar();
    }

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
          <button type="button" class="sim-home">HOME (selector de escenas)</button>
          <button type="button" class="sim-homeb1" title="Mantener HOME y tocar B1">HOME + B1 (SFX / CEL)</button>
          <label>Perilla al conectar <select class="sim-dest"><option value="0">SFX (sonidos)</option><option value="1">CEL (volumen del celu)</option></select></label>
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
      r.querySelector('.sim-homeb1').addEventListener('click', () => { if (this.conectado && !this.selector) this._cambiarDestino(); });
      r.querySelector('.sim-dest').addEventListener('change', () => { this._destinoInicial(); this._dibujar(); });
      this._anim = setInterval(() => { if (this.conectado && this.raiz.offsetParent !== null) this._oled(); }, 100);   // para que corra el titulo
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

    // La OLED se dibuja con los MISMOS numeros que programa_dnd.cpp (dibujarOled): 64 x 128, letra de 6 x 8.
    _oled() {
      const c = this.cOled.getContext('2d'); c.imageSmoothingEnabled = false;
      const BL = '#8fe3ff', NG = '#05080a';
      c.fillStyle = NG; c.fillRect(0, 0, 64, 128);
      c.font = '10px monospace'; c.textBaseline = 'top';
      const t = (s2, x, y, inv) => { c.fillStyle = inv ? NG : BL; c.fillText(String(s2), x, y - 1); };
      const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
      const marco = (x, y, w, h) => { c.strokeStyle = BL; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); };
      const arte = (x0, y0, filas) => { c.fillStyle = BL; filas.forEach((fila, y) => { for (let x = 0; x < fila.length; x++) if (fila[x] === '#') c.fillRect(x0 + x, y0 + y, 1, 1); }); };
      const O_CELU = ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####', '##.##'], O_DECK = ['#######', '#.....#', '#.#.#.#', '#.....#', '#.#.#.#', '#.....#', '#######'];
      const O_RAYO = ['..#', '.#.', '###', '.#.', '#..'], O_PAUSA = ['##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '##.##'];
      const ALT = [[3, 6, 4, 2, 5, 7, 3, 4], [6, 3, 7, 5, 2, 4, 6, 3], [2, 5, 3, 7, 4, 3, 5, 6]];   // mismas alturas que oledEcualizador() del firmware
      const barritas = (x0, y0) => { const paso = Math.floor(Date.now() / 130); for (let k = 0; k < 3; k++) { const h = ALT[k][(paso + k * 3) % 8]; rect(x0 + k * 2, y0 + 7 - h, 1, h, BL); } };
      if (!this.conectado) { t('Waiting...', 2, 70); t('Open the', 2, 82); t('app, tap', 2, 91); t('Connect', 2, 100); return; }
      if (this.selector) {
        rect(0, 0, 64, 10, BL); t('SCENES', 2, 1, true);
        this.escenas.forEach((n, i) => { t(NOMBRES[i] + (i === this.actual ? '>' : ' ') + n.slice(0, 8), 2, 12 + i * 9); });
        t('Hold', 2, 110); t('HOME exits', 2, 119); return;
      }
      const ce = this.celu, fresco = this._celFresco, fl = fresco ? ce.flags : 0;
      // fila de baterias: celu a la izquierda, Macrodeck a la derecha
      arte(1, 0, O_CELU); t(fresco && ce.bat <= 100 ? ce.bat + '%' : '--%', 8, 1);
      if (fl & 1) arte(27, 2, O_RAYO);
      arte(34, 0, O_DECK); t('--%', 44, 1);
      // titulo de la escena: MAYUSCULAS sobre blanco
      const tit = (this.filas[0] || this.escenas[this.actual] || 'D&D').toUpperCase().slice(0, 10);
      rect(0, 10, 64, 10, BL); t(tit, Math.max(0, Math.floor((64 - tit.length * 6) / 2)), 11, true);
      t(this.filas[1], 2, 22); t(this.filas[2], 2, 31); t(this.mapaListo ? this.filas[3] : 'No map yet', 2, 40);
      // mini-panel de teclas
      for (let i = 0; i < 10; i++) {
        const x = 2 + (i % 5) * 12, y = 49 + Math.floor(i / 5) * 13, on = this.leds[i] > 0;
        if (on) rect(x, y, 10, 11, BL); else marco(x, y, 10, 11);
        t('ABCDE'[i % 5], x + 2, y + 2, on);
      }
      // lo que suena en el celu
      const acceso = !!(fl & 8), suena = !!(fl & 2), sesion = !!(fl & 4);
      const estado = !fresco ? 'NO DATA' : (!acceso ? 'NO ACCESS' : (suena ? 'PLAYING' : (sesion ? 'PAUSED' : 'NO MEDIA')));
      c.save(); c.beginPath(); c.rect(11, 78, 50, 11); c.clip();
      if ((suena || sesion) && ce.titulo) {
        const n = ce.titulo.length, ancho = 50;
        if (n * 6 <= ancho) t(ce.titulo, 11, 80);
        else {
          const per = (n + 4) * 6, pausa = 1500, paso = 60, tt = performance.now() % (pausa + per * paso), off = tt < pausa ? 0 : Math.floor((tt - pausa) / paso);
          t(ce.titulo, 11 - off, 80); t(ce.titulo, 11 - off + per, 80);
        }
      } else if (!(suena || sesion)) t('- - - - -', 11, 80); else t('...', 11, 80);
      c.restore();
      marco(0, 77, 64, 13);
      if (suena) barritas(3, 80); else if (sesion) arte(3, 80, O_PAUSA);
      t(estado, 2, 92);
      // volumenes
      const fila = (y, et, pct, activa) => {
        if (activa) { rect(0, y - 1, 20, 9, BL); t(et, 1, y, true); } else t(et, 1, y);
        marco(22, y, 22, 7);
        const n = pct < 0 ? 0 : Math.round((18 * pct) / 100); if (n > 0) rect(24, y + 2, n, 3, BL);
        if (activa && !this.agarrado) { c.globalCompositeOperation = 'difference'; rect(24 + Math.floor(18 * this._potPct / 100), y - 1, 1, 9, '#ffffff'); c.globalCompositeOperation = 'source-over'; }
        t(pct < 0 ? '--%' : (pct >= 100 ? 'MAX' : pct + '%'), 46, y);
      };
      fila(104, 'SFX', this.sfxEnv, this.volDestino === 0);
    }

    _epaper() {
      // Igual que la e-Paper del Macrodeck (programa_dnd.cpp, celdaDnd): fondo negro, celdas de 56 x 56 con margen de 8.
      const c = this.cEp.getContext('2d'); c.imageSmoothingEnabled = false;
      const C = MD.Config, COL = { amarillo: COLOR_EPAPER.amarillo, rojo: COLOR_EPAPER.rojo, blanco: COLOR_EPAPER.blanco, gris: COLOR_EPAPER.blanco };
      c.fillStyle = '#000'; c.fillRect(0, 0, 296, 128);
      c.textBaseline = 'top';
      if (!this.conectado || !this.mapaListo) { c.fillStyle = COLOR_EPAPER.blanco; c.font = '12px monospace'; c.fillText(this.conectado ? 'Esperando el mapa...' : 'Abri la app y toca Conectar', 14, 54); return; }
      const w = 56, h = 56;
      const marco = (x, y, ww, hh, col, punteado) => { c.strokeStyle = col; c.lineWidth = 1; c.setLineDash(punteado ? [1, 1] : []); c.strokeRect(x + 0.5, y + 0.5, ww - 1, hh - 1); c.setLineDash([]); };
      for (let i = 0; i < 10; i++) {
        const t = this.teclas[i], x = 8 + (i % 5) * w, y = 8 + Math.floor(i / 5) * h;
        const vacio = !t.nombre && !t.hayIcono;
        const modo = vacio ? 'gris' : (MARCO[t.glifo] || 'blanco'), col = COL[modo];
        marco(x, y, w - 1, h - 1, vacio ? '#8a8478' : col, modo === 'gris');
        if (!vacio && t.ducking) marco(x + 2, y + 2, w - 5, h - 5, col, false);                  // marco doble = ducking
        c.fillStyle = (modo === 'gris' && !vacio) ? COLOR_EPAPER.blanco : (vacio ? '#8a8478' : col); c.fillRect(x + 3, y + 3, 18, 14);
        c.fillStyle = '#000'; c.font = 'bold 10px monospace'; c.fillText(NOMBRES[i], x + 5, y + 4);
        if (vacio) continue;
        if (t.hayIcono) MD.Iconos.pintar(c, t.icono, x + w - 29, y + 3, 1, COLOR_EPAPER.blanco);
        const clave = GLIFO_CLAVE[t.glifo] || 'una_vez', arte = C.ARTE[clave];
        C.pintarArte(c, x + 4, y + 20 + (arte.length === 5 ? 2 : 1), arte, col, 1);              // el modo, con el color del marco
        if (t.ducking) C.pintarArte(c, x + 16, y + 21, C.ARTE.ducking, COLOR_EPAPER.amarillo, 1); // parlante con flecha
        c.fillStyle = COLOR_EPAPER.blanco; c.font = '9px monospace';
        const pal = t.nombre.split(' '); let l1 = '', l2 = '';
        pal.forEach(p => { if ((l1 + ' ' + p).trim().length <= 7 && !l2) l1 = (l1 + ' ' + p).trim(); else l2 = (l2 + ' ' + p).trim(); });
        const centro = (txt2, yy) => c.fillText(txt2, x + 1 + Math.max(0, (w - 3 - c.measureText(txt2).width) / 2), yy);
        centro(l1.slice(0, 8), y + 32); if (l2) centro(l2.slice(0, 8), y + 43);
      }
    }
    destruir() { clearInterval(this._anim); window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku); }
  }
  MD.Simulador = Simulador;
})(window.MD);
