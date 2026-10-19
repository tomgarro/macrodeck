// drive_ui.js - La pestana "Drive": conectar con la carpeta, ver que hay y bajar lo nuevo a este celu.
window.MD = window.MD || {};
(function (MD) {
  const mb = (n) => (n / 1048576).toFixed(n < 1048576 ? 2 : 1) + ' MB';

  // Estado de un sonido de Drive respecto de lo que ya esta en la biblioteca de este celu
  function estadoDe(A, s) {
    const ya = A.cfg.sonidos.find(x => x.id === s.id);
    if (!ya) return 'nuevo';
    if (ya.driveMod && s.mod > ya.driveMod) return 'cambio';
    return 'ok';
  }

  function vista(A, el) {
    const h = MD.UI.h, D = MD.Drive, aj = D.ajustes();
    const url = D.urlFija ? null : h('input', { type: 'text', value: aj.url || '', placeholder: 'https://script.google.com/macros/s/.../exec', autocapitalize: 'off', spellcheck: 'false' });
    const clave = h('input', { type: 'password', value: aj.clave || '', placeholder: 'La clave', autocomplete: 'off' });
    const por = h('select', null, D.usuarios.map(n => h('option', { value: n, selected: n === aj.por }, n)));
    const entrar = () => { D.fijar(url ? url.value : '', clave.value, por.value); A.driveLista = null; A.driveActualizar(); };
    clave.addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
    el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Entrar a la biblioteca de Drive'),
      h('p', { class: 'suave' }, 'Los sonidos viven en una carpeta de Google Drive compartida. Elegi quien sos y pone la clave (se guarda solo en este celu).'),
      url ? [h('label', null, 'Direccion del Apps Script (falta cargarla en drive_config.js)'), url] : null,
      h('label', null, 'Quien sos'), por, h('label', null, 'Clave'), clave,
      h('div', { class: 'fila', style: 'margin-top:10px' }, h('button', { class: 'primario', type: 'button', onclick: entrar }, 'Entrar')),
      A.driveError ? h('p', { class: 'aviso', style: 'margin-top:10px' }, A.driveError) : null));

    if (!D.configurado()) return;
    if (!A.driveLista && !A.driveCargando && !A.driveError) A.driveActualizar();

    if (A.driveCargando && !A.driveLista) { el.append(h('p', { class: 'suave' }, 'Leyendo la carpeta de Drive…')); return; }
    if (!A.driveLista) return;

    const lista = A.driveLista, nuevos = lista.filter(s => estadoDe(A, s) === 'nuevo'), cambiados = lista.filter(s => estadoDe(A, s) === 'cambio');
    const pendientes = nuevos.concat(cambiados);
    const faltan = A.cfg.sonidos.filter(s => s.carpeta && !lista.some(x => x.id === s.id));
    const resumen = lista.length + ' sonido(s) en Drive en ' + (A.driveCategorias.length || 1) + ' categoria(s)'
      + (nuevos.length ? ' · ' + nuevos.length + ' nuevo(s)' : '') + (cambiados.length ? ' · ' + cambiados.length + ' cambiado(s)' : '');
    el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Carpeta: ' + (A.driveCarpeta || '')),
      h('p', null, resumen + '.'),
      h('div', { class: 'fila' },
        h('button', { type: 'button', disabled: !!A.driveCargando, onclick: () => A.driveActualizar() }, A.driveCargando ? 'Actualizando…' : 'Actualizar'),
        h('button', { class: 'primario', type: 'button', disabled: !pendientes.length || !!A.driveBajandoTodo, onclick: () => A.driveBajarTodo(pendientes) },
          A.driveBajandoTodo ? ('Bajando… ' + A.driveBajandoTodo) : (pendientes.length ? 'Bajar lo nuevo (' + pendientes.length + ')' : 'Todo al dia'))),
      A.driveMsg ? h('p', { class: 'suave', style: 'margin-top:8px' }, A.driveMsg) : null));

    // escenas compartidas
    const teclasDe = (e) => e ? e.teclas.filter(Boolean).length : 0;
    el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Escenas compartidas'),
      h('p', { class: 'suave' }, D.esDM()
        ? 'Junta tus escenas y looks de luces con los de Drive. Las escenas nuevas nacen en borrador: Tom no las ve hasta que toques "Confirmar escena" (pestana Escenas) y sincronices.'
        : 'Junta las escenas y los looks de luces de este celu con los de Drive. Solo llegan las escenas que Frodo ya confirmo; si tocaron la misma, te pregunta.'),
      h('div', { class: 'fila' }, h('button', { class: 'primario', type: 'button', disabled: !!A.escCargando, onclick: () => A.driveEscenas() }, A.escCargando ? 'Sincronizando…' : 'Sincronizar escenas')),
      A.escMsg ? h('p', { class: 'suave', style: 'margin-top:8px' }, A.escMsg) : null,
      (A.escConflictos || []).map(c => h('div', { class: 's', style: 'margin-top:8px' },
        h('div', { class: 'crece' }, h('div', null, (c.mia && c.mia.nombre) || (c.drive && c.drive.nombre) || c.id), h('small', null, 'En este celu: ' + teclasDe(c.mia) + ' tecla(s) · En Drive: ' + teclasDe(c.drive) + ' tecla(s)')),
        h('button', { type: 'button', onclick: () => A.driveElegir(c.id, 'mia') }, 'Quedarme con la mia'),
        h('button', { type: 'button', onclick: () => A.driveElegir(c.id, 'drive') }, 'Usar la de Drive')))));

    // subir sonidos
    const cats = ['Sin categoria'].concat((A.driveCategorias || []).filter(c => c !== 'Sin categoria'));
    const sel = h('select', { onchange: () => { A.driveCatSel = sel.value; } }, cats.map(c => h('option', { value: c === 'Sin categoria' ? '' : c, selected: (A.driveCatSel || '') === (c === 'Sin categoria' ? '' : c) }, c)));
    const arch = h('input', { type: 'file', multiple: true, accept: 'audio/*,.mp3,.wav,.ogg,.m4a,.flac,.opus,.aac,.webm' });
    el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Subir sonidos a Drive'),
      h('p', { class: 'suave' }, 'Los sonidos que subas les aparecen a los demas como "nuevos". Maximo 12 MB cada uno. Las categorias son las subcarpetas de Drive (para crear una nueva, hacela a mano en Drive).'),
      h('label', null, 'Categoria'), sel, h('label', null, 'Archivos'), arch,
      h('div', { class: 'fila', style: 'margin-top:10px' }, h('button', { class: 'primario', type: 'button', disabled: !!A.driveSubiendo, onclick: () => { if (!arch.files.length) { A.driveSubidaMsg = 'Primero elegi uno o mas archivos.'; A.render(); return; } A.driveSubidaMsg = ''; A.driveSubir(arch.files, sel.value); } }, A.driveSubiendo ? 'Subiendo…' : 'Subir')),
      A.driveSubiendo ? h('p', { class: 'suave', style: 'margin-top:8px' }, A.driveSubiendo) : null,
      A.driveSubidaMsg ? h('p', { class: 'suave', style: 'margin-top:8px' }, A.driveSubidaMsg) : null));

    // agrupado por categoria (subcarpeta)
    const grupos = new Map();
    lista.slice().sort((a, b) => (a.carpeta + '/' + a.nombre).localeCompare(b.carpeta + '/' + b.nombre, 'es')).forEach(s => {
      if (!grupos.has(s.carpeta)) grupos.set(s.carpeta, []);
      grupos.get(s.carpeta).push(s);
    });
    grupos.forEach((items, carpeta) => {
      const pend = items.filter(s => estadoDe(A, s) !== 'ok');
      const caja = h('div', { class: 'tarjeta' }, h('div', { class: 'fila', style: 'margin-bottom:8px' },
        h('h3', { class: 'crece', style: 'margin:0' }, carpeta + ' (' + items.length + ')'),
        pend.length ? h('button', { type: 'button', disabled: !!A.driveBajandoTodo, onclick: () => A.driveBajarTodo(pend) }, 'Bajar carpeta (' + pend.length + ')') : h('small', { class: 'suave' }, '✓ toda en este celu')));
      const l = h('div', { class: 'lista-s' });
      items.forEach(s => {
        const est = estadoDe(A, s), bajando = A.driveBajando && A.driveBajando[s.id];
        const etiqueta = bajando != null ? 'bajando ' + Math.round(bajando * 100) + ' %' : (est === 'ok' ? 'en este celu' : est === 'nuevo' ? 'nuevo, solo en Drive' : 'cambio en Drive');
        l.append(h('div', { class: 's' },
          h('button', { type: 'button', title: est === 'ok' ? 'Escuchar' : 'Bajar y escuchar', onclick: async () => { if (est !== 'ok') await A.driveBajar(s); A.previa(s.id); } }, '▶'),
          h('div', { class: 'crece' }, h('div', null, s.nombre), h('small', null, mb(s.tam) + ' · ' + etiqueta + (s.nota ? ' · ' + s.nota : ''))),
          est === 'ok' ? h('span', { class: 'suave' }, '✓') : h('button', { type: 'button', disabled: bajando != null, onclick: () => A.driveBajar(s) }, est === 'nuevo' ? 'Bajar' : 'Actualizar')));
      });
      caja.append(l); el.append(caja);
    });

    if (faltan.length) {
      el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Ya no estan en Drive (' + faltan.length + ')'),
        h('p', { class: 'suave' }, 'Estos sonidos siguen en este celu pero alguien los saco de la carpeta. No se borra nada solo.'),
        h('div', { class: 'lista-s' }, faltan.map(s => h('div', { class: 's' }, h('div', { class: 'crece' }, s.nombre, h('small', null, ' · ' + (s.carpeta || ''))))))));
    }
  }

  MD.DriveUI = { vista, estadoDe };
})(window.MD);
