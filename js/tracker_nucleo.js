// tracker_nucleo.js - Initiative Tracker (D&D): lo que comparten el simulador y el aparato real.
// Aca vive todo lo que "sabe" lo que sabe el Arduino: los tipos de personaje y sus colores, la tabla de senos, la pantalla de 12 LEDs
// (los renders y las animaciones, copiados del sketch firmware/tracker/tracker_dnd/tracker_dnd.ino) y el lector de las lineas del puerto serie.
//
//   LINEAS que manda el Arduino (una por renglon):
//     @EVENTO,arg,...   un "movimiento" (ver Trk.EVENTOS)        #M,ronda,turno,total,cfg,ins,xxx...   foto completa del tracker
//     !TRK,version,r      saludo al arrancar (r = 1 si retomo un combate guardado)
//   El espejo (Trk.Espejo) lee esas lineas y mantiene la pantalla de LEDs igual a la del aparato.
window.MD = window.MD || {};
(function (MD) {
  const fr = Math.fround;
  const Trk = {};

  // ---------- personajes (el orden de las letras es el MISMO del enum del sketch: E D R N X L I) ----------
  Trk.LETRAS = 'EDRNXLI';
  Trk.TIPOS = {
    E: { n: 'Enemigo', cl: 'Calavera', c: [255, 0, 0] },
    D: { n: 'Dieter', cl: 'Paladín', c: [0, 150, 255] },
    R: { n: 'Ront', cl: 'Bárbaro', c: [0, 200, 0] },
    N: { n: 'Nabi', cl: 'Druida', c: [255, 100, 0] },
    X: { n: 'Narxira', cl: 'Monje', c: [255, 40, 0] },
    L: { n: 'Eclipso', cl: 'Pícaro', c: [60, 0, 90] },
    I: { n: 'Invitado', cl: 'Invitado', c: [0, 255, 127] },
    // 3.0: cuatro invitados con color propio (apagados de fabrica; se prenden en el Taller de colores). Mismos colores que COL_FABRICA del firmware del ESP32.
    a: { n: 'Invitado A', cl: 'Color A', c: [200, 0, 255] },
    b: { n: 'Invitado B', cl: 'Color B', c: [0, 255, 255] },
    c: { n: 'Invitado C', cl: 'Color C', c: [255, 220, 0] },
    d: { n: 'Invitado D', cl: 'Color D', c: [255, 255, 255] },
  };
  Trk.LETRAS_TODAS = 'EDRNXLIabcd';      // el orden es el del enum del firmware 3.0 (los 7 de siempre + los 4 invitados con color)
  Trk.MASCARA_FABRICA = 0x7F;            // E D R N X L I (como el Uno); a-d apagados
  Trk.BRILLO_FABRICA = 35;
  Trk.coloresFabrica = () => { const o = {}; for (const t of Trk.LETRAS_TODAS) o[t] = Trk.TIPOS[t].c.slice(); return o; };
  Trk.ALT_LETRAS = 'NCJI';
  Trk.ALT_N = ['normal', 'concentración', 'comodín', 'inconsciente'];
  Trk.ALT_C = [[0, 0, 0], [255, 0, 180], [173, 255, 47], [0, 0, 0]];
  Trk.SEC_CENTRO = [6, 7, 5, 8, 4, 9, 3, 10, 2, 11, 1, 12];
  Trk.UMBRAL_INACTIVO = 180000;

  // ---------- seno entero (identico a la tabla del sketch) ----------
  const SIN = new Int8Array(256);
  for (let i = 0; i < 256; i++) SIN[i] = Math.round(127 * Math.sin(2 * Math.PI * i / 256));
  Trk.SIN = SIN;
  const S8 = (i) => SIN[i & 255];
  Trk.S8 = S8;
  const PL = (frames, M) => fr((S8(Math.floor(((frames >>> 0) * M) / 256)) + 127) / 254);   // 0..1, avanza M/256 puntos por cuadro (25 ms)

  // ---------- la pantalla de 12 LEDs ----------
  // S = { modo:'Q'|'C'|'B', ronda, turno, total, cfg, ins, tipo:[,'E',...], alt:[,0,...], muerto:[,false,...] }
  Trk.estadoVacio = function () {
    return { modo: 'Q', ronda: 1, turno: 1, total: 4, cfg: 1, ins: 0, tipo: Array(13).fill('E'), alt: Array(13).fill(0), muerto: Array(13).fill(false) };
  };
  const trunc = Math.trunc;

  class Pantalla {
    // inactivoFn(ms) -> true si el turno lleva 3 minutos sin tocarse (el aparato real avisa con el evento ID)
    constructor(S, inactivoFn) {
      this.S = S; this.cols = Array.from({ length: 13 }, () => [0, 0, 0]);
      this.frames = 0; this.tFrame = 0; this.anim = null; this.inactivoFn = inactivoFn || (() => false); this.cola = [];
    }
    colorDe(t) { return (this.colores && this.colores[t]) || Trk.TIPOS[t].c; }       // 3.0: los colores pueden ser los configurados en el tracker (Taller de colores)
    led(i, r, g, b) { if (i < 1 || i > 12) return; const c = (v) => (v < 0 ? 0 : (v > 255 ? 255 : v | 0)); this.cols[i] = [c(r), c(g), c(b)]; }
    apagar() { for (let i = 1; i <= 12; i++) this.cols[i] = [0, 0, 0]; }
    get off() { return trunc((12 - this.S.total) / 2); }

    // un paso del "loop": cada 25 ms redibuja (si no hay una animacion de evento en marcha)
    tick(ms) {
      if (this.anim) {
        this.animTick(ms);
        if (!this.anim && this.cola.length) { const x = this.cola.shift(); this.iniciar(x[0], x[1], x[2], ms); }   // la siguiente arranca en el mismo instante
        return;
      }
      if (this.cola.length) { const x = this.cola.shift(); this.iniciar(x[0], x[1], x[2], ms); return; }
      if (ms - this.tFrame >= 25) {
        this.tFrame = ms; this.frames++;
        if (this.S.modo === 'Q') this.rQ(); else if (this.S.modo === 'C') this.rC(); else if (this.S.modo === 'F') this.apagar(); else this.rB(ms);
      }
    }
    // ----- renders (copia de renderConfigCantidad / renderConfigColor / renderCombate) -----
    rQ() {
      const S = this.S, p = PL(this.frames, 5215);
      for (let i = 1; i <= 12; i++) {
        if (i < S.total) this.led(i, 255, 255, 255);
        else if (i === S.total) { const v = trunc(fr(255 * p)); this.led(i, v, v, v); }
        else this.led(i, 0, 0, 0);
      }
    }
    rC() {
      const S = this.S, p = PL(this.frames, 2086), off = this.off;
      for (let i = 1; i <= 12; i++) {
        const k = i - off;
        if (k >= 1 && k <= S.total) {
          const c = this.colorDe(S.tipo[k]);
          if (k < S.cfg) this.led(i, c[0], c[1], c[2]);
          else if (k === S.cfg) this.led(i, trunc(fr(c[0] * p)), trunc(fr(c[1] * p)), trunc(fr(c[2] * p)));
          else this.led(i, 255, 255, 255);
        } else this.led(i, 0, 0, 0);
      }
    }
    rB(ms) {
      const S = this.S, F = this.frames, off = this.off;
      const resp = PL(F, 626);
      const inact = this.inactivoFn(ms);
      const pT = inact ? PL(F, 6258) : PL(F, 1565);
      const pIns = PL(F, 2608);
      let s = S8(Math.floor((F * 417) / 256)); if (s < 0) s = 0;
      let lat = fr(s / 127); lat = fr(fr(fr(fr(lat * lat) * lat) * lat) * fr(0.35));
      const M = (a, f) => trunc(fr(a * f));
      for (let i = 1; i <= 12; i++) {
        const k = i - off;
        if (k < 1 || k > S.total) { this.led(i, 0, 0, 0); continue; }
        if (S.muerto[k]) { this.led(i, 0, 0, 0); continue; }
        const b = this.colorDe(S.tipo[k]);
        if (S.ins && k === S.ins) { this.led(i, M(b[0], pIns), M(b[1], pIns), M(b[2], pIns)); continue; }
        const est = S.alt[k], alt = est !== 0;
        const a = (alt && est !== 3) ? Trk.ALT_C[est] : [0, 0, 0];
        if (k === S.turno) {
          if (!alt) this.led(i, M(255, pT), M(255, pT), M(255, pT));
          else if (est === 3) this.led(i, M(b[0], lat), M(b[1], lat), M(b[2], lat));
          else this.led(i, M(a[0], pT), M(a[1], pT), M(a[2], pT));
        } else if (alt) {
          if (est === 3) this.led(i, M(b[0], lat), M(b[1], lat), M(b[2], lat));
          else {
            const q = fr(1 - resp), mx = (j) => trunc(fr(fr(b[j] * resp) + fr(a[j] * q)));
            this.led(i, mx(0), mx(1), mx(2));
          }
        } else {
          const ia = ((Math.floor(((ms * 40053) % 4294967296) / 65536) & 255) + (trunc((k * 9371 + 50) / 100) & 255)) & 255;
          const ib = ((Math.floor(((ms * 72095) % 4294967296) / 65536) & 255) - (trunc((k * 6926 + 50) / 100) & 255)) & 255;
          const ff = fr(fr(0.75) + fr(fr(fr(0.125) * (S8(ia) + S8((ib + 64) & 255))) / 127));
          this.led(i, M(b[0], ff), M(b[1], ff), M(b[2], ff));
        }
      }
    }

    // ----- animaciones de evento (copia de los actualizar*() del sketch; no bloquean) -----
    // tipos: 'estrobo'(veces) · 'fulminado'(slot) · 'flash' · 'ronda'(dir +1/-1) · 'victoria'
    // Si ya hay una en marcha, la nueva espera su turno (el aparato nunca las superpone).
    arrancar(tipo, p, post, ms) { if (this.anim) this.cola.push([tipo, p, post]); else this.iniciar(tipo, p, post, ms); }
    iniciar(tipo, p, post, ms) {
      this.anim = { tipo, step: 0, t0: ms, A: p || 0, brillo: 0, dir: 1, post: post || null };
      if (tipo === 'ronda') { this.apagar(); this.anim.dir = p > 0 ? 1 : 0; this.anim.A = 0; }
      if (tipo === 'victoria') this.apagar();
    }
    fin() { const p = this.anim.post; this.anim = null; if (p) p(); }
    animTick(ms) {
      const a = this.anim, off = this.off, S = this.S;
      switch (a.tipo) {
        case 'estrobo':
          if (ms - a.t0 < 80) return; a.t0 = ms;
          if (a.step % 2 === 0) { for (let i = 1; i <= S.total; i++) this.led(i + off, 255, 0, 0); } else this.apagar();
          a.step++; if (a.step >= a.A * 2) this.fin(); return;
        case 'fulminado': {
          if (ms - a.t0 < 60) return; a.t0 = ms;
          const l = a.A + off;
          if (a.step % 2 === 0) this.led(l, 255, 0, 0); else this.led(l, 0, 0, 0);
          a.step++; if (a.step >= 6) this.fin(); return;
        }
        case 'flash': {
          const dur = [150, 100, 150, 100];
          if (ms - a.t0 < dur[a.step]) return; a.t0 = ms;
          if (a.step % 2 === 0) { for (let i = 1; i <= S.total; i++) this.led(i + off, 100, 100, 100); } else this.apagar();
          a.step++; if (a.step >= 4) this.fin(); return;
        }
        case 'ronda': {
          if (a.step <= 6) {
            if (ms - a.t0 < 60) return; a.t0 = ms;
            const li = 5 - a.step, ld = 6 + a.step, r = a.dir ? 0 : 255, g = a.dir ? 200 : 0;
            if (li >= 1) this.led(li, r, g, 0); if (ld <= 12) this.led(ld, r, g, 0);
            a.step++; return;
          }
          if (a.step === 7) { if (ms - a.t0 < 250) return; this.apagar(); a.t0 = ms; a.step = 8; return; }
          if (a.step === 8) { if (ms - a.t0 < 150) return; a.t0 = ms; a.A = 0; a.step = 9; return; }
          if (a.step === 9) {
            const n = Math.min(S.ronda, S.total);
            for (let i = 0; i < n; i++) this.led(Trk.SEC_CENTRO[i], 0, 100, 255);
            a.t0 = ms; a.step = 10; return;
          }
          if (a.step === 10) { if (ms - a.t0 < 300) return; this.apagar(); a.t0 = ms; a.step = 11; return; }
          if (a.step === 11) { if (ms - a.t0 < 200) return; a.A++; if (a.A >= 3) this.fin(); else a.step = 9; return; }
          return;
        }
        case 'victoria':
          switch (a.step) {
            case 0: if (ms - a.t0 < 1200) return; a.t0 = ms; a.brillo = 0; a.A = 0; a.step = 1; return;
            case 1:
              if (ms - a.t0 < 20) return; a.t0 = ms;
              for (let i = 1; i <= 12; i++) this.led(i, a.brillo, 0, trunc(a.brillo / 4));
              a.brillo += 15; if (a.brillo > 255) { a.brillo = 255; a.step = 2; } return;
            case 2:
              if (ms - a.t0 < 20) return; a.t0 = ms;
              for (let i = 1; i <= 12; i++) this.led(i, a.brillo, 0, trunc(a.brillo / 4));
              a.brillo -= 15; if (a.brillo < 0) { this.apagar(); a.A++; a.t0 = ms; a.step = 3; } return;
            case 3: if (ms - a.t0 < 300) return; if (a.A < 2) { a.brillo = 0; a.t0 = ms; a.step = 1; } else { a.t0 = ms; a.step = 4; } return;
            case 4: if (ms - a.t0 < 500) return; a.brillo = 0; a.t0 = ms; a.step = 5; return;
            case 5:
              if (ms - a.t0 < 35) return; a.t0 = ms;
              for (let i = 1; i <= S.total; i++) {
                if (S.tipo[i] !== 'E' && !S.muerto[i]) {
                  const c = this.colorDe(S.tipo[i]);
                  this.led(i + off, trunc((c[0] * a.brillo) / 255), trunc((c[1] * a.brillo) / 255), trunc((c[2] * a.brillo) / 255));
                }
              }
              a.brillo += 10; if (a.brillo > 255) { a.t0 = ms; a.step = 6; } return;
            case 6: if (ms - a.t0 < 1500) return; this.fin(); return;
          }
      }
    }
  }
  Trk.Pantalla = Pantalla;

  // ---------- lector de lineas ----------
  // -> {k:'ev', id, a:[...]} | {k:'snap', S} | {k:'hola', ver, restaurado} | {k:'otro', txt}
  Trk.parsear = function (linea) {
    const l = String(linea).replace(/\r/g, '').trim();
    if (!l) return null;
    const c = l[0];
    if (c === '@') { const p = l.slice(1).split(','); return { k: 'ev', id: p[0], a: p.slice(1) }; }
    if (c === '#') {
      const p = l.slice(1).split(',');
      if (p.length < 7) return { k: 'otro', txt: l };
      const S = Trk.estadoVacio();
      S.modo = p[0]; S.ronda = +p[1] || 1; S.turno = +p[2] || 1; S.total = Math.max(1, Math.min(12, +p[3] || 1)); S.cfg = +p[4] || 1; S.ins = +p[5] || 0;
      const cuerpo = p.slice(6).join(',');
      for (let i = 1; i <= S.total; i++) {
        const t = cuerpo[(i - 1) * 3], e = cuerpo[(i - 1) * 3 + 1], v = cuerpo[(i - 1) * 3 + 2];
        if (!Trk.TIPOS[t] || Trk.ALT_LETRAS.indexOf(e) < 0 || (v !== '0' && v !== '1')) return { k: 'otro', txt: l };
        S.tipo[i] = t; S.alt[i] = Trk.ALT_LETRAS.indexOf(e); S.muerto[i] = v === '0';
      }
      return { k: 'snap', S };
    }
    if (l.startsWith('!CFG,')) {                          // 3.0: !CFG,mascara,brillo,<11 colores en rrggbb>
      const p = l.slice(5).split(','), hex = (p[2] || '');
      if (hex.length < 66) return { k: 'otro', txt: l };
      const colores = {}; Trk.LETRAS_TODAS.split('').forEach((t, i) => { colores[t] = [0, 1, 2].map((j) => parseInt(hex.substr(i * 6 + j * 2, 2), 16) || 0); });
      return { k: 'cfg', mascara: (+p[0] || 0) | 1, brillo: Math.max(5, Math.min(100, +p[1] || Trk.BRILLO_FABRICA)), colores };
    }
    if (c === '!') { const p = l.slice(1).split(','); return { k: 'hola', ver: p[1] || '?', restaurado: p[2] === '1' }; }
    return { k: 'otro', txt: l };
  };
  // numero de calavera: el 1.er enemigo del tracker es la calavera 1, etc. (del 7.o en adelante: lisa)
  Trk.numEnemigo = function (S, i) { let n = 0; for (let k = 1; k <= i; k++) if (S.tipo[k] === 'E') n++; return n; };

  // ---------- el espejo: la pantalla del aparato (o del simulador) dibujada en la app ----------
  // Se alimenta con las lineas del Arduino. onEvento(id, args, ev) se llama en el mismo instante en que llega cada evento.
  class Espejo {
    constructor() {
      this.S = Trk.estadoVacio(); this.hay = false; this.t0 = performance.now(); this.inactivo = false;
      this.p = new Pantalla(this.S, () => this.inactivo); this.onEvento = null; this.onCambio = null; this.hola = null; this.ultSnap = 0;
    }
    reiniciar() { this.S = Trk.estadoVacio(); this.p.S = this.S; this.p.colores = null; this.cfgTracker = null; this.hay = false; this.p.anim = null; this.p.cola.length = 0; this.inactivo = false; }
    ahora() { return performance.now() - this.t0; }
    linea(txt) {
      const x = Trk.parsear(txt); if (!x) return null;
      const ms = this.ahora();
      if (x.k === 'snap') {
        const v = this.S;
        if (x.S.turno !== v.turno || x.S.ronda !== v.ronda || x.S.modo !== v.modo) this.inactivo = false;
        this.S = x.S; this.p.S = x.S; this.hay = true; this.ultSnap = ms;
        if (this.onCambio) this.onCambio();
      } else if (x.k === 'ev') {
        this.evento(x.id, x.a, ms);
        if (this.onEvento) this.onEvento(x.id, x.a, x);
      } else if (x.k === 'hola') {
        this.hola = x;
      } else if (x.k === 'cfg') {
        this.p.colores = x.colores; this.cfgTracker = x;            // los colores del tracker real: el espejo pinta con ellos
      }
      return x;
    }
    // el evento mueve lo que se ve YA (sin esperar la foto completa)
    evento(id, a, ms) {
      const S = this.S, p = this.p, num = (v) => +v || 0;
      if (['TN', 'TP', 'SC', 'SJ', 'SN', 'UN', 'CG'].indexOf(id) >= 0) this.inactivo = false;
      if (id === 'RN' || id === 'RP') { S.ronda = num(a[0]); S.turno = num(a[2]) || S.turno; this.inactivo = false; p.arrancar('ronda', id === 'RN' ? 1 : -1, null, ms); }
      else if (id === 'TN' || id === 'TP') S.turno = num(a[1]) || S.turno;
      else if (id === 'SC' || id === 'SJ' || id === 'SN' || id === 'SI') { const k = num(a[1]); if (k >= 1 && k <= 12) S.alt[k] = id === 'SC' ? 1 : (id === 'SJ' ? 2 : (id === 'SN' ? 0 : 3)); }
      else if (id === 'KL') p.arrancar('fulminado', num(a[1]), null, ms);
      else if (id === 'QO') { S.modo = 'C'; S.cfg = 1; p.arrancar('flash', 0, null, ms); }
      else if (id === 'CG') S.modo = 'B';
      else if (id === 'VI') { S.modo = 'F'; p.arrancar('victoria', 0, null, ms); }
      else if (id === 'TK' || id === 'RS') { S.modo = id === 'TK' ? 'F' : 'Q'; p.arrancar('estrobo', 3, null, ms); }
      else if (id === 'ID') this.inactivo = true;
      else if (id === 'QU' || id === 'QD') S.total = num(a[0]) || S.total;
      else if (id === 'CN' || id === 'CP' || id === 'IT') { const k = num(a[1]); if (k >= 1 && k <= 12 && Trk.TIPOS[a[0]]) S.tipo[k] = a[0]; }
      else if (id === 'CS') { const k = num(a[1]); if (k >= 1 && k < S.total) S.cfg = k + 1; }
    }
    tick() { this.p.tick(this.ahora()); }
  }
  Trk.Espejo = Espejo;

  MD.Trk = Trk;
})(window.MD);
