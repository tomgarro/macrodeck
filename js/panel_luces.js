// panel_luces.js - (2.0-dev2) El PANEL PLEGABLE de la cabecera: estado, luces de D&D (control individual, "Conectar todo", pintar con el dedo)
// y pantalla (ambilight, pantalla completa). Tambien el AMBILIGHT (los bordes de la app toman el color de las lamparas) y la pantalla completa.
//
// Filosofia: todo va en plegables. El panel NO flota encima de nada: va EN el flujo, entre la cabecera y la pantalla, asi no se pisa con
// el reproductor de abajo, ni con la barra de Sincronizar, ni con la maqueta de escritorio.
//
// Las luces se mandan por el MISMO camino de siempre (MD.LucesDnd.enviar -> /efectos del servidor): un color quieto en la capa "ambiente".
window.MD = window.MD || {};
(function (MD) {
  const h = (...a) => MD.UI.h(...a);
  const LZ = () => MD.LucesDnd;
  const P = MD.Panel = { A: null, vivos: new Set() };

  // ---------- ajustes chicos de esta pantalla (por celu, no se sincronizan) ----------
  let guardado = {};
  try { guardado = JSON.parse(localStorage.getItem('md_panel') || '{}') || {}; } catch (e) { guardado = {}; }
  const cfg = Object.assign({ secs: { estado: true, luces: true, cada: false, pintar: false, pantalla: false }, ambi: true, completa: false }, guardado);
  cfg.secs = Object.assign({ estado: true, luces: true, cada: false, pintar: false, pantalla: false }, cfg.secs || {});
  const guardar = () => { try { localStorage.setItem('md_panel', JSON.stringify(cfg)); } catch (e) {} };
  P.cfg = cfg;

  const enApk = () => !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

  // ---------- plegable generico ----------
  // clave: se acuerda si quedo abierto. Devuelve { el, abrir(bool), cuerpo }
  P.plegable = function (titulo, cuerpo, clave, extra, porDefecto) {
    const abierto0 = clave in cfg.secs ? !!cfg.secs[clave] : !!porDefecto;
    const flecha = MD.IUI.svg('flecha', 'pl-flecha');
    const cab = h('button', { type: 'button', class: 'pl-cab', 'aria-expanded': String(abierto0) }, h('span', { class: 'pl-tit' }, titulo), extra || null, flecha);
    const cuerpoEl = h('div', { class: 'pl-cuerpo' }, cuerpo);
    cuerpoEl.hidden = !abierto0;
    const el = h('section', { class: 'pl' + (abierto0 ? ' abierto' : ''), 'data-pl': clave || '' }, cab, cuerpoEl);
    const abrir = (v, guardarlo) => {
      cuerpoEl.hidden = !v; el.classList.toggle('abierto', !!v); cab.setAttribute('aria-expanded', String(!!v));
      if (clave && guardarlo !== false) { cfg.secs[clave] = !!v; guardar(); }
    };
    cab.addEventListener('click', () => abrir(cuerpoEl.hidden));
    return { el, abrir, cuerpo: cuerpoEl, cab };
  };

  // ---------- color ----------
  const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const rgb2hex = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b);
  function hsv2hex(hh, s, v) {            // hh 0..360, s y v 0..1
    const c = v * s, x = c * (1 - Math.abs((hh / 60) % 2 - 1)), m = v - c; let r = 0, g = 0, b = 0;
    if (hh < 60) { r = c; g = x; } else if (hh < 120) { r = x; g = c; } else if (hh < 180) { g = c; b = x; } else if (hh < 240) { g = x; b = c; } else if (hh < 300) { r = x; b = c; } else { r = c; b = x; }
    return rgb2hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  // Temperatura (0 = calido 2200 K ... 100 = frio 6500 K) -> color RGB (aproximacion de Tanner Helland)
  function temp2hex(t) {
    const k = (2200 + (6500 - 2200) * t / 100) / 100; let r, g, b;
    r = k <= 66 ? 255 : 329.698727446 * Math.pow(k - 60, -0.1332047592);
    g = k <= 66 ? 99.4708025861 * Math.log(k) - 161.1195681661 : 288.1221695283 * Math.pow(k - 60, -0.0755148492);
    b = k >= 66 ? 255 : (k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307);
    return rgb2hex(r, g, b);
  }
  P.hsv2hex = hsv2hex; P.temp2hex = temp2hex;

  // ---------- modelo de las lamparas (lo que el panel mando por ultima vez) ----------
  const LAMP = [['dnd-1', 'D&D 1'], ['dnd-2', 'D&D 2']];
  const M = P.modelo = {};
  LAMP.forEach(([id]) => { M[id] = { on: true, brillo: 100, hue: 30, sat: 1, temp: 15, modo: 'color', conectada: null, tocado: false }; });
  const colorDe = (m) => m.modo === 'temp' ? temp2hex(m.temp) : hsv2hex(m.hue, m.sat, 1);
  const lookDe = (m, efecto) => m.on ? { efecto: efecto || 'fijo', color: colorDe(m), brillo: m.brillo, velocidad: 1, intensidad: 5 }
    : { efecto: 'apagado', color: '#000000', brillo: 1, velocidad: 1, intensidad: 5 };
  const timers = {}, blanco = {};
  // TEMPERATURA = el BLANCO de la lampara (sus LED blancos, mucho mas fuertes que los de color). El servidor lo anima con "efectos" solo en color,
  // asi que antes se corta el efecto de esa lampara y despues se manda la orden directa (encendida + brillo + temperatura), de a una por vez.
  async function mandarBlanco(id) {
    const L = LZ(), b = blanco[id] = blanco[id] || { vuelo: false, pend: false, ult: 0 };
    if (b.vuelo) { b.pend = true; return; }
    b.vuelo = true;
    try {
      do {
        b.pend = false;
        const m = M[id];
        if (!m.on || m.modo !== 'temp') break;
        if (Date.now() - b.ult > 1500) await L.enviar([{ luz: id, parar: 'todo' }]);              // corta el efecto que estuviera andando
        b.ult = Date.now();
        try { await L.postLuz(id, { encendida: true, brillo: m.brillo, temperatura: m.temp }); } catch (e) {}
        b.ult = Date.now();
      } while (b.pend);
    } finally { b.vuelo = false; }
  }
  function mandar(ids) {
    const L = LZ(); if (!L || !L.aj.activo) return;
    ids.forEach((id) => {
      clearTimeout(timers[id]);
      timers[id] = setTimeout(() => {
        const m = M[id];
        if (m.on && m.modo === 'temp') {
          P.alOrdenes([{ luz: id, capa: 'ambiente', look: { efecto: 'fijo', color: temp2hex(m.temp), brillo: m.brillo, velocidad: 1 } }]);   // el ambilight
          mandarBlanco(id);
        } else L.enviar([{ luz: id, look: lookDe(m), capa: 'ambiente', id: 'manual' }]);
      }, 110);
    });
  }
  P.aplicar = function (ids, parcial) { ids.forEach((id) => { Object.assign(M[id], parcial, { tocado: true }); }); mandar(ids); refrescarVivos(); };

  // ---------- controles (se usan en el panel, en la pestana Luces y en el Modo mesa) ----------
  const rango = (min, max, valor, clase, alMover, etiqueta) => {
    const e = h('input', { type: 'range', min, max, value: valor, class: 'pl-rango ' + (clase || ''), 'aria-label': etiqueta });
    e.addEventListener('input', () => alMover(+e.value));
    return e;
  };
  // Un grupo de controles para una o varias lamparas: [prender/apagar] brillo, color, temperatura.
  P.controles = function (ids, titulo) {
    const ref = M[ids[0]];
    const sw = h('button', { type: 'button', class: 'pl-sw', role: 'switch', 'aria-label': 'Prender o apagar ' + titulo }, h('i'));
    sw.addEventListener('click', () => P.aplicar(ids, { on: !ref.on }));
    const punto = h('i', { class: 'pl-pt' });
    const brillo = rango(1, 100, ref.brillo, '', (v) => P.aplicar(ids, { brillo: v, on: true }), 'Brillo de ' + titulo);
    const color = rango(0, 360, ref.hue, 'pl-hue', (v) => P.aplicar(ids, { hue: v, sat: 1, modo: 'color', on: true }), 'Color de ' + titulo);
    const temp = rango(0, 100, ref.temp, 'pl-temp', (v) => P.aplicar(ids, { temp: v, modo: 'temp', on: true }), 'Temperatura de ' + titulo);
    const vb = h('span', { class: 'pl-val' }), vt = h('span', { class: 'pl-val' });
    const muestra = h('i', { class: 'pl-muestra' });
    const preset = (txt, t) => h('button', { type: 'button', class: 'chico pl-preset', onclick: () => P.aplicar(ids, { modo: 'temp', temp: t, brillo: 100, on: true }) }, txt);
    const el = h('div', { class: 'pl-ctl' },
      h('div', { class: 'pl-ctl-cab' }, punto, h('strong', { class: 'crece' }, titulo), muestra, sw),
      h('div', { class: 'pl-presets' }, preset('Cálida a full', 0), preset('Neutra', 50), preset('Fría', 100)),
      h('label', { class: 'pl-et' }, 'Brillo ', vb), brillo,
      h('label', { class: 'pl-et' }, 'Color'), color,
      h('label', { class: 'pl-et' }, 'Temperatura ', vt, h('span', { class: 'suave pl-ext' }, 'cálido ↔ frío')), temp);
    const v = {
      el,
      refrescar() {
        sw.setAttribute('aria-checked', String(ref.on)); sw.classList.toggle('on', ref.on);
        if (document.activeElement !== brillo) brillo.value = ref.brillo;
        if (document.activeElement !== color) color.value = ref.hue;
        if (document.activeElement !== temp) temp.value = ref.temp;
        vb.textContent = ref.brillo + ' %'; vt.textContent = '';
        muestra.style.background = ref.on ? colorDe(ref) : 'transparent';
        const cs = ids.map((i) => M[i].conectada), todas = cs.every((c) => c === true), alguna = cs.some((c) => c === true);
        punto.className = 'pl-pt ' + (cs.every((c) => c === null) ? '' : (todas ? 'ok' : (alguna ? 'warn' : 'mal')));
        punto.title = todas ? 'Conectada' : (alguna ? 'Alguna sin conexión' : (cs.every((c) => c === null) ? 'Sin datos todavía' : 'Sin conexión'));
        el.classList.toggle('apagada', !ref.on);
      },
    };
    P.vivos.add(v); v.refrescar();
    return v;
  };
  function refrescarVivos() { for (const v of Array.from(P.vivos)) { if (!v.el.isConnected) { P.vivos.delete(v); continue; } v.refrescar(); } }

  // "Las dos" arriba y "Cada una" plegable. Devuelve un nodo.
  P.controlesLuces = function () {
    const dos = P.controles(LAMP.map((l) => l[0]), 'Las dos');
    const cada = P.plegable('Cada una por separado', h('div', { class: 'pl-pila' }, LAMP.map(([id, n]) => P.controles([id], n).el)), 'cada', null, false);
    return h('div', { class: 'pl-pila' }, dos.el, cada.el);
  };

  // ---------- estado de las lamparas desde el servidor ----------
  let tPoll = 0;
  P.leer = async function () {
    const L = LZ(); if (!L || !L.aj.activo) return;
    try {
      const lu = await L.leer();
      for (const id in lu) {
        const m = M[id]; if (!m || !lu[id]) continue;
        const e = lu[id].estado || {};
        m.conectada = !!e.conectada;
        if (!m.tocado) {                         // mientras no se toca nada, se muestra lo que dice la lampara
          if (typeof e.encendida === 'boolean') m.on = e.encendida;
          if (typeof e.brillo === 'number') m.brillo = Math.max(1, Math.min(100, e.brillo));
        }
      }
    } catch (e) { LAMP.forEach(([id]) => { M[id].conectada = false; }); }
    refrescarVivos();
    const bb = document.getElementById('plBadgeLuces'); if (bb) bb.textContent = badgeLuces();
  };
  function badgeLuces() { const L = LZ(), g = L && L.conectadas; return g ? g.conectadas + '/' + g.luces : ''; }
  P.sondeo = function (rapido) {
    clearInterval(tPoll);
    tPoll = setInterval(() => { P.leer(); if (LZ() && LZ().aj.activo) LZ().probarConexion().then(() => LZ().pintar()).catch(() => {}); }, rapido ? 5000 : 20000);
  };

  // ---------- "Conectar todo": 3 runas ----------
  const RUNAS = [['audio', 'Audio', 'audio'], ['bt', 'Macrodeck', 'bt'], ['luces', 'Luces', 'luz']];
  const runas = {};
  RUNAS.forEach(([k]) => { runas[k] = { est: 'quieta', txt: '' }; });
  let corriendo = false;
  function pintarRunas() {
    const caja = document.getElementById('plRunas'); if (!caja) return;
    caja.replaceChildren(...RUNAS.map(([k, n, ic]) => {
      const r = runas[k];
      return h('div', { class: 'pl-runa ' + r.est }, h('span', { class: 'pl-runa-ic' }, MD.IUI.svg(ic), h('i', { class: 'pl-runa-pt' })), h('b', null, n), r.txt ? h('small', { class: 'suave' }, r.txt) : null);
    }));
    caja.hidden = RUNAS.every(([k]) => runas[k].est === 'quieta');
  }
  const poner = (k, est, txt) => { runas[k] = { est, txt: txt || '' }; pintarRunas(); };
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  async function tareaAudio(A) {
    poner('audio', 'giro', 'Activando…');
    try { await A.audioPrimero(); poner('audio', 'ok', 'Listo'); } catch (e) { poner('audio', 'mal', 'No arrancó: tocá la pantalla y probá otra vez'); }
  }
  async function tareaBt(A) {
    if (A.tr && A.tr.conectado) { poner('bt', 'ok', 'Ya estaba conectado'); return; }
    poner('bt', 'giro', 'Buscando el Macrodeck…');
    try { await A.conectarBle(); } catch (e) {}
    for (let i = 0; i < 40; i++) { if (A.tr && A.tr.conectado) break; await espera(500); }
    if (A.tr && A.tr.conectado) poner('bt', 'ok', 'Conectado');
    else poner('bt', 'mal', 'No contestó: ¿está prendido y cerca?');
  }
  async function tareaLuces(forzar) {
    const L = LZ();
    if (!L || !L.aj.activo) { poner('luces', 'mal', 'Las luces están apagadas en este celu (Herramientas)'); return false; }
    poner('luces', 'giro', 'Mirando el servidor…');
    let g = null;
    for (let i = 0; i < 3 && !g; i++) {
      try { const s = await L.salud(); g = (s.grupos || {}).dnd || { luces: 0, conectadas: 0 }; } catch (e) { await espera(1200); }
    }
    if (!g) { poner('luces', 'mal', 'El servidor de luces no contesta (se reinicia solo; probá en unos segundos)'); return false; }
    if (!g.luces) { poner('luces', 'mal', 'El servidor no tiene las lámparas de D&D (faltan las claves)'); return false; }
    if (forzar || g.conectadas < g.luces) {
      poner('luces', 'giro', 'Buscando lámparas… ' + g.conectadas + '/' + g.luces);
      try { await L.buscar(); } catch (e) {}
      for (let i = 0; i < 24; i++) {
        await espera(2500);
        try { const s = await L.salud(); g = (s.grupos || {}).dnd || g; } catch (e) {}
        poner('luces', 'giro', 'Buscando lámparas… ' + g.conectadas + '/' + g.luces);
        if (g.conectadas >= g.luces) break;
      }
    }
    L.conectadas = g; L.pintar(); P.leer();
    if (g.conectadas >= g.luces) {
      poner('luces', 'ok', g.conectadas + ' de ' + g.luces + ' conectadas');
      L.enviar(LAMP.map(([id]) => ({ luz: id, capa: 'momento', segundos: 2.5, id: 'ok', look: { efecto: 'respirar', color: '#ffd24a', brillo: 55, velocidad: 1.6, intensidad: 5 } })));   // guiño de "listo"
      return true;
    }
    poner('luces', g.conectadas ? 'warn' : 'mal', g.conectadas + ' de ' + g.luces + '. Apagá y prendé las que faltan (10 s) y tocá Reconectar. ¿El celu está en el hotspot «DnD Lights»?');
    return false;
  }
  P.conectarTodo = async function () {
    if (corriendo) return; corriendo = true;
    const btns = document.querySelectorAll('.pl-conectar'); btns.forEach((b) => { b.disabled = true; });
    try {
      RUNAS.forEach(([k]) => { runas[k] = { est: 'giro', txt: '' }; });
      pintarRunas(); P.abrir('luces');
      await Promise.all([tareaAudio(P.A), tareaBt(P.A), tareaLuces(false)]);
    } finally { corriendo = false; btns.forEach((b) => { b.disabled = false; }); }
  };
  P.reconectarLuces = async function () {
    if (corriendo) return; corriendo = true;
    const btns = document.querySelectorAll('.pl-conectar'); btns.forEach((b) => { b.disabled = true; });
    try { runas.luces = { est: 'giro', txt: '' }; pintarRunas(); await tareaLuces(true); } finally { corriendo = false; btns.forEach((b) => { b.disabled = false; }); }
  };
  P.botonConectar = function (grande) {
    return h('button', { type: 'button', class: 'pl-conectar primario' + (grande ? ' grande' : ''), id: grande ? 'btnConectarTodo' : null, onclick: () => P.conectarTodo() }, MD.IUI.svg('sync'), ' Conectar todo');
  };

  // ---------- pintar con el dedo ----------
  function pintarConElDedo(A) {
    const cv = h('canvas', { class: 'pl-lienzo', width: 320, height: 150, 'aria-label': 'Elegí un color con el dedo' });
    const c = cv.getContext('2d');
    const grad = c.createLinearGradient(0, 0, 320, 0);
    for (let i = 0; i <= 12; i++) grad.addColorStop(i / 12, 'hsl(' + (i * 30) + ',100%,50%)');
    c.fillStyle = grad; c.fillRect(0, 0, 320, 150);
    const bl = c.createLinearGradient(0, 0, 0, 150); bl.addColorStop(0, 'rgba(255,255,255,0)'); bl.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = bl; c.fillRect(0, 0, 320, 150);
    const mira = h('i', { class: 'pl-mira' });
    const caja = h('div', { class: 'pl-lienzo-caja' }, cv, mira);
    const est = { hue: 30, sat: 1, brillo: 80, efecto: 'fijo', a: 'dos' };
    const sel = h('select', { 'aria-label': 'A qué lámpara' }, h('option', { value: 'dos' }, 'Las dos'), LAMP.map(([id, n]) => h('option', { value: id }, n)));
    sel.addEventListener('change', () => { est.a = sel.value; });
    const ids = () => est.a === 'dos' ? LAMP.map((l) => l[0]) : [est.a];
    const efectos = h('select', { 'aria-label': 'Efecto' }, LZ().EFECTOS.filter((e) => e[0] !== 'apagado').map((e) => h('option', { value: e[0] }, e[1])));
    efectos.addEventListener('change', () => { est.efecto = efectos.value; enviar(); });
    const bri = rango(1, 100, est.brillo, '', (v) => { est.brillo = v; enviar(); }, 'Brillo');
    const nombre = h('input', { type: 'text', maxlength: 24, placeholder: 'Nombre del look', 'aria-label': 'Nombre del look' });
    const msg = h('p', { class: 'suave', style: 'margin:4px 0 0' }, '');
    const color = () => hsv2hex(est.hue, est.sat, 1);
    let t = 0;
    function enviar() {
      clearTimeout(t);
      t = setTimeout(() => {
        const L = LZ(); if (!L.aj.activo) return;
        L.enviar(ids().map((id) => { Object.assign(M[id], { on: true, brillo: est.brillo, hue: est.hue, sat: est.sat, modo: 'color', tocado: true }); return { luz: id, look: { efecto: est.efecto, color: color(), brillo: est.brillo, velocidad: 1, intensidad: 5 }, capa: 'ambiente', id: 'manual' }; }));
        refrescarVivos();
      }, 110);
    }
    function tocar(ev) {
      const r = cv.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
      est.hue = Math.min(359, x * 360); est.sat = 1 - y;
      mira.style.left = (x * 100) + '%'; mira.style.top = (y * 100) + '%'; mira.style.background = color();
      enviar();
    }
    let abajo = false;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (ev) => { abajo = true; try { cv.setPointerCapture(ev.pointerId); } catch (e) {} tocar(ev); });
    cv.addEventListener('pointermove', (ev) => { if (abajo) tocar(ev); });
    ['pointerup', 'pointercancel'].forEach((n) => cv.addEventListener(n, () => { abajo = false; }));
    mira.style.left = (30 / 360 * 100) + '%'; mira.style.top = '0%'; mira.style.background = color();
    const guardarLook = () => {
      const A2 = P.A, L = LZ();
      const nom = (nombre.value || '').trim() || 'Mi color';
      A2.cfg.looks = A2.cfg.looks || [];
      A2.cfg.looks.push(L.normLook({ id: MD.Config.nuevoId('l'), nombre: nom, efecto: est.efecto, color: color(), brillo: est.brillo, velocidad: 1 }));
      A2.cambio(false);
      msg.textContent = 'Guardado en «Mis looks» (pestaña Luces > Mis looks): ' + nom + '.'; nombre.value = '';
    };
    return h('div', { class: 'pl-pila' },
      h('p', { class: 'suave', style: 'margin:0' }, 'Tocá o arrastrá: arriba colores vivos, abajo se van al blanco. Las lámparas cambian en vivo.'),
      caja, h('label', { class: 'pl-et' }, 'A: '), sel, h('label', { class: 'pl-et' }, 'Efecto'), efectos, h('label', { class: 'pl-et' }, 'Brillo'), bri,
      h('div', { class: 'fila' }, nombre, h('button', { type: 'button', onclick: guardarLook }, 'Guardar como look')), msg);
  }

  // ---------- AMBILIGHT ----------
  // Los dos bordes de la app brillan con el color de cada lampara (izquierda = D&D 1, derecha = D&D 2), con el movimiento de su efecto.
  const ambi = { 'dnd-1': { amb: null, mom: null, el: null }, 'dnd-2': { amb: null, mom: null, el: null }, tm: {} };
  function crearAmbi() {
    if (ambi['dnd-1'].el) return;
    ambi['dnd-1'].el = h('div', { class: 'ambi ambi-l', 'aria-hidden': 'true' });
    ambi['dnd-2'].el = h('div', { class: 'ambi ambi-r', 'aria-hidden': 'true' });
    document.body.append(ambi['dnd-1'].el, ambi['dnd-2'].el);
  }
  function pintarAmbi(id) {
    const a = ambi[id]; if (!a || !a.el) return;
    const s = a.mom || a.amb, el = a.el;
    if (!s || s.efecto === 'apagado' || !cfg.ambi) { el.classList.remove('on'); return; }
    el.style.setProperty('--ac', s.color); el.style.setProperty('--b', String(Math.max(0.15, s.brillo / 100)));
    const cl = 'ambi ' + (id === 'dnd-1' ? 'ambi-l' : 'ambi-r') + ' on e-' + s.efecto;
    if (el.className !== cl) el.className = cl;
    el.style.setProperty('--v', String(1 / Math.max(0.25, s.velocidad || 1)));
  }
  P.alOrdenes = function (ordenes) {
    crearAmbi();
    for (const o of ordenes || []) {
      const ids = o.luz ? [o.luz] : (o.grupo === 'dnd' ? Object.keys(ambi).filter((k) => k !== 'tm') : []);
      ids.forEach((id) => {
        const a = ambi[id]; if (!a) return;
        if (o.parar) { if (o.parar === 'momento' || o.parar === 'todo') a.mom = null; if (o.parar === 'ambiente' || o.parar === 'todo') a.amb = null; pintarAmbi(id); return; }
        if (!o.look || o.ajustar) return;
        const s = { efecto: o.look.efecto, color: o.look.color || '#ffffff', brillo: o.look.brillo || 80, velocidad: o.look.velocidad || 1 };
        if (o.capa === 'ambiente') { a.amb = s; a.mom = null; clearTimeout(ambi.tm[id]); }
        else {
          a.mom = s; clearTimeout(ambi.tm[id]);
          const seg = typeof o.segundos === 'number' && o.segundos > 0 ? o.segundos : 8;
          ambi.tm[id] = setTimeout(() => { a.mom = null; pintarAmbi(id); }, seg * 1000);
        }
        pintarAmbi(id);
      });
    }
  };
  const sincChk = () => { document.querySelectorAll('input.chk-ambi').forEach((i) => { i.checked = cfg.ambi; }); document.querySelectorAll('input.chk-completa').forEach((i) => { i.checked = cfg.completa; }); };
  P.fijarAmbi = function (v) { cfg.ambi = !!v; guardar(); document.body.classList.toggle('sin-ambi', !cfg.ambi); ['dnd-1', 'dnd-2'].forEach(pintarAmbi); sincChk(); };
  // Las dos opciones de pantalla (las usa el panel de la cabecera y la pestaña Mas)
  P.opcionesPantalla = function () {
    return h('div', { class: 'pl-pila' },
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', class: 'chk-ambi', checked: cfg.ambi, onchange: (e) => P.fijarAmbi(e.target.checked) }), ' Ambilight: los bordes de la app toman el color de las luces'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', class: 'chk-completa', checked: cfg.completa, onchange: (e) => P.fijarCompleta(e.target.checked) }), ' Pantalla completa: esconde la barra de Android (se ve deslizando desde el borde)'));
  };

  // ---------- pantalla completa ----------
  let completaMesa = false;
  P.pantallaCompleta = function (on, esMesa) {
    if (esMesa) completaMesa = !!on;
    const quiere = !!on || cfg.completa;                 // si el ajuste global esta prendido, no se vuelven a mostrar las barras al salir del modo mesa
    try { if (MD.Nativo && MD.Nativo.pantallaCompleta) MD.Nativo.pantallaCompleta(quiere); } catch (e) {}
    try {
      if (!enApk()) {
        if (quiere && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
        if (!quiere && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      }
    } catch (e) {}
  };
  P.fijarCompleta = function (v) { cfg.completa = !!v; guardar(); P.pantallaCompleta(completaMesa, false); sincChk(); };

  // ---------- el panel ----------
  let raiz = null, secs = {}, txtEstado = null, btnDesc = null;
  P.montar = function (A) {
    P.A = A;
    raiz = document.getElementById('estadoTxt'); if (!raiz || raiz.dataset.panel) return;
    raiz.dataset.panel = '1'; raiz.className = 'panel-estado'; raiz.hidden = true; raiz.setAttribute('role', 'region'); raiz.setAttribute('aria-label', 'Estado y controles');
    // 1. Estado
    txtEstado = h('p', { class: 'pl-txt', id: 'plTxtEstado' });
    btnDesc = h('button', { type: 'button', class: 'chico', id: 'btnDesconectar', onclick: () => { A.cortar(); } }, 'Desconectar el Macrodeck');
    secs.estado = P.plegable('Estado', h('div', null, txtEstado, h('div', { class: 'fila' }, btnDesc)), 'estado', null, true);
    // 2. Luces
    const badge = h('span', { class: 'pl-badge', id: 'plBadgeLuces' }, badgeLuces());
    const cuerpoLuces = h('div', { class: 'pl-pila' },
      h('div', { class: 'fila pl-fila-con' }, P.botonConectar(true), h('button', { type: 'button', class: 'pl-conectar', onclick: () => P.reconectarLuces() }, 'Reconectar lámparas')),
      h('div', { class: 'pl-runas', id: 'plRunas', hidden: true }),
      P.controlesLuces(),
      P.plegable('Pintar con el dedo', pintarConElDedo(A), 'pintar', null, false).el);
    secs.luces = P.plegable('Luces de D&D', cuerpoLuces, 'luces', badge, true);
    // 3. Pantalla
    secs.pantalla = P.plegable('Pantalla', h('div', { class: 'pl-pila' },
      P.opcionesPantalla(),
      h('div', { class: 'fila' }, h('button', { type: 'button', onclick: () => { P.cerrar(); if (MD.Au && MD.Au.ui) MD.Au.ui.abrirOv('mesa'); } }, 'Abrir el Modo mesa'))), 'pantalla', null, false);
    raiz.append(secs.estado.el, secs.luces.el, secs.pantalla.el);
    document.body.classList.toggle('sin-ambi', !cfg.ambi);
    crearAmbi(); pintarRunas();
    if (cfg.completa) setTimeout(() => P.pantallaCompleta(false, false), 600);
  };
  P.pintarEstado = function (texto, conectado) {
    if (txtEstado && txtEstado.textContent !== texto) txtEstado.textContent = texto || '';
    if (btnDesc) btnDesc.hidden = !conectado;
  };
  P.abierto = () => !!raiz && !raiz.hidden;
  P.abrir = function (sec) {
    if (!raiz) return;
    raiz.hidden = false;
    if (sec && secs[sec]) { secs[sec].abrir(true); setTimeout(() => { try { secs[sec].el.scrollIntoView({ block: 'nearest' }); } catch (e) {} }, 30); }
    P.leer(); P.sondeo(true);
    const b = document.getElementById('estadoCab'); if (b) b.setAttribute('aria-expanded', 'true');
  };
  P.cerrar = function () { if (!raiz) return; raiz.hidden = true; P.sondeo(false); const b = document.getElementById('estadoCab'); if (b) b.setAttribute('aria-expanded', 'false'); };
  P.alternar = function (sec) {
    if (!raiz) return;
    if (!raiz.hidden && (!sec || (secs[sec] && !secs[sec].cuerpo.hidden && raiz.dataset.ult === sec))) { P.cerrar(); return; }
    raiz.dataset.ult = sec || ''; P.abrir(sec);
  };

  // ---------- arranque ----------
  P.iniciar = function (A) {
    P.A = A; P.montar(A);
    const L = LZ();
    if (L) {
      L.alOrden = L.alOrden || []; L.alOrden.push((o) => { try { P.alOrdenes(o); } catch (e) {} });
      P.sondeo(false); P.leer();
      // desde la notificacion: boton "Escena" -> la escena vuelve a poner su luz de ambiente
      if (MD.Nativo && MD.Nativo.alAccion) MD.Nativo.alAccion((id) => { if (id === 'escena') { const esc = A.cfg.escenas[A.activa]; L.alEscena(esc); } });
    }
    P.fijarAmbi(cfg.ambi);
  };
})(window.MD);
