// audios_ui.js - Las pantallas de la pestana Audios: biblioteca (filtros, buscador, seleccion de varios), listas, cola, reproductor completo,
// modo mesa (Frodo), el mini-reproductor que queda abajo en todas las pestanas y la tarjeta de "musica de fondo" del editor de escenas.
window.MD = window.MD || {};
(function (MD) {
  const Au = MD.Au, S = Au.S, prefs = Au.prefs, FILAS = Au.FILAS, BIOMAS = Au.BIOMAS;
  const h = (...a) => MD.UI.h(...a);
  const U = { sub: 'biblioteca', lista: null, sel: null, destino: null, ov: null, arrastrando: false };
  let APP = null, vistaEl = null, barra = null, toastT = 0;

  // ---------------- iconos ----------------
  const IC = {
    play: 'M8 5v14l11-7z', pausa: 'M6 5h4v14H6zm8 0h4v14h-4z', sig: 'M6 18l8.5-6L6 6zm10-12v12h2V6z', ant: 'M6 6h2v12H6zm3.5 6l8.5 6V6z',
    azar: 'M10.59 9.17L5.41 4L4 5.41l5.17 5.17zM14.5 4l2.04 2.04L4 18.59L5.41 20L17.96 7.46L20 9.5V4zm.33 9.41l-1.41 1.41l3.13 3.13L14.5 20H20v-5.5l-2.04 2.04z',
    repetir: 'M7 7h10v3l4-4l-4-4v3H5v6h2zm10 10H7v-3l-4 4l4 4v-3h12v-6h-2z', estrella: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2L9.19 8.63L2 9.24l5.46 4.73L5.82 21z',
    estrellaO: 'M12 15.39l-3.76 2.27l.99-4.28l-3.32-2.88l4.38-.37L12 6.09l1.71 4.04l4.38.37l-3.32 2.88l.99 4.28M22 9.24l-7.19-.62L12 2L9.19 8.62L2 9.24l5.46 4.73L5.82 21L12 17.27L18.18 21l-1.63-7.03z',
    cerrar: 'M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z', abajo: 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6l-6-6z',
    mas: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z', puntos: 'M12 16a2 2 0 0 1 2 2a2 2 0 0 1-2 2a2 2 0 0 1-2-2a2 2 0 0 1 2-2m0-6a2 2 0 0 1 2 2a2 2 0 0 1-2 2a2 2 0 0 1-2-2a2 2 0 0 1 2-2m0-6a2 2 0 0 1 2 2a2 2 0 0 1-2 2a2 2 0 0 1-2-2a2 2 0 0 1 2-2',
    ok: 'M21 7L9 19l-5.5-5.5l1.41-1.41L9 16.17L19.59 5.59z', cola: 'M15 6H3v2h12zm0 4H3v2h12zM3 16h8v-2H3zM17 6v8.18c-.31-.11-.65-.18-1-.18a3 3 0 1 0 3 3V8h3V6z',
    bajar: 'M5 20h14v-2H5zM19 9h-4V3H9v6H5l7 7z', volver: 'M15.41 7.41L14 6l-6 6l6 6l1.41-1.41L10.83 12z', agarre: 'M3 15h18v-2H3zm0-4h18V9H3z',
  };
  const ic = (n, px) => { const s = h('span', { class: 'au-ic' }); s.innerHTML = '<svg viewBox="0 0 24 24" width="' + (px || 22) + '" height="' + (px || 22) + '" fill="currentColor" aria-hidden="true"><path d="' + IC[n] + '"/></svg>'; return s; };
  const btn = (n, etiqueta, fn, clase, px) => h('button', { type: 'button', class: clase || '', 'aria-label': etiqueta, title: etiqueta, onclick: fn }, ic(n, px));

  // ---------------- avisos y ventanitas ----------------
  function aviso(txt) {
    let t = document.getElementById('auToast');
    if (!t) { t = h('div', { id: 'auToast', class: 'au-toast', role: 'status' }); document.body.append(t); }
    t.textContent = txt; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800);
  }
  function hoja(titulo, filas, extra) {                                   // hoja desde abajo con opciones: filas = [[texto, fn, clase?]...]
    cerrarHoja();
    const fondo = h('div', { class: 'au-fondo', id: 'auHoja', onclick: (e) => { if (e.target === fondo) cerrarHoja(); } });
    const c = h('div', { class: 'au-hoja', role: 'dialog', 'aria-label': titulo }, h('div', { class: 'au-hoja-t' }, titulo));
    filas.forEach(([t, fn, clase]) => c.append(h('button', { type: 'button', class: 'au-hoja-b ' + (clase || ''), onclick: () => { cerrarHoja(); fn && fn(); } }, t)));
    if (extra) c.append(extra);
    c.append(h('button', { type: 'button', class: 'au-hoja-b cancelar', onclick: cerrarHoja }, 'Cancelar'));
    fondo.append(c); document.body.append(fondo);
  }
  function cerrarHoja() { const x = document.getElementById('auHoja'); if (x) x.remove(); }
  function pedirTexto(titulo, valor, ok, textoOk) {
    cerrarHoja();
    const i = h('input', { type: 'text', class: 'au-buscar', value: valor || '', maxlength: 40, autocomplete: 'off', 'aria-label': titulo });
    i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') ir(); });
    const ir = () => { const v = i.value.trim(); if (!v) return; cerrarHoja(); ok(v); };
    const fondo = h('div', { class: 'au-fondo', id: 'auHoja', onclick: (e) => { if (e.target === fondo) cerrarHoja(); } },
      h('div', { class: 'au-hoja', role: 'dialog', 'aria-label': titulo }, h('div', { class: 'au-hoja-t' }, titulo), i,
        h('div', { class: 'fila', style: 'margin-top:10px' }, h('button', { type: 'button', class: 'primario', onclick: ir }, textoOk || 'Guardar'), h('button', { type: 'button', onclick: cerrarHoja }, 'Cancelar'))));
    document.body.append(fondo); setTimeout(() => { i.focus(); i.select(); }, 30);
  }
  // Elegir a que lista agregar estos audios (o crear una nueva)
  function elegirLista(ids, listo) {
    const ls = Au.listas().filter((l) => !l.auto);
    const filas = ls.map((l) => [l.nombre + ' · ' + l.items.length, () => { agregarALista(l, ids); listo && listo(l); }]);
    filas.unshift(['＋ Lista nueva…', () => pedirTexto('Nombre de la lista nueva', '', (n) => { const l = Au.nuevaLista(n, []); agregarALista(l, ids); listo && listo(l); }, 'Crear')]);
    hoja('Agregar ' + ids.length + (ids.length === 1 ? ' audio' : ' audios') + ' a…', filas);
  }
  function agregarALista(l, ids) {
    let n = 0; ids.forEach((id) => { if (l.items.indexOf(id) < 0 && l.items.length < 500) { l.items.push(id); n++; } });
    Au.cambio(); aviso(n ? n + (n === 1 ? ' audio agregado' : ' audios agregados') + ' a «' + l.nombre + '».' : 'Ya estaban en «' + l.nombre + '».'); pintar();
  }
  function menuAudio(d, extras) {
    const f = [
      ['Próximo en cola', () => Au.alCola(d.id, true)], ['Al final de la cola', () => Au.alCola(d.id, false)],
      ['Agregar a lista…', () => elegirLista([d.id])], [Au.esFav(d.id) ? 'Sacar de favoritos' : 'Marcar favorito ★', () => { Au.alternarFav(d.id); pintar(); }],
    ].concat(extras || []);
    if (!Au.bajado(d.id)) f.unshift(['Bajar a este equipo (' + Au.mb(d.tam) + ')', () => Au.bajarLista([d])]);
    hoja(d.titulo, f);
  }

  // ---------------- mini-reproductor (queda abajo en todas las pestanas) ----------------
  function armarBarra() {
    if (barra) return;
    const b = h('div', { class: 'au-barra', id: 'audioBarra', hidden: true });
    b.innerHTML = '<div class="au-l1"><button type="button" class="au-abrir" aria-label="Abrir el reproductor"><span class="au-cv"></span><span class="au-t"><b class="au-tit"></b><span class="au-sub"></span></span></button>'
      + '<div class="au-ctl"><button type="button" class="au-pp" aria-label="Pausa / seguir"></button><button type="button" class="au-sig" aria-label="Siguiente"></button></div></div>'
      + '<div class="au-prog fina"><i></i></div>';
    const tabs = document.getElementById('tabs'); tabs.parentNode.insertBefore(b, tabs);
    barra = b;
    b.querySelector('.au-abrir').addEventListener('click', () => abrirOv('player'));
    b.querySelector('.au-pp').addEventListener('click', () => Au.pausaSeguir());
    b.querySelector('.au-sig').addEventListener('click', () => Au.siguiente(true));
    b.querySelector('.au-sig').append(ic('sig', 22));
    Au.alCambiar(() => { pintarBarra(); if (U.ov) U.ov.render(); if (APP && APP.tab === 'audios') pintarMarcas(); });
    setInterval(() => { if (Au.P.id) { pintarTiempo(); if (U.ov && U.ov.tick) U.ov.tick(); } }, 500);
  }
  function pintarBarra() {
    armarBarra();
    const e = Au.estado(), d = e.d;
    barra.hidden = !d;
    if (!d) return;
    if (barra.dataset.id !== d.id) { barra.dataset.id = d.id; barra.querySelector('.au-cv').replaceChildren(Au.portada(d, 44)); }
    barra.querySelector('.au-tit').textContent = d.titulo;
    const sig = Au.proximo();
    barra.querySelector('.au-sub').textContent = (Au.P.ctx && Au.P.ctx.listaId ? Au.P.ctx.nombre + ' · ' : '') + (sig ? 'sigue: ' + sig.titulo : [d.bioma, d.lugar].filter(Boolean).join(' · '));
    const pp = barra.querySelector('.au-pp'); pp.replaceChildren(ic(e.sonando ? 'pausa' : 'play', 22));
    pintarTiempo();
  }
  function pintarTiempo() {
    if (!barra) return;
    const e = Au.estado(); if (!e.dur) return;
    barra.querySelector('.au-prog i').style.width = Math.min(100, e.t / e.dur * 100) + '%';
  }

  // ---------------- pantallas que tapan todo (reproductor, cola, modo mesa) ----------------
  function abrirOv(tipo) {
    cerrarOv();
    const el = h('div', { class: 'au-ov au-ov-' + tipo, role: 'dialog', 'aria-label': tipo === 'player' ? 'Reproductor' : tipo === 'cola' ? 'En cola' : 'Modo mesa' });
    document.body.append(el); document.body.classList.add('au-ov-abierto');
    const def = { player: ovPlayer, cola: ovCola, mesa: ovMesa }[tipo];
    U.ov = Object.assign({ tipo, el }, def(el));
    U.ov.render();
  }
  function cerrarOv() { if (U.ov) { U.ov.el.remove(); U.ov = null; } document.body.classList.remove('au-ov-abierto'); }
  const cab = (titulo, derecha, alCerrar) => h('div', { class: 'au-ov-cab' }, btn('abajo', 'Cerrar', alCerrar || cerrarOv, 'au-ib', 26), h('div', { class: 'au-ov-tit' }, titulo), derecha || h('span', { style: 'width:44px' }));

  // --- reproductor completo ---
  function ovPlayer(el) {
    let ref = {};
    function render() {
      const e = Au.estado(), d = e.d;
      if (!d) { cerrarOv(); return; }
      const c = Au.P.ctx, sig = Au.proximo();
      const seek = h('input', { type: 'range', class: 'au-seek', min: 0, max: 1000, value: e.dur ? Math.round(e.t / e.dur * 1000) : 0, 'aria-label': 'Posición' });
      seek.addEventListener('input', () => { const r = Au.actual(); if (r && isFinite(r.el.duration)) r.el.currentTime = seek.value / 1000 * r.el.duration; });
      ref = { seek, t1: h('span', null, Au.dur(e.t)), t2: h('span', null, '-' + Au.dur(Math.max(0, e.dur - e.t))) };
      const rep = h('button', { type: 'button', class: 'au-ib' + (prefs.repetir !== 'no' ? ' on' : ''), 'aria-label': 'Repetir: ' + prefs.repetir, title: 'Repetir', onclick: () => { prefs.repetir = prefs.repetir === 'no' ? 'lista' : prefs.repetir === 'lista' ? 'uno' : 'no'; Au.guardarPrefs(); render(); } }, ic('repetir', 24), prefs.repetir === 'uno' ? h('small', { class: 'au-uno' }, '1') : null);
      const azar = h('button', { type: 'button', class: 'au-ib' + (prefs.azar ? ' on' : ''), 'aria-label': 'Aleatorio', title: 'Aleatorio', onclick: () => { prefs.azar = !prefs.azar; if (Au.P.ctx) Au.P.ctx.azar = null; Au.guardarPrefs(); render(); } }, ic('azar', 24));
      el.replaceChildren(
        cab(c && c.listaId ? 'Sonando desde la lista · ' + c.nombre : 'Sonando desde ' + (c ? c.nombre : 'la biblioteca'), btn('puntos', 'Más', () => menuAudio(d), 'au-ib', 24)),
        h('div', { class: 'au-ov-cuerpo' },
          h('div', { class: 'au-gran' }, Au.portada(d, 300)),
          h('div', { class: 'au-pl-tit' }, h('div', { class: 'crece' }, h('h2', null, d.titulo), h('div', { class: 'suave' }, [d.bioma, d.lugar, d.tono].filter(Boolean).join(' · ') + (d.bpm ? ' · ' + Math.round(d.bpm) + ' BPM' : ''))),
            h('button', { type: 'button', class: 'au-ib' + (Au.esFav(d.id) ? ' fav' : ''), 'aria-label': 'Favorito', onclick: () => { Au.alternarFav(d.id); render(); } }, ic(Au.esFav(d.id) ? 'estrella' : 'estrellaO', 28))),
          h('div', null, seek, h('div', { class: 'au-tt' }, ref.t1, ref.t2)),
          h('div', { class: 'au-ctrls' }, azar, btn('ant', 'Anterior', () => Au.anterior(), 'au-ib', 30),
            h('button', { type: 'button', class: 'au-gordo', 'aria-label': e.sonando ? 'Pausa' : 'Seguir', onclick: () => Au.pausaSeguir() }, ic(e.sonando ? 'pausa' : 'play', 32)),
            btn('sig', 'Siguiente', () => Au.siguiente(true), 'au-ib', 30), rep),
          h('div', { class: 'au-caja' },
            h('label', { class: 'au-sw' }, h('span', { class: 'crece' }, 'Aleatorio inteligente', h('small', { class: 'suave' }, ' cuando se acaba, sigue con uno del mismo bioma y lugar')),
              h('input', { type: 'checkbox', checked: prefs.inteligente, onchange: (x) => Au.seguirConParecido(x.target.checked) })),
            h('div', { class: 'au-fila2' }, h('span', { class: 'crece' }, 'Pase entre audios'), h('span', { class: 'suave' }, (c ? c.fundido : prefs.fundido) ? 'fundido de ' + (c ? c.fundido : prefs.fundido) + ' s · entra desde 0:' + String(c ? c.intro : prefs.intro).padStart(2, '0') : 'sin fundido')),
            d.energia ? h('div', { class: 'au-fila2' }, h('span', { class: 'crece' }, 'Tensión (E' + d.energia + ')'), btn('mas', 'Subir energía', () => Au.cambiarEnergia(1), 'au-chico'), h('button', { type: 'button', class: 'au-chico', 'aria-label': 'Bajar energía', onclick: () => Au.cambiarEnergia(-1) }, '−')) : null,
            h('div', { class: 'au-fila2 sep' }, h('span', { class: 'suave' }, 'Sigue:'), h('span', { class: 'crece au-corta' }, sig ? sig.titulo : (prefs.azar ? 'uno al azar' : '—')),
              h('button', { type: 'button', class: 'au-chico', onclick: () => abrirOv('cola') }, 'En cola (' + Au.P.cola.length + ')'))),
          h('div', { class: 'fila' }, h('button', { type: 'button', onclick: () => abrirOv('mesa') }, 'Modo mesa'), h('button', { type: 'button', onclick: () => Au.apagarSuave(8) }, 'Apagar suave'))));
    }
    return { render, tick: () => { const e = Au.estado(); if (ref.seek && e.dur && document.activeElement !== ref.seek) { ref.seek.value = Math.round(e.t / e.dur * 1000); ref.t1.textContent = Au.dur(e.t); ref.t2.textContent = '-' + Au.dur(Math.max(0, e.dur - e.t)); } } };
  }

  // --- cola ---
  function ovCola(el) {
    function render() {
      const e = Au.estado(), d = e.d, P = Au.P, c = P.ctx;
      const filaCola = (id, i) => { const x = Au.dePorId(id); return x ? h('div', { class: 'au-fila-l' }, h('span', { class: 'au-grip', 'data-i': i, 'aria-label': 'Mover' }, ic('agarre', 20)), Au.portada(x, 42), h('div', { class: 'au-info' }, h('h3', null, x.titulo), h('div', { class: 'au-meta' }, [x.bioma, x.lugar].filter(Boolean).join(' · '))), btn('cerrar', 'Quitar de la cola', () => Au.quitarDeCola(i), 'au-ib', 20)) : null; };
      const resto = c ? c.ids.slice(c.pos + 1, c.pos + 8) : [];
      const lista = h('div', { class: 'au-lista-ord' }, P.cola.map(filaCola));
      el.replaceChildren(cab('En cola', P.cola.length ? h('button', { type: 'button', class: 'au-link', onclick: () => Au.vaciarCola() }, 'Vaciar') : null, () => { cerrarOv(); if (Au.P.id) abrirOv('player'); }),
        h('div', { class: 'au-ov-cuerpo' },
          h('div', { class: 'au-sec' }, 'Sonando ahora'),
          d ? h('div', { class: 'au-card suena' }, Au.portada(d, 52), h('div', { class: 'au-info' }, h('h3', null, d.titulo), h('div', { class: 'au-meta' }, (c ? c.nombre + ' · ' : '') + 'quedan ' + Au.dur(Math.max(0, e.dur - e.t)))), h('span', { class: 'au-pill' }, e.pase ? 'en pase' : 'sonando')) : h('p', { class: 'suave' }, 'No suena nada.'),
          h('div', { class: 'au-sec' }, 'Lo que agregaste a mano ', h('small', { class: 'suave' }, '· suena antes que la lista')),
          P.cola.length ? lista : h('p', { class: 'suave' }, 'La cola está vacía. Usá «Próximo en cola» en cualquier audio.'),
          resto.length ? h('div', { class: 'au-sec' }, 'Sigue en la lista · ' + (c ? c.nombre : '')) : null,
          resto.map((id) => { const x = Au.dePorId(id); return x ? h('div', { class: 'au-fila-l quieta' }, Au.portada(x, 42), h('div', { class: 'au-info' }, h('h3', null, x.titulo), h('div', { class: 'au-meta' }, [x.bioma, x.lugar].filter(Boolean).join(' · ') + (Au.bajado(id) ? '' : ' · sin bajar')))) : null; }),
          h('label', { class: 'au-sw' }, h('span', { class: 'crece' }, 'Al terminar la lista, seguir con uno parecido'), h('input', { type: 'checkbox', checked: prefs.inteligente, onchange: (x) => Au.seguirConParecido(x.target.checked) }))));
      arrastrable(lista, '.au-fila-l', '.au-grip', (de, a) => Au.moverCola(de, a));
    }
    return { render };
  }

  // ---------------- modo mesa (Frodo): pocos botones, grandes ----------------
  function ovMesa(el) {
    let ref = {};
    function render() {
      const e = Au.estado(), d = e.d, c = Au.P.ctx, sig = Au.proximo();
      const vol = h('input', { type: 'range', class: 'au-vol', min: 0, max: 100, value: Math.round(prefs.vol * 100), 'aria-label': 'Volumen', oninput: (x) => { Au.setVol(x.target.value / 100); ref.v.textContent = x.target.value + ' %'; } });
      ref.v = h('span', null, Math.round(prefs.vol * 100) + ' %');
      ref.barra = h('i', { style: 'width:' + (e.dur ? e.t / e.dur * 100 : 0) + '%' });
      const grande = (cl, t, sub, fn) => h('button', { type: 'button', class: 'au-mesa-b ' + cl, onclick: fn }, h('b', null, t), sub ? h('small', null, sub) : null);
      const ls = Au.listas();
      el.replaceChildren(
        h('div', { class: 'au-ov-cab' }, h('div', { class: 'au-ov-tit izq' }, h('small', { class: 'suave' }, 'Modo mesa'), h('div', null, c ? c.nombre : 'Audios')), h('button', { type: 'button', onclick: () => { cerrarOv(); } }, 'Salir')),
        h('div', { class: 'au-ov-cuerpo' },
          h('div', { class: 'au-mesa-ahora' }, d ? Au.portada(d, 84) : null, h('div', { class: 'crece' }, h('h2', null, d ? d.titulo : 'Nada suena'), h('div', { class: 'suave' }, d ? [d.bioma, d.lugar, d.energia ? 'E' + d.energia : ''].filter(Boolean).join(' · ') : 'Elegí una lista abajo'),
            h('div', { class: 'au-prog fina', style: 'margin:10px 0 4px' }, ref.barra), h('div', { class: 'suave au-corta' }, sig ? 'Sigue: ' + sig.titulo : ''))),
          h('div', { class: 'au-mesa-fila' }, grande('amarillo', e.sonando ? 'Pausa' : 'Seguir', '', () => Au.pausaSeguir()), grande('', 'Siguiente', '', () => Au.siguiente(true))),
          h('div', { class: 'au-mesa-grid' },
            grande('rojo', 'Combate', 'salta a E4–E5', () => Au.saltarEnergia(4, 5, 3)), grande('azul', 'Calma', 'baja a E1–E2', () => Au.saltarEnergia(1, 2, 4)),
            grande('', 'Parecido', 'mismo bioma y lugar', () => Au.parecidoAhora()), grande('', 'Apagar suave', 'fundido de salida', () => Au.apagarSuave(8))),
          h('div', { class: 'au-caja' }, h('div', { class: 'au-fila2' }, h('span', { class: 'crece' }, 'Volumen'), ref.v), vol),
          ls.length ? h('div', { class: 'au-sec' }, 'Cambiar de lista') : null,
          h('div', { class: 'au-mesa-listas' }, ls.map((l) => h('button', { type: 'button', class: 'au-mesa-l' + (c && c.listaId === l.id ? ' on' : ''), onclick: () => { Au.reproducirLista(l); } }, Au.mosaico(Au.idsDeLista(l).slice(0, 4), 96), h('span', null, l.nombre))))));
    }
    return { render, tick: () => { const e = Au.estado(); if (ref.barra && e.dur) ref.barra.style.width = Math.min(100, e.t / e.dur * 100) + '%'; } };
  }

  // ---------------- arrastrar para ordenar (agarre de 3 rayitas, con dedo o mouse) ----------------
  // Durante el arrastre NO se mueven los nodos del DOM (si no, el navegador suelta el dedo): se usan transform; al soltar se reordena.
  function arrastrable(cont, selFila, selGrip, alMover) {
    cont.querySelectorAll(selGrip).forEach((g) => {
      g.style.touchAction = 'none';
      g.addEventListener('pointerdown', (ev) => {
        const fila = g.closest(selFila); if (!fila) return;
        ev.preventDefault(); g.setPointerCapture(ev.pointerId); U.arrastrando = true;
        const filas = [...cont.querySelectorAll(selFila)], de = filas.indexOf(fila), alto = fila.getBoundingClientRect().height, y0 = ev.clientY;
        fila.classList.add('moviendo');
        let a = de;
        const mover = (e2) => {
          const dy = e2.clientY - y0;
          fila.style.transform = 'translateY(' + dy + 'px)';
          a = Math.max(0, Math.min(filas.length - 1, de + Math.round(dy / alto)));
          filas.forEach((f, i) => { if (f === fila) return; f.style.transform = (de < a && i > de && i <= a) ? 'translateY(' + (-alto) + 'px)' : (a < de && i >= a && i < de) ? 'translateY(' + alto + 'px)' : ''; });
        };
        const fin = () => {
          g.removeEventListener('pointermove', mover); g.removeEventListener('pointerup', fin); g.removeEventListener('pointercancel', fin);
          filas.forEach((f) => { f.style.transform = ''; }); fila.classList.remove('moviendo'); U.arrastrando = false;
          if (a !== de) {
            const resto = filas.filter((f) => f !== fila);
            if (a >= resto.length) cont.append(fila); else cont.insertBefore(fila, resto[a]);
            alMover(de, a);
          }
        };
        g.addEventListener('pointermove', mover); g.addEventListener('pointerup', fin); g.addEventListener('pointercancel', fin);
      });
    });
  }

  // ---------------- la pestana ----------------
  const SUBS = [['biblioteca', 'Biblioteca'], ['listas', 'Listas'], ['favoritos', '★ Favoritos'], ['recientes', 'Recientes']];
  function vista(app, el) {
    APP = app; vistaEl = el; armarBarra();
    if (!MD.Drive.configurado()) {
      el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Audios'), h('p', { class: 'suave' }, 'Primero entrá a Drive (pestaña Drive) con tu nombre y la clave. Después acá aparecen todos los audios de la biblioteca.')));
      return;
    }
    const sub = U.lista ? 'listas' : U.sub;
    el.append(h('div', { class: 'au-cab' }, h('h2', null, 'Audios'), h('span', { class: 'au-cuenta suave', id: 'auCuenta' }),
      btn('cola', 'Ver la cola', () => abrirOv('cola'), 'au-act', 20), h('button', { type: 'button', class: 'au-act', id: 'auAct', title: 'Buscar audios nuevos en Drive', onclick: () => Au.actualizar(true) }, '↻')));
    el.append(h('div', { class: 'au-sub-nav' }, SUBS.map(([id, n]) => h('button', { type: 'button', class: id === sub ? 'on' : '', onclick: () => { U.sub = id; U.lista = null; U.sel = null; U.destino = null; APP.render(); } }, n))));
    if (U.lista) { vistaDetalle(el); return; }
    if (U.sub === 'listas') vistaListas(el);
    else if (U.sub === 'favoritos' || U.sub === 'recientes') vistaSimple(el, U.sub);
    else vistaBiblioteca(el);
    Au.actualizar(false);
  }
  function pintar() {
    if (!vistaEl || !APP || APP.tab !== 'audios' || !document.getElementById('auCuenta')) return;
    if (U.arrastrando) return;
    if (!U.lista && U.sub === 'biblioteca') pintarCuerpo(); else if (!U.lista && (U.sub === 'favoritos' || U.sub === 'recientes')) pintarSimple(); else APP.render();
  }
  function pintarMarcas() { pintar(); }

  // ----- biblioteca -----
  function vistaBiblioteca(el) {
    const buscar = h('input', { type: 'search', class: 'au-buscar', placeholder: 'Buscar: lluvia, lobos, taberna…', autocomplete: 'off', value: S.q, 'aria-label': 'Buscar audios' });
    buscar.addEventListener('input', () => { S.q = buscar.value; pintarCuerpo(); });
    buscar.addEventListener('keydown', (e) => e.stopPropagation());
    el.append(buscar, h('p', { class: 'suave au-ayuda' }, 'Podés marcar varias opciones por fila (Bosque o Pantano). Entre filas se combinan.'),
      h('div', { id: 'auFacetas', class: 'au-facetas' }), h('button', { type: 'button', id: 'auLimpiar', class: 'au-limpiar', hidden: true, onclick: () => { S.filtro = Au.nuevoFiltro(); S.q = ''; buscar.value = ''; pintarCuerpo(); } }, 'Limpiar filtros'),
      h('div', { class: 'au-herr', id: 'auHerr' }), h('div', { id: 'auBajada', class: 'au-bajada' }), h('div', { id: 'auLista', class: 'au-lista', 'aria-live': 'polite' }), h('div', { id: 'auSelBarra' }));
    pintarCuerpo();
  }
  function marcar(k, v) { const a = S.filtro[k], i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); pintarCuerpo(); }
  function visibles() { return Au.coinciden(null).sort(Au.orden); }
  function pintarCuerpo() {
    const lista = document.getElementById('auLista'); if (!lista) return;
    pintarFacetas(); Au.pintarBajada();
    const r = visibles();
    document.getElementById('auCuenta').textContent = S.cargando ? 'leyendo Drive…' : (r.length + ' de ' + S.cat.length);
    document.getElementById('auLimpiar').hidden = !Au.hayFiltro();
    pintarHerr(r);
    const frag = document.createDocumentFragment();
    if (S.error) frag.append(h('p', { class: 'aviso' }, S.error));
    if (!S.cat.length && !S.cargando && !S.error) frag.append(h('div', { class: 'au-vacio' }, 'Todavía no hay audios. Se suben desde el programa Macrodeck Audio (botón Sincronizar con Drive).'));
    else if (!r.length && S.cat.length) frag.append(h('div', { class: 'au-vacio' }, 'No hay audios con esa combinación. Probá sacar un filtro.'));
    r.forEach((d) => frag.append(tarjeta(d, r)));
    lista.replaceChildren(frag);
    pintarSelBarra(r);
  }
  function pintarHerr(r) {
    const box = document.getElementById('auHerr'); if (!box) return;
    box.replaceChildren(
      U.sel ? null : h('button', { type: 'button', class: 'au-pill-b', onclick: () => { U.sel = new Set(); pintarCuerpo(); } }, 'Seleccionar varios'),
      U.sel ? null : h('button', { type: 'button', class: 'au-pill-b', onclick: () => { const d = Au.parecido(null); if (!d) { aviso('Primero bajá algunos audios.'); return; } Au.seguirConParecido(true); Au.reproducirUno(d, [d.id]); } }, 'Aleatorio inteligente'));
  }
  function tarjeta(d, rVis) {
    const bajado = Au.bajado(d.id), suena = Au.P.id === d.id, e = Au.estado(), sel = U.sel && U.sel.has(d.id);
    const meta = [d.bioma, d.lugar].filter(Boolean).join(' · ');
    const tags = h('div', { class: 'au-tags' }, d.escena ? h('span', { class: 'au-tag' }, d.escena) : null, d.tono ? h('span', { class: 'au-tag' }, d.tono) : null, d.bpm ? h('span', { class: 'au-tag' }, '♩ ' + Math.round(d.bpm)) : null, Au.esReciente(d.id) ? h('span', { class: 'au-tag rec' }, 'escuchado hace poco') : null);
    const acc = h('div', { class: 'au-acc' });
    if (U.sel) acc.append(h('span', { class: 'au-check' + (sel ? ' on' : '') }, sel ? ic('ok', 18) : null));
    else {
      if (bajado) acc.append(h('button', { type: 'button', class: 'au-play', 'aria-label': (suena ? 'Pausa ' : 'Escuchar ') + d.titulo, onclick: () => { if (suena) Au.pausaSeguir(); else Au.reproducirUno(d, (rVis || visibles()).map((x) => x.id)); } }, ic(suena && e.sonando ? 'pausa' : 'play', 20)));
      else {
        const bj = h('button', { type: 'button', class: 'au-bajar', 'aria-label': 'Bajar ' + d.titulo, title: 'Bajar a este equipo (' + Au.mb(d.tam) + ')', onclick: () => Au.bajarLista([d]) }, ic('bajar', 20));
        if (S.dl.activo && S.dl.actual === d.titulo) { bj.disabled = true; bj.textContent = Math.round(S.dl.pct * 100) + '%'; }
        acc.append(bj);
      }
      acc.append(h('div', { class: 'au-mini' }, h('button', { type: 'button', class: Au.esFav(d.id) ? 'fav' : '', 'aria-label': 'Favorito', onclick: () => { Au.alternarFav(d.id); pintarTarjeta(d.id); } }, ic(Au.esFav(d.id) ? 'estrella' : 'estrellaO', 18)), btn('puntos', 'Más opciones', () => menuAudio(d), '', 18)));
    }
    acc.append(h('span', { class: 'au-dur' }, Au.dur(d.duracion_s) + (bajado ? '' : ' · ' + Au.mb(d.tam))));
    const c = h('div', { class: 'au-card' + (suena ? ' suena' : '') + (bajado ? '' : ' nobaj') + (sel ? ' sel' : ''), 'data-id': d.id }, Au.portada(d, 60), h('div', { class: 'au-info' }, h('h3', null, d.titulo), h('div', { class: 'au-meta' }, meta), tags), acc);
    if (U.sel) { c.addEventListener('click', () => { if (U.sel.has(d.id)) U.sel.delete(d.id); else U.sel.add(d.id); pintarCuerpo(); }); }
    return c;
  }
  function pintarTarjeta(id) {
    const e = vistaEl && document.querySelector('.au-card[data-id="' + id + '"]'), d = Au.dePorId(id);
    if (e && d && APP && APP.tab === 'audios' && !U.lista && U.sub === 'biblioteca') e.replaceWith(tarjeta(d, null));
    Au.pintarBajada();
  }
  Au.pintarTarjeta = pintarTarjeta;
  function pintarFacetas() {
    const box = document.getElementById('auFacetas'); if (!box) return;
    const frag = document.createDocumentFragment();
    for (const [k, nombre] of FILAS) {
      const cuenta = new Map();
      Au.coinciden(k).forEach((d) => { const v = Au.valor(d, k); if (v != null) cuenta.set(v, (cuenta.get(v) || 0) + 1); });
      S.filtro[k].forEach((v) => { if (!cuenta.has(v)) cuenta.set(v, 0); });
      let vals = [...cuenta.keys()];
      vals = k === 'bioma' ? vals.sort((a, b) => (Object.keys(BIOMAS).indexOf(a) + 99 * (BIOMAS[a] ? 0 : 1)) - (Object.keys(BIOMAS).indexOf(b) + 99 * (BIOMAS[b] ? 0 : 1)))
        : k === 'energia' ? vals.sort((a, b) => a - b) : vals.sort((a, b) => String(a).localeCompare(String(b), 'es'));
      if (!vals.length) continue;
      const fila = h('div', { class: 'au-fila' }, h('b', null, nombre));
      const chips = h('div', { class: 'au-chips' });
      vals.forEach((v) => {
        const on = S.filtro[k].indexOf(v) >= 0;
        chips.append(h('button', { type: 'button', class: 'au-chip', 'aria-pressed': on ? 'true' : 'false', onclick: () => marcar(k, v) },
          k === 'bioma' ? h('i', { style: 'background:' + (BIOMAS[v] || '#8e8e8e') }) : null, k === 'energia' ? 'E' + v : v, h('small', null, ' ' + cuenta.get(v))));
      });
      fila.append(chips); frag.append(fila);
    }
    box.replaceChildren(frag);
  }
  // barra de abajo cuando se esta eligiendo varios
  function pintarSelBarra(r) {
    const box = document.getElementById('auSelBarra'); if (!box) return;
    if (!U.sel) { box.replaceChildren(); return; }
    const n = U.sel.size, ids = [...U.sel], dest = U.destino ? Au.lista(U.destino) : null;
    const filtro = Au.hayFiltro();
    const fin = () => { U.sel = null; if (dest) { U.lista = dest.id; U.sub = 'listas'; U.destino = null; APP.render(); } else pintarCuerpo(); };
    const auto = h('input', { type: 'checkbox', id: 'auAutoLista' });
    box.replaceChildren(h('div', { class: 'au-selbarra' },
      h('div', { class: 'au-fila2' }, h('b', { class: 'crece' }, n + (n === 1 ? ' seleccionado' : ' seleccionados')),
        h('button', { type: 'button', class: 'au-link', onclick: () => { r.forEach((d) => U.sel.add(d.id)); pintarCuerpo(); } }, 'Los ' + r.length + ' que veo'),
        h('button', { type: 'button', class: 'au-link', onclick: () => { U.sel.clear(); pintarCuerpo(); } }, 'Ninguno'),
        h('button', { type: 'button', class: 'au-link', onclick: fin }, dest ? 'Volver' : 'Salir')),
      !dest && filtro ? h('label', { class: 'au-sw chico' }, auto, h('span', { class: 'crece' }, 'Lista automática', h('small', { class: 'suave' }, ' (se actualiza sola con este filtro: ' + Au.textoFiltro(Au.copiaFiltro()) + ')'))) : null,
      dest ? h('button', { type: 'button', class: 'primario au-gran-b', disabled: !n, onclick: () => { agregarALista(dest, ids); fin(); } }, 'Agregar ' + n + ' a «' + dest.nombre + '»')
        : h('button', { type: 'button', class: 'primario au-gran-b', disabled: !n && !filtro, onclick: () => { if (!n && !auto.checked) { aviso('Elegí al menos un audio.'); return; } pedirTexto('Nombre de la lista', filtro ? Au.textoFiltro(Au.copiaFiltro()).slice(0, 40) : '', (nom) => { const l = Au.nuevaLista(nom, ids, auto.checked ? Au.copiaFiltro() : null); fin(); U.sub = 'listas'; U.lista = l.id; APP.render(); }, 'Crear lista'); } }, 'Crear lista' + (n ? ' con ' + n + (n === 1 ? ' audio' : ' audios') : '')),
      !dest ? h('div', { class: 'au-fila3' }, h('button', { type: 'button', disabled: !n, onclick: () => elegirLista(ids, fin) }, 'Agregar a lista…'), h('button', { type: 'button', disabled: !n, onclick: () => { ids.forEach((id) => Au.alCola(id, false)); fin(); } }, 'A la cola'),
        h('button', { type: 'button', disabled: !n, onclick: () => { ids.forEach((id) => { if (!Au.esFav(id)) Au.alternarFav(id); }); fin(); } }, '★ Favoritos')) : null));
  }
  // resumen de bajada (cuanto falta, lugar en el equipo)
  async function pintarBajada() {
    const box = document.getElementById('auBajada'); if (!box) return;
    const D = S.dl, vis = Au.coinciden(null).filter((d) => !Au.bajado(d.id)), todo = S.cat.filter((d) => !Au.bajado(d.id));
    const suma = (l) => l.reduce((t, d) => t + (d.tam || 0), 0);
    const bt = document.querySelector('.au-card .au-bajar:disabled'); if (bt && D.activo) bt.textContent = Math.round(D.pct * 100) + '%';
    if (D.activo && box.firstChild && box.querySelector('.au-prog i')) {
      box.querySelector('.au-prog i').style.width = Math.round(((D.hechos + D.pct) / D.total) * 100) + '%';
      const t = box.querySelector('.au-bj-txt'); t.firstChild.textContent = 'Bajando ' + Math.min(D.hechos + 1, D.total) + ' de ' + D.total; t.lastChild.textContent = D.actual + ' · ' + Math.round(D.pct * 100) + '%';
      return;
    }
    box.replaceChildren();
    if (D.activo) {
      box.append(h('div', { class: 'au-bj-fila' }, h('div', { class: 'au-bj-txt' }, h('b', null, 'Bajando ' + Math.min(D.hechos + 1, D.total) + ' de ' + D.total), h('span', { class: 'suave' }, D.actual + ' · ' + Math.round(D.pct * 100) + '%')),
        h('button', { type: 'button', onclick: () => { D.cancelar = true; } }, 'Cancelar')), h('div', { class: 'au-prog' }, h('i', { style: 'width:' + Math.round(((D.hechos + D.pct) / D.total) * 100) + '%' })));
    } else if (S.cat.length) {
      const f = h('div', { class: 'au-bj-fila' });
      f.append(h('div', { class: 'au-bj-txt' }, h('b', null, S.bajados.size + ' de ' + S.cat.length + ' bajados'), h('span', { class: 'suave', id: 'auCupo' }, '')));
      if (Au.hayFiltro() && vis.length && vis.length < todo.length) f.append(h('button', { type: 'button', onclick: () => Au.bajarLista(vis) }, 'Bajar lo que veo (' + vis.length + ' · ' + Au.mb(suma(vis)) + ')'));
      if (todo.length) f.append(h('button', { type: 'button', onclick: () => Au.bajarLista(todo) }, 'Bajar todo (' + todo.length + ' · ' + Au.mb(suma(todo)) + ')'));
      box.append(f);
      try { const e = await navigator.storage.estimate(); const c = document.getElementById('auCupo'); if (c && e.quota) c.textContent = 'Usado ' + Au.mb(e.usage) + ' de ' + Au.mb(e.quota) + ' en este equipo'; } catch (x) {}
    }
    if (D.errores.length) box.append(h('p', { class: 'aviso' }, D.errores.slice(-3).join('\n')));
  }
  Au.pintarBajada = pintarBajada;

  // ----- favoritos y recientes -----
  function vistaSimple(el, cual) {
    el.append(h('div', { id: 'auCajaSimple' })); pintarSimple();
  }
  function pintarSimple() {
    const c = document.getElementById('auCajaSimple'); if (!c) return;
    const cual = U.sub, ids = (cual === 'favoritos' ? prefs.fav.slice().reverse() : prefs.rec).filter((id) => Au.dePorId(id));
    const ds = ids.map(Au.dePorId);
    document.getElementById('auCuenta').textContent = ds.length + (cual === 'favoritos' ? ' favoritos' : ' escuchados');
    c.replaceChildren(
      ds.length ? h('div', { class: 'fila' }, h('button', { type: 'button', class: 'primario', onclick: () => { const b = ds.filter((d) => Au.bajado(d.id)); if (!b.length) { aviso('Ninguno está bajado todavía.'); return; } Au.reproducirUno(b[0], b.map((d) => d.id)); } }, 'Reproducir'),
        h('button', { type: 'button', onclick: () => { const l = Au.nuevaLista(cual === 'favoritos' ? 'Favoritos' : 'Escuchados', ids.slice(0, 500)); aviso('Lista «' + l.nombre + '» creada.'); } }, 'Guardar como lista')) : null,
      h('div', { class: 'au-lista' }, ds.length ? ds.map((d) => tarjeta(d, ds)) : [h('div', { class: 'au-vacio' }, cual === 'favoritos' ? 'Todavía no marcaste favoritos. Tocá la ★ en cualquier audio.' : 'Acá aparece lo que fuiste escuchando, para no repetir.')]));
  }

  // ----- listas -----
  function vistaListas(el) {
    const ls = Au.listas();
    el.append(h('div', { class: 'au-listas-top' },
      h('button', { type: 'button', class: 'au-atajo', onclick: () => { U.sub = 'favoritos'; APP.render(); } }, h('span', { class: 'au-atajo-i fav' }, ic('estrella', 22)), 'Favoritos'),
      h('button', { type: 'button', class: 'au-atajo', onclick: () => { U.sub = 'recientes'; APP.render(); } }, h('span', { class: 'au-atajo-i' }, '↺'), 'Escuchados hace poco'),
      h('button', { type: 'button', class: 'au-atajo nueva', onclick: () => pedirTexto('Nombre de la lista nueva', '', (n) => { const l = Au.nuevaLista(n, []); U.lista = l.id; APP.render(); }, 'Crear') }, h('span', { class: 'au-atajo-i' }, ic('mas', 22)), 'Nueva lista')));
    el.append(h('div', { class: 'au-sec' }, 'Tus listas · ' + ls.length));
    document.getElementById('auCuenta').textContent = '';
    if (!ls.length) { el.append(h('div', { class: 'au-vacio' }, 'Todavía no hay listas. Creá una con «Nueva lista» o elegí varios audios en la Biblioteca (Seleccionar varios).')); return; }
    el.append(h('div', { class: 'au-grid-listas' }, ls.map((l) => {
      const ids = Au.idsDeLista(l), tot = ids.reduce((t, id) => t + ((Au.dePorId(id) || {}).duracion_s || 0), 0);
      return h('button', { type: 'button', class: 'au-lcard', onclick: () => { U.lista = l.id; APP.render(); } }, Au.mosaico(ids.slice(0, 4), 150), h('b', null, l.nombre), h('small', { class: 'suave' }, ids.length + ' audios · ' + Au.durLarga(tot) + (l.auto ? ' · automática' : '')));
    })));
  }
  function vistaDetalle(el) {
    const l = Au.lista(U.lista);
    if (!l) { U.lista = null; U.sub = 'listas'; APP.render(); return; }
    document.getElementById('auCuenta').textContent = '';
    const ids = Au.idsDeLista(l), ds = ids.map(Au.dePorId), tot = ds.reduce((t, d) => t + (d.duracion_s || 0), 0);
    const usos = (APP.cfg.escenas || []).filter((e) => e.lista && e.lista.id === l.id).map((e) => e.nombre);
    const sonando = Au.P.ctx && Au.P.ctx.listaId === l.id;
    const fila = (d, i) => h('div', { class: 'au-fila-l' + (sonando && Au.P.id === d.id ? ' suena' : ''), 'data-id': d.id },
      l.auto ? h('span', { class: 'au-n' }, String(i + 1)) : h('span', { class: 'au-grip', 'aria-label': 'Arrastrar para mover' }, ic('agarre', 20)), Au.portada(d, 44),
      h('div', { class: 'au-info' }, h('h3', null, d.titulo), h('div', { class: 'au-meta' }, [d.bioma, d.lugar, d.energia ? 'E' + d.energia : ''].filter(Boolean).join(' · ') + ' · ' + Au.dur(d.duracion_s) + (Au.bajado(d.id) ? '' : ' · sin bajar'))),
      btn('puntos', 'Más opciones', () => menuAudio(d, l.auto ? [] : [['Quitar de esta lista', () => { l.items = l.items.filter((x) => x !== d.id); Au.cambio(); APP.render(); }, 'peligro']]), 'au-ib', 20));
    const opcion = (valores, actual, etiqueta, fn) => h('div', { class: 'au-fila2' }, h('span', { class: 'crece' }, etiqueta), h('span', { class: 'au-opts' }, valores.map(([v, t]) => h('button', { type: 'button', class: v === actual ? 'on' : '', onclick: () => { fn(v); Au.cambio(); APP.render(); } }, t))));
    const cuerpo = h('div', { class: 'au-lista-ord' }, ds.map(fila));
    let seguro = false;
    el.append(
      h('div', { class: 'au-det-cab' }, btn('volver', 'Volver', () => { U.lista = null; APP.render(); }, 'au-ib', 24), h('span', { class: 'crece' }), h('button', { type: 'button', class: 'au-link', onclick: () => pedirTexto('Nombre de la lista', l.nombre, (n) => { l.nombre = n.slice(0, 40); Au.cambio(); APP.render(); }) }, 'Cambiar nombre')),
      h('div', { class: 'au-det-top' }, Au.mosaico(ids.slice(0, 4), 112), h('div', { class: 'crece' }, h('h2', { style: 'margin:0' }, l.nombre), h('div', { class: 'suave', style: 'font-size:.8rem;margin-top:4px' }, ds.length + ' audios · ' + Au.durLarga(tot) + (usos.length ? ' · Escenas: ' + usos.join(', ') : '') + (l.auto ? ' · automática: ' + Au.textoFiltro(l.auto) : '')))),
      h('div', { class: 'fila' }, h('button', { type: 'button', class: 'primario au-redondo', 'aria-label': 'Reproducir la lista', onclick: () => Au.reproducirLista(l, { azar: false }) }, ic('play', 24)), h('button', { type: 'button', class: 'au-redondo', 'aria-label': 'Reproducir al azar', onclick: () => Au.reproducirLista(l, { azar: true }) }, ic('azar', 22)),
        l.auto ? h('button', { type: 'button', onclick: () => { l.items = ids.slice(0, 500); delete l.auto; Au.cambio(); APP.render(); } }, 'Pasar a manual') : h('button', { type: 'button', onclick: () => { U.sub = 'biblioteca'; U.destino = l.id; U.sel = new Set(); U.lista = null; APP.render(); } }, '＋ Agregar audios')),
      h('div', { class: 'au-caja' },
        opcion([[0, 'sin'], [8, '8 s'], [15, '15 s'], [20, '20 s']], l.fundido, 'Fundido entre audios', (v) => { l.fundido = v; }),
        opcion([[0, '0 s'], [15, '15 s']], l.intro, 'Saltear intro del que entra', (v) => { l.intro = v; })),
      ds.length ? (l.auto ? h('div', { class: 'au-lista-ord' }, ds.map(fila)) : h('div', null, h('p', { class: 'suave au-ayuda' }, 'Arrastrá de las rayitas para cambiar el orden.'), cuerpo)) : h('div', { class: 'au-vacio' }, 'La lista está vacía. Tocá «＋ Agregar audios».'),
      h('div', { class: 'fila', style: 'margin-top:14px' }, h('button', { type: 'button', class: 'peligro', onclick: (e) => { if (!seguro) { seguro = true; e.target.textContent = '¿Seguro? tocá otra vez'; return; } Au.borrarLista(l.id); U.lista = null; APP.render(); } }, 'Borrar lista')));
    if (!l.auto) arrastrable(cuerpo, '.au-fila-l', '.au-grip', (de, a) => { const x = l.items.splice(de, 1)[0]; l.items.splice(a, 0, x); Au.cambio(); });
  }

  // ---------------- musica de fondo en el editor de escenas ----------------
  function tarjetaEscena(app, esc) {
    const ls = Au.listas(), cur = esc.lista, l = cur && Au.lista(cur.id);
    const sel = h('select', { 'aria-label': 'Lista de la escena', onchange: (e) => { const v = e.target.value; if (v) esc.lista = { id: v, arranca: cur ? cur.arranca !== false : true, azar: cur ? !!cur.azar : false }; else delete esc.lista; app.cambio(true); app.render(); } },
      h('option', { value: '' }, '(ninguna: no toca la música)'), ls.map((x) => h('option', { value: x.id, selected: !!cur && cur.id === x.id }, x.nombre + (x.auto ? ' (automática)' : ''))),
      cur && !l ? h('option', { value: cur.id, selected: true }, '(lista que todavía no llegó a este celu)') : null);
    return h('div', { class: 'tarjeta' }, h('div', { class: 'fila' }, MD.IUI.svg('audios', 'ic-luz'), h('h3', { style: 'margin:0' }, 'Música de fondo de la escena')),
      h('label', null, 'Lista de la pestaña Audios'), sel,
      cur ? [h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: cur.arranca !== false, onchange: (e) => { cur.arranca = e.target.checked; app.cambio(true); } }), ' Arranca sola al entrar a la escena'),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!cur.azar, onchange: (e) => { cur.azar = e.target.checked; app.cambio(true); } }), ' En orden al azar'),
        l ? h('div', { class: 'fila', style: 'margin-top:8px' }, h('button', { type: 'button', onclick: () => Au.reproducirLista(l, { azar: !!cur.azar }) }, 'Probar'), h('button', { type: 'button', onclick: () => { U.sub = 'listas'; U.lista = l.id; app.tab = 'audios'; app.render(); } }, 'Abrir la lista')) : null,
        h('p', { class: 'suave', style: 'margin:8px 0 0' }, 'Si ya suena otra música, se mezcla con un fundido.')] : h('p', { class: 'suave', style: 'margin:8px 0 0' }, 'Elegí una lista y suena sola al entrar a la escena (desde la app o con el selector del Macrodeck).'));
  }

  Au.ui = { vista, armarBarra, pintar, aviso, tarjetaEscena, abrirOv, cerrarOv };
})(window.MD);
