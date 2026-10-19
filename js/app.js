// app.js - El pegamento: conecta la configuracion, el motor de audio, el Macrodeck (Bluetooth o simulador) y las pantallas.
(function () {
  const MDg = window.MD, h = MDg.UI.h, P = MDg.P;
  const A = window.MDapp = {
    cfg: null, motor: new MDg.Motor(), tr: null, sim: null, simRaiz: document.createElement('div'),
    activa: 0, edEsc: 0, edTecla: null, tab: 'mesa', portapapeles: null,
    estadoAlmacen: '', estadoPack: '', infoAlmacen: '', mesaCeldas: [], ultLeds: '', ultFilas: ['', '', '', ''], regs: new Map(),
  };
  const vista = document.getElementById('vista'), tabsEl = document.getElementById('tabs');
  const estadoCab = document.getElementById('estadoCab'), estadoTxt = document.getElementById('estadoTxt');
  const TABS = [['mesa', 'Mesa', 'mesa'], ['escenas', 'Escenas', 'escenas'], ['sonidos', 'Sonidos', 'sonidos'], ['audios', 'Audios', 'audios'], ['drive', 'Drive', 'drive'], ['herramientas', 'Herramientas', 'herramientas']];

  // ---------- guardar ----------
  // v1.3-dev18: el guardado ya no es mudo. Cada cambio se guarda solo a los 0,4 s; ademas se guarda YA al ocultar la app, al cambiar de
  // pestana y con el boton Guardar; el estado (Guardando / Guardado a las HH:MM / error) se ve en los editores y, si falla, en la cabecera.
  let tGuardar = 0, tMapa = 0;
  A.sucio = false; A.guardadoHora = 0; A.errorGuardar = '';
  A.textoGuardado = function () {
    if (A.errorGuardar) return '⚠ No se pudo guardar: ' + A.errorGuardar;
    if (A.sucio) return 'Guardando…';
    if (!A.guardadoHora) return 'Todo guardado';
    const d = new Date(A.guardadoHora), p = (n) => String(n).padStart(2, '0');
    return 'Guardado ✓ ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };
  A.pintarGuardado = function () {
    const txt = A.textoGuardado();
    document.querySelectorAll('.js-guardado').forEach((e) => { e.textContent = txt; e.classList.toggle('mal', !!A.errorGuardar); });
    const cab = document.getElementById('guardadoCab'); if (cab) cab.hidden = !A.errorGuardar;
  };
  const guardarConfig = async () => {
    try {
      await MDg.Almacen.guardarConfig(A.cfg);
      A.sucio = false; A.guardadoHora = Date.now(); A.errorGuardar = '';
    } catch (e) {
      A.errorGuardar = (e && e.message) || String(e) || 'error desconocido';
      if (MDg.Diag) MDg.Diag.anotar('no se pudo guardar la configuracion: ' + A.errorGuardar);
      A.pintarGuardado(); throw e;
    }
    A.pintarGuardado();
  };
  A.cambio = function (mapa) {
    A.motor.registrar(A.cfg.sonidos); A.motor.fijarTope(A.cfg.ajustes.volMax);
    A.sucio = true; A.pintarGuardado();
    clearTimeout(tGuardar); tGuardar = setTimeout(() => guardarConfig().catch(() => {}), 400);
    if (mapa) { clearTimeout(tMapa); tMapa = setTimeout(() => { A.enviarEscenas(); A.enviarMapa(); }, 500); }
  };
  A.guardarYa = async () => { clearTimeout(tGuardar); await guardarConfig(); };
  // Boton "Guardar": guarda ya y, si se pide (mapa), manda ya al Macrodeck las escenas y las teclas de la escena activa.
  A.guardarBoton = async (mapa) => {
    await A.guardarYa();
    if (mapa) { clearTimeout(tMapa); A.enviarEscenas(); A.enviarMapa(); }
  };
  // Al ocultar la app (cambiar de app, apagar la pantalla, cerrarla) NO se espera los 0,4 s: en el APK 'beforeunload' no avisa.
  const volcar = () => { if (A.sucio) { clearTimeout(tGuardar); guardarConfig().catch(() => {}); } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') volcar(); });
  window.addEventListener('pagehide', volcar);
  window.addEventListener('blur', volcar);

  // ---------- Macrodeck: enviar ----------
  const conectado = () => A.tr && A.tr.conectado;
  A.enviarEscenas = function () { if (conectado()) A.tr.sendVarias(P.tramasEscenas(A.cfg.escenas.map(e => e.nombre), A.activa)); };
  A.enviarMapa = function () {
    if (!conectado()) return;
    const esc = A.cfg.escenas[A.activa]; if (!esc) return;
    const teclas = esc.teclas.map(t => t ? Object.assign({}, t, { icono: MDg.Iconos.deHex(t.icono) }) : null);
    A.tr.sendVarias(P.tramasMapa(teclas));
  };
  A.enviarTodo = function () {
    if (!conectado()) return;
    A.ultLeds = ''; A.ultFilas = ['', '', '', ''];
    A.enviarEscenas(); A.enviarMapa(); A.actualizarEstado(true);
    if (MDg.Celu) MDg.Celu.reiniciar();
  };

  // ---------- escenas ----------
  A.activar = function (i) {
    if (!A.cfg.escenas[i]) return;
    A.activa = i;
    A.motor.fijarTeclas(A.cfg.escenas[i].teclas);
    A.motor.precargar(A.cfg.escenas[i].teclas).catch(() => {});
    if (conectado()) { A.tr.send(P.enc.escenaActual(i)); A.enviarMapa(); A.ultFilas = ['', '', '', '']; }
    A.actualizarEstado(true);
    if (A.tab === 'mesa') A.render();
  };
  A.activarSinSonido = function () { A.motor.teclas = (A.cfg.escenas[A.activa] || A.cfg.escenas[0]).teclas; };

  // ---------- audio ----------
  A.audioPrimero = async function () {
    try { await A.motor.iniciar(); } catch (e) {}
    document.getElementById('audioGate').hidden = true;
    pintarPills();
  };
  document.getElementById('gateBtn').addEventListener('click', () => A.audioPrimero());
  // v1.3-dev13: el estado va en la cabecera como PUNTITOS (verde = bien, amarillo = en camino / silenciado, rojo = sin conexion, gris = apagado)
  // sobre un icono: parlante (audio), Bluetooth (Macrodeck) y la bateria de ESTE celu con su porcentaje. Tocar el grupo muestra el detalle escrito.
  const mkInd = (id, punto) => { const e = h('span', { class: 'ind', id }, punto ? h('i', { class: 'pt' }) : null); estadoCab.append(e); return e; };
  const indAudio = mkInd('indAudio', true), indCon = mkInd('indCon', true), indBat = mkInd('indBat', false);
  indBat.hidden = true;
  const pctBat = h('span', { class: 'pct' }); indBat.append(pctBat);
  function ponerInd(e, clase, icono) {
    if (e._ic !== icono) { const v = e.querySelector('svg'); if (v) v.remove(); e.prepend(MDg.IUI.svg(icono)); e._ic = icono; }
    if (e._cl !== clase) { e.className = 'ind ' + clase; e._cl = clase; }
  }
  let tTxt = 0;
  estadoCab.addEventListener('click', () => {
    estadoTxt.hidden = !estadoTxt.hidden; clearTimeout(tTxt);
    if (!estadoTxt.hidden) { estadoTxt.textContent = A.estadoTexto || ''; tTxt = setTimeout(() => { estadoTxt.hidden = true; }, 6000); }
  });
  try { if (navigator.getBattery) navigator.getBattery().then((b) => { A.bat = b; ['levelchange', 'chargingchange'].forEach(ev => b.addEventListener(ev, pintarPills)); pintarPills(); }).catch(() => {}); } catch (e) {}
  function pintarPills() {
    const run = A.motor.ctx && A.motor.ctx.state === 'running';
    ponerInd(indAudio, run ? (A.motor.silenciado ? 'warn' : 'ok') : 'off', run && !A.motor.silenciado ? 'audio' : 'audioOff');
    const c = conectado(), buscando = !c && A.tr && A.tr.estado && A.tr.estado !== 'desconectado';
    ponerInd(indCon, c ? 'ok' : (buscando ? 'warn' : 'mal'), c || buscando ? 'bt' : 'btOff');
    const tAudio = run ? (A.motor.silenciado ? 'Audio silenciado' : 'Audio listo') : 'Audio apagado (toca la pantalla para activarlo)';
    const tCon = c ? (A.tr.tipo === 'sim' ? 'Simulador conectado' : 'Macrodeck conectado') : (buscando ? 'Macrodeck: ' + A.tr.estado + '…' : 'Sin Macrodeck');
    let tBat = '';
    if (A.bat) {
      const pct = Math.round(A.bat.level * 100), carga = !!A.bat.charging, bajo = pct <= 20 && !carga;
      ponerInd(indBat, 'bat' + (bajo ? ' bajo' : ''), carga ? 'bateriaCarga' : (bajo ? 'bateriaBaja' : 'bateria'));
      if (pctBat.textContent !== pct + '%') pctBat.textContent = pct + '%';
      indBat.hidden = false; tBat = 'Bateria de este celu ' + pct + '%' + (carga ? ' (cargando)' : '');
    }
    A.estadoTexto = [tAudio, tCon, tBat].filter(Boolean).join(' · ');
    if (estadoCab.title !== A.estadoTexto) { estadoCab.title = A.estadoTexto; if (!estadoTxt.hidden) estadoTxt.textContent = A.estadoTexto; }
  }
  // ---------- escuchar un sonido (con pausa, barra y parar) ----------
  // Pasa por el MISMO camino que la Mesa (volumen del sonido x volumen general), asi se oye igual.
  const mini = document.getElementById('miniPlayer');
  const miniNombre = h('strong', { class: 'mini-nombre' }), miniTiempo = h('small', null, ''),
        miniBarra = h('input', { type: 'range', min: 0, max: 1000, value: 0, style: 'flex:1' }),
        miniPausa = h('button', { type: 'button', title: 'Pausa / seguir' }, '⏸'), miniParar = h('button', { type: 'button', title: 'Detener' }, '■');
  mini.append(h('div', { class: 'mini-fila' }, miniNombre, miniTiempo), h('div', { class: 'mini-fila' }, miniPausa, miniBarra, miniParar));
  let prev = null;
  const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  function pintarMini() {
    if (!prev) return;
    const el = prev.el, d = isFinite(el.duration) ? el.duration : 0;
    miniTiempo.textContent = mmss(el.currentTime) + (d ? ' / ' + mmss(d) : '');
    if (d && document.activeElement !== miniBarra) miniBarra.value = Math.round(el.currentTime / d * 1000);
    miniPausa.textContent = el.paused ? '▶' : '⏸';
  }
  miniPausa.addEventListener('click', () => { if (!prev) return; if (prev.el.paused) prev.el.play().catch(() => {}); else prev.el.pause(); pintarMini(); });
  miniParar.addEventListener('click', () => A.detenerPrevia());
  miniBarra.addEventListener('input', () => { if (prev && isFinite(prev.el.duration)) prev.el.currentTime = miniBarra.value / 1000 * prev.el.duration; });
  A.detenerPrevia = function () {
    if (!prev) { mini.hidden = true; return; }
    const p = prev; prev = null;
    try { p.el.pause(); } catch (e) {}
    try { p.fuente.disconnect(); p.g.disconnect(); } catch (e) {}
    URL.revokeObjectURL(p.url); mini.hidden = true;
  };
  A.previa = async function (id) {
    await A.audioPrimero();
    if (prev && prev.id === id) { A.detenerPrevia(); return; }          // el mismo boton otra vez: parar
    A.detenerPrevia();
    const reg = A.regs.get(id) || A.motor.regs.get(id); if (!reg) return;
    const m = A.motor; await m.iniciar();
    const url = URL.createObjectURL(reg.blob), el = new Audio(url);
    const fuente = m.ctx.createMediaElementSource(el), g = m.ctx.createGain(), meta = m.sonidos.get(id);
    g.gain.value = meta ? meta.volumen : 1;
    fuente.connect(g); g.connect(m.master);
    prev = { id, el, url, fuente, g };
    miniNombre.textContent = (meta && meta.nombre) || reg.nombre || 'Sonido';
    miniBarra.value = 0; miniTiempo.textContent = ''; mini.hidden = false;
    el.addEventListener('timeupdate', pintarMini); el.addEventListener('play', pintarMini); el.addEventListener('pause', pintarMini);
    el.addEventListener('ended', () => { if (prev && prev.el === el) A.detenerPrevia(); });
    el.play().catch(() => { if (prev && prev.el === el) A.detenerPrevia(); });
    pintarMini();
  };

  // ---------- tramas que llegan ----------
  A.alTrama = function (f) {
    const d = P.dec(f); if (!d) return;
    switch (d.t) {
      case 'tecla':
        if (MD.Diag) MD.Diag.anotar('tecla ' + d.i + (d.abajo ? ' abajo' : ' arriba') + ' (audio ' + (A.motor.ctx ? A.motor.ctx.state : 'sin iniciar') + ')');
        if (!A.motor.ctx || A.motor.ctx.state !== 'running') { A.motor.iniciar().then(() => { if (A.motor.ctx.state !== 'running') document.getElementById('audioGate').hidden = false; pintarPills(); }); }
        A.motor.tecla(d.i, d.abajo); break;
      case 'perilla': A.motor.fijarVolumen(d.v / 255); if (A.mesaVol && document.activeElement !== A.mesaVol) A.mesaVol.value = d.v; break;
      case 'escena': A.activar(d.i); break;
      case 'hola': if (conectado()) A.tr.send(P.enc.hola()); break;
      case 'reenviar': A.enviarTodo(); break;
      case 'volCelu': if (MDg.Celu) MDg.Celu.volumen(d.v); break;     // v1.3-dev14: la perilla del Macrodeck (modo CEL) pide ese volumen de Android
    }
  };
  // v1.3 ducking: el motor avisa cuando empieza/termina; en el APK, MD.Nativo.duck(on) le pide a Android bajar la musica de otras apps.
  A.motor.onDuck = (on) => { A.duckActivo = on; if (MD.Diag) MD.Diag.anotar('ducking ' + (on ? 'ON' : 'OFF')); try { if (MD.Nativo && MD.Nativo.duck) MD.Nativo.duck(on); } catch (e) {} if (A.mesaDuck) A.mesaDuck.hidden = !on; };
  // v1.3-dev8: modo del ducking (Agil / Normal / Suave). Se guarda en ESTE celu (no viaja en packs ni en Drive).
  A.duckModo = 'normal';
  try { const m = localStorage.getItem('md_duck_modo'); if (MDg.DUCK_MODOS[m]) A.duckModo = m; } catch (e) {}
  A.motor.fijarDuckModo(A.duckModo);
  A.fijarDuckModo = function (m) { if (!MDg.DUCK_MODOS[m]) return; A.duckModo = m; A.motor.fijarDuckModo(m); try { localStorage.setItem('md_duck_modo', m); } catch (e) {} A.render(); };
  // v1.3-dev8: boton "Parar todo" de la notificacion del APK (corta todo ya, sin esperar fundidos largos)
  if (MDg.Nativo && MDg.Nativo.alParar) MDg.Nativo.alParar(() => { if (MDg.Diag) MDg.Diag.anotar('Parar todo (desde la notificacion)'); A.motor.pararTodo(); });
  // v1.3-dev8: al volver de la pantalla de Android del ahorro de bateria, se actualiza el aviso de Mesa
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && A._bateriaPoner && MDg.Nativo) MDg.Nativo.bateria().then(b => { if (A._bateriaPoner) A._bateriaPoner(!!(b && b.exento)); }); });

  // ---------- estado vivo (LEDs, OLED, pantalla Mesa) ----------
  A.actualizarEstado = function (forzar) {
    const m = A.motor;
    const leds = m.ledsEstado(), clave = leds.join('');
    if (conectado() && (forzar || clave !== A.ultLeds)) { A.tr.send(P.enc.leds(leds)); }
    A.ultLeds = clave;
    const sonando = m.sonando();
    const esc = A.cfg.escenas[A.activa];
    const avN = m.avisoNivel && performance.now() < m.avisoNivel.hasta ? m.avisoNivel : null;     // 1.3-dev20: aviso de la tecla Intensidad (2,5 s)
    const filas = [esc ? esc.nombre : '', sonando[0] || '', sonando[1] || (sonando.length > 2 ? '+' + (sonando.length - 1) : ''), avN ? (avN.n ? 'INT ' + avN.n + '/5' : 'SIN LOOP') : (m.silenciado ? 'SILENCIO' : (sonando.length ? sonando.length + ' sonando' : ''))];
    filas.forEach((t, k) => { const x = P.ascii(t).slice(0, 10); if (conectado() && (forzar || x !== A.ultFilas[k])) A.tr.send(P.enc.oled(k, x)); A.ultFilas[k] = x; });
    if (A.tab === 'mesa' && A.mesaCeldas.length) {
      A.mesaCeldas.forEach((c, i) => { if (c.dataset.led !== String(leds[i])) c.dataset.led = String(leds[i]); });
      if (A.mesaSonando) A.mesaSonando.textContent = (avN ? avN.texto + (sonando.length ? ' — ' : '') : '') + (sonando.length ? 'Sonando: ' + sonando.join(' · ') : (m.silenciado ? 'Silenciado' : ''));
    }
    pintarPills();
  };
  setInterval(() => A.actualizarEstado(false), 150);

  // ---------- conexion ----------
  function nuevoTransporte(tr) {
    if (A.tr) { try { A.tr.desconectar(); } catch (e) {} }
    A.tr = tr;
    tr.onFrame = (f) => A.alTrama(f);
    tr.onEstado = () => { if (MDg.Diag) MDg.Diag.anotar('bluetooth ' + tr.estado); pintarPills(); if (tr.estado === 'conectado') A.mantenerVivo(true); if (A.tab === 'mesa') A.render(); };
    tr.onConectado = () => { A.ultLeds = ''; A.ultFilas = ['', '', '', '']; A.motor.fijarTope(A.cfg.ajustes.volMax); };
  }
  A.conectarBle = async function () {
    await A.audioPrimero();
    // dentro del APK se usa el Bluetooth nativo; en el navegador, Web Bluetooth
    nuevoTransporte(MDg.NativoBleTransport.disponible() ? new MDg.NativoBleTransport() : new MDg.BleTransport());
    try { await A.tr.conectar(); } catch (e) { if (A.tab === 'mesa') A.render(); }
  };
  A.usarSimulador = async function () {
    await A.audioPrimero();
    if (A.sim) A.sim.destruir();
    A.simRaiz.innerHTML = '';
    A.sim = new MDg.Simulador(A.simRaiz);
    nuevoTransporte(A.sim);
    await A.sim.conectar();
    A.render();
  };
  A.cortar = function () { if (A.tr) A.tr.desconectar(); A.mantenerVivo(false); A.render(); };

  // ---------- mantener vivo (celu en el bolsillo) ----------
  let silencioEl = null, wake = null;
  function wavSilencio() {
    const n = 8000, b = new ArrayBuffer(44 + n * 2), v = new DataView(b); const s = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
  }
  A.mantenerVivo = async function (si) {
    try {
      // En el APK lo hace el servicio en primer plano de Android (notificacion + wake lock). NO se usa el audio silencioso
      // del navegador: un <audio> en el WebView podria pedirle el foco de audio a Android y pausar YouTube.
      if (MDg.Nativo && MDg.Nativo.servicio) {
        await MDg.Nativo.servicio(!!si, 'Macrodeck conectado', A.cfg && A.cfg.nombre ? A.cfg.nombre : '');
        if (MDg.Vivo) {   // que Chromium no congele la pagina con el celu bloqueado (ver js/vivo.js)
          if (si) { try { await A.motor.iniciar(); } catch (e) {} MDg.Vivo.activar(A.motor.ctx); } else MDg.Vivo.parar();
        }
        if (si) {   // la primera vez que se conecta, pedirle a Android que no duerma la app (ahorro de bateria)
          try {
            const b = await MDg.Nativo.bateria(); let visto = false;
            try { visto = localStorage.getItem('md_bateria_pedida') === '1'; } catch (e) {}
            if (b && !b.exento && !visto) { try { localStorage.setItem('md_bateria_pedida', '1'); } catch (e) {} MDg.Nativo.pedirExencionBateria(); }
          } catch (e) {}
        }
        return;
      }
      if (si) {
        if (!silencioEl) { silencioEl = new Audio(wavSilencio()); silencioEl.loop = true; silencioEl.volume = 0.01; }
        await silencioEl.play().catch(() => {});
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({ title: 'Macrodeck D&D', artist: A.cfg.nombre || 'Campana' });
          navigator.mediaSession.playbackState = 'playing';
        }
        if (navigator.wakeLock && !wake) wake = await navigator.wakeLock.request('screen').catch(() => null);
      } else {
        if (silencioEl) silencioEl.pause();
        if (wake) { wake.release().catch(() => {}); wake = null; }
      }
    } catch (e) {}
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && conectado() && !wake && navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wake = w; w.onrelease = () => { wake = null; }; }).catch(() => {}); });

  // ---------- sonidos ----------
  function duracionDe(file) {
    return new Promise(ok => { const a = new Audio(), u = URL.createObjectURL(file); a.preload = 'metadata'; a.onloadedmetadata = () => { ok(isFinite(a.duration) ? Math.round(a.duration * 10) / 10 : 0); URL.revokeObjectURL(u); }; a.onerror = () => { ok(0); URL.revokeObjectURL(u); }; a.src = u; });
  }
  A.importarSonidos = async function (files) {
    let n = 0;
    for (const f of files) {
      if (!/^audio\//.test(f.type) && !/\.(mp3|wav|ogg|m4a|flac|opus|aac|webm)$/i.test(f.name)) continue;
      const id = MDg.Config.nuevoId('s'), reg = { blob: f, nombre: f.name, tipo: f.type || 'audio/mpeg' };
      await MDg.Almacen.guardarSonido(id, reg);
      A.regs.set(id, reg); await A.motor.fijarArchivo(id, reg);
      A.cfg.sonidos.push({ id, nombre: f.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 60), volumen: 1, duracion: await duracionDe(f), archivoOriginal: f.name });
      n++;
    }
    A.estadoAlmacen = n + ' sonido(s) importado(s).';
    A.cambio(false); await A.guardarYa(); await A.infoStorage(); A.render();
  };
  A.usosDeSonido = function (id) {
    let n = 0;
    for (const e of A.cfg.escenas) for (const t of e.teclas) if (t && t.sonidos.includes(id)) n++;
    return n;
  };
  A.borrarSonido = async function (id) {
    A.cfg.sonidos = A.cfg.sonidos.filter(s => s.id !== id);
    for (const e of A.cfg.escenas) for (const t of e.teclas) if (t) { t.sonidos = t.sonidos.filter(x => x !== id); }
    A.regs.delete(id); A.motor.olvidarArchivo(id); await MDg.Almacen.borrarSonido(id);
    A.cambio(true); await A.guardarYa(); await A.infoStorage(); A.render();
  };

  // ---------- Drive (sonidos y escenas) ----------
  A.driveLista = null; A.driveCategorias = []; A.driveCarpeta = ''; A.driveError = ''; A.driveMsg = ''; A.driveCargando = false; A.driveBajando = {}; A.driveBajandoTodo = '';
  A.driveActualizar = async function () {
    A.driveCargando = true; A.driveError = ''; A.driveMsg = ''; if (A.tab === 'drive') A.render();
    try {
      const p = await MDg.Drive.ping(); A.driveCarpeta = p.carpeta;
      const j = await MDg.Drive.listar();
      A.driveLista = j.sonidos; A.driveCategorias = j.categorias;
      A.drivePend = j.sonidos.filter(x => MDg.DriveUI.estadoDe(A, x) !== 'ok').length;
    } catch (e) { A.driveError = e.message; A.driveLista = null; }
    A.driveCargando = false;
    if (A.tab === 'drive') A.render();
    else A.pintarTabs();
  };
  // Baja un sonido de Drive y lo deja en la biblioteca de este celu (el id es el mismo de Drive: sirve en todos los celus)
  A.driveBajar = async function (s) {
    if (A.driveBajando[s.id] != null) return;
    A.driveBajando[s.id] = 0; if (A.tab === 'drive') A.render();
    try {
      const blob = await MDg.Drive.bajar(s.id, (q) => { A.driveBajando[s.id] = q; });
      const reg = { blob, nombre: s.nombre, tipo: blob.type || s.mime || 'audio/mpeg' };
      await MDg.Almacen.guardarSonido(s.id, reg);
      A.regs.set(s.id, reg); await A.motor.fijarArchivo(s.id, reg);
      const dur = await duracionDe(blob), nombre = s.nombre.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').trim().slice(0, 60);
      const ya = A.cfg.sonidos.find(x => x.id === s.id);
      if (ya) { ya.duracion = dur; ya.driveMod = s.mod; ya.carpeta = s.carpeta; }
      else A.cfg.sonidos.push({ id: s.id, nombre, volumen: 1, duracion: dur, archivoOriginal: s.nombre, carpeta: s.carpeta, driveMod: s.mod });
      A.cambio(false); await A.guardarYa(); await A.infoStorage();
    } catch (e) { A.driveMsg = 'No se pudo bajar "' + s.nombre + '": ' + e.message; }
    delete A.driveBajando[s.id]; if (A.tab === 'drive') A.render();
  };
  // Sube sonidos de este celu a Drive (los demas los ven como "nuevos"). Tambien quedan en la biblioteca de este celu con el mismo id.
  A.driveSubiendo = ''; A.driveSubidaMsg = '';
  A.driveSubir = async function (archivos, carpeta) {
    const lista = Array.from(archivos || []); if (!lista.length || A.driveSubiendo) return;
    const ok = [], mal = [];
    for (let i = 0; i < lista.length; i++) {
      const f = lista[i];
      A.driveSubiendo = 'Subiendo ' + (i + 1) + ' de ' + lista.length + ': ' + f.name; if (A.tab === 'drive') A.render();
      try {
        const r = await MDg.Drive.subir(f, carpeta);
        const reg = { blob: f, nombre: r.nombre, tipo: f.type || 'audio/mpeg' };
        await MDg.Almacen.guardarSonido(r.id, reg); A.regs.set(r.id, reg); await A.motor.fijarArchivo(r.id, reg);
        A.cfg.sonidos.push({ id: r.id, nombre: r.nombre.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').trim().slice(0, 60), volumen: 1, duracion: await duracionDe(f), archivoOriginal: r.nombre, carpeta: r.carpeta, driveMod: Date.now() + 120000 });
        ok.push(r.nombre);
      } catch (e) { mal.push(f.name + ': ' + e.message); }
    }
    A.driveSubiendo = ''; A.cambio(false); await A.guardarYa(); await A.infoStorage();
    A.driveSubidaMsg = (ok.length ? ok.length + ' sonido(s) subidos a Drive. ' : '') + (mal.length ? 'No se pudo: ' + mal.join(' | ') : '');
    await A.driveActualizar();
  };

  // Escenas compartidas: junta las de este celu con las de Drive (ver drive_escenas.js).
  A.escCargando = false; A.escMsg = ''; A.escConflictos = []; A.escElec = {};
  A.driveEscenas = async function () {
    if (A.escCargando) return;
    A.escCargando = true; A.escMsg = ''; A.render();
    try {
      // 1.3-dev21: Frodo (el DM) ve y arma TODO, con las escenas nuevas en "borrador". Tom solo recibe las "confirmadas" (los borradores quedan ocultos, solo se cuenta cuantos hay).
      const dm = MDg.Drive.esDM();
      for (let intento = 0; intento < 3; intento++) {
        const r = await MDg.Drive.escenasLeer();
        const remotoTodo = (r.config && r.config.escenas) || [], remotoLooks = (r.config && r.config.looks) || [], base = MDg.Drive.baseEscenas();
        const ocultas = dm ? [] : remotoTodo.filter(e => e && e.estado === 'borrador');
        const remoto = dm ? remotoTodo : remotoTodo.filter(e => !(e && e.estado === 'borrador'));
        const f = MDg.DriveEsc.fusionar(base && base.escenas, A.cfg.escenas, remoto, A.escElec);
        if (f.conflictos.length) {
          A.escConflictos = f.conflictos.map(id => ({ id, mia: A.cfg.escenas.find(e => e.id === id), drive: remoto.find(e => e.id === id) }));
          A.escMsg = 'La escena ' + f.conflictos.map(id => '"' + ((A.cfg.escenas.find(e => e.id === id) || {}).nombre || id) + '"').join(', ') + ' se cambio en los dos lados. Elegi con cual quedarte.';
          break;
        }
        A.escConflictos = [];
        // Los looks de luces viajan con las escenas. Si dos celus cambiaron el mismo look, gana el de Frodo (el DM).
        const fl = MDg.DriveEsc.fusionar(base && base.looks, A.cfg.looks || [], remotoLooks, () => (dm ? 'mia' : 'drive'), 200);
        const nuevas = MDg.Config.normalizar({ escenas: f.escenas }).escenas;
        const nuevosLooks = MDg.Config.normalizar({ looks: fl.escenas }).looks;
        const cambioLocal = MDg.DriveEsc.estable(nuevas) !== MDg.DriveEsc.estable(A.cfg.escenas);
        const cambioLooks = MDg.DriveEsc.estable(nuevosLooks) !== MDg.DriveEsc.estable(A.cfg.looks || []);
        if (cambioLocal || cambioLooks) {
          if (cambioLocal) { A.cfg.escenas = nuevas; A.activa = Math.min(A.activa, nuevas.length - 1); A.edEsc = Math.min(A.edEsc, nuevas.length - 1); A.edTecla = null; }
          if (cambioLooks) A.cfg.looks = nuevosLooks;
          A.cambio(true); await A.guardarYa();
        }
        let version = r.version;
        if (!f.igual || !fl.igual) {
          // lo que Tom no ve (los borradores de Frodo) se conserva tal cual en Drive, en su mismo lugar
          const salida = nuevas.slice();
          ocultas.forEach(o => salida.splice(Math.min(remotoTodo.indexOf(o), salida.length), 0, o));
          const g = await MDg.Drive.escenasGuardar(r.version, { escenas: salida, looks: nuevosLooks });
          if (g.conflicto) continue;                                   // alguien guardo justo en el medio: se vuelve a juntar
          version = g.version;
        }
        MDg.Drive.fijarBaseEscenas(version, nuevas, nuevosLooks); A.escElec = {};
        A.escEnPrep = ocultas.length;
        const faltan = new Set(); nuevas.forEach(e => e.teclas.forEach(t => t && t.sonidos.forEach(id => { if (!A.regs.has(id)) faltan.add(id); })));
        const x = f.resumen;
        A.escMsg = 'Escenas sincronizadas (' + (x.traidas ? x.traidas + ' traida(s) de Drive' : 'nada nuevo en Drive') + ', ' + (x.subidas ? x.subidas + ' subida(s)' : 'nada para subir') + (x.borradas ? ', ' + x.borradas + ' borrada(s)' : '') + ').'
          + (ocultas.length ? ' Hay ' + ocultas.length + ' escena(s) en preparacion.' : '')
          + (faltan.size ? ' Ojo: faltan ' + faltan.size + ' sonido(s) en este celu; usa "Bajar lo nuevo".' : '');
        break;
      }
    } catch (e) { A.escMsg = 'No se pudo sincronizar: ' + e.message; }
    A.escCargando = false; A.render();
  };
  A.driveElegir = function (id, quien) { A.escElec[id] = quien; A.driveEscenas(); };

  A.driveBajarTodo = async function (lista) {
    A.driveMsg = '';
    for (let i = 0; i < lista.length; i++) { A.driveBajandoTodo = (i + 1) + ' / ' + lista.length; if (A.tab === 'drive') A.render(); await A.driveBajar(lista[i]); }
    A.driveBajandoTodo = ''; if (!A.driveMsg) A.driveMsg = 'Listo: ' + lista.length + ' sonido(s) bajados a este celu.'; if (A.tab === 'drive') A.render();
  };

  // ---------- packs ----------
  function descargar(blob, nombre) {
    const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = nombre; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
  A.exportarPack = async function () {
    A.estadoPack = 'Armando el pack…'; A.render();
    try {
      await A.guardarYa();
      const blob = await MDg.Almacen.exportarPack(A.cfg);
      descargar(blob, (A.cfg.nombre || 'campana').replace(/[^\w\-]+/g, '_') + '.zip');
      A.estadoPack = 'Pack listo (' + (blob.size / 1048576).toFixed(1) + ' MB). Buscalo en Descargas.';
    } catch (e) { A.estadoPack = 'No se pudo armar el pack: ' + e.message; }
    A.render();
  };
  A.importarPack = async function (file) {
    A.estadoPack = 'Leyendo el pack…'; A.render();
    try {
      const pack = await MDg.Almacen.leerPack(file);
      pack.config = MDg.Config.normalizar(pack.config);
      await MDg.Almacen.instalarPack(pack, true);
      await A.recargar();
      A.estadoPack = 'Pack "' + A.cfg.nombre + '" importado: ' + A.cfg.escenas.length + ' escena(s), ' + A.cfg.sonidos.length + ' sonido(s).';
    } catch (e) { A.estadoPack = 'No se pudo importar: ' + e.message; }
    A.render();
  };
  A.cargarDemo = async function () {
    await A.audioPrimero();
    const d = MDg.Demo.crear();
    const vacia = A.cfg.escenas.length === 1 && A.cfg.escenas[0].teclas.every(t => !t);   // la escena inicial sin usar se reemplaza
    if (10 - (vacia ? 0 : A.cfg.escenas.length) < 2) { A.estadoPack = 'No hay lugar para 2 escenas de prueba (el maximo es 10). Borra alguna escena primero.'; A.render(); return; }
    if (vacia) A.cfg.escenas = [];
    for (const s of d.sonidos) {
      if (A.regs.has(s.id)) continue;
      const reg = { blob: s.blob, nombre: s.nombre, tipo: s.tipo };
      await MDg.Almacen.guardarSonido(s.id, reg); A.regs.set(s.id, reg); await A.motor.fijarArchivo(s.id, reg);
    }
    d.config.sonidos.forEach(m => { if (!A.cfg.sonidos.some(x => x.id === m.id)) A.cfg.sonidos.push(m); });
    d.config.escenas.forEach(e => { if (!A.cfg.escenas.some(x => x.id === e.id)) A.cfg.escenas.push(e); });
    A.cambio(true); await A.guardarYa(); await A.infoStorage();
    A.activar(Math.min(A.activa, A.cfg.escenas.length - 1));
    A.estadoPack = 'Contenido de prueba agregado.'; A.tab = 'mesa'; A.render();
  };
  // El contenido de prueba se reconoce por el nombre interno: sonidos "demo_..." y escenas "demo_e...".
  A.demoCuenta = function () { return { sonidos: A.cfg.sonidos.filter(s => /^demo_/.test(s.id)).length, escenas: A.cfg.escenas.filter(e => /^demo_e/.test(e.id)).length }; };
  A.borrarDemo = async function () {
    const ids = A.cfg.sonidos.filter(s => /^demo_/.test(s.id)).map(s => s.id), n = A.demoCuenta();
    A.detenerPrevia();
    A.cfg.escenas = A.cfg.escenas.filter(e => !/^demo_e/.test(e.id));
    if (!A.cfg.escenas.length) A.cfg.escenas.push(MDg.Config.escenaNueva('Escena 1'));
    for (const id of ids) {
      for (const e of A.cfg.escenas) for (const t of e.teclas) if (t) { t.sonidos = t.sonidos.filter(x => x !== id); }
      A.regs.delete(id); A.motor.olvidarArchivo(id); await MDg.Almacen.borrarSonido(id);
    }
    A.cfg.sonidos = A.cfg.sonidos.filter(s => !/^demo_/.test(s.id));
    A.motor.pararTodo(); A.edEsc = 0; A.edTecla = null;
    A.cambio(true); await A.guardarYa(); await A.infoStorage();
    A.activar(Math.min(A.activa, A.cfg.escenas.length - 1));
    A.estadoPack = 'Listo: se borraron ' + n.sonidos + ' sonidos y ' + n.escenas + ' escenas de prueba.'; A.render();
  };
  A.borrarTodo = async function () {
    await MDg.Almacen.borrarTodo(); await A.recargar(); A.estadoPack = 'Todo borrado.'; A.render();
  };
  A.pedirPersistencia = async function () { const ok = await MDg.Almacen.pedirPersistencia(); A.infoAlmacen = ok ? 'Listo: el navegador no va a borrar tus datos solo.' : 'El navegador no lo concedio (suele hacerlo si instalas la app en la pantalla de inicio).'; A.render(); };
  A.infoStorage = async function () {
    try { const e = await navigator.storage.estimate(); A.infoAlmacen = 'Usado: ' + (e.usage / 1048576).toFixed(1) + ' MB de ' + (e.quota / 1048576).toFixed(0) + ' MB disponibles.'; } catch (e) { A.infoAlmacen = ''; }
  };

  // ---------- cargar ----------
  A.recargar = async function () {
    let cfg = null;
    try { cfg = await MDg.Almacen.leerConfig(); } catch (e) {}
    A.cfg = MDg.Config.normalizar(cfg);
    A.regs = new Map();
    const m = A.motor; m.regs.forEach((_, id) => m.olvidarArchivo(id));
    for (const s of A.cfg.sonidos) { const reg = await MDg.Almacen.leerSonido(s.id).catch(() => null); if (reg) { A.regs.set(s.id, reg); await m.fijarArchivo(s.id, reg); } }
    m.registrar(A.cfg.sonidos); m.fijarTope(A.cfg.ajustes.volMax);
    A.activa = Math.min(A.cfg.ajustes.escenaInicial | 0, A.cfg.escenas.length - 1); A.edEsc = 0; A.edTecla = null;
    m.pararTodo(); m.teclas = A.cfg.escenas[A.activa].teclas; m.estadoTecla = Array.from({ length: 10 }, () => m._estadoNuevo());
    await A.infoStorage();
    if (conectado()) A.enviarTodo();
  };

  // ---------- conversores de imagen ----------
  function cargarImagen(file) {
    return new Promise((ok, mal) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { ok(im); }; im.onerror = () => mal(new Error('No pude leer la imagen')); im.src = u; });
  }
  function dialogo(titulo, cuerpo) {
    const d = h('dialog', null, h('h3', null, titulo), cuerpo, h('div', { class: 'fila', style: 'margin-top:12px;justify-content:flex-end' }, h('button', { type: 'button', onclick: () => d.close() }, 'Cerrar')));
    d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal(); return d;
  }
  A.abrirConversor = function (i) {
    const t = A.cfg.escenas[A.edEsc].teclas[i]; let im = null, bits = null;
    const umbral = h('input', { type: 'range', min: 10, max: 245, value: 128 }), inv = h('input', { type: 'checkbox' });
    const prev = h('canvas', { width: 24, height: 24, class: 'prev', style: 'width:144px;height:144px' });
    const rehacer = () => { if (!im) return; bits = MDg.Iconos.deImagen(im, { umbral: +umbral.value, invertir: inv.checked }); const c = prev.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 24, 24); MDg.Iconos.pintar(c, bits, 0, 0, 1, '#000'); };
    const archivo = h('input', { type: 'file', accept: 'image/*', onchange: async (e) => { try { im = await cargarImagen(e.target.files[0]); rehacer(); } catch (x) {} } });
    umbral.oninput = rehacer; inv.onchange = rehacer;
    const d = dialogo('Mi imagen como icono', h('div', null, h('p', { class: 'suave' }, 'Funciona mejor con dibujos simples. Si tiene fondo transparente se usa la silueta; si no, lo claro es tinta.'), archivo, h('label', null, 'Umbral'), umbral, h('label', null, h('input', { type: 'checkbox', style: 'width:auto', onchange: (e) => { inv.checked = e.target.checked; rehacer(); } }), ' Invertir (la tinta es lo oscuro)'), h('div', { style: 'margin:10px 0' }, prev),
      h('button', { class: 'primario', type: 'button', onclick: () => { if (!bits) return; t.icono = MDg.Iconos.aHex(bits); A.cambio(true); d.close(); A.render(); } }, 'Usar como icono')));
  };
  A.abrirConversorLogo = function () {
    let im = null, res = null;
    const prog = h('select', null, h('option', { value: 'spotify' }, 'Programa de musica'), h('option', { value: 'dnd' }, 'Programa de rol'));
    const tam = h('input', { type: 'range', min: 32, max: 96, value: 88 }), umbral = h('input', { type: 'range', min: 10, max: 245, value: 128 }), inv = h('input', { type: 'checkbox', style: 'width:auto' });
    const prev = h('canvas', { class: 'prev', width: 8, height: 8 }), cod = h('pre', { class: 'cod' }, '(elegi una imagen)'), info = h('small', null, '');
    const hacer = () => {
      if (!im) return;
      const w0 = im.naturalWidth || im.width, h0 = im.naturalHeight || im.height, esc = Math.min(1, +tam.value / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * esc)), hh = Math.max(1, Math.round(h0 * esc));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; const c = cv.getContext('2d', { willReadFrequently: true });
      c.drawImage(im, 0, 0, w, hh); const dt = c.getImageData(0, 0, w, hh);
      let alfa = false; for (let i = 3; i < dt.data.length; i += 4) if (dt.data[i] < 250) { alfa = true; break; }
      const bf = Math.ceil(w / 8), datos = new Array(bf * hh).fill(0), pts = [];
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4; let tinta;
        if (alfa) tinta = dt.data[k + 3] >= 128; else { const lum = Math.floor((299 * dt.data[k] + 587 * dt.data[k + 1] + 114 * dt.data[k + 2]) / 1000); tinta = lum >= +umbral.value; if (inv.checked) tinta = !tinta; }
        if (tinta) datos[y * bf + (x >> 3)] |= 0x80 >> (x & 7);
        pts.push(tinta);
      }
      const N = prog.value.toUpperCase(), nombre = 'icono_propio_' + prog.value + '.h';
      let s = `// ${nombre}  -  generado por el conversor de la app a partir de una imagen tuya (${w} x ${hh} puntos, 1 color)\n#pragma once\n#include <Arduino.h>\n#define ICONO_${N}_W ${w}\n#define ICONO_${N}_H ${hh}\nstatic const uint8_t ICONO_${N}_DATOS[] PROGMEM = {\n`;
      for (let i = 0; i < datos.length; i += 16) s += '  ' + datos.slice(i, i + 16).map(v => '0x' + v.toString(16).toUpperCase().padStart(2, '0')).join(', ') + ',\n';
      s += '};\n';
      prev.width = w; prev.height = hh; prev.style.cssText = `width:${w * 2}px;height:${hh * 2}px;max-width:100%`;
      const pc = prev.getContext('2d'); pc.fillStyle = '#fff'; pc.fillRect(0, 0, w, hh); pc.fillStyle = '#000'; pts.forEach((t, i) => { if (t) pc.fillRect(i % w, Math.floor(i / w), 1, 1); });
      cod.textContent = s; info.textContent = `${w} × ${hh} puntos, ${datos.length} bytes`; res = { s, nombre, N };
    };
    [tam, umbral, inv, prog].forEach(e => e.addEventListener('input', hacer)); inv.addEventListener('change', hacer);
    const archivo = h('input', { type: 'file', accept: 'image/*', onchange: async (e) => { try { im = await cargarImagen(e.target.files[0]); hacer(); } catch (x) { cod.textContent = x.message; } } });
    dialogo('Conversor de imagen a icono del lobby', h('div', null,
      h('p', { class: 'suave' }, 'Elegi el programa y la imagen. Despues: copia el archivo .h a la carpeta del firmware y en iconos_propios.h cambia el 0 por 1 de esa linea.'),
      prog, h('label', null, 'Imagen'), archivo, h('label', null, 'Tamano maximo (puntos)'), tam, h('label', null, 'Umbral (cuando no hay transparencia)'), umbral,
      h('label', null, inv, ' Invertir (logo oscuro sobre fondo claro)'), h('div', { style: 'margin:10px 0' }, prev, h('br'), info), cod,
      h('div', { class: 'fila', style: 'margin-top:8px' },
        h('button', { type: 'button', onclick: () => { if (res) descargar(new Blob([res.s], { type: 'text/plain' }), res.nombre); } }, 'Descargar .h'),
        h('button', { type: 'button', onclick: (e) => { if (res && navigator.clipboard) navigator.clipboard.writeText(res.s).then(() => { e.target.textContent = 'Copiado'; }).catch(() => {}); } }, 'Copiar texto'))));
  };

  // ---------- pantallas ----------
  // v1.3-dev13: cada pestana lleva su icono (MDI); la de Drive muestra un numerito si hay sonidos nuevos o cambiados.
  A.pintarTabs = function () {
    tabsEl.innerHTML = '';
    TABS.forEach(([id, n, ic]) => tabsEl.append(h('button', { type: 'button', class: id === A.tab ? 'on' : '', 'data-tab': id, 'aria-label': n, onclick: () => { volcar(); A.tab = id; A.render(); vista.scrollTop = 0; } },
      h('span', { class: 'tab-ic' }, MDg.IUI.svg(ic), id === 'drive' && A.drivePend ? h('b', { class: 'bd' }, String(A.drivePend)) : null), h('span', { class: 'tab-n' }, n))));
  };
  A.render = function () {
    const sc = vista.scrollTop;
    vista.innerHTML = ''; A.mesaCeldas = []; A.mesaVol = A.mesaSonando = null;
    ({ mesa: MDg.UI.vistaMesa, escenas: MDg.UI.vistaEscenas, sonidos: MDg.UI.vistaSonidos, audios: MDg.Audios.vista, drive: MDg.DriveUI.vista, herramientas: MDg.UI.vistaHerramientas })[A.tab](A, vista);
    A.pintarTabs();
    if (MDg.Maqueta) MDg.Maqueta.montar(A);                    // 1.3-dev22: version de escritorio
    vista.scrollTop = sc; pintarPills(); A.actualizarEstado(false);
  };

  // ---------- arranque ----------
  (async function () {
    await A.recargar();
    if (MDg.Audios) await MDg.Audios.iniciar(A);          // dev23: pestana Audios (catalogo guardado y audios bajados)
    if (MDg.LucesDnd) MDg.LucesDnd.enganchar(A);         // 1.3-dev16: luces de D&D (envuelve motor.tecla y A.activar)
    A.render();
    if (MDg.Drive.configurado() && navigator.onLine) A.driveActualizar();     // mira en silencio si hay sonidos nuevos (aparece el numero en la pestana Drive)
    const enApk = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());   // dentro del APK la web viene empaquetada: no hace falta cache offline (y evitaria ver una version vieja)
    if (!enApk && 'serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
    window.addEventListener('beforeunload', () => { try { MDg.Almacen.guardarConfig(A.cfg); } catch (e) {} });
    if (MDg.Celu) { MDg.Celu.onCambio = () => { if (A._celuPintar) A._celuPintar(); const av = document.getElementById('avisoAccesoMedios'); if (av) av.hidden = !!MDg.Celu.s.acceso; }; MDg.Celu.iniciar(A); }
    window.appListo = true;
  })();
})();
