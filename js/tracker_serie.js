// tracker_serie.js - Initiative Tracker: la conexion con el Arduino (o con el simulador) y el servicio que lo mantiene vivo.
//
// TRANSPORTES (los tres entregan LINEAS completas, una por vez y en orden; nunca se mezclan):
//   usb : plugin nativo "TrackerSerie" de la APK (Android, cable OTG). La parte nativa arma las lineas y las manda una a una.
//   web : Web Serial del navegador (Chrome/Edge de escritorio). Sirve para probar el Arduino real desde la compu.
//   sim : el Arduino virtual de la app (tracker_motor.js).
//   md  : (2.0-dev13) el tracker ESP32 REAL, por la radio ESP-NOW del Macrodeck; el Macrodeck le pasa las lineas a la app por Bluetooth (tramas 'L' / 'N' / 'u').
//
// SERVICIO (MD.Trk.Servicio): corre siempre, aunque estes en otra pestana: lee lineas, mantiene el espejo, dispara sonidos y luces, cuenta estadisticas y
// guarda el monitor serie. La pestana Tracker solo lo muestra.
window.MD = window.MD || {};
(function (MD) {
  const Trk = MD.Trk || (MD.Trk = {});
  const cap = window.Capacitor;
  const nativo = () => !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  const plugin = () => { try { return nativo() ? ((cap.Plugins && cap.Plugins.TrackerSerie) || (typeof cap.registerPlugin === 'function' ? cap.registerPlugin('TrackerSerie') : null)) : null; } catch (e) { return null; } };
  const MAX_LOG = 600;

  const Sv = Trk.Servicio = {
    A: null, cfg: Trk.cfgNueva(), espejo: new Trk.Espejo(), stats: Trk.statsNueva(),
    modo: null, estado: 'desconectado', detalle: '', ultRx: 0, rxN: 0, hola: null, deseado: false,
    log: [], logN: 0, oyentes: new Set(), motor: null, mdPres: false, mdRx: '', cfgTracker: null, comb: null, pushHecho: false, tSim: 0, usbEsc: [], web: null, tVigia: 0, tReint: 0, tGuardar: 0, ultEvento: null, avisoHola: '',
  };

  // ---------- avisos a quien mira ----------
  Sv.alCambio = (fn) => { Sv.oyentes.add(fn); return () => Sv.oyentes.delete(fn); };
  const avisar = (que) => Sv.oyentes.forEach((fn) => { try { fn(que); } catch (e) {} });
  Sv.avisar = avisar;

  // ---------- configuracion ----------
  Sv.guardarCfg = function () {
    clearTimeout(Sv.tGuardar);
    Sv.tGuardar = setTimeout(() => { try { MD.Almacen.guardarConfigClave('tracker_cfg', Sv.cfg); } catch (e) {} }, 400);
    Trk.Audio.volumen = Sv.cfg.vol; Trk.Audio.duck = Sv.cfg.duck;
    Trk.Audio.precargar(Sv.cfg).catch(() => {});
    Trk.aplicarNombres(Sv.cfg.taller);
    avisar('cfg');
  };
  Sv.cargarCfg = async function () {
    try { Sv.cfg = Trk.cfgNormalizar(await MD.Almacen.leerConfigClave('tracker_cfg')); } catch (e) { Sv.cfg = Trk.cfgNueva(); }
    Trk.aplicarNombres(Sv.cfg.taller);
    Sv.cfgCargada = true;      // desde aca la configuracion del tracker viaja con "Sincronizar todo" (ver A.driveEscenas)
    Trk.Audio.volumen = Sv.cfg.vol; Trk.Audio.duck = Sv.cfg.duck;
    Trk.Audio.bibliotecaMeta = () => ((Sv.A && Sv.A.cfg && Sv.A.cfg.sonidos) || []);
  };

  // ---------- monitor serie ----------
  // dir: 'rx' (del Arduino) | 'tx' (a el) | 'info'. Los latidos (#) iguales seguidos se juntan en un solo renglon con contador (no inunda el monitor).
  Sv.anotar = function (dir, txt, extra) {
    const t = Date.now(), ult = Sv.log[Sv.log.length - 1];
    const k = txt[0] === '#' ? '#' : (txt[0] === '@' ? '@' : (txt[0] === '!' ? '!' : (dir === 'info' ? 'i' : 'o')));
    if (dir === 'rx' && k === '#' && ult && ult.txt === txt && ult.dir === 'rx') { ult.n++; ult.t = t; avisar('log'); return; }
    Sv.log.push(Object.assign({ n: 1, t, dir, txt, k, id: ++Sv.logN }, extra || {}));
    if (Sv.log.length > MAX_LOG) Sv.log.splice(0, Sv.log.length - MAX_LOG);
    avisar('log');
  };
  Sv.limpiarLog = function () { Sv.log.length = 0; avisar('log'); };

  // 2.0-dev14: baterias (el dummy tiene la del tracker, que llega por !BAT, y la del Macrodeck, que llega por la trama 'E'). Los datos viejos (2 min) se ignoran.
  Sv.bat = null; Sv.macBat = null;
  Sv.macBateria = function (d) { Sv.macBat = { pct: d.pct, mv: d.mv, baja: !!d.baja, t: Date.now() }; avisar('bat'); };
  Sv.textoBat = function () {
    const ahora = Date.now(), p = [];
    if (Sv.bat && Sv.bat.pct >= 0 && ahora - Sv.bat.t < 120000) p.push('tracker ' + Sv.bat.pct + ' %');
    if (Sv.macBat && Sv.macBat.pct >= 0 && ahora - Sv.macBat.t < 120000) p.push('Macrodeck ' + Sv.macBat.pct + ' %');
    return p.length ? ' · 🔋 ' + p.join(' · ') : '';
  };

  // ---------- lineas que llegan ----------
  Sv.linea = function (txt) {
    txt = String(txt).replace(/[\r\n]+/g, '').trim(); if (!txt) return;
    Sv.ultRx = Date.now(); Sv.rxN++;
    if (txt.indexOf('!BAT,') === 0) {                                              // 2.0-dev14: bateria del tracker: !BAT,<%>,<mV>,<mV del 100 %>,<mV del 0 %> (pct -1 = sin bateria)
      const f = txt.slice(1).split(',');
      Sv.bat = { pct: parseInt(f[1], 10), mv: parseInt(f[2], 10), full: parseInt(f[3], 10) || 0, empty: parseInt(f[4], 10) || 0, t: Date.now() };
      Sv.anotar('rx', txt, { nota: 'batería del tracker' }); avisar('bat'); return;
    }
    const x = Sv.espejo.linea(txt);
    if (!x) return;
    if (x.k === 'hola') {
      Sv.hola = x; Sv.anotar('rx', txt, { nota: 'Tracker v' + x.ver + (x.restaurado ? ' · retomó el combate guardado' : '') });
      if (x.restaurado) { Sv.stats.t0 = Sv.stats.t0 || Date.now(); avisar('aviso:Retomé el combate que estaba guardado en el Arduino'); }
      avisar('hola');
      if (Sv.firmwareNuevo()) { Sv.pushHecho = false; Sv.enviarLinea('CFG'); }          // 3.0: pregunta la configuracion para ponerla igual a la del Taller de colores
      return;
    }
    if (x.k === 'cfg') { Sv.anotar('rx', txt, { nota: 'configuración del tracker' }); Sv.cfgTracker = x; Sv.alConfigTracker(x); avisar('cfgTracker'); return; }
    if (x.k === 'snap') { Sv.anotar('rx', txt); avisar('snap'); return; }
    if (x.k === 'ev') { Sv.alEvento(x.id, x.a, txt); return; }
    Sv.anotar('rx', txt, { k: 'o' });
  };

  // un movimiento del tracker -> sonido + luz + estadisticas
  Sv.alEvento = function (id, a, txt) {
    const ev = Trk.EV[id], t = Trk.claseDe(id, a), ahora = Date.now();
    Trk.statsContar(Sv.stats, id, a, ahora);
    Sv.ultEvento = { id, a, t: ahora };
    if (Trk.Hist) Trk.Hist.alEvento(id, a, ahora);                                  // 2.0-dev13: combates guardados (estadisticas)
    if (Trk.Turno) Trk.Turno.alEvento(id, a);                                       // 2.0-dev13: lamparas que siguen el turno (opcional)
    if (!ev) { Sv.anotar('rx', txt, { nota: 'evento que esta app no conoce (¿firmware más nuevo?)' }); avisar('ev'); return; }
    const r = Trk.resolver(Sv.cfg, id, t), partes = [];
    if (r.s.length) { const ref = Trk.Audio.tocar(r.s, r.vol, id + (t || '')); if (ref) partes.push('▶ ' + Trk.Audio.nombreDe(ref)); else partes.push('▶ (sonido no disponible)'); }
    if (r.l && Sv.cfg.luces) { if (Trk.Luz.disparar(r.l)) partes.push('💡 ' + Trk.Luz.nombreLook(r.l.look)); else if (!Trk.Luz.disponible()) partes.push('💡 (luces apagadas)'); }
    Sv.anotar('rx', txt, { nota: ev.n + (t ? ' · ' + Trk.TIPOS[t].n : '') + (partes.length ? ' · ' + partes.join(' · ') : '') });
    avisar('ev');
  };

  // ---------- enviar ----------
  Sv.enviar = function (txt) {
    txt = String(txt); if (Sv.estado !== 'conectado') return false;
    Sv.anotar('tx', txt.replace(/[\r\n]+$/, ''));
    try {
      if (Sv.modo === 'sim') Sv.motor.entrada(txt);
      else if (Sv.modo === 'md') { if (!Sv.mdEnviar(txt)) return false; }
      else if (Sv.modo === 'usb') plugin().escribir({ texto: txt });
      else if (Sv.modo === 'web' && Sv.web && Sv.web.writer) Sv.web.writer.write(new TextEncoder().encode(txt)).catch(() => {});
    } catch (e) { Sv.anotar('info', 'No se pudo enviar: ' + ((e && e.message) || e)); return false; }
    return true;
  };

  // Una orden completa (con salto de linea): B,C,1 · COL,D,255,0,0 · CFG · ...  (el '?' suelto no lo necesita)
  Sv.enviarLinea = (txt) => Sv.enviar(String(txt).replace(/[\r\n]+/g, '') + '\n');
  // 3.0: el firmware nuevo (ESP32) entiende los botones por serie y las ordenes COL / HAB / BRI / CFG / DEF. El Uno (2.1) no.
  Sv.firmwareNuevo = () => Sv.modo === 'sim' || (!!Sv.hola && parseFloat(Sv.hola.ver) >= 3);
  Sv.puedeBoton = () => Sv.estado === 'conectado' && Sv.firmwareNuevo();
  // El joystick que sirve para TODOS los transportes: el simulador lo recibe directo; el tracker real, como la orden "B,<lado>,<0|1>"
  Sv.boton = (lado, abajo) => {
    if (Sv.modo === 'sim') { Sv.simBoton(lado, abajo); return true; }
    if (!Sv.puedeBoton()) return false;
    return Sv.enviarLinea('B,' + lado + ',' + (abajo ? 1 : 0));
  };

  // ---------- por el Macrodeck (radio ESP-NOW) ----------
  Sv.mdDisponible = () => !!(Sv.A && Sv.A.tr && Sv.A.tr.conectado);
  // el Macrodeck avisa ('N') que el tracker aparecio o se fue
  Sv.mdPresencia = function (p) {
    Sv.mdPres = !!p;
    if (Sv.modo === 'md' && Sv.deseado) {
      if (p && Sv.estado !== 'conectado') { Sv.rxN = 0; Sv.ultRx = Date.now(); poner('conectado', 'por el Macrodeck'); vigia(); setTimeout(() => { if (Sv.estado === 'conectado' && Sv.modo === 'md') Sv.enviar('?'); }, 300); }
      else if (!p && Sv.estado === 'conectado') poner('conectando', 'el tracker salió del alcance de la radio');
    } else if (p && Sv.cfg.auto && Sv.mdDisponible() && Sv.estado !== 'conectado' && Sv.estado !== 'conectando') {
      Sv.conectar('md');                                                       // el tracker se prendio: la app lo toma sola (si no hay otra cosa conectada)
    } else if (p && Sv.estado === 'conectado' && Sv.modo === 'sim') avisar('aviso:El tracker real está al alcance del Macrodeck. Para usarlo: Conexión > Por el Macrodeck.');
    avisar('estado');
  };
  // pedazos de una linea que mando el tracker ('L'): se juntan hasta el ultimo
  Sv.mdLinea = function (fin, txt) {
    Sv.mdRx += txt || '';
    if (Sv.mdRx.length > 200) Sv.mdRx = '';
    if (!fin) return;
    const l = Sv.mdRx; Sv.mdRx = '';
    if (Sv.modo === 'md' && l) Sv.linea(l);
  };
  // una linea para el tracker: la app se la pasa al Macrodeck en pedazos ('u') y el Macrodeck la manda por la radio
  Sv.mdEnviar = function (txt) {
    const A = Sv.A; if (!Sv.mdDisponible()) return false;
    const l = String(txt).replace(/[\r\n]+/g, ''); if (!l) return true;
    try { A.tr.sendVarias(MD.P.enc.lineaTracker(l)); return true; } catch (e) { Sv.anotar('info', 'No se pudo mandar por el Macrodeck: ' + ((e && e.message) || e)); return false; }
  };

  // ---------- configuracion del tracker (Taller de colores) ----------
  // Compara lo que dijo el tracker (!CFG) con el Taller de la app y manda solo lo que difiere. Se hace UNA vez por conexion (despues de 'hola').
  Sv.alConfigTracker = function (x) {
    if (!Sv.cfg.taller || Sv.pushHecho) return;
    Sv.pushHecho = true;
    Sv.aplicarTaller(x);
  };
  // Varias ordenes seguidas van de a una cada 80 ms: la radio y la cola del tracker son chicas y una rafaga se perderia.
  Sv.cola = []; Sv.tCola = 0;
  Sv.enviarLento = function (lineas) {
    Sv.cola.push.apply(Sv.cola, lineas);
    if (Sv.tCola) return;
    Sv.tCola = setInterval(() => {
      const l = Sv.cola.shift();
      if (l === undefined || Sv.estado !== 'conectado') { if (l === undefined || Sv.estado !== 'conectado') { Sv.cola.length = 0; clearInterval(Sv.tCola); Sv.tCola = 0; } return; }
      Sv.enviarLinea(l);
    }, 80);
  };
  // actual = lo que dijo el tracker (!CFG): solo se manda lo que difiere. Sin 'actual' se manda TODO. Devuelve cuantas ordenes quedaron en cola.
  Sv.aplicarTaller = function (actual) {
    const T = Sv.cfg.taller; if (!T || !Sv.firmwareNuevo() || Sv.estado !== 'conectado') return 0;
    const out = [];
    for (const k of Trk.LETRAS_TODAS) {
      const a = actual && actual.colores && actual.colores[k], w = T.col[k];
      if (!a || a[0] !== w[0] || a[1] !== w[1] || a[2] !== w[2]) out.push('COL,' + k + ',' + w.join(','));
    }
    if (!actual || actual.mascara !== T.mask) out.push('HAB,' + T.mask);
    if (!actual || actual.brillo !== T.brillo) out.push('BRI,' + T.brillo);
    for (const k of 'abcd') if (T.nom[k]) out.push('NOM,' + k + ',' + T.nom[k]);
    if (out.length) { Sv.enviarLento(out); Sv.enviarLento(['CFG']); }          // al final se vuelve a preguntar: el espejo pinta con los colores nuevos
    return out.length;
  };
  // nombres de los invitados con color: se ven en toda la app
  Trk.aplicarNombres = function (T) { for (const k of 'abcd') Trk.TIPOS[k].n = (T && T.nom && T.nom[k]) || ('Invitado ' + k.toUpperCase()); };

  // ---------- estado de la conexion ----------
  function poner(estado, detalle) {
    if (Sv.estado === estado && Sv.detalle === (detalle || '')) return;
    Sv.estado = estado; Sv.detalle = detalle || '';
    Sv.anotar('info', 'Conexión: ' + estado + (detalle ? ' · ' + detalle : ''));
    avisar('estado');
    Sv.vivo(estado === 'conectado' && Sv.modo === 'usb');
  }

  // Mantener la app despierta con el celu bloqueado mientras el Arduino esta conectado por USB (si no, Android congela el audio y la lectura del serial).
  // Usa el mismo servicio en primer plano que el Macrodeck; si el Macrodeck ya lo tiene prendido (A._svcOn), no lo toca, y al desconectar tampoco lo apaga.
  Sv._vivoPropio = false;
  Sv.vivo = function (si) {
    const N = MD.Nativo, A = Sv.A;
    if (!N || !N.servicio) return;
    try {
      if (si && !Sv._vivoPropio && !(A && A._svcOn)) {
        Sv._vivoPropio = true;
        N.servicio(true, '✔ Initiative Tracker conectado', 'Sonidos y luces listos', 'conectado');
        if (MD.Vivo) { Trk.Audio.asegurar(); MD.Vivo.activar(Trk.Audio.ctx); }
      } else if (!si && Sv._vivoPropio) {
        Sv._vivoPropio = false;
        if (!(A && A._svcOn)) { N.servicio(false); if (MD.Vivo) MD.Vivo.parar(); }
      }
    } catch (e) {}
  };
  Sv.sinSenal = () => Sv.estado === 'conectado' && Sv.modo !== 'sim' && Date.now() - Sv.ultRx > 8000;
  Sv.soporte = () => ({ usb: !!plugin(), web: typeof navigator !== 'undefined' && 'serial' in navigator, sim: true, md: Sv.mdDisponible() });

  // vigia: si no llega nada, pide un saludo ('?'); si el cable se corta, reintenta (si es el modo USB y esta pedido)
  function vigia() {
    clearInterval(Sv.tVigia);
    Sv.tVigia = setInterval(() => {
      if (Sv.estado === 'conectado' && Sv.modo !== 'sim') {
        const sin = Date.now() - Sv.ultRx;
        if (sin > 4000 && (Sv.rxN === 0 || sin < 60000) && Date.now() - (Sv._ultPing || 0) > 4000) { Sv._ultPing = Date.now(); Sv.enviar('?'); }
        avisar('vigia');
      }
    }, 1000);
  }

  // ---------- conectar ----------
  Sv.conectar = async function (modo) {
    Trk.Audio.asegurar();                                  // el toque del boton es el "permiso" que pide el navegador para el sonido
    modo = modo || Sv.modo || (Sv.soporte().usb ? 'usb' : (Sv.soporte().web ? 'web' : 'sim'));
    if (Sv.estado === 'conectado' || Sv.estado === 'conectando') await Sv.desconectar(true);
    Sv.modo = modo; Sv.deseado = true; Sv.rxN = 0; Sv.ultRx = Date.now(); Sv.hola = null;
    Sv.espejo.reiniciar(); Sv.stats = Trk.statsNueva();
    poner('conectando', modo === 'usb' ? 'buscando el Arduino por el cable USB…' : (modo === 'web' ? 'elegí el puerto en la ventana del navegador' : ''));
    try {
      if (modo === 'sim') iniciarSim();
      else if (modo === 'md') iniciarMd();
      else if (modo === 'usb') await iniciarUsb();
      else if (modo === 'web') await iniciarWeb();
      else throw new Error('modo desconocido');
      if (modo === 'md' && !Sv.mdPres) { poner('conectando', 'esperando al tracker (¿está prendido y cerca del Macrodeck?)'); return; }
      poner('conectado', modo === 'sim' ? 'simulador' : modo === 'md' ? 'por el Macrodeck' : (Sv.detalle !== 'buscando el Arduino por el cable USB…' && Sv.detalle !== 'elegí el puerto en la ventana del navegador' ? Sv.detalle : ''));
      vigia();
      if (modo !== 'sim') setTimeout(() => { if (Sv.rxN === 0 && Sv.estado === 'conectado') Sv.enviar('?'); }, 1800);    // el Uno se reinicia al abrir el puerto: se le pide el saludo por si ya arrancó
    } catch (e) {
      Sv.deseado = modo === 'usb' && !!Sv.cfg.auto;
      poner('error', (e && e.message) || String(e));
      if (modo === 'usb' && Sv.cfg.auto) programarReintento();
    }
  };
  Sv.desconectar = async function (interno) {
    if (!interno) Sv.deseado = false;
    clearTimeout(Sv.tReint);
    try {
      if (Sv.modo === 'sim') { clearInterval(Sv.tSim); Sv.motor = null; }
      else if (Sv.modo === 'usb') { const p = plugin(); if (p) await p.desconectar(); }
      else if (Sv.modo === 'web' && Sv.web) { try { Sv.web.activo = false; if (Sv.web.reader) await Sv.web.reader.cancel(); if (Sv.web.writer) Sv.web.writer.releaseLock(); if (Sv.web.port) await Sv.web.port.close(); } catch (e) {} Sv.web = null; }
    } catch (e) {}
    if (!interno) poner('desconectado', '');
  };
  // ----- por el Macrodeck -----
  function iniciarMd() {
    if (!Sv.mdDisponible()) throw new Error('Conectá el Macrodeck por Bluetooth primero (el tracker habla con la app a través de él)');
    Sv.mdRx = '';
    Sv.detalle = 'por el Macrodeck';
  }
  function programarReintento() {
    clearTimeout(Sv.tReint);
    if (!Sv.cfg.auto || Sv.modo !== 'usb') return;
    Sv.tReint = setTimeout(() => { if (Sv.estado !== 'conectado' && Sv.estado !== 'conectando') Sv.conectar('usb'); }, 3500);
  }

  // ----- usb (APK) -----
  let oyenteUsb = false;
  async function iniciarUsb() {
    const p = plugin(); if (!p) throw new Error('Esta versión de la app no trae el USB. Instalá la APK nueva.');
    if (!oyenteUsb) {
      oyenteUsb = true;
      p.addListener('linea', (d) => { if (Sv.modo === 'usb') Sv.linea(d && d.texto); });
      p.addListener('estado', (d) => {
        if (Sv.modo !== 'usb' || !d) return;
        if (d.estado === 'desconectado' && Sv.estado === 'conectado') { poner('desconectado', d.detalle || 'se cortó el cable'); if (Sv.deseado) programarReintento(); }
        else if (d.estado === 'enchufado' && Sv.cfg.auto && Sv.estado !== 'conectado' && Sv.estado !== 'conectando') Sv.conectar('usb');
      });
    }
    const r = await p.conectar({ baud: Sv.cfg.baud });
    Sv.detalle = (r && r.nombre) || 'Arduino';
  }
  // ----- Web Serial (escritorio) -----
  async function iniciarWeb() {
    if (!('serial' in navigator)) throw new Error('Este navegador no tiene Web Serial (usá Chrome o Edge en la compu)');
    const port = await navigator.serial.requestPort(); await port.open({ baudRate: Sv.cfg.baud });
    const w = Sv.web = { port, activo: true, reader: port.readable.getReader(), writer: port.writable.getWriter() };
    (async () => {
      const dec = new TextDecoder(); let resto = '';
      try {
        while (w.activo) {
          const { value, done } = await w.reader.read(); if (done) break;
          resto += dec.decode(value, { stream: true });
          let i; while ((i = resto.indexOf('\n')) >= 0) { const l = resto.slice(0, i); resto = resto.slice(i + 1); Sv.linea(l); }
          if (resto.length > 400) resto = '';                                   // basura sin fin de linea: se descarta
        }
      } catch (e) { /* el puerto se cerró */ }
      if (w.activo && Sv.modo === 'web') poner('desconectado', 'se cortó la conexión');
    })();
    Sv.detalle = 'puerto serie';
  }
  // ----- simulador -----
  function iniciarSim() {
    let guardado = null; try { guardado = JSON.parse(localStorage.getItem('trk_sim_guardado') || 'null'); } catch (e) {}
    const t0 = performance.now();
    let cfgSim = null; try { cfgSim = JSON.parse(localStorage.getItem('trk_sim_cfg') || 'null'); } catch (e) {}
    Sv.motor = new Trk.Motor({ invertir: true, version: '3.0', cfg: cfgSim, alCfg: (o) => { try { localStorage.setItem('trk_sim_cfg', JSON.stringify(o)); } catch (e) {} }, salida: (l) => Sv.linea(l), restaurar: guardado, alGuardar: (o) => { try { if (o) localStorage.setItem('trk_sim_guardado', JSON.stringify(o)); else localStorage.removeItem('trk_sim_guardado'); } catch (e) {} } });
    clearInterval(Sv.tSim);
    Sv.tSim = setInterval(() => { if (Sv.motor) Sv.motor.tick(Math.floor(performance.now() - t0)); }, 4);
  }
  // un toque tiene que durar al menos 50 ms para que el Arduino virtual lo vea (como un boton de verdad: nunca dura 1 ms)
  const pulso = {};
  Sv.simBoton = (lado, abajo) => {
    if (Sv.modo !== 'sim' || !Sv.motor) return;
    if (abajo) { pulso[lado] = performance.now(); clearTimeout(pulso[lado + 't']); Sv.motor.boton(lado, true); return; }
    const falta = 50 - (performance.now() - (pulso[lado] || 0));
    if (falta > 0) { clearTimeout(pulso[lado + 't']); pulso[lado + 't'] = setTimeout(() => { if (Sv.motor) Sv.motor.boton(lado, false); }, falta); } else Sv.motor.boton(lado, false);
  };
  Sv.simReiniciar = function () { try { localStorage.removeItem('trk_sim_guardado'); } catch (e) {} if (Sv.modo === 'sim') Sv.conectar('sim'); };

  // ---------- el espejo siempre al dia (aunque nadie mire la pestana) ----------
  setInterval(() => { if (Sv.estado === 'conectado') Sv.espejo.tick(); }, 30);

  // ---------- indicador de la cabecera ----------
  Sv.pill = function () {
    if (Sv.estado === 'conectado') return { clase: Sv.sinSenal() ? 'warn' : 'ok', texto: Sv.modo === 'sim' ? 'Tracker simulado' : (Sv.sinSenal() ? 'Tracker sin señal' : (Sv.modo === 'md' ? 'Tracker (Macrodeck)' : 'Tracker conectado')) };
    if (Sv.estado === 'conectando') return { clase: 'warn', texto: 'Tracker: conectando…' };
    if (Sv.estado === 'error') return { clase: 'mal', texto: 'Tracker: ' + Sv.detalle };
    return null;
  };

  // ---------- arranque (lo llama app.js) ----------
  Trk.iniciar = async function (A) {
    Sv.A = A; await Sv.cargarCfg();
    Trk.Audio.precargar(Sv.cfg).catch(() => {});
    // conexion automatica: en la APK, si ya habia un Arduino enchufado y permitido
    if (Sv.cfg.auto && plugin()) setTimeout(() => { if (Sv.estado === 'desconectado') { Sv.modo = 'usb'; plugin().listar().then((r) => { if (r && r.dispositivos && r.dispositivos.length && r.permitido) Sv.conectar('usb'); }).catch(() => {}); } }, 1200);
  };
})(window.MD);
