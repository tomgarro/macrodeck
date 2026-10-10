// ui.js - Las pantallas: Mesa (jugar), Escenas (editar), Sonidos (biblioteca) y Herramientas (packs, logos, ayuda).
window.MD = window.MD || {};
(function (MD) {
  const NOM = ['A1', 'B1', 'C1', 'D1', 'E1', 'A2', 'B2', 'C2', 'D2', 'E2'];
  const GL = ['', 'L', '?', 'H', '>', 'X', 'F', 'D'];
  function h(tag, attrs, ...hijos) {
    const e = document.createElement(tag);
    for (const k in (attrs || {})) {
      const v = attrs[k];
      if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v; else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of hijos.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  }
  function icoCanvas(hex, color) {
    const cv = document.createElement('canvas'); cv.width = 24; cv.height = 24;
    const b = MD.Iconos.deHex(hex); if (b) MD.Iconos.pintar(cv.getContext('2d'), b, 0, 0, 1, color || '#efe7d6');
    return cv;
  }
  const tipoDe = id => MD.Config.TIPOS.find(t => t.id === id) || MD.Config.TIPOS[0];
  const catIdx = id => Math.max(0, MD.Config.CATEGORIAS.findIndex(c => c.id === id));
  function celda(t, i, extra) {
    extra = extra || {};
    if (!t) return h('button', Object.assign({ class: 't vacia c3', type: 'button' }, extra), h('span', { class: 'id' }, NOM[i]), h('span', { class: 'nom suave' }, 'vacia'));
    return h('button', Object.assign({ class: 't c' + catIdx(t.categoria), type: 'button' }, extra),
      h('span', { class: 'id' }, NOM[i]), t.tipo !== 'una_vez' ? h('span', { class: 'gl' }, GL[MD.P.GLIFO[t.tipo]] || '') : null,
      t.icono ? icoCanvas(t.icono) : null, h('span', { class: 'nom' }, t.nombre || '(sin nombre)'));
  }
  function avisosTecla(A, t) {
    const out = [];
    if (!t) return out;
    if ((t.nombre || '').split(/\s+/).some(p => p.length > 7)) out.push('El nombre tiene una palabra de mas de 7 letras: en la pantalla e-Paper se va a cortar.');
    if (!t.nombre) out.push('La tecla no tiene nombre: en el Macrodeck se vera solo el icono.');
    if (['una_vez', 'loop', 'mantener', 'azar', 'secuencia'].includes(t.tipo) && t.sonidos.length < 1) out.push('Esta tecla no tiene sonido todavia.');
    if (t.tipo === 'azar' && t.sonidos.length === 1) out.push('"Al azar" con un solo sonido es igual que "Una vez".');
    t.sonidos.forEach(id => { if (!A.cfg.sonidos.some(s => s.id === id)) out.push('Falta un sonido que esta tecla usaba (se borro de la biblioteca).'); });
    return out;
  }

  // ===================== MESA =====================
  function vistaMesa(A, el) {
    const con = h('div', { class: 'tarjeta' });
    const esBle = A.tr && A.tr.tipo === 'ble' && A.tr.estado !== 'desconectado';
    const esSim = A.tr && A.tr.tipo === 'sim' && A.tr.conectado;
    con.append(h('h3', null, 'Conexion'));
    if (!esBle && !esSim) {
      if (!MD.BleTransport.disponible()) con.append(h('p', { class: 'aviso' }, 'Este navegador no tiene Bluetooth web. En el celu usa Chrome (Android). En la compu, Chrome o Edge. Mientras tanto podes probar con el simulador.'));
      con.append(h('div', { class: 'fila' },
        h('button', { class: 'primario', type: 'button', id: 'btnConectar', onclick: () => A.conectarBle() }, 'Conectar Macrodeck'),
        h('button', { type: 'button', id: 'btnSim', onclick: () => A.usarSimulador() }, 'Probar con el simulador')));
      con.append(h('p', { class: 'suave' }, 'En el Macrodeck abri el programa D&D (desde el lobby): va a decir "Buscando…". Despues toca "Conectar" y elegi "Macrodeck".'));
    } else {
      con.append(h('div', { class: 'fila' }, h('span', { class: 'crece' }, esSim ? 'Simulador activo' : 'Estado: ' + A.tr.estado + (A.tr.detalle ? ' (' + A.tr.detalle + ')' : '')),
        h('button', { type: 'button', onclick: () => A.cortar() }, 'Desconectar')));
    }
    el.append(con);

    const bar = h('div', { class: 'escenas' });
    A.cfg.escenas.forEach((e, i) => bar.append(h('button', { type: 'button', class: i === A.activa ? 'on' : '', onclick: () => A.activar(i) }, e.nombre)));
    el.append(bar);

    const rej = h('div', { class: 'rejilla' });
    const esc = A.cfg.escenas[A.activa];
    A.mesaCeldas = esc.teclas.map((t, i) => {
      const c = celda(t, i, {});
      const dn = (e) => { e.preventDefault(); A.audioPrimero(); A.motor.tecla(i, true); };
      const up = (e) => { e.preventDefault(); A.motor.tecla(i, false); };
      c.addEventListener('pointerdown', dn); c.addEventListener('pointerup', up); c.addEventListener('pointerleave', up); c.addEventListener('pointercancel', up);
      rej.append(c); return c;
    });
    el.append(rej);

    const vol = h('input', { type: 'range', min: 0, max: 255, value: Math.round(A.motor.volGeneral * 255), oninput: (e) => { A.motor.fijarVolumen(e.target.value / 255); } });
    A.mesaVol = vol;
    A.mesaSonando = h('div', { class: 'sonando' });
    A.mesaDado = h('div', { class: 'dado' });
    el.append(h('div', { class: 'tarjeta', style: 'margin-top:14px' },
      h('div', { class: 'fila' }, h('div', { class: 'crece' }, h('label', { style: 'margin:0' }, 'Volumen (la perilla del Macrodeck lo mueve)'), vol), A.mesaDado),
      A.mesaSonando,
      h('div', { class: 'fila' },
        h('button', { type: 'button', onclick: () => A.motor.alternarSilencio() }, 'Silenciar / devolver'),
        h('button', { type: 'button', onclick: () => A.motor.fadeoutTotal(2.5) }, 'Fade-out'),
        h('button', { class: 'peligro', type: 'button', onclick: () => A.motor.pararTodo() }, 'Cortar todo'))));

    if (A.tr && A.tr.tipo === 'sim') {
      const caja = h('div', { class: 'tarjeta' }, h('h3', null, 'Macrodeck simulado'));
      caja.append(A.simRaiz); el.append(caja);
    }
  }

  // ===================== ESCENAS (editor) =====================
  function vistaEscenas(A, el) {
    const cfg = A.cfg;
    A.edEsc = Math.min(A.edEsc, cfg.escenas.length - 1);
    const esc = cfg.escenas[A.edEsc];
    const bar = h('div', { class: 'escenas' });
    cfg.escenas.forEach((e, i) => bar.append(h('button', { type: 'button', class: i === A.edEsc ? 'on' : '', onclick: () => { A.edEsc = i; A.edTecla = null; A.render(); } }, e.nombre)));
    if (cfg.escenas.length < 10) bar.append(h('button', { type: 'button', id: 'btnNuevaEscena', onclick: () => { cfg.escenas.push(MD.Config.escenaNueva('Escena ' + (cfg.escenas.length + 1))); A.edEsc = cfg.escenas.length - 1; A.edTecla = null; A.cambio(true); A.render(); } }, '+ Escena'));
    el.append(bar);

    const nombre = h('input', { type: 'text', value: esc.nombre, maxlength: 30, oninput: (e) => { esc.nombre = e.target.value; A.cambio(true); } });
    const mover = (d) => { const j = A.edEsc + d; if (j < 0 || j >= cfg.escenas.length) return; [cfg.escenas[A.edEsc], cfg.escenas[j]] = [cfg.escenas[j], cfg.escenas[A.edEsc]]; if (A.activa === A.edEsc) A.activa = j; else if (A.activa === j) A.activa = A.edEsc; A.edEsc = j; A.cambio(true); A.render(); };
    let seguro = false;
    const borrar = h('button', { class: 'peligro', type: 'button', onclick: (e) => {
      if (cfg.escenas.length < 2) return;
      if (!seguro) { seguro = true; e.target.textContent = 'Seguro? toca otra vez'; e.target.classList.add('seguro'); return; }
      cfg.escenas.splice(A.edEsc, 1); A.edEsc = Math.max(0, A.edEsc - 1); A.edTecla = null; if (A.activa >= cfg.escenas.length) A.activa = 0; A.activarSinSonido(); A.cambio(true); A.render();
    } }, 'Borrar escena');
    const dup = h('button', { type: 'button', onclick: () => { if (cfg.escenas.length >= 10) return; const c = JSON.parse(JSON.stringify(esc)); c.id = MD.Config.nuevoId('e'); c.nombre = (esc.nombre + ' (copia)').slice(0, 30); cfg.escenas.splice(A.edEsc + 1, 0, c); A.edEsc++; A.cambio(true); A.render(); } }, 'Duplicar');
    el.append(h('div', { class: 'tarjeta' },
      h('label', { style: 'margin-top:0' }, 'Nombre de la escena (en el selector del Macrodeck se ven ~7 letras)'), nombre,
      h('div', { class: 'fila', style: 'margin-top:10px' }, h('button', { type: 'button', onclick: () => mover(-1) }, '←'), h('button', { type: 'button', onclick: () => mover(1) }, '→'), dup, borrar)));

    const rej = h('div', { class: 'rejilla' });
    esc.teclas.forEach((t, i) => { const c = celda(t, i, { onclick: () => { A.edTecla = i; A.render(); } }); if (i === A.edTecla) c.classList.add('sel'); rej.append(c); });
    el.append(h('div', { class: 'tarjeta' }, h('p', { class: 'suave', style: 'margin-top:0' }, 'Toca una tecla para editarla. Estan en el mismo orden que en el Macrodeck (arriba A1–E1, abajo A2–E2).'), rej));

    if (A.edTecla != null) el.append(editorTecla(A, esc, A.edTecla));
  }

  function editorTecla(A, esc, i) {
    const cfg = A.cfg; const t = esc.teclas[i];
    const caja = h('div', { class: 'tarjeta', id: 'editorTecla' });
    caja.append(h('h3', null, 'Tecla ' + NOM[i]));
    if (!t) {
      caja.append(h('p', { class: 'suave' }, 'Esta tecla esta vacia.'));
      const fila = h('div', { class: 'fila' }, h('button', { class: 'primario', type: 'button', id: 'btnCrearTecla', onclick: () => { esc.teclas[i] = MD.Config.teclaNueva({ nombre: 'Nueva' }); A.cambio(true); A.render(); } }, 'Crear tecla'));
      if (A.portapapeles) fila.append(h('button', { type: 'button', onclick: () => { esc.teclas[i] = JSON.parse(JSON.stringify(A.portapapeles)); A.cambio(true); A.render(); } }, 'Pegar "' + (A.portapapeles.nombre || 'tecla') + '"'));
      caja.append(fila); return caja;
    }
    const cam = (campo, render) => (e) => { const v = (e.target.type === 'number' || e.target.type === 'range') ? Number(e.target.value) : e.target.value; t[campo] = v; A.cambio(true); if (render) A.render(); };
    const av = h('ul', { class: 'avisos' });
    const actAv = () => { av.innerHTML = ''; avisosTecla(A, t).forEach(x => av.append(h('li', null, x))); };

    caja.append(h('label', { style: 'margin-top:0' }, 'Nombre (hasta 18 letras, sin palabras de mas de 7)'),
      h('input', { type: 'text', id: 'inNombre', maxlength: 18, value: t.nombre, oninput: (e) => { t.nombre = e.target.value; A.cambio(true); actAv(); } }));
    caja.append(h('div', { class: 'cols' },
      h('div', null, h('label', null, 'Categoria (color del marco)'),
        h('select', { onchange: cam('categoria', true) }, MD.Config.CATEGORIAS.map(c => h('option', { value: c.id, selected: c.id === t.categoria }, c.nombre)))),
      h('div', null, h('label', null, 'Tipo'),
        h('select', { id: 'selTipo', onchange: cam('tipo', true) }, MD.Config.TIPOS.map(c => h('option', { value: c.id, selected: c.id === t.tipo }, c.nombre))))));
    caja.append(h('p', { class: 'suave' }, tipoDe(t.tipo).ayuda));

    if (!['silenciar', 'fadeout'].includes(t.tipo)) {
      const multi = ['azar', 'secuencia'].includes(t.tipo);
      caja.append(h('label', null, multi ? 'Sonidos (en orden)' : 'Sonido'));
      const lista = h('div', { class: 'lista-s' });
      t.sonidos.forEach((id, k) => {
        const s = cfg.sonidos.find(x => x.id === id);
        lista.append(h('div', { class: 's' }, h('span', { class: 'crece' }, s ? s.nombre : '(falta)'),
          h('button', { type: 'button', onclick: () => A.previa(id) }, '▶'),
          multi ? h('button', { type: 'button', onclick: () => { if (k > 0) { [t.sonidos[k - 1], t.sonidos[k]] = [t.sonidos[k], t.sonidos[k - 1]]; A.cambio(true); A.render(); } } }, '↑') : null,
          h('button', { class: 'peligro', type: 'button', onclick: () => { t.sonidos.splice(k, 1); A.cambio(true); A.render(); } }, '✕')));
      });
      caja.append(lista);
      if (multi || t.sonidos.length === 0) {
        caja.append(h('select', { id: 'selSonido', onchange: (e) => { if (!e.target.value) return; if (multi) t.sonidos.push(e.target.value); else t.sonidos = [e.target.value]; A.cambio(true); A.render(); } },
          h('option', { value: '' }, cfg.sonidos.length ? '+ Agregar sonido…' : 'Primero importa sonidos en la pestana Sonidos'), cfg.sonidos.map(s => h('option', { value: s.id }, s.nombre))));
      }
    }
    if (t.tipo === 'dado') {
      const sonOpts = (campo) => h('select', { onchange: cam(campo, false) }, h('option', { value: '' }, '(ninguno)'), cfg.sonidos.map(s => h('option', { value: s.id, selected: s.id === t[campo] }, s.nombre)));
      caja.append(h('div', { class: 'cols' },
        h('div', null, h('label', null, 'Dado'), h('select', { onchange: cam('dado', false) }, [4, 6, 8, 10, 12, 20, 100].map(n => h('option', { value: n, selected: n === t.dado }, 'd' + n)))),
        h('div', null, h('label', null, 'Sonido si sale el maximo'), sonOpts('dadoCritico')),
        h('div', null, h('label', null, 'Sonido si sale 1'), sonOpts('dadoPifia'))));
    }
    if (!['silenciar', 'dado'].includes(t.tipo)) {
      const etVol = h('label', null, 'Volumen de la tecla (' + Math.round(t.volumen * 100) + '%)');
      caja.append(h('div', { class: 'cols' },
        h('div', null, etVol, h('input', { type: 'range', min: 0, max: 1.5, step: 0.05, value: t.volumen, oninput: (e) => { t.volumen = +e.target.value; A.cambio(false); etVol.textContent = 'Volumen de la tecla (' + Math.round(t.volumen * 100) + '%)'; } })),
        ['loop', 'mantener', 'una_vez', 'azar', 'secuencia'].includes(t.tipo) ? h('div', null, h('label', null, 'Entrada (fundido, segundos)'), h('input', { type: 'number', min: 0, max: 10, step: 0.5, value: t.entrada, oninput: cam('entrada') })) : null,
        ['loop', 'mantener', 'fadeout'].includes(t.tipo) ? h('div', null, h('label', null, 'Salida (fundido, segundos)'), h('input', { type: 'number', min: 0, max: 10, step: 0.5, value: t.salida, oninput: cam('salida') })) : null));
    }
    if (['una_vez', 'azar', 'secuencia', 'mantener'].includes(t.tipo))
      caja.append(h('label', null, 'Si la tocas mientras ya suena'), h('select', { onchange: cam('retoque') }, MD.Config.RETOQUES.map(r => h('option', { value: r.id, selected: r.id === t.retoque }, r.nombre))));
    if (t.tipo === 'loop')
      caja.append(h('label', null, 'Grupo exclusivo (los loops con el mismo grupo se reemplazan entre si con fundido cruzado; ej: "amb")'), h('input', { type: 'text', maxlength: 20, value: t.grupo, oninput: cam('grupo') }));

    const icoBox = h('div', { class: 'tarjeta', style: 'background:var(--panel2);margin-top:14px' });
    const hexLib = MD.Iconos.lista.map(ic => MD.Iconos.hexDe(ic.id));
    const sel = hexLib.indexOf(t.icono);
    const prev = t.icono ? icoCanvas(t.icono) : h('span', { class: 'suave' }, 'sin icono');
    if (t.icono) prev.style.cssText = 'width:72px;height:72px;image-rendering:pixelated;background:#0b0a08;border-radius:6px';
    icoBox.append(h('div', { class: 'fila' }, h('strong', null, 'Icono (24 × 24, un solo color)'), prev, t.icono ? h('button', { type: 'button', onclick: () => { t.icono = ''; A.cambio(true); A.render(); } }, 'Quitar') : null));
    icoBox.append(h('div', { class: 'aviso', style: 'margin-top:8px' },
      sel >= 0 ? [h('strong', null, MD.Iconos.lista[sel].nombre), ' · ', MD.Iconos.lista[sel].desc]
               : (t.icono ? 'Icono propio (una imagen tuya).' : 'Toca un icono para ver para que sirve.')));
    const grid = h('div', { class: 'icos' });
    const botones = MD.Iconos.lista.map((ic, k) => h('button', { type: 'button', class: k === sel ? 'on' : '', title: ic.nombre + ': ' + ic.desc, 'data-q': (ic.nombre + ' ' + ic.desc).toLowerCase(),
      onclick: () => { A._icoScroll = grid.scrollTop; A._icoFiltro = buscar.value; t.icono = hexLib[k]; A.cambio(true); A.render(); } }, icoCanvas(hexLib[k])));
    const buscar = h('input', { type: 'text', placeholder: 'Buscar icono (fuego, hielo, curacion…)', style: 'margin:8px 0', value: A._icoFiltro || '',
      oninput: () => { const q = buscar.value.trim().toLowerCase(); botones.forEach(b => { b.style.display = (!q || b.dataset.q.includes(q)) ? '' : 'none'; }); } });
    botones.forEach(b => grid.append(b));
    icoBox.append(buscar);
    icoBox.append(grid);
    if (A._icoFiltro) buscar.dispatchEvent(new Event('input'));
    setTimeout(() => { grid.scrollTop = A._icoScroll || 0; }, 0);
    icoBox.append(h('div', { class: 'fila', style: 'margin-top:8px' }, h('button', { type: 'button', onclick: () => A.abrirConversor(i) }, 'Usar mi propia imagen…')));
    caja.append(icoBox);

    caja.append(av); actAv();
    caja.append(h('div', { class: 'fila', style: 'margin-top:10px' },
      h('button', { type: 'button', onclick: () => { A.portapapeles = JSON.parse(JSON.stringify(t)); A.render(); } }, 'Copiar tecla'),
      A.portapapeles ? h('button', { type: 'button', onclick: () => { esc.teclas[i] = JSON.parse(JSON.stringify(A.portapapeles)); A.cambio(true); A.render(); } }, 'Pegar encima') : null,
      h('button', { class: 'peligro', type: 'button', onclick: () => { esc.teclas[i] = null; A.cambio(true); A.render(); } }, 'Vaciar tecla')));
    return caja;
  }

  // ===================== SONIDOS =====================
  function vistaSonidos(A, el) {
    const cfg = A.cfg;
    const inp = h('input', { type: 'file', id: 'inSonidos', accept: 'audio/*,.mp3,.wav,.ogg,.m4a,.flac,.opus', multiple: true, hidden: true, onchange: async (e) => { const fs = [...e.target.files]; e.target.value = ''; await A.importarSonidos(fs); } });
    el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Biblioteca de sonidos'),
      h('p', { class: 'suave' }, 'Importa mp3, wav, ogg o m4a. Quedan guardados en este navegador (no se suben a ningun lado). Para pasarlos a otro celu, usa un pack en Herramientas.'),
      h('div', { class: 'fila' }, h('button', { class: 'primario', type: 'button', onclick: () => inp.click() }, 'Importar sonidos'), inp),
      A.estadoAlmacen ? h('p', { class: 'suave' }, A.estadoAlmacen) : null));
    if (!cfg.sonidos.length) { el.append(h('p', { class: 'suave' }, 'Todavia no hay sonidos. Tambien podes cargar el pack de prueba desde Herramientas.')); return; }
    const lista = h('div', { class: 'lista-s' });
    cfg.sonidos.forEach(s => {
      const usos = A.usosDeSonido(s.id);
      let seguro = false;
      lista.append(h('div', { class: 's' },
        h('button', { type: 'button', onclick: () => A.previa(s.id) }, '▶'),
        h('div', { class: 'crece' }, h('input', { type: 'text', value: s.nombre, maxlength: 60, oninput: (e) => { s.nombre = e.target.value; A.cambio(false); } }), h('small', null, (s.duracion ? s.duracion + ' s · ' : '') + (usos ? 'usado en ' + usos + ' teclas' : 'sin usar'))),
        h('input', { class: 'peq', type: 'range', min: 0, max: 2, step: 0.05, value: s.volumen, title: 'Volumen base', oninput: (e) => { s.volumen = +e.target.value; A.cambio(false); } }),
        h('button', { class: 'peligro', type: 'button', onclick: async (e) => { if (usos && !seguro) { seguro = true; e.target.textContent = '¿Seguro?'; return; } await A.borrarSonido(s.id); } }, '✕')));
    });
    el.append(lista);
  }

  // ===================== HERRAMIENTAS =====================
  function vistaHerramientas(A, el) {
    const cfg = A.cfg, demo = A.demoCuenta();
    el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Campana'),
      h('label', null, 'Nombre de la campana'), h('input', { type: 'text', value: cfg.nombre, maxlength: 60, oninput: (e) => { cfg.nombre = e.target.value; A.cambio(false); } })));
    el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Probar sin sonidos propios'),
      h('p', { class: 'suave' }, 'Agrega 2 escenas de ejemplo con sonidos sintetizados (lluvia, fogata, espadas, dado…). No toca lo que ya tengas. Despues se pueden borrar de una vez.'),
      h('div', { class: 'fila' },
        h('button', { type: 'button', id: 'btnDemo', onclick: () => A.cargarDemo() }, 'Agregar contenido de prueba'),
        (demo.sonidos || demo.escenas) ? h('button', { class: 'peligro', type: 'button', onclick: async (e) => { if (!A._borrDemo) { A._borrDemo = 1; e.target.textContent = 'Seguro? ' + demo.sonidos + ' sonidos y ' + demo.escenas + ' escenas'; return; } A._borrDemo = 0; await A.borrarDemo(); } },
          'Borrar contenido de prueba (' + demo.sonidos + ' sonidos, ' + demo.escenas + ' escenas)') : null),
      A.estadoPack ? h('p', { class: 'suave', style: 'margin-top:8px' }, A.estadoPack) : null));
    el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Conversor de imagen a icono del lobby'),
      h('p', { class: 'suave' }, 'Convierte una imagen en un icono de un solo color para la pantalla de inicio del Macrodeck. Elegi la imagen, ajusta el umbral y descarga el archivo .h.'),
      h('button', { type: 'button', onclick: () => A.abrirConversorLogo() }, 'Abrir conversor')));
    el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Almacenamiento'),
      h('p', { class: 'suave' }, A.infoAlmacen || ''),
      h('div', { class: 'fila' }, h('button', { type: 'button', onclick: () => A.pedirPersistencia() }, 'Proteger datos'),
        h('button', { class: 'peligro', type: 'button', onclick: async (e) => { if (!A._borr) { A._borr = 1; e.target.textContent = 'Seguro? se borra TODO'; return; } A._borr = 0; await A.borrarTodo(); } }, 'Borrar todo')),
      h('p', { class: 'suave', style: 'margin-bottom:0' }, 'Version de la app: ' + MD.VERSION)));
  }

  MD.UI = { h, icoCanvas, vistaMesa, vistaEscenas, vistaSonidos, vistaHerramientas, NOM };
  MD.VERSION = '1.1';
})(window.MD);
