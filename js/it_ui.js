// it_ui.js - Pestana «Tracker IT» (2.0-dev13): lo que se SUMA a la vista del Initiative Tracker cuando el tracker es el ESP32 nuevo.
//
//   - Taller de colores: color de cada personaje, quien se puede elegir (incluidos los 4 invitados con color A-D y el invitado generico, siempre opcionales),
//     nombre de los invitados y brillo de la tira. Se guarda en la app (Sv.cfg.taller) y se manda al tracker apenas conecta (o al tocar «Guardar y aplicar»).
//   - Combates guardados: al terminar un combate (victoria, caida total o reinicio) se guarda un resumen en este celu. Se pueden ver en grande
//     (para el monitor del dummy) y bajar como CSV.
//   - Lamparas que siguen el turno: opcional y APAGADO de fabrica. Complementa (no reemplaza) los sonidos y luces que se asignan a cada movimiento.
//
// Todo anda igual con el tracker simulado (Frodo no tiene Macrodeck ni tracker): el simulador entiende las mismas ordenes que el ESP32.
window.MD = window.MD || {};
(function (MD) {
  const Trk = MD.Trk || (MD.Trk = {});
  const SV = () => Trk.Servicio;
  const pad2 = (n) => String(n).padStart(2, '0');
  const hex = (c) => '#' + c.map((v) => pad2(Math.max(0, Math.min(255, v | 0)).toString(16))).join('');
  const deHex = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) || 0);
  const fechaCorta = (t) => { const d = new Date(t); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const durTxt = (s) => Math.floor(s / 60) + ':' + pad2(s % 60);
  const RES = { victoria: 'Victoria', tpk: 'Caída total', reinicio: 'Reiniciado' };

  // ============================================================================================================
  //  COMBATES GUARDADOS
  // ============================================================================================================
  const H = Trk.Hist = { lista: [], cur: null, _p: null };
  const CLAVE = 'tracker_hist', MAX = 60;
  H.asegurar = function () {
    if (!H._p) H._p = (async () => { try { const l = await MD.Almacen.leerConfigClave(CLAVE); if (Array.isArray(l)) H.lista = l.concat(H.lista.filter((x) => !l.some((y) => y.id === x.id))); } catch (e) {} })();
    return H._p;
  };
  H.guardar = function () { try { MD.Almacen.guardarConfigClave(CLAVE, H.lista.slice(0, MAX)); } catch (e) {} };
  const nuevo = (ahora, retomado) => ({ id: ahora, t0: ahora, retomado: !!retomado, rondas: 1, turnos: 0, muertes: {}, caidos: {}, turnosPorClase: {}, conc: 0, comodin: 0, deshacer: 0, inserciones: 0, fichas: '', fin: 0, dur: 0, res: '' });
  const sumar = (o, k) => { o[k] = (o[k] || 0) + 1; };
  H.componer = function () {
    const c = H.cur, S = SV().espejo && SV().espejo.S; if (!c || !S || !S.total) return;
    c.fichas = S.tipo.slice(1, S.total + 1).join('');
  };
  // lo llama el servicio con CADA evento del tracker
  H.alEvento = function (id, a, ahora) {
    const t = Trk.claseDe(id, a);
    if (id === 'CG') { H.cur = nuevo(ahora, false); setTimeout(H.componer, 700); return; }
    let c = H.cur;
    if (!c) {
      if (['TN', 'RN', 'KL', 'SI', 'SC', 'SJ'].indexOf(id) < 0) return;
      c = H.cur = nuevo(ahora, true); H.componer();                           // el combate ya estaba andando (se retomo o se conecto tarde)
    }
    if (id === 'TN' || id === 'RN') { c.turnos++; if (t) sumar(c.turnosPorClase, t); if (id === 'RN') c.rondas = Math.max(c.rondas, +a[0] || c.rondas); }
    else if (id === 'KL') { if (t) sumar(c.muertes, t); }
    else if (id === 'SI') { if (t) sumar(c.caidos, t); }
    else if (id === 'SC') c.conc++;
    else if (id === 'SJ') c.comodin++;
    else if (id === 'UN') c.deshacer++;
    else if (id === 'IN') c.inserciones++;
    else if (id === 'VI') H.fin('victoria', ahora);
    else if (id === 'TK') H.fin('tpk', ahora);
    else if (id === 'RS') { if (c.turnos > 0) H.fin('reinicio', ahora); else H.cur = null; }
  };
  H.fin = function (res, ahora) {
    const c = H.cur; H.cur = null; if (!c) return;
    H.componer.call(null); c.res = res; c.fin = ahora; c.dur = Math.max(0, Math.round((ahora - c.t0) / 1000));
    if (!c.fichas) { const S = SV().espejo && SV().espejo.S; if (S && S.total) c.fichas = S.tipo.slice(1, S.total + 1).join(''); }
    H.asegurar().then(() => { H.lista.unshift(c); H.lista.splice(MAX); H.guardar(); SV().avisar('hist'); });
  };
  const suma = (o) => Object.keys(o || {}).reduce((s, k) => s + o[k], 0);
  H.csvResumen = () => ['fecha;resultado;duracion_s;rondas;turnos;muertes;caidos;concentraciones;comodines;deshacer;inserciones;fichas'].concat(H.lista.map((c) =>
    [new Date(c.t0).toISOString().slice(0, 19).replace('T', ' '), RES[c.res] || c.res, c.dur, c.rondas, c.turnos, suma(c.muertes), suma(c.caidos), c.conc, c.comodin, c.deshacer, c.inserciones, c.fichas].join(';'))).join('\r\n');
  H.csvDetalle = () => {
    const f = ['fecha;clase;turnos;muertes;caidos'];
    H.lista.forEach((c) => {
      const clases = new Set([].concat(Object.keys(c.turnosPorClase), Object.keys(c.muertes), Object.keys(c.caidos)));
      clases.forEach((k) => f.push([new Date(c.t0).toISOString().slice(0, 19).replace('T', ' '), (Trk.TIPOS[k] || { n: k }).n, c.turnosPorClase[k] || 0, c.muertes[k] || 0, c.caidos[k] || 0].join(';')));
    });
    return f.join('\r\n');
  };
  function bajar(nombre, texto) {
    try {
      const u = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a');
      a.href = u; a.download = nombre; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return true;
    } catch (e) { return false; }
  }

  // ============================================================================================================
  //  LAMPARAS QUE SIGUEN EL TURNO (opcional; apagado de fabrica)
  // ============================================================================================================
  const TU = Trk.Turno = {};
  TU.colorDe = function (t) { const p = SV().espejo && SV().espejo.p; return (p && p.colores && p.colores[t]) || (Trk.TIPOS[t] || Trk.TIPOS.E).c; };
  TU.disparar = function (rgb, prueba) {
    const cfg = SV().cfg.luzTurno, L = MD.LucesDnd;
    if (!cfg || !L || !L.aj || !L.aj.activo) return false;
    const dest = cfg.lamp === 'dnd-1' || cfg.lamp === 'dnd-2' ? { luz: cfg.lamp } : { grupo: 'dnd' };
    L.enviar([Object.assign(dest, { look: { efecto: cfg.efecto, color: hex(rgb), brillo: cfg.brillo, velocidad: 1.2, intensidad: 5 }, capa: 'momento', segundos: prueba ? 3 : cfg.seg, id: 'trkturno' })]);
    return true;
  };
  TU.alEvento = function (id, a) {
    const cfg = SV().cfg.luzTurno; if (!cfg || !cfg.on) return;
    if (['TN', 'TP', 'RN', 'CG'].indexOf(id) < 0) return;
    let t = Trk.claseDe(id, a);
    if (!t) { const S = SV().espejo && SV().espejo.S; if (S && S.tipo && S.tipo[S.turno || 1]) t = S.tipo[S.turno || 1]; }
    if (t) TU.disparar(TU.colorDe(t));
  };

  // ============================================================================================================
  //  LA VISTA
  // ============================================================================================================
  const ITui = MD.ITui = {};
  ITui.agregar = function (c) {
    const { root, el, toast, antes } = c, Sv = SV();
    const poner = (nodo) => { if (antes && antes.parentNode === root) root.insertBefore(nodo, antes); else root.append(nodo); };
    const chk = (txt, val, fn, ayuda) => el('label', { class: 'tk-chk' }, el('input', { type: 'checkbox', checked: val, onchange: (ev) => fn(ev.target.checked) }), ' ', el('span', null, txt, ayuda ? el('small', { class: 'suave', style: 'display:block' }, ayuda) : null));

    // ---------------- TALLER DE COLORES ----------------
    const fabrica = () => ({ mask: Trk.MASCARA_FABRICA, brillo: Trk.BRILLO_FABRICA, col: Trk.coloresFabrica(), nom: {} });
    const deCfg = (x) => ({ mask: x.mascara, brillo: x.brillo, col: JSON.parse(JSON.stringify(x.colores)), nom: {} });
    let T = JSON.parse(JSON.stringify(Sv.cfg.taller || (Sv.cfgTracker ? deCfg(Sv.cfgTracker) : fabrica())));
    for (const k of 'abcd') if (!T.nom) T.nom = {};
    const filas = el('div', { class: 'it-filas' }), estadoT = el('p', { class: 'suave tk-nota' });
    const brilloV = el('b', null, String(T.brillo) + ' %');
    const brillo = el('input', { type: 'range', min: 5, max: 100, step: 5, value: T.brillo, 'aria-label': 'Brillo de la tira', oninput: () => { T.brillo = +brillo.value; brilloV.textContent = T.brillo + ' %'; } });
    function pintarFilas() {
      filas.innerHTML = '';
      Trk.LETRAS_TODAS.split('').forEach((k, i) => {
        const inv = 'abcd'.indexOf(k) >= 0, sw = el('input', { type: 'color', value: hex(T.col[k]), 'aria-label': 'Color de ' + Trk.TIPOS[k].n, oninput: (ev) => { T.col[k] = deHex(ev.target.value); } });
        const en = el('input', { type: 'checkbox', checked: k === 'E' || ((T.mask >> i) & 1) === 1, disabled: k === 'E', 'aria-label': 'Se puede elegir ' + Trk.TIPOS[k].n, onchange: (ev) => { T.mask = ev.target.checked ? (T.mask | (1 << i)) : (T.mask & ~(1 << i)); } });
        const nombre = inv ? el('input', { type: 'text', maxlength: 9, placeholder: 'Invitado ' + k.toUpperCase(), value: (T.nom && T.nom[k]) || '', 'aria-label': 'Nombre del invitado ' + k.toUpperCase(), oninput: (ev) => { T.nom = T.nom || {}; T.nom[k] = ev.target.value; } })
          : el('span', { class: 'it-nom' }, Trk.TIPOS[k].n, el('small', { class: 'suave' }, ' ' + Trk.TIPOS[k].cl));
        filas.append(el('div', { class: 'it-fila' + (k === 'I' ? ' it-sep' : '') }, sw, el('div', { class: 'crece' }, nombre), el('label', { class: 'it-en' }, en, k === 'E' ? 'siempre' : (k === 'I' ? 'genérico' : 'en juego'))));
      });
    }
    function estadoTxt() {
      const lista = Sv.estado === 'conectado' && Sv.firmwareNuevo();
      estadoT.textContent = lista ? '● Tracker conectado: «Guardar y aplicar» se lo manda ahora.' : (Sv.estado === 'conectado' ? 'Este tracker es el Arduino viejo (firmware 2.x): no entiende colores nuevos.' : 'Sin tracker conectado: se guarda en la app y se manda solo cuando conecte (o con el simulador).');
    }
    const tTaller = el('div', { class: 'tarjeta it-taller' },
      el('h3', null, 'Taller de colores ', el('small', null, 'personajes e invitados')),
      el('p', { class: 'suave tk-nota' }, 'Elegí el color de cada personaje y quiénes aparecen al armar el combate. Los invitados A–D y el genérico son opcionales: tildá solo los que vayas a usar.'),
      filas,
      el('div', { class: 'fila tk-fila it-brillo' }, el('label', { style: 'margin:0' }, 'Brillo de la tira'), el('span', { class: 'crece' }, brillo), brilloV),
      el('p', { class: 'suave tk-nota' }, '35 % es lo recomendado (cuida la batería y el booster). Blanco al 100 % no se prueba.'),
      el('div', { class: 'fila tk-fila' },
        el('button', { type: 'button', class: 'primario', onclick: () => {
          Sv.cfg.taller = Trk.tallerNormalizar(T); T = JSON.parse(JSON.stringify(Sv.cfg.taller)); Sv.guardarCfg();
          const n = (Sv.estado === 'conectado' && Sv.firmwareNuevo()) ? Sv.aplicarTaller(null) : 0;
          toast(n ? 'Guardado. Mandando ' + n + ' órdenes al tracker…' : 'Guardado en la app. Se manda cuando conecte el tracker.'); pintarFilas(); estadoTxt();
        } }, 'Guardar y aplicar'),
        el('button', { type: 'button', onclick: () => { if (Sv.estado !== 'conectado' || !Sv.firmwareNuevo()) { toast('Conectá el tracker nuevo (o el simulador) primero'); return; } Sv.enviarLinea('CFG'); Sv._traer = true; toast('Pidiendo lo que tiene el tracker…'); } }, 'Traer del tracker'),
        el('button', { type: 'button', onclick: () => {
          T = fabrica(); Sv.cfg.taller = null; Sv.guardarCfg(); brillo.value = T.brillo; brilloV.textContent = T.brillo + ' %';
          if (Sv.estado === 'conectado' && Sv.firmwareNuevo()) { Sv.enviarLinea('DEF'); setTimeout(() => Sv.enviarLinea('CFG'), 300); }
          toast('Colores de fábrica'); pintarFilas(); estadoTxt();
        } }, 'De fábrica')),
      estadoT);
    poner(tTaller);

    // ---------------- COMBATES GUARDADOS ----------------
    const lista = el('div', { class: 'it-hist' }), nota = el('p', { class: 'suave tk-nota' });
    function pintarHist() {
      lista.innerHTML = '';
      H.lista.slice(0, 8).forEach((x, i) => {
        lista.append(el('button', { type: 'button', class: 'it-hi ' + x.res, onclick: () => abrirMonitor(i) },
          el('b', null, fechaCorta(x.t0)), el('span', { class: 'it-res' }, RES[x.res] || x.res), el('span', null, 'R' + x.rondas + ' · ' + x.turnos + ' turnos · ' + durTxt(x.dur)), el('span', { class: 'suave' }, suma(x.muertes) + ' muertes · ' + suma(x.caidos) + ' caídos')));
      });
      if (!H.lista.length) lista.append(el('p', { class: 'suave' }, 'Todavía no hay combates guardados. Se guardan solos cuando termina uno (victoria, caída total o reinicio).'));
      nota.textContent = H.lista.length ? H.lista.length + ' combate(s) en este celu' + (H.lista.length > 8 ? ' · se ven los últimos 8 (el CSV baja todos)' : '') + (H.cur ? ' · hay uno en curso' : '') : '';
    }
    const tHist = el('div', { class: 'tarjeta' },
      el('h3', null, 'Combates guardados ', el('small', null, 'para repasar después')),
      lista, nota,
      el('div', { class: 'fila tk-fila' },
        el('button', { type: 'button', onclick: () => { if (!H.lista.length) { toast('No hay nada para bajar todavía'); return; } if (!bajar('combates-resumen.csv', H.csvResumen())) toast('No se pudo bajar el archivo'); } }, 'Bajar resumen (CSV)'),
        el('button', { type: 'button', onclick: () => { if (!H.lista.length) { toast('No hay nada para bajar todavía'); return; } if (!bajar('combates-por-clase.csv', H.csvDetalle())) toast('No se pudo bajar el archivo'); } }, 'Bajar por clase (CSV)'),
        el('button', { type: 'button', class: 'peligro', onclick: (ev) => { const b = ev.currentTarget; if (!b._seguro) { b._seguro = true; b.textContent = '¿Seguro? Se borran todos'; setTimeout(() => { b._seguro = false; b.textContent = 'Borrar todo'; }, 3500); return; } H.lista = []; H.guardar(); pintarHist(); toast('Combates borrados'); b._seguro = false; b.textContent = 'Borrar todo'; } }, 'Borrar todo')),
      el('p', { class: 'suave tk-nota' }, 'Los CSV usan «;» como separador (se abren directo en Excel en español).'));
    poner(tHist);
    // vista grande (para el monitor del dummy)
    let mon = null;
    function abrirMonitor(i) {
      cerrarMonitor();
      const x = H.lista[i]; if (!x) return;
      const clases = Array.from(new Set([].concat(Object.keys(x.turnosPorClase), Object.keys(x.muertes), Object.keys(x.caidos))));
      const max = Math.max(1, ...clases.map((k) => x.turnosPorClase[k] || 0));
      const tile = (n, t) => el('div', null, el('b', null, String(n)), el('span', null, t));
      mon = el('div', { class: 'it-mon', role: 'dialog', 'aria-label': 'Resumen del combate' },
        el('button', { type: 'button', class: 'x', onclick: cerrarMonitor }, 'Cerrar'),
        el('h2', null, (RES[x.res] || x.res) + ' · ' + fechaCorta(x.t0)),
        el('div', { class: 'it-big' }, tile(x.rondas, 'rondas'), tile(x.turnos, 'turnos'), tile(durTxt(x.dur), 'duración'), tile(suma(x.muertes), 'muertes'), tile(suma(x.caidos), 'caídos'), tile(x.deshacer, 'deshacer')),
        el('div', { class: 'it-clases' }, clases.map((k) => el('div', { class: 'it-cl' },
          el('i', { style: 'background:' + hex(TU.colorDe(k)) }), el('span', { class: 'n' }, (Trk.TIPOS[k] || { n: k }).n),
          el('span', { class: 'bar' }, el('em', { style: 'width:' + Math.round(100 * (x.turnosPorClase[k] || 0) / max) + '%;background:' + hex(TU.colorDe(k)) })),
          el('span', { class: 'v' }, (x.turnosPorClase[k] || 0) + ' turnos' + (x.muertes[k] ? ' · ' + x.muertes[k] + ' muerte(s)' : '') + (x.caidos[k] ? ' · ' + x.caidos[k] + ' caído(s)' : ''))))),
        el('p', { class: 'suave' }, 'Concentraciones: ' + x.conc + ' · Comodines: ' + x.comodin + ' · Inserciones: ' + x.inserciones + (x.retomado ? ' · (se contó desde que se conectó la app)' : '')),
        el('div', { class: 'fila' }, el('button', { type: 'button', disabled: i >= H.lista.length - 1, onclick: () => abrirMonitor(i + 1) }, '← Anterior'), el('button', { type: 'button', disabled: i <= 0, onclick: () => abrirMonitor(i - 1) }, 'Siguiente →')));
      document.body.append(mon);
    }
    function cerrarMonitor() { if (mon) { mon.remove(); mon = null; } }

    // ---------------- LAMPARAS QUE SIGUEN EL TURNO ----------------
    const zz = () => Sv.cfg.luzTurno;
    const seg = el('input', { type: 'range', min: 1, max: 15, step: 1, value: zz().seg, 'aria-label': 'Segundos', oninput: () => { zz().seg = +seg.value; segV.textContent = zz().seg + ' s'; Sv.guardarCfg(); } }), segV = el('b', null, zz().seg + ' s');
    const bri = el('input', { type: 'range', min: 10, max: 100, step: 5, value: zz().brillo, 'aria-label': 'Brillo de las lámparas', oninput: () => { zz().brillo = +bri.value; briV.textContent = zz().brillo + ' %'; Sv.guardarCfg(); } }), briV = el('b', null, zz().brillo + ' %');
    const opt = (id, lab, arr, val, fn) => el('select', { id, 'aria-label': lab, onchange: (ev) => fn(ev.target.value) }, arr.map(([v, n]) => el('option', { value: v, selected: v === val }, n)));
    const tLuz = el('div', { class: 'tarjeta' },
      el('h3', null, 'Lámparas que siguen el turno ', el('small', null, 'opcional')),
      el('p', { class: 'suave tk-nota' }, 'Cuando cambia el turno, las lámparas de D&D toman el color del personaje al que le toca. Va aparte de las luces que elegiste para cada movimiento (esas siguen igual). Apagado de fábrica.'),
      chk('Prender las lámparas con el color del turno', zz().on, (v) => { zz().on = v; Sv.guardarCfg(); }, 'Hace falta tener las luces de D&D activas en la pestaña Luces.'),
      el('div', { class: 'fila tk-fila' }, el('label', { style: 'margin:0' }, 'Lámpara'), opt('luzTurnoLamp', 'Lámpara', [['dnd', 'Las dos'], ['dnd-1', 'Lámpara 1'], ['dnd-2', 'Lámpara 2']], zz().lamp, (v) => { zz().lamp = v; Sv.guardarCfg(); }),
        el('label', { style: 'margin:0' }, 'Efecto'), opt('luzTurnoEf', 'Efecto', [['respirar', 'Respira'], ['fijo', 'Fijo'], ['magia', 'Magia']], zz().efecto, (v) => { zz().efecto = v; Sv.guardarCfg(); })),
      el('div', { class: 'fila tk-fila' }, el('label', { style: 'margin:0' }, 'Dura'), el('span', { class: 'crece' }, seg), segV),
      el('div', { class: 'fila tk-fila' }, el('label', { style: 'margin:0' }, 'Brillo'), el('span', { class: 'crece' }, bri), briV),
      el('div', { class: 'fila tk-fila' }, el('button', { type: 'button', onclick: () => {
        const S = Sv.espejo.S, t = (Sv.espejo.hay && S.modo === 'B' && S.tipo[S.turno]) || 'D';
        if (!TU.disparar(TU.colorDe(t), true)) toast('Las luces de D&D están apagadas en este celu (pestaña Luces)'); else toast('Probando con el color de ' + Trk.TIPOS[t].n);
      } }, 'Probar con el turno actual')));
    poner(tLuz);

    // ---------------- vida de la vista ----------------
    pintarFilas(); estadoTxt(); pintarHist(); H.asegurar().then(pintarHist);
    const quien = Sv.alCambio((que) => {
      if (!root.isConnected) { quien(); cerrarMonitor(); return; }
      if (que === 'hist') pintarHist();
      else if (que === 'estado' || que === 'hola') estadoTxt();
      else if (que === 'cfgTracker' && Sv._traer && Sv.cfgTracker) { Sv._traer = false; T = deCfg(Sv.cfgTracker); T.nom = Object.assign({}, (Sv.cfg.taller && Sv.cfg.taller.nom) || {}); brillo.value = T.brillo; brilloV.textContent = T.brillo + ' %'; pintarFilas(); toast('Listo: se cargó lo que tiene el tracker (tocá «Guardar y aplicar» para quedarte con eso)'); }
    });
  };
})(window.MD);
