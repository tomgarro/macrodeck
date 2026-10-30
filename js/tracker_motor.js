// tracker_motor.js - El "Arduino virtual" del simulador: la misma logica que firmware/tracker/tracker_dnd/tracker_dnd.ino, linea por linea.
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
    orden(s) {
      if (s[0] === '?') { this.holaPend = true; this.snapPend = true; return; }
      let m;
      if ((m = /^B,([ICD]),([01])$/.exec(s))) { this.boton(m[1], m[2] === '1'); return; }
      if ((m = /^COL,([A-Za-z]),(-?\d+),(-?\d+),(-?\d+)/.exec(s))) {
        const t = L.indexOf(m[1]); if (t < 0) return;
        this.col[t] = [m[2], m[3], m[4]].map((v) => Math.max(0, Math.min(255, +v)));
        this.cfgCambio(); this.pedirSnap(); return;
      }
      if ((m = /^HAB,(-?\d+)/.exec(s))) { this.mask = ((+m[1]) & ((1 << N_TIPOS) - 1)) | 1; this.cfgCambio(); return; }       // el enemigo siempre
      if ((m = /^BRI,(-?\d+)/.exec(s))) { this.brillo = Math.max(5, Math.min(100, +m[1])); this.cfgCambio(); return; }
      if (s === 'CFG') { this.enviarCfg(); return; }
      if (s === 'DEF') { this.cfgFabrica(); this.cfgCambio(); this.pedirSnap(); this.enviarCfg(); }
    }
    // ---------- configuracion (3.0) ----------
    cfgFabrica() {
      this.mask = Trk.MASCARA_FABRICA; this.brillo = Trk.BRILLO_FABRICA;
      this.col = L.split('').map((t) => Trk.TIPOS[t].c.slice());
      this.colMapa = this.colMapa || {}; this.cfgMapa();
    }
    cfgMapa() { L.split('').forEach((t, i) => { this.colMapa[t] = this.col[i]; }); }      // el mapa es el MISMO objeto que ve la pantalla
    cfgDe(o) {
      try {
        if (typeof o.mask === 'number') this.mask = (o.mask & ((1 << N_TIPOS) - 1)) | 1;
        if (typeof o.brillo === 'number' && o.brillo >= 5 && o.brillo <= 100) this.brillo = o.brillo;
        if (Array.isArray(o.col) && o.col.length === N_TIPOS) this.col = o.col.map((c) => [0, 1, 2].map((j) => Math.max(0, Math.min(255, c[j] | 0))));
        this.cfgMapa();
      } catch (e) { /* configuracion rota: queda la de fabrica */ }
    }
    cfgCambio() { this.cfgMapa(); this.alCfg({ mask: this.mask, brillo: this.brillo, col: this.col.map((c) => c.slice()) }); }
    enviarCfg() {
      const h = (v) => (v < 16 ? '0' : '') + v.toString(16);
      this.tx('!CFG,' + this.mask + ',' + this.brillo + ',' + this.col.map((c) => h(c[0]) + h(c[1]) + h(c[2])).join(''));
    }
    habilitado(t) { return t === ENEMIGO || (t < N_TIPOS && ((this.mask >> t) & 1) === 1); }

    // ---------- serie ----------
    tx(linea) { this.salida(linea); this.ultTx = this.ms; }
    ev(...x) { this.tx('@' + x.join(',')); }
    evTS(id, t, s) { this.ev(id, L[t], s); }
    pedirSnap() { this.snapPend = true; }
    foto() {
      let s = '#' + 'QCBF'[this.modo] + ',' + this.ronda + ',' + this.turno + ',' + this.total + ',' + this.slotCfg + ',' + (this.ins ? this.slotIns : 0) + ',';
      for (let i = 1; i <= this.total; i++) s += L[this.tipo[i]] + Trk.ALT_LETRAS[this.alt[i]] + (this.muerto[i] ? '0' : '1');
      return s;
    }
    servirSerie() {
      if (this.holaPend) { this.tx('!TRK,' + this.version + ',' + (this.restauradoEnBoot ? '1' : '0')); this.holaPend = false; }
      if (this.snapPend || this.ms - this.ultTx >= LATIDO_MS) { this.tx(this.foto()); this.snapPend = false; }
    }

    // ---------- estado visible para la pantalla ----------
    sincronizar() {
      const S = this.S;
      S.modo = 'QCBF'[this.modo]; S.ronda = this.ronda; S.turno = this.turno; S.total = this.total; S.cfg = this.slotCfg; S.ins = this.ins ? this.slotIns : 0;
      for (let i = 0; i <= 12; i++) { S.tipo[i] = L[this.tipo[i]]; S.alt[i] = this.alt[i]; S.muerto[i] = this.muerto[i]; }
    }

    // ---------- guardado ----------
    marcarCambio() { this.eeSucio = true; this.eeT = this.ms; }
    marcarTurno() { this.tInicioTurno = this.ms; this.idleAvisado = false; }
    invalidarEE() { this.eeSucio = false; this.alGuardar(null); }
    servirEE() {
      if (this.modo === 2 && !this.combateGanado && this.eeSucio && !this.p.anim && this.ms - this.eeT > 600) {
        this.eeSucio = false;
        this.alGuardar({ turno: this.turno, ronda: this.ronda, total: this.total, tipo: this.tipo.slice(), alt: this.alt.slice(), muerto: this.muerto.slice() });
      }
    }
    restaurarDe(o) {
      try {
        if (!(o.total >= 1 && o.total <= 12 && o.turno >= 1 && o.turno <= o.total)) return;
        for (let i = 0; i <= 12; i++) if ((o.tipo[i] | 0) >= N_TIPOS) return;       // un tipo que no existe: el guardado esta roto (se ignora)
        this.total = o.total; this.turno = o.turno; this.ronda = Math.max(1, o.ronda | 0);
        for (let i = 0; i <= 12; i++) { this.tipo[i] = o.tipo[i] | 0; this.alt[i] = o.alt[i] | 0; this.muerto[i] = !!o.muerto[i]; }
        this.modo = 2; this.slotCfg = this.total; this.hist = []; this.combateGanado = false; this.restauradoEnBoot = true; this.marcarTurno();
      } catch (e) { /* se ignora un guardado roto */ }
    }

    // ---------- el loop ----------
    tick(ms) {
      this.ms = ms;
      this.servirSerie();
      this.sincronizar();
      if (this.p.anim) { this.p.animTick(ms); this.sincronizar(); return; }
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
      const bIzq = this.pul.I, bDer = this.pul.D, bCen = this.leerCentro(ms);
      let pushIzq = false, pushDer = false;
      if (bIzq && !this.ultIzq && ms - this.dbIzq > 200) { pushIzq = true; this.dbIzq = ms; } this.ultIzq = bIzq;
      if (bDer && !this.ultDer && ms - this.dbDer > 200) { pushDer = true; this.dbDer = ms; } this.ultDer = bDer;

      if (bIzq && bCen && bDer) {
        if (!this.contTriple) { this.contTriple = true; this.tTriple = ms; }
        else if (ms - this.tTriple > 3000) {
          this.ev('RS'); this.invalidarEE();
          this.modo = 0; this.reiniciarMemoria(); this.ins = false; this.contTriple = false; this.cenPres = false;
          this.pedirSnap(); this.sincronizar(); this.p.iniciar('estrobo', 3, null, ms);
        }
        return;
      } else this.contTriple = false;

      // COMBATE TERMINADO: no responde a nada (solo al reinicio de 3 botones)
      if (this.modo === 3) { this.cenPres = false; return; }

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
          this.cambiarTipoConfig(dir, this.slotCfg);
          this.evTS(dir > 0 ? 'CN' : 'CP', this.tipo[this.slotCfg], this.slotCfg); this.pedirSnap();
        } else this.navegarTurno(dir);
      }

      if (bCen && !this.cenPres) { this.cenPres = true; this.tPresCen = ms; this.accionCen = false; this.cmdInc = false; this.cmdMuerte = false; }

      if (bCen && this.cenPres) {
        const dur = ms - this.tPresCen;
        if (this.modo === 2 && !bIzq && !bDer) {
          const t = this.tipo[this.turno];
          if (dur >= 2000 && !this.cmdInc) {
            this.cmdInc = true; this.accionCen = true;
            if (t === ENEMIGO) {
              this.cmdMuerte = true; this.enemAntes = this.enemigosVivos(); this.guardarHist(); this.slotMuriendo = this.turno;
              this.evTS('KL', t, this.turno); this.sincronizar(); this.p.iniciar('fulminado', this.turno, () => this.accionPost(), ms); this.postAcc = 1;
            } else {
              this.guardarHist(); this.alt[this.turno] = INCONSCIENTE; this.evTS('SI', t, this.turno); this.pedirSnap(); this.marcarCambio();
            }
          }
          if (dur >= 4000 && !this.cmdMuerte && t >= INVITADO) {
            this.cmdMuerte = true; this.enemAntes = this.enemigosVivos(); this.guardarHist(); this.slotMuriendo = this.turno;
            this.evTS('KL', t, this.turno); this.sincronizar(); this.p.iniciar('fulminado', this.turno, () => this.accionPost(), ms); this.postAcc = 1;
          }
        } else if (this.modo === 0 && dur >= 2000 && !this.accionCen && !bIzq && !bDer) {
          this.accionCen = true; this.modo = 1; this.slotCfg = 1; this.hist = []; this.guardarHist();
          this.ev('QO', this.total); this.pedirSnap(); this.sincronizar(); this.p.iniciar('flash', 0, null, ms);
        }
      }

      if (!bCen && this.cenPres) {
        const dur = ms - this.tPresCen; this.cenPres = false;
        if (!this.accionCen && dur < 1000) {
          if (this.ins) {
            this.ins = false; this.guardarHist(); this.evTS('IO', this.tipo[this.slotIns], this.slotIns); this.pedirSnap(); this.marcarCambio();
          } else if (this.modo === 1) {
            this.guardarHist(); this.evTS('CS', this.tipo[this.slotCfg], this.slotCfg); this.slotCfg++;
            if (this.slotCfg > this.total) { this.modo = 2; this.reiniciarEstadisticas(); this.ev('CG', this.total); }
            else if (!this.disponible(this.tipo[this.slotCfg], this.slotCfg)) this.cambiarTipoConfig(1, this.slotCfg);
            this.pedirSnap();
          } else if (this.modo === 2) {
            this.guardarHist(); this.marcarTurno();
            let e = this.alt[this.turno]; e = (e === INCONSCIENTE) ? NORMAL : (e + 1) % 3; this.alt[this.turno] = e;
            this.evTS(e === NORMAL ? 'SN' : (e === CONCENTRACION ? 'SC' : 'SJ'), this.tipo[this.turno], this.turno);
            this.pedirSnap(); this.marcarCambio();
          }
        }
        this.cmdInc = false; this.cmdMuerte = false;
      }
    }

    // ---------- historial y acciones ----------
    reiniciarMemoria() { for (let i = 1; i <= 12; i++) { this.tipo[i] = ENEMIGO; this.muerto[i] = false; this.alt[i] = NORMAL; } }
    reiniciarEstadisticas() {
      this.turno = 1; this.ronda = 1; this.hist = []; this.slotCfg = this.total;
      for (let i = 1; i <= 12; i++) { this.muerto[i] = false; this.alt[i] = NORMAL; }
      this.marcarTurno(); this.combateGanado = false; this.guardarHist(); this.marcarCambio();
    }
    guardarHist() {
      const h = { turno: this.turno, ronda: this.ronda, total: this.total, slotCfg: this.slotCfg, tipo: this.tipo.slice(), alt: this.alt.slice(), muerto: this.muerto.slice() };
      if (this.hist.length < 5) this.hist.push(h); else { this.hist.shift(); this.hist.push(h); }
    }
    ctrlZ() {
      if (this.ins || this.hist.length === 0) { this.ev('NO', 'U'); return; }
      const h = this.hist.pop();
      this.turno = h.turno; this.ronda = h.ronda; this.total = h.total; this.slotCfg = h.slotCfg; this.tipo = h.tipo.slice(); this.alt = h.alt.slice(); this.muerto = h.muerto.slice();
      this.marcarTurno(); this.ev('UN'); this.pedirSnap(); this.marcarCambio();
    }
    iniciarInsercion() {
      if (this.modo !== 2) return;
      if (this.total >= 12) { this.ev('NO', 'I'); return; }
      this.guardarHist();
      for (let i = this.total; i > this.turno; i--) { this.tipo[i + 1] = this.tipo[i]; this.alt[i + 1] = this.alt[i]; this.muerto[i + 1] = this.muerto[i]; }
      this.slotIns = this.turno + 1; this.total++;
      this.tipo[this.slotIns] = ENEMIGO; this.alt[this.slotIns] = NORMAL; this.muerto[this.slotIns] = false;
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
