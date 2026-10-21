// sync_todo.js - El boton GRANDE "Sincronizar todo", fijo arriba en todas las pestanas.
// De un toque: junta con Drive las escenas, los looks de luces, las listas, los favoritos y la luz de reposo; actualiza el catalogo de audios y la lista de
// sonidos; y si faltan audios o sonidos en este equipo, pregunta cuantos son y cuanto pesan antes de bajarlos ("faltan 12 audios, 340 MB, ¿bajo?").
window.MD = window.MD || {};
(function (MD) {
  const h = (...a) => MD.UI.h(...a);
  const S = { activo: false, fase: '', ultima: 0, resumen: '', error: '' };
  const mb = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : Math.max(1, Math.round(n / 1e6)) + ' MB';
  const hora = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()); };
  let barra = null, tim = 0;

  // Audios que esta campana usa y todavia no estan bajados en este equipo (musica de las escenas, ambientes, teclas Ambiente, listas, favoritos).
  function audiosQueFaltan(A) {
    const Au = MD.Au, ids = new Set(), add = (id) => { if (id) ids.add(id); };
    (A.cfg.escenas || []).forEach((e) => {
      if (e.lista) { const l = Au.lista(e.lista.id); if (l) Au.idsDeLista(l).forEach(add); }
      if (e.ambiente) add(e.ambiente.id);
      (e.teclas || []).forEach((t) => { if (t && t.tipo === 'ambiente') add(t.audio); });
    });
    (A.cfg.listas || []).forEach((l) => { if (!l.auto) Au.idsDeLista(l).forEach(add); });
    (A.cfg.favoritos || []).forEach(add);
    return [...ids].map(Au.dePorId).filter((d) => d && d.drive_id && !Au.bajado(d.id));
  }
  function sonidosQueFaltan(A) {
    const D = MD.DriveUI;
    return (A.driveLista || []).filter((s) => D.estadoDe(A, s) !== 'ok');
  }
  // Hay cambios en este equipo que todavia no subieron a Drive?
  function sinSubir(A) {
    try {
      const b = MD.Drive.baseEscenas(); if (!b) return true;
      const E = MD.DriveEsc.estable, esc = (A.cfg.escenas || []).filter((e) => !(e && e.estado === 'borrador' && !MD.Drive.esDM()));
      return E(esc) !== E(b.escenas || []) || E(A.cfg.looks || []) !== E(b.looks || []) || E(A.cfg.listas || []) !== E(b.listas || [])
        || E((A.cfg.favoritos || []).slice().sort()) !== E((b.favoritos || []).slice().sort())
        || E(MD.Config.normLuzBase(A.cfg.ajustes.luzBase)) !== E(MD.Config.normLuzBase(b.luzBase));
    } catch (e) { return false; }
  }

  function pregunta(A, aud, son, bytes) {
    return new Promise((ok) => {
      const D = MD.Disco, discoMal = D && D.activo() && !D.listo();
      const d = h('dialog', { class: 'esc-md-dlg', id: 'dlgSync' }, h('h3', null, 'Faltan cosas en este equipo'),
        h('p', null, (aud.length ? aud.length + ' audio(s) de Audios' : '') + (aud.length && son.length ? ' y ' : '') + (son.length ? son.length + ' sonido(s) de teclas' : '') + ' · aprox. ' + mb(bytes) + '.'),
        D && D.activo() ? h('p', { class: 'suave' }, discoMal ? '⚠ El disco «' + D.nombre() + '» no está conectado.' : 'Se guardan en el disco «' + D.nombre() + '».') : null,
        h('div', { class: 'fila', style: 'margin-top:12px;justify-content:flex-end;flex-wrap:wrap' },
          discoMal ? h('button', { type: 'button', onclick: async () => { await D.reconectar(); d.close(); d.remove(); ok(await pregunta(A, aud, son, bytes)); } }, 'Reconectar disco') : null,
          h('button', { type: 'button', onclick: () => { d.close(); d.remove(); ok(false); } }, 'Más tarde'),
          discoMal ? null : h('button', { type: 'button', class: 'primario', id: 'btnSyncBajar', onclick: () => { d.close(); d.remove(); ok(true); } }, 'Bajar ahora')));
      document.body.append(d); d.showModal();
    });
  }

  async function sincronizarTodo() {
    const A = window.MDapp, Au = MD.Au;
    if (S.activo) return;
    if (!MD.Drive.configurado()) { A.tab = 'drive'; A.render(); return; }
    if (!navigator.onLine) { S.error = 'No hay internet.'; pintar(); return; }
    S.activo = true; S.error = ''; S.resumen = ''; pintar();
    try {
      S.fase = 'Escenas, looks, listas y favoritos…'; pintar();
      await A.driveEscenas();
      if (A.escConflictos && A.escConflictos.length) { S.resumen = 'Hay una escena cambiada en los dos lados: elegí con cuál quedarte (pestaña Drive).'; A.tab = 'drive'; A.render(); return; }
      if (/^No se pudo/.test(A.escMsg || '')) throw new Error(A.escMsg);
      S.fase = 'Catálogo de audios…'; pintar();
      await Au.actualizar(true);
      S.fase = 'Sonidos de Drive…'; pintar();
      await A.driveActualizar();
      const aud = audiosQueFaltan(A), son = sonidosQueFaltan(A);
      const bytes = aud.reduce((n, d) => n + (d.tam || 0), 0) + son.reduce((n, s) => n + (s.tam || 0), 0);
      let bajados = '';
      if (aud.length || son.length) {
        S.fase = ''; pintar();
        if (await pregunta(A, aud, son, bytes)) {
          if (son.length) { S.fase = 'Bajando sonidos…'; pintar(); await A.driveBajarTodo(son); }
          if (aud.length) { S.fase = 'Bajando audios…'; pintar(); await Au.bajarLista(aud); }
          const errs = (Au.S.dl.errores || []).length;
          bajados = ' · bajé ' + (aud.length ? aud.length + ' audio(s)' : '') + (aud.length && son.length ? ' y ' : '') + (son.length ? son.length + ' sonido(s)' : '') + (errs ? ' (' + errs + ' con error)' : '');
        } else bajados = ' · faltan ' + aud.length + ' audio(s) y ' + son.length + ' sonido(s) (' + mb(bytes) + ')';
      }
      S.ultima = Date.now();
      S.resumen = 'Listo ' + hora(S.ultima) + (A.escMsg ? ' · ' + A.escMsg.replace(/\s*Ojo:.*$/, '') : '') + bajados;
    } catch (e) { S.error = e.message || String(e); }
    S.activo = false; S.fase = ''; pintar();
  }

  function pintar() {
    if (!barra) return;
    const A = window.MDapp, D = MD.Disco;
    const cfgd = MD.Drive.configurado(), dm = MD.Drive.esDM();
    barra.className = 'barra-sync' + (dm ? ' dm' : '') + (S.activo ? ' ocupada' : '');
    const b = barra.querySelector('button.sync-b'), t = barra.querySelector('.sync-t');
    b.disabled = S.activo; b.firstChild.textContent = S.activo ? '⟳' : '⟳'; b.querySelector('b').textContent = !cfgd ? 'Conectar Drive' : S.activo ? 'Sincronizando…' : 'Sincronizar todo';
    let txt = '';
    const dl = MD.Au && MD.Au.S.dl;
    if (S.error) txt = '⚠ ' + S.error;
    else if (S.activo) {
      txt = S.fase;
      if (dl && dl.activo) txt = 'Bajando audio ' + Math.min(dl.hechos + 1, dl.total) + ' de ' + dl.total + (dl.actual ? ': ' + dl.actual : '') + ' (' + Math.round(dl.pct * 100) + ' %)';
      else if (A && A.driveBajandoTodo) txt = 'Bajando sonidos ' + A.driveBajandoTodo;
    } else if (!cfgd) txt = 'Entrá a Drive para sincronizar escenas, luces, listas y favoritos.';
    else {
      const sin = A && A.cfg ? sinSubir(A) : false;
      txt = (S.resumen || (S.ultima ? 'Última sync ' + hora(S.ultima) : 'Todavía no sincronizaste en esta sesión')) + (sin ? ' · ● hay cambios sin subir' : '');
    }
    if (D && D.activo() && !D.listo() && !S.activo) txt = '💾 Disco «' + D.nombre() + '» desconectado · ' + txt;
    t.textContent = txt;
    t.classList.toggle('mal', !!S.error);
    let rc = barra.querySelector('.sync-rec');
    if (D && D.activo() && !D.listo()) {
      if (!rc) { rc = h('button', { type: 'button', class: 'sync-rec', onclick: async () => { await D.reconectar(); pintar(); } }, 'Reconectar disco'); barra.append(rc); }
    } else if (rc) rc.remove();
  }

  const API = {
    estado: S,
    audiosQueFaltan, sonidosQueFaltan, sinSubir,
    sincronizarTodo,
    montar() {
      if (barra) { pintar(); return; }
      barra = h('div', { class: 'barra-sync', id: 'barraSync' }, h('button', { type: 'button', class: 'sync-b', id: 'btnSincronizarTodo', onclick: sincronizarTodo }, h('span', { class: 'sync-ic' }, '⟳'), h('b', null, 'Sincronizar todo')), h('span', { class: 'sync-t suave' }));
      const main = document.getElementById('vista'); main.parentNode.insertBefore(barra, main);
      if (MD.Disco) MD.Disco.alCambiar = ((previo) => () => { try { if (previo) previo(); } catch (e) {} pintar(); })(MD.Disco.alCambiar);
      if (!tim) tim = setInterval(pintar, 1500);
      pintar();
    },
  };
  MD.Sync = API;
})(window.MD);
