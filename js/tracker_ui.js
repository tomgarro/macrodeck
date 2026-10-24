// tracker_ui.js - La pestana "Initiative Tracker" (icono de dragon): conexion con el Arduino, simulador con la foto del aparato, joystick,
// pantalla de mesa, estadisticas, sonidos y luces por movimiento, ajustes y monitor serie.
// Solo MUESTRA lo que hace el servicio (tracker_serie.js); si cerras la pestana, la conexion y los sonidos siguen andando.
window.MD = window.MD || {};
(function (MD) {
  const Trk = MD.Trk, Sv = Trk.Servicio;
  const NS = 'http://www.w3.org/2000/svg';
  const CX = [120, 257, 396, 535, 675, 814, 1188, 1327, 1465, 1604, 1743, 1881];    // centro de cada ficha sobre la foto (1998 de ancho)
  const pad2 = (n) => String(n).padStart(2, '0');
  const hora = (t) => { const d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); };
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v; else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
    return e;
  }
  const svgIcono = (n) => MD.IUI.svg(n);
  const rgb = (c) => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  const nombreFicha = (S, k) => { const t = S.tipo[k]; return Trk.TIPOS[t].n + (t === 'E' ? ' ' + Trk.numEnemigo(S, k) : ''); };


  // ============================================================================================================
  // Pantalla de mesa: ronda y ficha del turno en grande (para dejar el celu o la tablet parados frente a la mesa). Tiene su propio bucle:
  // sigue viva aunque cambies de pestana.
  let mesa = null, mesaRaf = 0;
  Trk.abrirMesa = function () {
    if (mesa) return;
    const f = document.createElementNS(NS, 'svg'); f.setAttribute('viewBox', '0 0 100 170'); f.setAttribute('class', 'tk-mFicha');
    const n = { ronda: el('div', { class: 'big' }, '1'), nom: el('div', { class: 'nom' }), cl: el('div', { class: 'cl' }), sig: el('div', { class: 'sig' }), f };
    mesa = el('div', { class: 'tk-mesa', role: 'dialog', 'aria-label': 'Pantalla de mesa del Initiative Tracker' }, el('button', { type: 'button', class: 'x', onclick: () => Trk.cerrarMesa() }, 'Cerrar'), el('div', { class: 'lbl' }, 'RONDA'), n.ronda, f, n.nom, n.cl, n.sig);
    mesa._n = n; document.body.append(mesa); if (MD.Nativo) MD.Nativo.pantallaCompleta(true);
    const lazo = () => { if (!mesa) return; dibujarMesa(); mesaRaf = requestAnimationFrame(lazo); }; lazo();
  };
  Trk.cerrarMesa = function () {
    if (!mesa) return false;
    cancelAnimationFrame(mesaRaf); mesa.remove(); mesa = null;
    const A = Sv.A; if (MD.Nativo) MD.Nativo.pantallaCompleta(!!(A && A.cfg && A.cfg.ajustes && A.cfg.ajustes.pantallaCompleta));
    return true;
  };
  function dibujarMesa() {
    const E = Sv.espejo, S = E.S, cols = E.p.cols, off = E.p.off, n = mesa._n, hay = Sv.estado === 'conectado' && E.hay, B = hay && S.modo === 'B';
    n.ronda.textContent = S.ronda;
    if (B) {
      const k = S.turno, c = cols[k + off] || [0, 0, 0], tc = Trk.TIPOS[S.tipo[k]].c, lum = Math.max(c[0], c[1], c[2]) / 255, firma = S.tipo[k] + Trk.numEnemigo(S, k);
      if (n.f._k !== firma) { n.f._k = firma; n.f.innerHTML = Trk.ficha(S.tipo[k], S.tipo[k] === 'E' ? Trk.numEnemigo(S, k) : 0); }
      n.f.style.fill = rgb(tc); n.f.style.opacity = (0.35 + 0.65 * lum).toFixed(2);
      n.nom.textContent = nombreFicha(S, k); n.cl.textContent = Trk.TIPOS[S.tipo[k]].cl + (S.alt[k] ? ' · ' + Trk.ALT_N[S.alt[k]] : '');
      let sig = k, q = 0; do { sig = sig % S.total + 1; q++; } while (S.muerto[sig] && q < 13);
      n.sig.textContent = sig !== k && !S.muerto[sig] ? 'Sigue: ' + nombreFicha(S, sig) : '';
    } else { n.f._k = ''; n.f.innerHTML = ''; n.nom.textContent = hay ? (S.modo === 'Q' ? 'Armando el combate…' : 'Eligiendo personajes…') : 'Sin conexión'; n.cl.textContent = ''; n.sig.textContent = ''; }
  }

  // ============================================================================================================
  Trk.vista = function (A, vista) {
    const E = Sv.espejo;
    const root = el('div', { class: 'tk' });
    vista.append(root);
    const refs = {};
    let sucio = { todo: true, log: true, cfg: true }, rafId = 0, abierto = null, escala = null;

    // ---------- cabecera ----------
    refs.pill = el('span', { class: 'tk-pill' });
    root.append(el('div', { class: 'tk-cab' }, el('span', { class: 'tk-dr' }, svgIcono('tracker')), el('div', { class: 'crece' }, el('h2', null, 'Initiative Tracker'), el('small', null, 'El tracker de iniciativa de Frodo · Arduino por USB')), refs.pill));

    // ---------- conexion ----------
    const sop = Sv.soporte();
    refs.modos = {};
    const segm = el('div', { class: 'tk-seg', role: 'tablist' });
    [['usb', 'USB (Arduino)', sop.usb, 'Solo dentro de la APK, con el cable OTG'], ['web', 'Compu (Web Serial)', sop.web, 'Chrome o Edge en la compu'], ['sim', 'Simulador', true, '']].forEach(([m, n, ok, tip]) => {
      const b = el('button', { type: 'button', title: ok ? '' : tip, disabled: !ok, onclick: () => { Sv.modo = m; Sv.avisar('modo'); } }, n); refs.modos[m] = b; segm.append(b);
    });
    refs.cBtn = el('button', { type: 'button', class: 'primario', onclick: () => { if (Sv.estado === 'conectado' || Sv.estado === 'conectando') Sv.desconectar(); else Sv.conectar(Sv.modo || undefined); } }, 'Conectar');
    refs.cTxt = el('div', { class: 'tk-estado' });
    refs.cAyuda = el('p', { class: 'suave tk-nota' });
    root.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Conexión'), segm, el('div', { class: 'fila tk-fila' }, refs.cBtn, refs.cTxt), refs.cAyuda));

    // ---------- ahora (ronda, turno, ficha) ----------
    refs.ronda = el('span', { class: 'tk-ronda' }, '1');
    refs.tNom = el('b'); refs.tCl = el('span', { class: 'suave' }); refs.tSig = el('small', { class: 'suave' });
    refs.fichaTurno = document.createElementNS(NS, 'svg'); refs.fichaTurno.setAttribute('viewBox', '0 0 100 170'); refs.fichaTurno.setAttribute('class', 'tk-fichaT');
    refs.modoTxt = el('span', { class: 'tk-modo' });
    root.append(el('div', { class: 'tarjeta' },
      el('div', { class: 'tk-hero' }, el('div', { class: 'tk-rondaBox' }, el('small', null, 'RONDA'), refs.ronda), el('div', { class: 'crece tk-turno' }, el('small', { class: 'suave' }, 'Turno de'), refs.tNom, refs.tCl, refs.tSig), refs.fichaTurno),
      el('div', { class: 'fila tk-fila' }, el('button', { type: 'button', onclick: () => Trk.abrirMesa() }, 'Pantalla de mesa'), refs.modoTxt)));

    // ---------- el tracker (foto + fichas) ----------
    refs.foto = el('div', { class: 'tk-foto' }, el('img', { alt: 'Tracker de frente', src: 'tracker/tracker.jpg', draggable: 'false' }));
    refs.svgT = document.createElementNS(NS, 'svg'); refs.svgT.setAttribute('viewBox', '0 0 1998 800'); refs.svgT.setAttribute('preserveAspectRatio', 'none');
    refs.svgT.innerHTML = '<defs><filter id="tk-gl" x="-60%" y="-30%" width="220%" height="160%"><feGaussianBlur stdDeviation="7"/></filter><clipPath id="tk-clip"><rect x="0" y="0" width="1998" height="287"/></clipPath><linearGradient id="tk-fade" gradientUnits="userSpaceOnUse" x1="0" y1="170" x2="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient></defs>';
    refs.slots = [];
    const tapa = document.createElementNS(NS, 'g'); tapa.setAttribute('clip-path', 'url(#tk-clip)');   // lo que pasa de la tapa de madera no se ve
    for (let i = 0; i < 12; i++) {
      const cov = document.createElementNS(NS, 'rect'); cov.setAttribute('x', CX[i] - 71); cov.setAttribute('y', 66); cov.setAttribute('width', 142); cov.setAttribute('height', 220); cov.setAttribute('fill', '#040404'); refs.svgT.append(cov);
      const g = document.createElementNS(NS, 'g'); g.setAttribute('transform', 'translate(' + (CX[i] - 71.5) + ',83) scale(1.43)');   // la ficha mide lo que la de la foto; la base queda tapada por la tapa
      g.innerHTML = '<g class="gl" filter="url(#tk-gl)"></g><g class="sh"></g><g class="fd" fill="url(#tk-fade)"></g>'; tapa.append(g);
      refs.slots.push({ g, gl: g.querySelector('.gl'), sh: g.querySelector('.sh'), fd: g.querySelector('.fd'), firma: '' });
    }
    refs.svgT.append(tapa);
    refs.foto.append(refs.svgT);
    refs.sinSenal = el('div', { class: 'tk-vacio' }, 'Conectá el Arduino (o el simulador) para ver el tracker en vivo.');
    refs.foto.append(refs.sinSenal);
    const cardFoto = (el('div', { class: 'tarjeta' }, el('h3', null, 'El tracker, en vivo'), refs.foto, el('p', { class: 'suave tk-nota' }, 'Las fichas se ponen según los personajes que armó Frodo en el Arduino y se iluminan con el mismo color que los LED del aparato. Solo el combate muestra fichas; al armar, se ven los LED.')));

    // ---------- joystick ----------
    refs.barra = el('i');
    const bJ = (cls, lado, etiqueta) => {
      const b = el('button', { type: 'button', class: 'tk-jb ' + cls, 'aria-label': etiqueta });
      let abajo = false;
      const arriba = () => {
        if (!abajo) return; abajo = false; b.classList.remove('p'); Sv.simBoton(lado, false);
        if (lado === 'C') {
          const dur = cDown ? performance.now() - cDown : 0; cDown = 0; refs.barra.style.width = '0';
          if (dur && dur < 500 && E && E.S && E.S.modo === 'Q') toast('Para confirmar la cantidad hay que mantener el botón del medio 2 segundos');
        }
      };
      b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); if (Sv.modo !== 'sim' || Sv.estado !== 'conectado') { toast('El joystick de la pantalla maneja el simulador. En el aparato real, usá el joystick de Frodo.'); return; } abajo = true; try { b.setPointerCapture(ev.pointerId); } catch (e) {} b.classList.add('p'); Sv.simBoton(lado, true); if (lado === 'C') cDown = performance.now(); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((k) => b.addEventListener(k, arriba));   // con captura: aunque el mouse se corra un poco, el boton sigue apretado hasta soltar
      return b;
    };
    let cDown = 0;
    refs.joy = el('div', { class: 'tk-joy' }, el('img', { alt: 'Joystick de 3 botones', src: 'tracker/joystick.png', draggable: 'false' }), bJ('b1', 'I', 'Izquierda: turno siguiente'), bJ('b2', 'C', 'Centro'), bJ('b3', 'D', 'Derecha: turno anterior'));
    const botonUndo = el('button', { type: 'button', onclick: () => combo('D') }, '↶ Deshacer (Centro + Der.)');
    const botonIns = el('button', { type: 'button', onclick: () => combo('I') }, '＋ Insertar (Centro + Izq.)');
    const botonRst = el('button', { type: 'button', onclick: () => { Sv.simReiniciar(); toast('Simulador reiniciado'); } }, 'Reiniciar simulador');
    function combo(lado) { if (Sv.modo !== 'sim' || Sv.estado !== 'conectado') return; Sv.simBoton('C', true); setTimeout(() => { Sv.simBoton(lado, true); setTimeout(() => { Sv.simBoton(lado, false); Sv.simBoton('C', false); }, 120); }, 60); }
    refs.joyCard = el('div', { class: 'tarjeta' }, el('h3', null, 'Joystick ', el('small', null, 'también andan ← → y la barra espaciadora (simulador)')), refs.joy,
      el('div', { class: 'tk-ayuda' }, el('div', null, '◀ Izq.', el('br'), 'turno siguiente'), el('div', null, 'Centro: estado', el('br'), 'mantené 2 s = caído / muerte'), el('div', null, 'Der. ▶', el('br'), 'turno anterior')),
      el('div', { class: 'tk-barra' }, refs.barra), el('div', { class: 'fila tk-fila' }, botonUndo, botonIns, botonRst),
      el('p', { class: 'suave tk-nota' }, 'Armando: izquierda / derecha cambian la cantidad o el personaje; centro 2 s confirma la cantidad; centro corto confirma cada personaje. Los tres botones juntos 3 s reinician.'));
    // En pantalla ancha (escritorio) el tracker con su joystick va en la columna de la derecha, en el lugar de la maqueta del Macrodeck (lo monta Maqueta.montar).
    const lado = !!(MD.Maqueta && MD.Maqueta.activa());
    Trk._lado = lado ? [cardFoto, refs.joyCard] : null;
    if (!lado) root.append(cardFoto, refs.joyCard);

    // ---------- sesion ----------
    const tile = (n) => { const b = el('b', null, '0'); refs['s_' + n[0]] = b; return el('div', null, b, el('span', null, n[1])); };
    root.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Sesión'), el('div', { class: 'tk-stats' }, [['ronda', 'ronda'], ['muertes', 'muertes'], ['caidos', 'caídos'], ['turnos', 'turnos'], ['tiempo', 'combate'], ['medio', 'por turno']].map(tile)),
      el('div', { class: 'fila tk-fila' }, el('button', { type: 'button', onclick: () => { Sv.stats = Trk.statsNueva(); Sv.avisar('ev'); } }, 'Poner en cero'))));

    // ============================================================================================================
    // ---------- sonidos y luces por movimiento ----------
    let ambito = null;                                   // null = general · letra = solo para esa clase
    refs.lista = el('div', { class: 'tk-evs' });
    const cfg = () => Sv.cfg;
    const entrada = (id, t, crear) => {
      const c = cfg();
      if (t) { if (!c.cl[t]) { if (!crear) return null; c.cl[t] = {}; } if (!c.cl[t][id]) { if (!crear) return null; c.cl[t][id] = {}; } return c.cl[t][id]; }
      if (!c.ev[id]) { if (!crear) return null; c.ev[id] = {}; } return c.ev[id];
    };
    const limpiar = (id, t) => {
      const o = entrada(id, t, false); if (!o || Object.keys(o).length) return;
      if (t) { delete cfg().cl[t][id]; if (!Object.keys(cfg().cl[t]).length) delete cfg().cl[t]; } else delete cfg().ev[id];
    };
    function cambiar(id, t, fn, redibujar) { const o = entrada(id, t, true); fn(o); limpiar(id, t); Sv.guardarCfg(); if (redibujar !== false) { sucio.cfg = true; pedir(); } }
    function probar(id, t) {
      Trk.Audio.asegurar(); const r = Trk.resolver(cfg(), id, t);
      Trk.Audio.tocar(r.s, r.vol, 'prueba' + id + (t || '')); if (r.l && cfg().luces) Trk.Luz.disparar(r.l);
    }
    const resumen = (id) => {
      const r = Trk.resolver(cfg(), id, null), p = [];
      p.push(r.s.length ? '🔊 ' + Trk.Audio.nombreDe(r.s[0]) + (r.s.length > 1 ? ' +' + (r.s.length - 1) : '') : '🔇 sin sonido');
      if (r.l) p.push('💡 ' + Trk.Luz.nombreLook(r.l.look) + ' · ' + r.l.seg + ' s');
      const n = Object.keys(cfg().cl || {}).filter((t) => cfg().cl[t][id]).length; if (n) p.push('👤 ' + n + ' por personaje');
      return p.join('  ·  ');
    };
    const seg = (opts, actual, fn) => el('div', { class: 'tk-seg2' }, opts.map(([v, n]) => el('button', { type: 'button', class: v === actual ? 'on' : '', onclick: () => fn(v) }, n)));
    const checkSnd = (id, t, o, ref, nombre) => {
      const marcado = (o.s || []).indexOf(ref) >= 0;
      return el('div', { class: 'tk-item' }, el('label', null, el('input', { type: 'checkbox', checked: marcado, onchange: (ev) => cambiar(id, t, (x) => { const s = (x.s || []).slice(); const i = s.indexOf(ref); if (ev.target.checked && i < 0) s.push(ref); if (!ev.target.checked && i >= 0) s.splice(i, 1); x.s = s; }) }), ' ', nombre),
        el('button', { type: 'button', class: 'chico', 'aria-label': 'Escuchar ' + nombre, onclick: () => { Trk.Audio.asegurar(); Trk.Audio.tocar([ref], 1, 'prev'); } }, '▶'));
    };
    function editor(id) {
      const ev = Trk.EV[id], t = ambito, esC = !!t, o = entrada(id, t, false) || {}, r = Trk.resolver(cfg(), id, t), w = el('div', { class: 'tk-ed' });
      if (ev.clase) {
        w.append(el('div', { class: 'tk-clases' }, el('button', { type: 'button', class: !t ? 'on' : '', onclick: () => { ambito = null; sucio.cfg = true; pedir(); } }, 'General'),
          Trk.LETRAS.split('').map((c) => el('button', { type: 'button', class: (t === c ? 'on ' : '') + (Trk.cambiado(cfg(), id, c) ? 'tiene' : ''), onclick: () => { ambito = c; sucio.cfg = true; pedir(); } }, Trk.TIPOS[c].n))));
        if (esC) w.append(el('p', { class: 'suave tk-nota' }, 'Solo cuando el movimiento es de ' + Trk.TIPOS[t].n + ' (' + Trk.TIPOS[t].cl + '). Lo que no cambies acá, vale lo del movimiento general.'));
      }
      // sonido
      const modoS = o.s === undefined ? (esC ? 'igual' : 'fab') : (o.s.length ? 'elegir' : 'silencio');
      w.append(el('h4', null, '🔊 Sonido'));
      w.append(seg(esC ? [['igual', 'Igual que el general'], ['silencio', 'Silencio'], ['elegir', 'Elegir…']] : [['fab', 'De fábrica' + (ev.sf ? '' : ' (nada)')], ['silencio', 'Silencio'], ['elegir', 'Elegir…']], modoS, (v) => {
        if (v === 'igual' || v === 'fab') cambiar(id, t, (x) => { delete x.s; });
        else if (v === 'silencio') cambiar(id, t, (x) => { x.s = []; });
        else cambiar(id, t, (x) => { x.s = r.s.length ? r.s.slice() : ['f:' + Trk.SFX_FABRICA[0]]; });
      }));
      if (modoS === 'elegir') {
        w.append(el('p', { class: 'suave tk-nota' }, 'Tildá uno o varios. Si tildás varios, suena uno al azar sin repetir el último.'));
        w.append(el('div', { class: 'tk-lista' }, el('small', { class: 'suave' }, 'De fábrica (los de Frodo)'), Trk.SFX_FABRICA.map((f) => checkSnd(id, t, o, 'f:' + f, Trk.SFX_NOMBRES[f] + ' · ' + f))));
        const lib = (A.cfg && A.cfg.sonidos) || [];
        w.append(el('div', { class: 'tk-lista' }, el('small', { class: 'suave' }, 'Mi biblioteca (pestaña Sonidos)'), lib.length ? lib.map((s) => checkSnd(id, t, o, 's:' + s.id, s.nombre || s.id)) : el('p', { class: 'suave tk-nota' }, 'Todavía no hay sonidos en la biblioteca. Se suben desde Más > Sonidos.')));
        (o.s || []).filter((x) => !Trk.Audio.existe(x)).forEach((x) => w.append(el('p', { class: 'tk-aviso' }, 'Un sonido elegido ya no está en la biblioteca y se saltea.')));
      }
      if (modoS !== 'silencio' && r.s.length) {
        const vol = el('input', { type: 'range', min: 0, max: 100, value: Math.round(r.vol * 100), 'aria-label': 'Volumen de este movimiento' });
        const lab = el('span', { class: 'suave' }, Math.round(r.vol * 100) + '%');
        vol.addEventListener('input', () => { lab.textContent = vol.value + '%'; cambiar(id, t, (x) => { x.vol = vol.value / 100; if (x.vol === 1) delete x.vol; }, false); });
        w.append(el('div', { class: 'fila tk-fila' }, el('label', { style: 'margin:0' }, 'Volumen de este movimiento'), el('span', { class: 'crece' }, vol), lab));
      }
      // luz
      const L = MD.LucesDnd, modoL = o.l === undefined ? (esC ? 'igual' : 'fab') : (o.l === null ? 'sin' : 'una');
      w.append(el('h4', null, '💡 Luz'));
      w.append(seg(esC ? [['igual', 'Igual que el general'], ['sin', 'Sin luz'], ['una', 'Elegir luz…']] : [['fab', 'Sin luz'], ['una', 'Elegir luz…']], modoL, (v) => {
        if (v === 'igual' || v === 'fab') cambiar(id, t, (x) => { delete x.l; });
        else if (v === 'sin') cambiar(id, t, (x) => { x.l = null; });
        else cambiar(id, t, (x) => { const s = ev.sug || {}; x.l = { look: s.look || 'lf_hechizo', seg: s.seg || 3, lamp: 'dnd' }; });
      }));
      if (modoL === 'una' && o.l) {
        const looks = (L && L.todosLosLooks) ? L.todosLosLooks() : [];
        if (!looks.length) w.append(el('p', { class: 'tk-aviso' }, 'No encuentro los looks de luces. Entrá a la pestaña Luces una vez.'));
        const sel = el('select', { 'aria-label': 'Look de luz' }, looks.map((k) => el('option', { value: k.id, selected: k.id === o.l.look }, k.nombre)));
        sel.addEventListener('change', () => cambiar(id, t, (x) => { x.l = Object.assign({}, x.l, { look: sel.value }); }));
        const segs = el('input', { type: 'number', min: 0.5, max: 30, step: 0.5, value: o.l.seg, 'aria-label': 'Segundos' });
        segs.addEventListener('change', () => cambiar(id, t, (x) => { x.l = Object.assign({}, x.l, { seg: Math.min(30, Math.max(0.5, +segs.value || 3)) }); }));
        const lamp = el('select', { 'aria-label': 'Lámpara' }, [['dnd', 'Las dos'], ['dnd-1', 'Lámpara 1'], ['dnd-2', 'Lámpara 2']].map(([v, n]) => el('option', { value: v, selected: v === o.l.lamp }, n)));
        lamp.addEventListener('change', () => cambiar(id, t, (x) => { x.l = Object.assign({}, x.l, { lamp: lamp.value }); }));
        w.append(el('div', { class: 'cols' }, el('div', null, el('label', null, 'Look'), sel), el('div', null, el('label', null, 'Segundos'), segs), el('div', null, el('label', null, 'Lámpara'), lamp)));
        w.append(el('div', { class: 'fila tk-fila' }, el('button', { type: 'button', onclick: () => { if (!Trk.Luz.disparar(o.l)) toast('Las luces están apagadas en este celu (pestaña Luces)'); } }, 'Probar la luz'),
          ev.sug ? el('button', { type: 'button', onclick: () => cambiar(id, t, (x) => { x.l = { look: ev.sug.look, seg: ev.sug.seg, lamp: 'dnd' }; }) }, 'Usar la sugerida') : null));
      }
      if (!Trk.Luz.disponible()) w.append(el('p', { class: 'suave tk-nota' }, 'Ahora las luces de D&D están apagadas en este celu: elegí igual lo que querés y se prenden cuando las actives en la pestaña Luces.'));
      w.append(el('div', { class: 'fila tk-fila tk-pie' }, el('button', { type: 'button', class: 'primario', onclick: () => probar(id, t) }, '▶ Probar el movimiento'),
        el('button', { type: 'button', disabled: !Trk.cambiado(cfg(), id, t), onclick: () => { cambiar(id, t, (x) => { for (const k of Object.keys(x)) delete x[k]; }); toast('Vuelto a lo de fábrica'); } }, esC ? 'Quitar lo de ' + Trk.TIPOS[t].n : 'Restaurar de fábrica')));
      return w;
    }
    function pintarLista() {
      refs.lista.innerHTML = '';
      Trk.GRUPOS.forEach((g) => {
        refs.lista.append(el('h4', { class: 'tk-grupo' }, g));
        Trk.EVENTOS.filter((e) => e.g === g).forEach((e) => {
          const cambios = Trk.cambiosDe(cfg(), e.id), esta = abierto === e.id;
          const fila = el('div', { class: 'tk-ev' + (esta ? ' abierto' : '') },
            el('div', { class: 'tk-ev-cab' },
              el('button', { type: 'button', class: 'tk-ev-n', 'aria-expanded': esta ? 'true' : 'false', onclick: () => { abierto = esta ? null : e.id; ambito = null; sucio.cfg = true; pedir(); } }, el('b', null, e.n, ' ', el('code', null, e.id)), el('small', { class: 'suave' }, resumen(e.id))),
              el('span', { class: 'tk-tag ' + (cambios ? 'c' : 'f') }, cambios ? 'Cambiado' : 'De fábrica'),
              el('button', { type: 'button', class: 'chico', 'aria-label': 'Probar ' + e.n, onclick: () => probar(e.id, null) }, '▶')));
          if (esta) { fila.append(el('p', { class: 'suave tk-nota' }, e.d)); fila.append(editor(e.id)); }
          refs.lista.append(fila);
        });
      });
    }
    refs.rt = el('button', { type: 'button', class: 'peligro', onclick: (ev) => { const b = ev.currentTarget; if (!b.classList.contains('seguro')) { b.classList.add('seguro'); b.textContent = '¿Seguro? Tocá otra vez'; setTimeout(() => { b.classList.remove('seguro'); b.textContent = 'Restaurar TODO de fábrica'; }, 3000); return; }
      cfg().ev = {}; cfg().cl = {}; Sv.guardarCfg(); sucio.cfg = true; pedir(); b.classList.remove('seguro'); b.textContent = 'Restaurar TODO de fábrica'; toast('Todo vuelto a lo de fábrica'); } }, 'Restaurar TODO de fábrica');
    root.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Sonidos y luces por movimiento'),
      el('p', { class: 'suave tk-nota' }, 'Cada movimiento del tracker puede tener su sonido y su luz, y hasta uno distinto según el personaje. Lo de fábrica es la selección de Frodo: no se pierde nunca, siempre se puede volver con «Restaurar».'),
      refs.lista,
      el('div', { class: 'fila tk-fila' },
        el('button', { type: 'button', onclick: () => { let n = 0; Trk.EVENTOS.forEach((e) => { if (e.sug && !(cfg().ev[e.id] && cfg().ev[e.id].l !== undefined)) { (cfg().ev[e.id] = cfg().ev[e.id] || {}).l = { look: e.sug.look, seg: e.sug.seg, lamp: 'dnd' }; n++; } }); Sv.guardarCfg(); sucio.cfg = true; pedir(); toast(n ? 'Luces sugeridas puestas en ' + n + ' movimientos' : 'Ya estaban puestas'); } }, 'Poner luces sugeridas'),
        el('button', { type: 'button', onclick: () => { Object.keys(cfg().ev).forEach((id) => { delete cfg().ev[id].l; if (!Object.keys(cfg().ev[id]).length) delete cfg().ev[id]; }); Sv.guardarCfg(); sucio.cfg = true; pedir(); } }, 'Quitar todas las luces'), refs.rt)));

    // ---------- ajustes ----------
    const chk = (txt, val, fn, ayuda) => el('label', { class: 'tk-chk' }, el('input', { type: 'checkbox', checked: val, onchange: (ev) => fn(ev.target.checked) }), ' ', txt, ayuda ? el('small', { class: 'suave' }, ayuda) : null);
    const vol = el('input', { type: 'range', min: 0, max: 100, value: Math.round(cfg().vol * 100), 'aria-label': 'Volumen del tracker' });
    const volL = el('span', { class: 'suave' }, Math.round(cfg().vol * 100) + '%');
    vol.addEventListener('input', () => { volL.textContent = vol.value + '%'; cfg().vol = vol.value / 100; Sv.guardarCfg(); });
    const baud = el('select', { 'aria-label': 'Baudios' }, [115200, 57600, 38400, 19200, 9600].map((b) => el('option', { value: b, selected: b === cfg().baud }, b + (b === 115200 ? ' (recomendado)' : ''))));
    baud.addEventListener('change', () => { cfg().baud = +baud.value; Sv.guardarCfg(); toast('Se usa en la próxima conexión (y tiene que coincidir con BAUDIOS del sketch)'); });
    root.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Ajustes del tracker'),
      el('div', { class: 'fila tk-fila' }, el('label', { style: 'margin:0' }, 'Volumen de los sonidos'), el('span', { class: 'crece' }, vol), volL, el('button', { type: 'button', class: 'chico', onclick: () => { Trk.Audio.asegurar(); Trk.Audio.tocar(['f:cmbMove1'], 1, 'prueba'); } }, '▶')),
      chk('Bajar la música de otras apps mientras suena (ducking)', cfg().duck, (v) => { cfg().duck = v; Sv.guardarCfg(); }, 'Solo dentro de la APK.'),
      chk('Mover las luces de D&D con los movimientos', cfg().luces, (v) => { cfg().luces = v; Sv.guardarCfg(); }, 'Usa las lámparas de la pestaña Luces. Si están apagadas en este celu, no pasa nada.'),
      chk('Conectar solo el Arduino al enchufarlo', cfg().auto, (v) => { cfg().auto = v; Sv.guardarCfg(); }, 'También reconecta si se corta el cable.'),
      el('label', null, 'Baudios (velocidad del puerto)'), baud));

    // ---------- monitor serie ----------
    let filtro = 'todo', pausa = false;
    refs.mon = el('div', { class: 'tk-mon', role: 'log', 'aria-live': 'off' });
    refs.monN = new Map();
    const filtros = [['todo', 'Todo'], ['ev', 'Movimientos'], ['st', 'Estado'], ['info', 'Conexión']];
    refs.chips = el('div', { class: 'tk-clases' }, filtros.map(([v, n]) => el('button', { type: 'button', 'data-f': v, class: v === filtro ? 'on' : '', onclick: () => { filtro = v; refs.chips.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.f === v)); refs.monN.forEach((e) => e.remove()); refs.monN.clear(); sucio.log = true; pedir(); } }, n)));
    const cmd = el('input', { type: 'text', placeholder: 'Escribirle algo al Arduino (ej.: ?)', 'aria-label': 'Orden al Arduino', autocomplete: 'off', autocapitalize: 'off' });
    const mandar = () => { const v = cmd.value; if (!v) return; if (!Sv.enviar(v)) toast('Conectá el Arduino primero'); cmd.value = ''; };
    cmd.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') mandar(); });
    refs.pausaB = el('button', { type: 'button', onclick: () => { pausa = !pausa; refs.pausaB.textContent = pausa ? 'Seguir' : 'Pausa'; if (!pausa) { sucio.log = true; pedir(); } } }, 'Pausa');
    refs.monInfo = el('small', { class: 'suave' });
    root.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Monitor serie ', el('small', null, 'lo que dice el Arduino, renglón por renglón')), refs.chips, refs.mon, refs.monInfo,
      el('div', { class: 'fila tk-fila' }, refs.pausaB, el('button', { type: 'button', onclick: () => { Sv.limpiarLog(); refs.monN.forEach((e) => e.remove()); refs.monN.clear(); } }, 'Limpiar'),
        el('button', { type: 'button', onclick: () => { const t = Sv.log.map((l) => hora(l.t) + ' ' + (l.dir === 'tx' ? '> ' : '') + l.txt + (l.n > 1 ? '  x' + l.n : '') + (l.nota ? '   // ' + l.nota : '')).join('\n'); try { navigator.clipboard.writeText(t); toast('Copiado'); } catch (e) { toast('No se pudo copiar'); } } }, 'Copiar todo')),
      el('div', { class: 'fila tk-fila' }, el('div', { class: 'crece' }, cmd), el('button', { type: 'button', onclick: mandar }, 'Enviar'), el('button', { type: 'button', onclick: () => { if (!Sv.enviar('?')) toast('Conectá el Arduino primero'); } }, 'Pedir estado (?)'))));
    function pintarMonitor() {
      if (pausa) return;
      const ok = (l) => filtro === 'todo' || (filtro === 'ev' && l.k === '@') || (filtro === 'st' && (l.k === '#' || l.k === '!')) || (filtro === 'info' && l.dir === 'info');
      const lista = Sv.log.filter(ok).slice(-160), ids = new Set(lista.map((l) => l.id));
      refs.monN.forEach((e, id) => { if (!ids.has(id)) { e.remove(); refs.monN.delete(id); } });
      const pegado = refs.mon.scrollTop + refs.mon.clientHeight >= refs.mon.scrollHeight - 30;
      lista.forEach((l) => {
        let e = refs.monN.get(l.id);
        if (!e) { e = el('div', { class: 'tk-l k' + (l.dir === 'tx' ? 'tx' : (l.dir === 'info' ? 'info' : l.k)) }, el('span', { class: 'h' }), el('span', { class: 't' }), el('span', { class: 'x' }), el('span', { class: 'n' })); refs.mon.append(e); refs.monN.set(l.id, e); }
        e.children[0].textContent = hora(l.t); e.children[1].textContent = (l.dir === 'tx' ? '→ ' : '') + l.txt; e.children[2].textContent = l.n > 1 ? ' ×' + l.n : ''; e.children[3].textContent = l.nota ? '  ' + l.nota : '';
      });
      if (pegado) refs.mon.scrollTop = refs.mon.scrollHeight;
      refs.monInfo.textContent = Sv.log.length + ' renglones guardados · ' + (Sv.rxN || 0) + ' recibidos en esta conexión' + (Trk.Audio.fallos.length ? ' · ⚠ ' + Trk.Audio.fallos[Trk.Audio.fallos.length - 1] : '');
    }

    // ---------- avisos ----------
    function toast(txt) { let t = document.getElementById('tkToast'); if (!t) { t = el('div', { id: 'tkToast', class: 'tk-toast', role: 'status' }); document.body.append(t); } t.textContent = txt; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }

    // ---------- actualizar lo que cambia poco ----------
    function actualizar() {
      const S = E.S, est = Sv.estado, c = est === 'conectado', ocup = est === 'conectando';
      Object.keys(refs.modos).forEach((m) => { refs.modos[m].className = Sv.modo === m ? 'on' : ''; refs.modos[m].disabled = (c || ocup) || (m === 'usb' && !sop.usb) || (m === 'web' && !sop.web); });
      refs.cBtn.textContent = c || ocup ? 'Desconectar' : 'Conectar'; refs.cBtn.disabled = !c && !ocup && !Sv.modo;
      const p = Sv.pill();
      refs.cTxt.textContent = c ? (Sv.sinSenal() ? '⚠ Conectado, pero no llega nada del Arduino' : '● Conectado' + (Sv.modo === 'sim' ? ' (simulador)' : '') + (Sv.hola ? ' · firmware ' + Sv.hola.ver : '')) : (ocup ? '… ' + Sv.detalle : (est === 'error' ? '✖ ' + Sv.detalle : 'Sin conexión'));
      refs.cTxt.className = 'tk-estado ' + (c ? (Sv.sinSenal() ? 'warn' : 'ok') : (est === 'error' ? 'mal' : ''));
      refs.cAyuda.textContent = Sv.modo === 'usb' ? 'Enchufá el Arduino al celu con un cable OTG; Android te pide permiso la primera vez. Si el Uno se reinicia al conectar, es normal: retoma el combate guardado.' : (Sv.modo === 'web' ? 'Chrome o Edge en la compu: te deja elegir el puerto del Arduino.' : (Sv.modo === 'sim' ? 'El simulador es un Arduino virtual con la misma lógica que el sketch: probá todo sin el aparato.' : (sop.usb ? 'Elegí cómo conectar.' : 'Sin el APK no hay USB: probá con el simulador, o con Web Serial desde Chrome en la compu.')));
      refs.pill.className = 'tk-pill ' + (p ? p.clase : 'off'); refs.pill.textContent = p ? p.texto : 'Sin conexión';
      refs.joyCard.classList.toggle('inactivo', !(Sv.modo === 'sim' && c));
      const hay = c && E.hay;
      refs.sinSenal.style.display = hay ? 'none' : 'flex';
      refs.sinSenal.textContent = c ? 'Esperando el estado del Arduino…' : 'Conectá el Arduino (o el simulador) para ver el tracker en vivo.';
      refs.ronda.textContent = S.ronda;
      if (S.modo === 'B' && hay) {
        const k = S.turno; refs.tNom.textContent = nombreFicha(S, k); refs.tCl.textContent = Trk.TIPOS[S.tipo[k]].cl + (S.alt[k] ? ' · ' + Trk.ALT_N[S.alt[k]] : '');
        let sig = k, n = 0; do { sig = sig % S.total + 1; n++; } while (S.muerto[sig] && n < 13);
        refs.tSig.textContent = S.muerto[sig] || sig === k ? '' : 'Sigue: ' + nombreFicha(S, sig);
        refs.fichaTurno.innerHTML = Trk.ficha(S.tipo[k], S.tipo[k] === 'E' ? Trk.numEnemigo(S, k) : 0);
      } else { refs.tNom.textContent = hay ? (S.modo === 'Q' ? 'Eligiendo la cantidad' : 'Eligiendo los personajes') : '—'; refs.tCl.textContent = ''; refs.tSig.textContent = ''; refs.fichaTurno.innerHTML = ''; }
      refs.modoTxt.textContent = hay ? (S.modo === 'Q' ? 'Cantidad: ' + S.total + ' · mantené el centro 2 s para confirmar' : (S.modo === 'C' ? 'Personaje ' + S.cfg + ' de ' + S.total : 'Combate · ' + S.total + ' lugares' + (S.ins ? ' · insertando' : ''))) : '';
      // estadisticas
      const st = Sv.stats, seg = st.t0 ? Math.floor((Date.now() - st.t0) / 1000) : 0;
      refs.s_ronda.textContent = S.modo === 'B' ? S.ronda : '–'; refs.s_muertes.textContent = st.muertes; refs.s_caidos.textContent = st.caidos; refs.s_turnos.textContent = st.turnos;
      refs.s_tiempo.textContent = Math.floor(seg / 60) + ':' + pad2(seg % 60); refs.s_medio.textContent = st.turnos && seg ? Math.round(seg / st.turnos) + ' s' : '–';
    }

    // ---------- dibujar el tracker (cada cuadro) ----------
    function dibujar(ms) {
      const S = E.S, cols = E.p.cols, hay = Sv.estado === 'conectado' && E.hay, off = E.p.off;
      for (let i = 1; i <= 12; i++) {
        const sl = refs.slots[i - 1], k = i - off;
        if (!hay || k < 1 || k > S.total) { if (sl.g.style.display !== 'none') sl.g.style.display = 'none'; continue; }
        const t = S.modo === 'B' || (S.modo === 'C' && k <= S.cfg) ? S.tipo[k] : '?', num = t === 'E' ? Trk.numEnemigo(S, k) : 0, firma = t + num;
        if (sl.firma !== firma) { sl.firma = firma; const html = Trk.ficha(t, num); sl.gl.innerHTML = html; sl.sh.innerHTML = html; sl.fd.innerHTML = html; }
        sl.g.style.display = '';
        const c = cols[i] || [0, 0, 0], luz = c[0] + c[1] + c[2] > 12, fill = luz ? rgb(c) : '#1d1d20';
        sl.gl.setAttribute('fill', fill); sl.gl.style.opacity = luz ? Math.min(0.8, 0.15 + Math.max(c[0], c[1], c[2]) / 255 * 0.55) : 0; sl.sh.setAttribute('fill', fill); sl.fd.style.display = luz ? '' : 'none';
      }
      if (hay && S.modo === 'B') { const c = cols[S.turno + off] || [0, 0, 0], tc = Trk.TIPOS[S.tipo[S.turno]].c; refs.fichaTurno.style.fill = rgb(tc); }
      if (cDown) refs.barra.style.width = Math.min(100, (performance.now() - cDown) / 20) + '%';
    }

    // ---------- bucle ----------
    function pedir() { sucio.todo = true; }
    const quien = Sv.alCambio((que) => { if (que === 'log') sucio.log = true; else { sucio.todo = true; if (que === 'cfg') sucio.cfg = true; } if (typeof que === 'string' && que.indexOf('aviso:') === 0) toast(que.slice(6)); });
    function lazo(ms) {
      if (!root.isConnected) { quien(); document.removeEventListener('keydown', teclas); document.removeEventListener('keyup', teclasArriba); return; }
      if (sucio.todo) { sucio.todo = false; actualizar(); }
      if (sucio.cfg) { sucio.cfg = false; pintarLista(); }
      if (sucio.log) { sucio.log = false; pintarMonitor(); }
      dibujar(ms);
      if (ms - (lazo.t || 0) > 500) { lazo.t = ms; actualizar(); }                 // reloj de la sesion y chequeo de "sin senal"
      rafId = requestAnimationFrame(lazo);
    }
    // teclado del simulador
    const teclas = (ev) => { if (ev.repeat || Sv.modo !== 'sim' || Sv.estado !== 'conectado' || /INPUT|TEXTAREA|SELECT/.test((ev.target || {}).tagName || '')) return;
      if (ev.key === 'ArrowLeft') { Sv.simBoton('I', true); ev.preventDefault(); } else if (ev.key === 'ArrowRight') { Sv.simBoton('D', true); ev.preventDefault(); } else if (ev.code === 'Space') { Sv.simBoton('C', true); cDown = performance.now(); ev.preventDefault(); } };
    const teclasArriba = (ev) => { if (ev.key === 'ArrowLeft') Sv.simBoton('I', false); else if (ev.key === 'ArrowRight') Sv.simBoton('D', false); else if (ev.code === 'Space') { Sv.simBoton('C', false); cDown = 0; refs.barra.style.width = '0'; } };
    document.addEventListener('keydown', teclas); document.addEventListener('keyup', teclasArriba);
    if (!Sv.modo) Sv.modo = sop.usb ? 'usb' : 'sim';
    pintarLista(); pintarMonitor(); actualizar();
    rafId = requestAnimationFrame(lazo);
  };
})(window.MD);
