// selector.js - La ventana para ELEGIR SONIDOS (v1.3-dev9): buscador por texto, sonidos agrupados por categoria (la subcarpeta de Drive),
// casillas para marcar varios de una vez, boton ▶ para escuchar sin elegir, y no se cierra hasta tocar "Agregar".
// Uso:  MD.Selector.abrir(A, { titulo, multi, yaEstan: [ids], alAceptar: (ids) => {...} })
//   multi=true  -> se pueden marcar varios (quedan en el orden en que se marcaron). multi=false -> se elige uno solo.
//   convertir=true (tecla de tipo Unico): se pueden marcar varios y abajo se elige "Al azar" o "En secuencia"; alAceptar(ids, como) recibe 'azar' o 'secuencia'.
//   nota: texto chico bajo el titulo (ej: por que este tipo usa un solo sonido).
window.MD = window.MD || {};
(function (MD) {
  const SIN_CAT = 'Sin categoria';
  const limpio = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const natural = (a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });

  // Agrupa los sonidos de la biblioteca por categoria. Devuelve [[categoria, [sonidos]], ...] ordenado (nombres con numeros: 2 antes que 10)
  function agrupar(sonidos) {
    const m = new Map();
    for (const s of sonidos) { const c = s.carpeta || SIN_CAT; if (!m.has(c)) m.set(c, []); m.get(c).push(s); }
    return [...m.entries()]
      .sort((a, b) => (a[0] === SIN_CAT) - (b[0] === SIN_CAT) || natural(a[0], b[0]))
      .map(([c, l]) => [c, l.slice().sort((x, y) => natural(x.nombre, y.nombre))]);
  }

  function abrir(A, op) {
    const h = MD.UI.h, multi = !!op.multi, convertir = !!op.convertir, yaEstan = new Set(op.yaEstan || []);
    const grupos = agrupar(A.cfg.sonidos);
    const elegidos = [];                                           // ids en el orden en que se marcaron
    const filas = [];                                              // {s, cat, fila, chk, grupo}
    const gr = [];                                                 // {cat, caja, cab, cuerpo, abierto, items, tit, btnTodos}

    const buscar = h('input', { type: 'text', id: 'selBuscar', placeholder: 'Buscar (ej: sword, fuego, paso…)', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    const contador = h('span', { class: 'suave', id: 'selContador' }, '');
    const btnOk = h('button', { type: 'button', class: 'primario', id: 'selAgregar', disabled: true }, multi ? 'Agregar' : 'Elegir');
    const cuerpo = h('div', { class: 'sel-cuerpo' });
    const vacio = h('p', { class: 'suave', id: 'selVacio', hidden: true }, 'No hay sonidos que coincidan.');
    // tecla Unica con varios marcados: como suenan (la tecla cambia de comportamiento al agregar)
    const radAzar = h('input', { type: 'radio', name: 'selComo', value: 'azar', checked: true }), radSec = h('input', { type: 'radio', name: 'selComo', value: 'secuencia' });
    const como = convertir ? h('div', { class: 'sel-como', id: 'selComo', hidden: true },
      h('span', { class: 'suave' }, 'Con varios sonidos la tecla pasa a:'),
      h('label', null, radAzar, ' Al azar'), h('label', null, radSec, ' En secuencia (uno por toque)')) : null;

    const d = h('dialog', { class: 'selector' },
      h('div', { class: 'sel-cab' }, h('h3', { style: 'margin:0 0 8px' }, op.titulo || (multi ? 'Agregar sonidos' : 'Elegir sonido')),
        op.nota ? h('p', { class: 'suave', style: 'margin:0 0 8px;font-size:.85rem' }, op.nota) : null, buscar),
      cuerpo,
      como,
      h('div', { class: 'sel-pie' }, contador, h('span', { class: 'crece' }),
        h('button', { type: 'button', id: 'selCancelar', onclick: () => d.close() }, 'Cancelar'), btnOk));

    const pintarPie = () => {
      const n = elegidos.length;
      contador.textContent = n ? (multi ? 'Marcados: ' + n : '1 elegido') : '';
      if (como) como.hidden = n < 2;
      btnOk.disabled = n === 0;
      btnOk.textContent = multi ? (n ? 'Agregar (' + n + ')' : 'Agregar') : 'Elegir';
    };
    const marcar = (id, si) => {
      const i = elegidos.indexOf(id);
      if (!multi) { elegidos.length = 0; if (si) elegidos.push(id); filas.forEach(f => { f.chk.checked = (f.s.id === id) && si; f.fila.classList.toggle('marcado', f.chk.checked); }); }
      else { if (si && i < 0) elegidos.push(id); if (!si && i >= 0) elegidos.splice(i, 1); }
      const f = filas.find(x => x.s.id === id); if (f) { f.chk.checked = elegidos.includes(id); f.fila.classList.toggle('marcado', f.chk.checked); }
      pintarGrupos(); pintarPie();
    };

    grupos.forEach(([cat, lista]) => {
      const g = { cat, items: [], abierto: grupos.length <= 1 };
      g.tit = h('span', { class: 'crece' }, '');
      g.cab = h('button', { type: 'button', class: 'sel-gcab', onclick: () => { g.abierto = !g.abierto; filtrar(); } }, g.tit);
      g.btnTodos = multi ? h('button', { type: 'button', class: 'sel-todos', title: 'Marcar o quitar todos los que se ven de esta categoria', onclick: () => {
        const vis = g.items.filter(f => !f.fila.hidden), todos = vis.length && vis.every(f => elegidos.includes(f.s.id));
        vis.forEach(f => marcar(f.s.id, !todos));
      } }, 'Todos') : null;
      g.cuerpo = h('div', { class: 'sel-lista' });
      lista.forEach(s => {
        const chk = h('input', { type: multi ? 'checkbox' : 'radio', name: 'selUno', onchange: () => marcar(s.id, chk.checked) });
        const fila = h('div', { class: 'sel-fila', 'data-id': s.id },
          h('label', null, chk, h('span', { class: 'crece' }, s.nombre, h('small', null, (s.duracion ? ' · ' + s.duracion + ' s' : '') + (yaEstan.has(s.id) ? ' · ya esta en la tecla' : '')))),
          h('button', { type: 'button', title: 'Escuchar', onclick: () => A.previa(s.id) }, '▶'));
        const f = { s, cat, fila, chk, grupo: g, texto: limpio(cat + ' ' + s.nombre) };
        filas.push(f); g.items.push(f); g.cuerpo.append(fila);
      });
      g.caja = h('div', { class: 'sel-grupo' }, h('div', { class: 'sel-gfila' }, g.cab, g.btnTodos), g.cuerpo);
      gr.push(g); cuerpo.append(g.caja);
    });
    cuerpo.append(vacio);

    function pintarGrupos() {
      gr.forEach(g => { const n = g.items.filter(f => elegidos.includes(f.s.id)).length; g.marcados = n; pintarTitulo(g); });
    }
    function pintarTitulo(g) {
      const vis = g.items.filter(f => !f.fila.hidden).length, buscando = !!limpio(buscar.value).trim();
      const abierto = buscando || g.abierto;
      g.tit.textContent = (abierto ? '▾ ' : '▸ ') + g.cat + ' (' + (buscando ? vis + ' de ' + g.items.length : g.items.length) + ')' + (g.marcados ? '  ✓' + g.marcados : '');
    }
    function filtrar() {
      const q = limpio(buscar.value).trim().split(/\s+/).filter(Boolean), buscando = q.length > 0;
      let total = 0;
      filas.forEach(f => { f.fila.hidden = buscando && !q.every(t => f.texto.includes(t)); });
      gr.forEach(g => {
        const vis = g.items.filter(f => !f.fila.hidden).length; total += vis;
        g.caja.hidden = buscando && vis === 0;
        g.cuerpo.hidden = !(buscando || g.abierto);
        if (g.btnTodos) g.btnTodos.hidden = !(buscando || g.abierto);
        pintarTitulo(g);
      });
      vacio.hidden = total > 0;
    }
    buscar.addEventListener('input', filtrar);
    btnOk.addEventListener('click', () => { const ids = elegidos.slice(), c = radSec.checked ? 'secuencia' : 'azar'; d.close(); if (ids.length) op.alAceptar(ids, c); });
    d.addEventListener('close', () => { try { A.detenerPrevia(); } catch (e) {} d.remove(); });
    document.body.append(d); filtrar(); pintarPie(); d.showModal();
    try { buscar.blur(); } catch (e) {}                              // que no salte el teclado solo: se toca el buscador cuando se quiere
    return d;
  }

  MD.Selector = { abrir, agrupar };
})(window.MD);
