// tracker_motor.js - El tracker virtual del simulador: la misma logica que el motor del Initiative Tracker 2.0 (macrodeck-tracker/firmware/tracker_dnd_esp32/motor.h), linea por linea.
// 2.0-dev31 (motor 3.1): varios estados a la vez (mascara), D2 corto saca estados (lista con la perilla), selector de personajes con cursor, orden UNDO.
// Recibe los 3 botones del joystick y larga por 'salida' las MISMAS lineas que larga el aparato (@evento, #foto, !saludo).
// La app lo trata igual que a un Arduino real conectado por USB: el espejo (tracker_nucleo.js) lee esas lineas y dibuja.
// Se prueba contra el sketch compilado en la compu (herramientas/tracker/prueba_diferencial.js).
(function (MD) {
  const Trk = MD.Trk, L = Trk.LETRAS_TODAS, N_TIPOS = 11, LATIDO_MS = 2500, DEBOUNCE_CEN = 20;
  const ENEMIGO = 0, INVITADO = 6, NORMAL = 0, CONCENTRACION = 1, COMODIN = 2, INCONSCIENTE = 3;

  class Motor {
    // opts: { salida(linea), restaurar: obj|null (combate guardado), alGuardar(obj|null), version, debug, cfg: obj|null (configuracion guardada), alCfg(obj) }
    constructor(opts) {
      opts = opts || {};
      this.salida = opts.salida || (() => {}); this.alGuardar = opts.alGuardar || (() => {}); this.version = opts.version || '2.1';
      this.umbral = opts.debug ? 15000 : Trk.UMBRAL_INACTIVO; this.debug = !!opts.debug; this.inv = !!(opts.debug || opts.invertir);   // inv: botones como en MODO_DEBUG (izq = atrás, der = adelante)
      this.ms = 0; this.ultTx = 0; this.snapPend = false; this.holaPend = false; this.restauradoEnBoot = false;
      this.modo = 0;                         // 0 cantidad · 1 colores · 2 combate · 3 terminado (todo apagado)
      this.total = 4; this.turno = 1; this.ronda = 1; this.slotCfg = 1;
      this.tipo = Array(13).fill(ENEMIGO); this.alt = Array(13).fill(NORMAL); this.muerto = Array(13).fill(false);
      // 2.0-dev27: una condicion del PHB 2014 por lugar (codigo = posicion en la lista de la perilla) y agotamiento 0..6, que convive con todo
      this.cond = Array(13).fill(0); this.agot = Array(13).fill(0);       // 2.0-dev31: cond = MASCARA (bit p-1 = estado de la posicion p, 1..16 sin el 6)
      this.perillaUlt = -1; this.perillaBase = -1; this.selActivo = false; this.selIdx = 0; this.selPos = -1; this.perillaTocada = false; this.sostenT = 0;
      this.lista = false; this.listaPos = 0; this.listaT = 0; this.undoUlt = -1;
      this.ins = false; this.slotIns = 0; this.hist = [];
      this.tInicioTurno = 0; this.idleAvisado = false;
      this.pul = { I: false, C: false, D: false };
      this.ultIzq = false; this.dbIzq = 0; this.ultDer = false; this.dbDer = 0;
      this.tTriple = 0; this.contTriple = false; this.cenEst = false; this.cenUltBajo = 0;
      this.cenPres = false; this.tPresCen = 0; this.accionCen = false; this.cmdInc = false; this.cmdMuerte = false;
      this.postAcc = 0; this.slotMuriendo = 0; this.enemAntes = 0; this.combateGanado = false;
      this.eeSucio = false; this.eeT = 0;
      this.rx = ''; this.alCfg = opts.alCfg || (() => {});
      this.cfgFabrica(); if (opts.cfg) this.cfgDe(opts.cfg);      // 3.0: personajes habilitados, brillo y colores (como el firmware, se guardan aparte del combate)
      this.S = Trk.estadoVacio();
      this.p = new Trk.Pantalla(this.S, (ms) => ms - this.tInicioTurno > this.umbral);
      this.p.colores = this.colMapa; this.p.apagar();
      if (opts.restaurar) this.restaurarDe(opts.restaurar);
      this.holaPend = true; this.snapPend = true;
    }

    // ---------- botones (abajo = true) ----------
    boton(lado, abajo) { this.pul[lado] = !!abajo; }
    // ---------- ordenes por el puerto (una por linea; el '?' suelto tambien vale) ----------
    entrada(txt) {
      for (const c of String(txt)) {
        if (c === '\n' || c === '\r') { if (this.rx) { this.orden(this.rx); this.rx = ''; } }
        else if (c === '?' && this.rx === '') { this.holaPend = true; this.snapPend = true; }
        else if (this.rx.length < 47) this.rx += c; else this.rx = '';
      }
    }
    // ---------- 2.0-dev31 (motor 3.1): perilla, estados y lista para sacarlos (igual que motor.h) ----------
    listaSel() { const L = []; for (let i = 0; i < 17; i++) if ((this.estHab >> i) & 1) L.push(i); return L; }
    posPerilla(k, n, actual) {
      if (!n) return 0;
      let j = (k * n) >> 8; if (j >= n) j = n - 1;
      if (actual < 0 || j === actual) return j;
      let a = ((k > 3 ? k - 3 : 0) * n) >> 8, b = ((k + 3 > 255 ? 255 : k + 3) * n) >> 8;
      if (a >= n) a = n - 1; if (b >= n) b = n - 1;
      return a === b ? j : actual;
    }
    listaQuitar(n) {
      const L = [];
      for (let p = 1; p <= 17; p++) {
        if (p === 6) { if (this.agot[n]) L.push(6); }
        else if (p === 17) { if (this.alt[n] === INCONSCIENTE) L.push(17); }
        else if (this.cond[n] & (1 << (p - 1))) L.push(p);
      }
      return L;
    }
    cerrarLista() { if (this.lista) { this.lista = false; this.ev('SQ'); } }
    perilla(k, ms) {
      const prev = this.perillaUlt; this.perillaUlt = k;
      if (this.lista) {
        const L = this.listaQuitar(this.turno); if (!L.length) { this.cerrarLista(); return; }
        const j = this.posPerilla(k, L.length, this.listaPos);
        if (j !== this.listaPos) { this.listaPos = j; this.listaT = this.ms; this.ev('SL', L[j]); }
        return;
      }
      if (this.selActivo) { const L = this.listaSel(), j = this.posPerilla(k, L.length, this.selPos); if (j !== this.selPos) { this.selPos = j; this.selIdx = L[j]; this.ev('SP', this.selIdx); } return; }
      if (!this.cenPres || this.modo !== 2 || this.ins || this.cmdInc || this.pul.I || this.pul.D) return;
      if (this.perillaBase < 0) { this.perillaBase = k; return; }
      if (prev >= 0 && Math.abs(k - prev) >= 3) { this.perillaTocada = true; this.sostenT = this.ms; }
      if (Math.abs(k - this.perillaBase) > 14) {
        this.selActivo = true; this.cmdInc = true; this.cmdMuerte = true; this.accionCen = true;
        const L = this.listaSel(); this.selPos = this.posPerilla(k, L.length, -1); this.selIdx = L[this.selPos]; this.ev('SP', this.selIdx);
      }
    }
    aplicarSeleccion(idx, ms) {
      if (this.modo !== 2 || this.ins) return;
      const t = this.tipo[this.turno], n = this.turno;
      this.guardarHist(); this.marcarTurno();
      if (idx === 0) { this.alt[n] = NORMAL; this.cond[n] = 0; this.evTS('SN', t, n); }
      else if (idx === 6) { this.agot[n] = (this.agot[n] + 1) % 7; this.ev('AG', L[t], n, this.agot[n]); }
      else if (idx <= 16) {
        const bit = 1 << (idx - 1);
        if (this.cond[n] & bit) { this.cond[n] &= ~bit; this.ev('SX', L[t], n, idx); }
        else { this.cond[n] |= bit; if (idx === 1) this.evTS('SC', t, n); else if (idx === 2) this.evTS('SJ', t, n); else this.ev('ST', L[t], n, idx); }
      }
      this.pedirSnap(); this.marcarCambio();
    }
    quitarEstado(n, cod) {
      const t = this.tipo[n];
      this.guardarHist(); this.marcarTurno();
      if (cod === 6) { if (this.agot[n]) this.agot[n]--; this.ev('AG', L[t], n, this.agot[n]); }
      else if (cod === 17) { this.alt[n] = NORMAL; this.ev('SX', L[t], n, 17); }
      else { this.cond[n] &= ~(1 << (cod - 1)); this.ev('SX', L[t], n, cod); }
      this.pedirSnap(); this.marcarCambio();
    }
    toqueEstado() {
      const L = this.listaQuitar(this.turno);
      if (!L.length) { this.ev('NO', 'S'); return; }
      if (L.length === 1) { this.quitarEstado(this.turno, L[0]); return; }
      this.lista = true; this.listaT = this.ms;
      this.listaPos = this.perillaUlt >= 0 ? this.posPerilla(this.perillaUlt, L.length, -1) : 0;
      this.ev('SL', L[this.listaPos]);
    }
    orden(s) {
      if (s[0] === '?') { this.holaPend = true; this.snapPend = true; return; }
      let m;
      if ((m = /^B,([ICD]),([01])$/.exec(s))) { this.boton(m[1], m[2] === '1'); return; }
      if ((m = /^K,(-?\d+)/.exec(s))) { this.perilla(Math.max(0, Math.min(255, +m[1])), this.ms); return; }
      if ((m = /^UNDO(?:,(-?\d+))?$/.exec(s))) {                    // 2.0-dev31: deshacer (tecla A2 del Macrodeck); con numero, las repetidas se ignoran
        if (m[1] !== undefined) { const n = (+m[1]) & 0xFFFF; if (n === this.undoUlt) return; this.undoUlt = n; }
        if (this.modo === 3 || this.p.anim) return;
        this.cerrarLista(); if (this.selActivo) { this.selActivo = false; this.ev('SQ'); }
        this.ctrlZ(); return;
      }
      if ((m = /^COL,([A-Za-z]),(-?\d+),(-?\d+),(-?\d+)/.exec(s))) {
        const t = L.indexOf(m[1]); if (t < 0) return;
        this.col[t] = [m[2], m[3], m[4]].map((v) => Math.max(0, Math.min(255, +v)));
        this.cfgCambio(); this.pedirSnap(); return;
      }
      if ((m = /^HAB,(-?\d+)/.exec(s))) { this.mask = ((+m[1]) & ((1 << N_TIPOS) - 1)) | 1; this.cfgCambio(); return; }       // el enemigo siempre
      if ((m = /^BRI,(-?\d+)/.exec(s))) { this.brillo = Math.max(5, Math.min(100, +m[1])); this.cfgCambio(); return; }
      if (s === 'CFG') { this.enviarCfg(); return; }
      if ((m = /^EHAB,(-?\d+)/.exec(s))) { this.estHab = ((+m[1]) & 0x3FFFF) | 1 | (1 << 17); this.cfgCambio(); return; }
      if ((m = /^ECOL,(\d+),(\d+),(\d+),(\d+)/.exec(s)) && +m[1] < 18) { this.colEst[+m[1]] = [+m[2], +m[3], +m[4]].map((v) => Math.max(0, Math.min(255, v))); this.cfgCambio(); this.pedirSnap(); return; }
      if (s === 'DEF') { this.cfgFabrica(); this.cfgCambio(); this.pedirSnap(); this.enviarCfg(); }
    }
    // ---------- configuracion (3.0) ----------
    cfgFabrica() {
      this.mask = Trk.MASCARA_FABRICA; this.brillo = Trk.BRILLO_FABRICA;
      this.estHab = Trk.EST_MASCARA_FABRICA; this.colEst = Trk.COL_EST_FABRICA.map((c) => c.slice());
      this.col = L.split('').map((t) => Trk.TIPOS[t].c.slice());
      this.colMapa = this.colMapa || {}; this.cfgMapa();
    }
    cfgMapa() { L.split('').forEach((t, i) => { this.colMapa[t] = this.col[i]; }); this.colEst.forEach((c, i) => { Trk.colEstMapa[i] = c; }); }      // el mapa es el MISMO objeto que ve la pantalla
    cfgDe(o) {
      try {
        if (typeof o.mask === 'number') this.mask = (o.mask & ((1 << N_TIPOS) - 1)) | 1;
        if (typeof o.brillo === 'number' && o.brillo >= 5 && o.brillo <= 100) this.brillo = o.brillo;
        if (typeof o.estHab === 'number') this.estHab = (o.estHab & 0x3FFFF) | 1 | (1 << 17);
        if (Array.isArray(o.colEst) && o.colEst.length === 18) this.colEst = o.colEst.map((c) => [0, 1, 2].map((j) => Math.max(0, Math.min(255, c[j] | 0))));
        if (Array.isArray(o.col) && o.col.length === N_TIPOS) this.col = o.col.map((c) => [0, 1, 2].map((j) => Math.max(0, Math.min(255, c[j] | 0))));
        this.cfgMapa();
      } catch (e) { /* configuracion rota: queda la de fabrica */ }
    }
    cfgCambio() { this.cfgMapa(); this.alCfg({ mask: this.mask, brillo: this.brillo, col: this.col.map((c) => c.slice()), estHab: this.estHab, colEst: this.colEst.map((c) => c.slice()) }); }
    enviarCfg() {
      const h = (v) => (v < 16 ? '0' : '') + v.toString(16);
      this.tx('!CFG,' + this.mask + ',' + this.brillo + ',' + this.col.map((c) => h(c[0]) + h(c[1]) + h(c[2])).join(''));
      this.tx('!EST,' + ('00000' + this.estHab.toString(16)).slice(-5) + ',' + this.colEst.map((c) => h(c[0]) + h(c[1]) + h(c[2])).join(''));
    }
    habilitado(t) { return t === ENEMIGO || (t < N_TIPOS && ((this.mask >> t) & 1) === 1); }

    // ---------- serie ----------
    tx(linea) { this.salida(linea); this.ultTx = this.ms; }
    ev(...x) { this.tx('@' + x.join(',')); }
    evTS(id, t, s) { this.ev(id, L[t], s); }
    pedirSnap() { this.snapPend = true; }
    foto() {
      let s = '#' + 'QCBF'[this.modo] + ',' + this.ronda + ',' + this.turno + ',' + this.total + ',' + this.slotCfg + ',' + (this.ins ? this.slotIns : 0) + ',';
      for (let i = 1; i <= this.total; i++) s += L[this.tipo[i]] + this.letraAlt(i) + (this.muerto[i] ? '0' : '1');
      s += ',';                                                          // 2.0-dev31: mascara de estados en 4 hex + agotamiento, por lugar
      for (let i = 1; i <= this.total; i++) s += ('000' + (this.cond[i] & 0xFFFF).toString(16).toUpperCase()).slice(-4) + (this.agot[i] > 6 ? 0 : this.agot[i]);
      return s;
    }
    letraAlt(i) { return this.alt[i] === INCONSCIENTE ? 'I' : ((this.cond[i] & 1) ? 'C' : ((this.cond[i] & 2) ? 'J' : 'N')); }
    servirSerie() {
      if (this.holaPend) { this.tx('!TRK,' + this.version + ',' + (this.restauradoEnBoot ? '1' : '0')); this.holaPend = false; }
      if (this.snapPend || this.ms - this.ultTx >= LATIDO_MS) { this.tx(this.foto()); this.snapPend = false; }
    }

    // ---------- estado visible para la pantalla ----------
    sincronizar() {
      const S = this.S;
      S.modo = 'QCBF'[this.modo]; S.ronda = this.ronda; S.turno = this.turno; S.total = this.total; S.cfg = this.slotCfg; S.ins = this.ins ? this.slotIns : 0;
      for (let i = 0; i <= 12; i++) { S.tipo[i] = L[this.tipo[i]]; S.alt[i] = this.alt[i]; S.muerto[i] = this.muerto[i]; S.cond[i] = this.cond[i]; S.agot[i] = this.agot[i]; }
    }

    // ---------- guardado ----------
    marcarCambio() { this.eeSucio = true; this.eeT = this.ms; }
    marcarTurno() { this.tInicioTurno = this.ms; this.idleAvisado = false; }
    invalidarEE() { this.eeSucio = false; this.alGuardar(null); }
    servirEE() {
      if (this.modo === 2 && !this.combateGanado && this.eeSucio && !this.p.anim && this.ms - this.eeT > 600) {
        this.eeSucio = false;
        this.alGuardar({ v: 31, turno: this.turno, ronda: this.ronda, total: this.total, tipo: this.tipo.slice(), alt: this.alt.slice(), muerto: this.muerto.slice(), cond: this.cond.slice(), agot: this.agot.slice() });
      }
    }
    restaurarDe(o) {
      try {
        if (!(o.total >= 1 && o.total <= 12 && o.turno >= 1 && o.turno <= o.total)) return;
        for (let i = 0; i <= 12; i++) if ((o.tipo[i] | 0) >= N_TIPOS) return;       // un tipo que no existe: el guardado esta roto (se ignora)
        this.total = o.total; this.turno = o.turno; this.ronda = Math.max(1, o.ronda | 0);
        for (let i = 0; i <= 12; i++) {
          this.tipo[i] = o.tipo[i] | 0; this.muerto[i] = !!o.muerto[i]; const a = o.alt[i] | 0, c = (o.cond && o.cond[i]) | 0, g = (o.agot && o.agot[i]) | 0;
          this.alt[i] = a === INCONSCIENTE ? INCONSCIENTE : NORMAL;
          this.cond[i] = (o.v >= 31 ? c & 0xFFFF : ((c >= 3 && c <= 16 && c !== 6) ? 1 << (c - 1) : 0)) & ~32;     // los guardados viejos tenian UNA condicion
          if (a === CONCENTRACION) this.cond[i] |= 1; if (a === COMODIN) this.cond[i] |= 2;
          this.agot[i] = (g >= 0 && g <= 6) ? g : 0;
        }
        this.modo = 2; this.slotCfg = this.total; this.hist = []; this.combateGanado = false; this.restauradoEnBoot = true; this.marcarTurno();
      } catch (e) { /* se ignora un guardado roto */ }
    }

    // ---------- el loop ----------
    tick(ms) {
      this.ms = ms;
      this.servirSerie();
      this.sincronizar();
      if (this.p.anim) { this.p.animTick(ms); this.sincronizar(); this.huboAnim = true; return; }
      this.manejarBotones(ms);
      this.sincronizar();
      this.p.tick(ms);
      if (this.modo === 2 && !this.idleAvisado && ms - this.tInicioTurno > this.umbral) { this.idleAvisado = true; this.evTS('ID', this.tipo[this.turno], this.turno); }
      this.servirEE();
    }

    // ---------- logica de clases ----------
    disponible(t, slot) {
      if (t === ENEMIGO || t >= INVITADO) return true;      // el enemigo y todos los invitados se pueden repetir
      for (let i = 1; i <= this.total; i++) { if (i === slot) continue; if (this.tipo[i] === t) return false; }
      return true;
    }
    cambiarTipoConfig(dir, slot) {
      let a = this.tipo[slot], n = 0;
      do { a = (a + dir + N_TIPOS) % N_TIPOS; this.tipo[slot] = a; n++; if (n > N_TIPOS) break; } while (!this.habilitado(a) || !this.disponible(this.tipo[slot], slot));
    }
    enemigosVivos() { let c = 0; for (let i = 1; i <= this.total; i++) if (this.tipo[i] === ENEMIGO && !this.muerto[i]) c++; return c; }

    leerCentro(ms) {
      if (this.pul.C) { this.cenUltBajo = ms; this.cenEst = true; } else if (this.cenEst && ms - this.cenUltBajo >= DEBOUNCE_CEN) this.cenEst = false;
      return this.cenEst;
    }

    manejarBotones(ms) {
      const bIzq = this.pul.I, bDer = this.pul.D;
      let bCen = this.leerCentro(ms);
      if (this.huboAnim) { this.huboAnim = false; if (bCen && this.cenPres) { this.cenPres = false; this.selActivo = false; } }     // 2.0-dev31: apretada nueva despues de una animacion (igual que motor.h 3.1)
      let pushIzq = false, pushDer = false;
      if (bIzq && !this.ultIzq && ms - this.dbIzq > 200) { pushIzq = true; this.dbIzq = ms; } this.ultIzq = bIzq;
      if (bDer && !this.ultDer && ms - this.dbDer > 200) { pushDer = true; this.dbDer = ms; } this.ultDer = bDer;

      if (bIzq && bCen && bDer) {
        if (!this.contTriple) { this.contTriple = true; this.tTriple = ms; }
        else if (ms - this.tTriple > 3000) {
          this.ev('RS'); this.invalidarEE();
          this.modo = 0; this.reiniciarMemoria(); this.ins = false; this.contTriple = false; this.cenPres = false;
          this.selActivo = false; this.lista = false; this.pedirSnap(); this.sincronizar(); this.p.iniciar('estrobo', 3, null, ms);
        }
        return;
      } else this.contTriple = false;

      // COMBATE TERMINADO: no responde a nada (solo al reinicio de 3 botones)
      if (this.modo === 3) { this.cenPres = false; return; }

      // 2.0-dev31: lista para sacar estados abierta
      if (this.lista) {
        if (this.modo !== 2 || this.ins || pushIzq || pushDer || ms - this.listaT > 8000) { this.cerrarLista(); this.cenPres = false; return; }
        if (bCen && !this.cenPres) { this.cenPres = true; this.tPresCen = ms; }
        if (!bCen && this.cenPres) {
          this.cenPres = false;
          const L = this.listaQuitar(this.turno), pos = this.listaPos;
          this.cerrarLista();
          if (pos >= 0 && pos < L.length) this.quitarEstado(this.turno, L[pos]);
        }
        this.accionCen = true;
        return;
      }

      let avanzar = false, retroceder = false, insertar = false, ctrlz = false;
      if (bCen) {
        if (pushIzq) { if (this.inv) ctrlz = true; else insertar = true; this.accionCen = true; }
        if (pushDer) { if (this.inv) insertar = true; else ctrlz = true; this.accionCen = true; }
      } else {
        if (pushIzq) { if (this.inv) retroceder = true; else avanzar = true; }
        if (pushDer) { if (this.inv) avanzar = true; else retroceder = true; }
      }
      if (ctrlz) this.ctrlZ();
      if (insertar) this.iniciarInsercion();

      if (avanzar || retroceder) {
        const dir = avanzar ? 1 : -1;
        if (this.ins) { this.cambiarTipoConfig(dir, this.slotIns); this.evTS('IT', this.tipo[this.slotIns], this.slotIns); this.pedirSnap(); }
        else if (this.modo === 0) {
          let t = this.total + dir, w = 0; if (t > 12) { t = 1; w = 1; } if (t < 1) { t = 12; w = 1; }
          this.total = t; this.ev(dir > 0 ? 'QU' : 'QD', this.total, w); this.pedirSnap();
        } else if (this.modo === 1) {
          let c = this.slotCfg + dir; if (c > this.total) c = 1; if (c < 1) c = this.total;
          this.slotCfg = c; this.evTS('CM', this.tipo[this.slotCfg], this.slotCfg); this.pedirSnap();
        } else this.navegarTurno(dir);
      }

      if (bCen && !this.cenPres) { this.cenPres = true; this.tPresCen = ms; this.sostenT = ms; this.accionCen = false; this.cmdInc = false; this.cmdMuerte = false; this.perillaBase = this.perillaUlt; this.selActivo = false; this.selPos = -1; this.perillaTocada = false; }

      if (bCen && this.cenPres) {
        const dur = ms - this.tPresCen, quieto = ms - this.sostenT;
        if (this.modo === 2 && !bIzq && !bDer) {
          const t = this.tipo[this.turno];
          if (quieto >= 2000 && !this.cmdInc) {
            this.cmdInc = true; this.accionCen = true;
            if (t === ENEMIGO) {
              this.cmdMuerte = true; this.enemAntes = this.enemigosVivos(); this.guardarHist(); this.slotMuriendo = this.turno;
              this.evTS('KL', t, this.turno); this.sincronizar(); this.p.iniciar('fulminado', this.turno, () => this.accionPost(), ms); this.postAcc = 1;
            } else {
              this.guardarHist(); this.alt[this.turno] = INCONSCIENTE; this.evTS('SI', t, this.turno); this.pedirSnap(); this.marcarCambio();
            }
          }
          if (quieto >= 4000 && !this.cmdMuerte && t >= INVITADO) {
            this.cmdMuerte = true; this.enemAntes = this.enemigosVivos(); this.guardarHist(); this.slotMuriendo = this.turno;
            this.evTS('KL', t, this.turno); this.sincronizar(); this.p.iniciar('fulminado', this.turno, () => this.accionPost(), ms); this.postAcc = 1;
          }
        } else if (this.modo === 0 && dur >= 2000 && !this.accionCen && !bIzq && !bDer) {
          this.accionCen = true; this.modo = 1; this.slotCfg = 1; this.hist = []; this.guardarHist();
          this.ev('QO', this.total); this.pedirSnap(); this.sincronizar(); this.p.iniciar('flash', 0, null, ms);
        } else if (this.modo === 1 && !this.ins && dur >= 2000 && !this.accionCen && !bIzq && !bDer) {
          this.accionCen = true; this.guardarHist(); this.modo = 2; this.reiniciarEstadisticas(); this.ev('CG', this.total);
          this.pedirSnap(); this.sincronizar(); this.p.iniciar('flash', 0, null, ms);
        }
      }

      if (!bCen && this.cenPres) {
        const dur = ms - this.tPresCen; this.cenPres = false;
        if (this.selActivo) { this.selActivo = false; this.ev('SQ'); this.aplicarSeleccion(this.selIdx, ms); }
        if (!this.accionCen && dur < 1000 && !this.perillaTocada) {
          if (this.ins) {
            this.ins = false; this.guardarHist(); this.evTS('IO', this.tipo[this.slotIns], this.slotIns); this.pedirSnap(); this.marcarCambio();
          } else if (this.modo === 1) {
            this.guardarHist(); this.cambiarTipoConfig(1, this.slotCfg); this.evTS('CN', this.tipo[this.slotCfg], this.slotCfg); this.pedirSnap();
          } else if (this.modo === 2) this.toqueEstado();
        }
        this.cmdInc = false; this.cmdMuerte = false;
      }
    }

    // ---------- historial y acciones ----------
    reiniciarMemoria() { for (let i = 1; i <= 12; i++) { this.tipo[i] = ENEMIGO; this.muerto[i] = false; this.alt[i] = NORMAL; this.cond[i] = 0; this.agot[i] = 0; } }
    reiniciarEstadisticas() {
      this.turno = 1; this.ronda = 1; this.hist = []; this.slotCfg = this.total;
      for (let i = 1; i <= 12; i++) { this.muerto[i] = false; this.alt[i] = NORMAL; this.cond[i] = 0; this.agot[i] = 0; }
      this.marcarTurno(); this.combateGanado = false; this.guardarHist(); this.marcarCambio();
    }
    guardarHist() {
      const h = { turno: this.turno, ronda: this.ronda, total: this.total, slotCfg: this.slotCfg, tipo: this.tipo.slice(), alt: this.alt.slice(), cond: this.cond.slice(), agot: this.agot.slice(), muerto: this.muerto.slice() };
      if (this.hist.length < 5) this.hist.push(h); else { this.hist.shift(); this.hist.push(h); }
    }
    ctrlZ() {
      if (this.ins || this.hist.length === 0) { this.ev('NO', 'U'); return; }
      const h = this.hist.pop();
      this.turno = h.turno; this.ronda = h.ronda; this.total = h.total; this.slotCfg = h.slotCfg; this.tipo = h.tipo.slice(); this.alt = h.alt.slice(); this.cond = h.cond.slice(); this.agot = h.agot.slice(); this.muerto = h.muerto.slice();
      this.marcarTurno(); this.ev('UN'); this.pedirSnap(); this.marcarCambio();
    }
    iniciarInsercion() {
      if (this.modo !== 2) return;
      if (this.total >= 12) { this.ev('NO', 'I'); return; }
      this.guardarHist();
      for (let i = this.total; i > this.turno; i--) { this.tipo[i + 1] = this.tipo[i]; this.alt[i + 1] = this.alt[i]; this.cond[i + 1] = this.cond[i]; this.agot[i + 1] = this.agot[i]; this.muerto[i + 1] = this.muerto[i]; }
      this.slotIns = this.turno + 1; this.total++;
      this.tipo[this.slotIns] = ENEMIGO; this.alt[this.slotIns] = NORMAL; this.cond[this.slotIns] = 0; this.agot[this.slotIns] = 0; this.muerto[this.slotIns] = false;
      if (!this.disponible(this.tipo[this.slotIns], this.slotIns)) this.cambiarTipoConfig(1, this.slotIns);
      this.ins = true; this.evTS('IN', this.tipo[this.slotIns], this.slotIns); this.pedirSnap();
    }
    navegarTurno(dir) {
      this.guardarHist();
      let rc = false, tc = 0, n = 0;
      do {
        this.turno += dir;
        if (this.turno > this.total) { this.turno = 1; rc = true; tc = 1; } else if (this.turno < 1) { this.turno = this.total; rc = true; tc = -1; }
        n++; if (n > 12) break;
      } while (this.muerto[this.turno]);
      if (rc) {
        if (tc === 1) { this.ronda++; this.ev('RN', this.ronda, L[this.tipo[this.turno]], this.turno); }
        else { if (this.ronda > 1) this.ronda--; this.ev('RP', this.ronda, L[this.tipo[this.turno]], this.turno); }
      } else this.evTS(dir > 0 ? 'TN' : 'TP', this.tipo[this.turno], this.turno);
      this.marcarTurno(); this.pedirSnap(); this.marcarCambio();
      if (rc) { this.sincronizar(); this.p.iniciar('ronda', tc, null, this.ms); }
    }
    verificarTPK() {
      let vivos = false; for (let i = 1; i <= this.total; i++) if (!this.muerto[i]) { vivos = true; break; }
      if (!vivos) {
        this.ev('TK'); this.invalidarEE(); this.modo = 3; this.pedirSnap();
        this.sincronizar(); this.p.iniciar('estrobo', 3, null, this.ms); return true;
      }
      return false;
    }
    continuarMuerte() {
      if (this.verificarTPK()) return;
      if (this.enemAntes > 0 && this.enemigosVivos() === 0) {
        this.ev('VI'); this.combateGanado = true; this.invalidarEE(); this.modo = 3; this.pedirSnap(); this.sincronizar(); this.p.iniciar('victoria', 0, null, this.ms);
      }
    }
    // al terminar el destello de una muerte (POST_MUERTE_TRAS_FULMINADO) o la animacion de ronda que le sigue (POST_MUERTE_TRAS_RONDA)
    accionPost() {
      const acc = this.postAcc; this.postAcc = 0;
      if (acc === 1) {
        this.muerto[this.slotMuriendo] = true;
        let rc = false, n = 0;
        do { this.turno++; if (this.turno > this.total) { this.turno = 1; rc = true; } n++; if (n > 12) break; } while (this.muerto[this.turno]);
        this.marcarTurno(); this.pedirSnap(); this.marcarCambio();
        if (rc) {
          this.ronda++; this.ev('RN', this.ronda, L[this.tipo[this.turno]], this.turno);
          this.sincronizar(); this.postAcc = 2; this.p.iniciar('ronda', 1, () => this.accionPost(), this.ms);
        } else this.continuarMuerte();
      } else if (acc === 2) this.continuarMuerte();
    }
  }
  Trk.Motor = Motor;
})(window.MD);
