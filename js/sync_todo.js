// sync_todo.js - El boton GRANDE "Sincronizar todo", fijo arriba en todas las pestanas.
// De un toque: junta con Drive las escenas, los looks de luces, las listas, los favoritos y la luz de reposo; actualiza el catalogo de audios y la lista de
// sonidos; y si faltan audios o sonidos en este equipo, pregunta cuantos son y cuanto pesan antes de bajarlos ("faltan 12 audios, 340 MB, ¿bajo?").
// 1.3-dev37: segundo boton "Descargar TODO" (todos los audios del catalogo + todos los sonidos de Drive + escenas/looks/listas, sin importar si una escena los usa).
// Mientras baja, la compu no se bloquea ni apaga la pantalla (MD.Sostener), espera si se cae internet, reintenta lo que falle y, si se corta, se retoma sin repetir lo ya bajado.
window.MD = window.MD || {};
(function (MD) {
  const h = (...a) => MD.UI.h(...a);
  const S = { activo: false, fase: '', ultima: 0, resumen: '', error: '', todo: false, cancel: false };
  const MARCA = 'md_descarga_todo';                       // queda puesta mientras una "Descargar TODO" no termino bien (si se corta, avisa que hay que retomar)
  const marca = (v) => { try { if (v) localStorage.setItem(MARCA, '1'); else localStorage.removeItem(MARCA); } catch (e) {} };
  const hayMarca = () => { try { return !!localStorage.getItem(MARCA); } catch (e) { return false; } };
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
  // TODOS los audios del catalogo que todavia no estan en este equipo (lo use una escena o no).
  function audiosTodos() { return MD.Au.S.cat.filter((d) => d && d.drive_id && !MD.Au.bajado(d.id)); }
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
        || E(MD.Config.normLuzBase(A.cfg.ajustes.luzBase)) !== E(MD.Config.normLuzBase(b.luzBase))
        || (MD.Trk && MD.Trk.Servicio && MD.Trk.Servicio.cfgCargada && b.tracker !== undefined && E(MD.DriveEsc.aplanarTracker(MD.Trk.Servicio.cfg)) !== E(b.tracker));
    } catch (e) { return false; }
  }

  function pregunta(A, aud, son, bytes, todo) {
    return new Promise((ok) => {
      const D = MD.Disco, discoMal = D && D.activo() && !D.listo();
      const d = h('dialog', { class: 'esc-md-dlg', id: 'dlgSync' }, h('h3', null, todo ? 'Descargar TODO' : 'Faltan cosas en este equipo'),
        h('p', null, (aud.length ? aud.length + ' audio(s) de Audios' : '') + (aud.length && son.length ? ' y ' : '') + (son.length ? son.length + ' sonido(s) de teclas' : '') + ' · aprox. ' + mb(bytes) + '.'),
        todo ? h('p', { class: 'suave' }, 'La pantalla no se va a apagar ni bloquear sola mientras baja. Dejá la compu enchufada y esta pestaña abierta. Si se corta, volvé a tocar «Descargar TODO»: lo que ya bajó no se repite.') : null,
        D && D.activo() ? h('p', { class: 'suave' }, discoMal ? '⚠ El disco «' + D.nombre() + '» no está conectado.' : 'Se guardan en el disco «' + D.nombre() + '».') : null,
        h('div', { class: 'fila', style: 'margin-top:12px;justify-content:flex-end;flex-wrap:wrap' },
          discoMal ? h('button', { type: 'button', onclick: async () => { await D.reconectar(); d.close(); d.remove(); ok(await pregunta(A, aud, son, bytes, todo)); } }, 'Reconectar disco') : null,
          h('button', { type: 'button', onclick: () => { d.close(); d.remove(); ok(false); } }, 'Más tarde'),
          discoMal ? null : h('button', { type: 'button', class: 'primario', id: 'btnSyncBajar', onclick: () => { d.close(); d.remove(); ok(true); } }, todo ? 'Bajar TODO ahora' : 'Bajar ahora')));
      document.body.append(d); d.showModal();
    });
  }

  // Baja lo que falta en rondas: lo que falle en una ronda se reintenta en la siguiente (hasta 4). Si no hay internet espera; si el disco se desconecta, frena.
  async function bajarConReintentos(A, aud, son) {
    const Au = MD.Au, D = MD.Disco;
    for (let ronda = 0; ronda < 4 && !S.cancel; ronda++) {
      if (ronda) { S.fase = 'Reintentando lo que falló (ronda ' + (ronda + 1) + ')…'; pintar(); await Au.dormir(4000 * ronda); }
      const pS = ronda ? sonidosQueFaltan(A) : son, pA = ronda ? aud.filter((d) => !Au.bajado(d.id)) : aud;
      if (!pA.length && !pS.length) break;
      if (!navigator.onLine) { S.fase = 'Sin internet: espero a que vuelva…'; pintar(); await Au.esperarRed(() => S.cancel); }
      if (S.cancel) break;
      if (D && D.activo() && !D.listo()) break;                                       // disco desconectado: no sirve seguir
      if (pS.length) { S.fase = 'Bajando sonidos…'; pintar(); await A.driveBajarTodo(pS); }
      if (S.cancel) break;
      if (pA.length) { S.fase = 'Bajando audios…'; pintar(); await Au.bajarLista(pA); }
    }
  }
  function cancelar() { S.cancel = true; try { MD.Au.S.dl.cancelar = true; window.MDapp.driveCancelar = true; } catch (e) {} pintar(); }

  // todo = false: "Sincronizar todo" (baja lo que usan las escenas, listas y favoritos). todo = true: "Descargar TODO" (baja absolutamente todo).
  async function sincronizarTodo(todo) {
    const A = window.MDapp, Au = MD.Au, Di = MD.Disco;
    if (S.activo) return;
    if (!MD.Drive.configurado()) { A.tab = 'drive'; A.render(); return; }
    if (!navigator.onLine) { S.error = 'No hay internet.'; pintar(); return; }
    if (todo && Di && Di.activo() && !Di.listo()) { try { await Di.reconectar(); } catch (e) {} if (!Di.listo()) { S.error = 'El disco «' + Di.nombre() + '» no está conectado: conectalo y tocá «Reconectar disco».'; pintar(); return; } }
    S.activo = true; S.todo = !!todo; S.cancel = false; S.error = ''; S.resumen = ''; pintar();
    const soltar = MD.Sostener ? MD.Sostener.tomar() : () => {};
    if (todo) marca(true);
    try {
      S.fase = 'Escenas, looks, listas, favoritos y tracker…'; pintar();
      await A.driveEscenas();
      if (A.escConflictos && A.escConflictos.length) { S.resumen = 'Hay una escena cambiada en los dos lados: elegí con cuál quedarte (pestaña Drive).'; A.tab = 'drive'; A.render(); return; }
      if (/^No se pudo/.test(A.escMsg || '')) throw new Error(A.escMsg);
      S.fase = 'Catálogo de audios…'; pintar();
      await Au.actualizar(true);
      S.fase = 'Sonidos de Drive…'; pintar();
      await A.driveActualizar();
      let adoptados = 0;
      if (A.adoptarSonidosDeDisco) { S.fase = 'Registrando sonidos que ya están en el disco…'; pintar(); try { adoptados = await A.adoptarSonidosDeDisco(); } catch (e) {} }   // 1.3-dev38: los que vinieron por pendrive
      // (2.0-dev3) En una red de la lista (ej. el hotspot) solo se sincroniza lo liviano; los audios y sonidos esperan a otro Wi-Fi
      const soloLiv = MD.Red && MD.Red.soloLiviano ? await MD.Red.soloLiviano() : false;
      const aud = soloLiv ? [] : (todo ? audiosTodos() : audiosQueFaltan(A)), son = soloLiv ? [] : sonidosQueFaltan(A);
      if (soloLiv) { const fa = audiosQueFaltan(A).length, fs = sonidosQueFaltan(A).length; S.avisoLiviano = ' · red con datos de otro celu: sincronicé escenas, looks y listas (' + ((fa || fs) ? 'faltan ' + fa + ' audio(s) y ' + fs + ' sonido(s) para otro Wi-Fi' : 'no faltaba nada pesado') + ')'; } else S.avisoLiviano = '';
      const bytes = aud.reduce((n, d) => n + (d.tam || 0), 0) + son.reduce((n, s) => n + (s.tam || 0), 0);
      let bajados = '';
      if (aud.length || son.length) {
        S.fase = ''; pintar();
        if (await pregunta(A, aud, son, bytes, todo)) {
          await bajarConReintentos(A, aud, son);
          const quedanA = aud.filter((d) => !Au.bajado(d.id)).length, quedanS = sonidosQueFaltan(A).length, hechosA = aud.length - quedanA, hechosS = son.length - quedanS;
          bajados = ' · bajé ' + hechosA + ' audio(s) y ' + hechosS + ' sonido(s)';
          if (S.cancel) bajados += ' · cancelado, faltan ' + quedanA + ' audio(s) y ' + quedanS + ' sonido(s)';
          else if (quedanA || quedanS) bajados += ' · ⚠ no se pudieron bajar ' + quedanA + ' audio(s) y ' + quedanS + ' sonido(s): tocá de nuevo para reintentar' + ((Di && Di.activo() && !Di.listo()) ? ' (el disco se desconectó)' : '');
          else if (todo) { marca(false); bajados += ' · ✓ ya tenés TODO en este equipo'; }
        } else bajados = ' · faltan ' + aud.length + ' audio(s) y ' + son.length + ' sonido(s) (' + mb(bytes) + ')';
      } else if (todo && !soloLiv) { marca(false); bajados = ' · ✓ ya tenés TODO en este equipo (' + Au.S.cat.filter((d) => Au.bajado(d.id)).length + ' audios)'; }
      if (todo && !soloLiv) { try { await Au.bajarCaratulas(); } catch (e) {} }
      if (soloLiv) bajados = S.avisoLiviano;
      if (adoptados) bajados += ' · registré ' + adoptados + ' sonido(s) del disco';
      S.ultima = Date.now();
      S.resumen = 'Listo ' + hora(S.ultima) + (A.escMsg ? ' · ' + A.escMsg.replace(/\s*Ojo:.*$/, '') : '') + bajados;
    } catch (e) { S.error = e.message || String(e); }
    soltar();
    S.activo = false; S.todo = false; S.cancel = false; S.fase = ''; pintar();
  }

  function pintar() {
    if (!barra) return;
    const A = window.MDapp, D = MD.Disco;
    const cfgd = MD.Drive.configurado(), dm = MD.Drive.esDM();
    barra.className = 'barra-sync' + (dm ? ' dm' : '') + (S.activo ? ' ocupada' : '');
    const b = barra.querySelector('button.sync-b'), t = barra.querySelector('.sync-t');
    b.disabled = S.activo; b.firstChild.textContent = S.activo ? '⟳' : '⟳'; b.querySelector('b').textContent = !cfgd ? 'Conectar Drive' : S.activo ? (S.todo ? 'Bajando TODO…' : 'Sincronizando…') : 'Sincronizar todo';
    const b2 = barra.querySelector('#btnDescargarTodo'), bc = barra.querySelector('#btnCancelarSync');
    if (b2) { b2.hidden = !cfgd; b2.disabled = S.activo; }
    if (bc) { bc.hidden = !S.activo; bc.disabled = S.cancel; bc.textContent = S.cancel ? 'Cancelando…' : 'Cancelar'; }
    let txt = '';
    const dl = MD.Au && MD.Au.S.dl;
    if (S.error) txt = '⚠ ' + S.error;
    else if (S.activo) {
      txt = S.fase;
      if (dl && dl.activo) txt = 'Bajando audio ' + Math.min(dl.hechos + 1, dl.total) + ' de ' + dl.total + (dl.actual ? ': ' + dl.actual : '') + ' (' + Math.round(dl.pct * 100) + ' %)';
      else if (A && A.driveBajandoTodo) txt = 'Bajando sonidos ' + A.driveBajandoTodo;
      if (MD.Sostener && MD.Sostener.pantallaDespierta()) txt += ' · ☀ pantalla despierta';
    } else if (!cfgd) txt = 'Entrá a Drive para sincronizar escenas, luces, listas y favoritos.';
    else {
      const sin = A && A.cfg ? sinSubir(A) : false;
      txt = (S.resumen || (hayMarca() ? '⚠ La descarga de TODO quedó a medias: tocá «Descargar TODO» para retomar (lo ya bajado no se repite).' : S.ultima ? 'Última sync ' + hora(S.ultima) : 'Todavía no sincronizaste en esta sesión')) + (sin ? ' · ● hay cambios sin subir' : '');
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
    audiosQueFaltan, audiosTodos, sonidosQueFaltan, sinSubir,
    sincronizarTodo: () => sincronizarTodo(false), descargarTodo: () => sincronizarTodo(true), cancelar,
    montar() {
      if (barra) { pintar(); return; }
      barra = h('div', { class: 'barra-sync', id: 'barraSync' }, h('button', { type: 'button', class: 'sync-b', id: 'btnSincronizarTodo', onclick: () => sincronizarTodo(false) }, h('span', { class: 'sync-ic' }, '⟳'), h('b', null, 'Sincronizar todo')),
        h('button', { type: 'button', class: 'sync-b sync-b2', id: 'btnDescargarTodo', title: 'Baja TODOS los audios, sonidos, escenas, looks y listas a este equipo (aunque ninguna escena los use)', onclick: () => sincronizarTodo(true) }, h('span', { class: 'sync-ic' }, '⬇'), h('b', null, 'Descargar TODO')),
        h('button', { type: 'button', class: 'sync-cancel', id: 'btnCancelarSync', hidden: true, onclick: cancelar }, 'Cancelar'), h('span', { class: 'sync-t suave' }));
      const main = document.getElementById('vista'); main.parentNode.insertBefore(barra, main);
      if (MD.Disco) MD.Disco.alCambiar = ((previo) => () => { try { if (previo) previo(); } catch (e) {} pintar(); })(MD.Disco.alCambiar);
      if (!tim) tim = setInterval(pintar, 1500);
      pintar();
    },
  };
  MD.Sync = API;
})(window.MD);
