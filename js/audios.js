// audios.js - La pestana "Audios": la biblioteca de musica y ambientes de Drive (los .opus del programa Macrodeck Audio).
// Filtra por Bioma / Lugar / Escena / Tono / Energia (varias opciones por fila; las opciones sin audios desaparecen), busca por texto,
// baja los audios a este equipo (IndexedDB, para usarlos sin internet) y los reproduce con una barra que queda a la vista en todas las pestanas.
// El catalogo (catalogo_app.json) y los audios los entrega el Apps Script (herramientas/drive/Audios.gs).
window.MD = window.MD || {};
(function (MD) {
  const h = (...a) => MD.UI.h(...a);
  const BIOMAS = { 'Bosque': '#3f8f55', 'Desierto': '#c98a4b', 'Montaña y nieve': '#7fb2c9', 'Pantano': '#5f7a3a', 'Agua': '#2f86c8', 'Cielo y tormenta': '#5a6fa8', 'Subterráneo': '#7a62b8', 'Volcánico y fuego': '#d4342c', 'Llanura y campo': '#a9b04a', 'Plano arcano': '#a65fc4', 'Neutro': '#8e8e8e' };
  const FILAS = [['bioma', 'Bioma'], ['lugar', 'Lugar'], ['escena', 'Escena'], ['tono', 'Tono'], ['energia', 'Energía']];
  const LS_CAT = 'audios_catalogo', TROZO = 6 * 1024 * 1024, PARALELO = 3;

  const S = { cat: [], cargado: null, cargando: false, error: '', bajados: new Map(), filtro: nuevoFiltro(), q: '', dl: { activo: false, cancelar: false, hechos: 0, total: 0, actual: '', pct: 0, errores: [] } };
  function nuevoFiltro() { return { bioma: [], lugar: [], escena: [], tono: [], energia: [] }; }
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dur = (s) => { s = Math.round(s || 0); const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60; return hh ? hh + ':' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0') : mm + ':' + String(ss).padStart(2, '0'); };
  const mb = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : Math.round(n / 1e6) + ' MB';
  const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
  let APP = null;                                                // la app (la entrega app.js al iniciar y cada vez que se abre la pestana)
  const A = () => APP;

  // ---------------- catalogo ----------------
  function preparar(lista) {
    return (lista || []).filter((d) => d && d.id && d.drive_id).map((d) => Object.assign({ etiquetas: [], energia: null }, d, {
      _buscar: norm([d.titulo, d.bioma, d.lugar, d.escena, d.tono, (d.etiquetas || []).join(' '), d.energia ? 'e' + d.energia : '', d.bpm ? 'bpm' + Math.round(d.bpm) : ''].join(' ')),
    }));
  }
  async function leerCache() {
    try { const c = await MD.Almacen.leerConfigClave(LS_CAT); if (c && c.audios) { S.cat = preparar(c.audios); S.cargado = c.cuando || null; } } catch (e) {}
    try { S.bajados = new Map((await MD.Almacen.audiosIds()).map((k) => [k, true])); } catch (e) {}
  }
  async function actualizar(forzar) {
    if (S.cargando || !MD.Drive.configurado() || !navigator.onLine) return;
    if (!forzar && S.cargado && Date.now() - S.cargado < 10 * 60e3) return;
    S.cargando = true; S.error = ''; pintar();
    try {
      const j = await MD.Drive.catalogoAudios();
      const c = JSON.parse(j.texto);
      S.cat = preparar(c.audios); S.cargado = Date.now();
      await MD.Almacen.guardarConfigClave(LS_CAT, { audios: c.audios, cuando: S.cargado, carpeta: c.carpeta });
    } catch (e) { S.error = e.message || String(e); }
    S.cargando = false; pintar();
  }

  // ---------------- filtros ----------------
  const valor = (d, k) => d[k] == null || d[k] === '' ? null : d[k];
  function coinciden(omitir) {
    const ws = norm(S.q).split(/\s+/).filter(Boolean);
    return S.cat.filter((d) => {
      for (const [k] of FILAS) { if (k !== omitir && S.filtro[k].length && S.filtro[k].indexOf(valor(d, k)) < 0) return false; }
      return ws.every((w) => d._buscar.indexOf(w) >= 0);
    });
  }
  function marcar(k, v) { const a = S.filtro[k], i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); pintar(); }
  function hayFiltro() { return !!(S.q || FILAS.some(([k]) => S.filtro[k].length)); }

  // ---------------- portada (se dibuja, no se baja) ----------------
  function portada(d, px) {
    const c = BIOMAS[d.bioma] || '#8e8e8e', e = d.energia || 0;
    let pills = '';
    for (let i = 0; i < 5; i++) pills += '<rect x="' + (8 + i * 8) + '" y="85" width="6" height="10" rx="1.5" fill="#fff" opacity="' + (i < e ? 1 : 0.22) + '"/>';
    const s = h('span', { class: 'au-car' });
    s.style.width = s.style.height = (px || 64) + 'px';
    s.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"><rect width="100" height="100" fill="' + c + '"/><rect width="100" height="100" fill="#fff" opacity=".18"/>'
      + '<circle cx="50" cy="50" r="22" fill="#3a3a3a" opacity=".85"/><rect width="100" height="20" fill="#161616" opacity=".86"/><circle cx="14.5" cy="10" r="6.5" fill="#fff"/>'
      + '<text x="24.5" y="13.5" font-size="8.2" fill="#fff" font-family="system-ui,sans-serif">' + esc((d.lugar || '').slice(0, 20)) + '</text>'
      + '<rect y="80" width="100" height="20" fill="#161616" opacity=".86"/>' + pills
      + (e ? '<text x="93" y="95" text-anchor="end" font-size="14" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">E' + e + '</text>' : '') + '</svg>';
    return s;
  }

  // ---------------- bajar ----------------
  async function aBytes(b64) {
    try { return new Uint8Array(await (await fetch('data:application/octet-stream;base64,' + b64)).arrayBuffer()); }
    catch (e) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  }
  async function bajarUno(d, alProgreso) {
    const partes = Math.max(1, Math.ceil((d.tam || 1) / TROZO)), trozos = new Array(partes);
    let sig = 0, hechos = 0;
    async function obrero() {
      while (sig < partes && !S.dl.cancelar) {
        const p = sig++;
        for (let i = 0; ; i++) {
          try { const j = await MD.Drive.bajarAudio(d.drive_id, p); trozos[p] = await aBytes(j.datos); break; }
          catch (e) { if (i >= 3 || S.dl.cancelar) throw e; await dormir(900 * (i + 1)); }
        }
        hechos++; alProgreso(hechos / partes);
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALELO, partes) }, obrero));
    if (S.dl.cancelar) throw new Error('cancelado');
    const blob = new Blob(trozos, { type: 'audio/ogg' });
    if (d.tam && blob.size !== d.tam) throw new Error('El audio llegó incompleto (' + blob.size + ' de ' + d.tam + ' bytes). Probá de nuevo.');
    await MD.Almacen.guardarAudio(d.id, { blob, tam: blob.size, md5: d.md5 || '', titulo: d.titulo });
    S.bajados.set(d.id, true);
  }
  async function bajarLista(lista) {
    const D = S.dl;
    if (D.activo) return;
    if (!navigator.onLine) { D.errores = ['No hay internet.']; pintar(); return; }
    lista = lista.filter((d) => !S.bajados.has(d.id));
    if (!lista.length) return;
    MD.Almacen.pedirPersistencia();
    Object.assign(D, { activo: true, cancelar: false, hechos: 0, total: lista.length, actual: '', pct: 0, errores: [] });
    for (const d of lista) {
      if (D.cancelar) break;
      D.actual = d.titulo; D.pct = 0; pintarBajada();
      try { await bajarUno(d, (p) => { D.pct = p; pintarBajada(); }); }
      catch (e) { if (e.message !== 'cancelado') D.errores.push(d.titulo.slice(0, 40) + ': ' + e.message); }
      D.hechos++;
      pintarTarjeta(d.id);
    }
    D.activo = false; D.actual = ''; pintar();
  }

  // ---------------- reproductor ----------------
  // Dos "ranuras" (cada una con su <audio> y su volumen) para que despues el pase entre audios pueda superponer el que termina con el que entra.
  const P = { ranuras: [], id: null, activa: 0, listo: false, barra: null };
  async function ranura(i) {
    if (P.ranuras[i]) return P.ranuras[i];
    await APP.audioPrimero();
    const m = APP.motor; await m.iniciar();
    const el = new Audio(); el.preload = 'auto';
    const fuente = m.ctx.createMediaElementSource(el), g = m.ctx.createGain();
    fuente.connect(g); g.connect(m.master);
    return (P.ranuras[i] = { el, g, url: null });
  }
  const actual = () => P.ranuras[P.activa];
  function dePorId(id) { return S.cat.find((x) => x.id === id); }
  async function reproducir(d) {
    const reg = await MD.Almacen.leerAudio(d.id);
    if (!reg) { S.dl.errores = ['«' + d.titulo + '» no está bajado todavía.']; pintar(); return; }
    const r = await ranura(P.activa);
    if (r.url) URL.revokeObjectURL(r.url);
    r.url = URL.createObjectURL(reg.blob); r.el.src = r.url; r.g.gain.value = 1;
    P.id = d.id;
    r.el.onended = () => { if (P.id === d.id) detener(); };
    try { await r.el.play(); } catch (e) { S.dl.errores = ['No se pudo reproducir: ' + (e.message || e)]; }
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: d.titulo, artist: [d.bioma, d.lugar].filter(Boolean).join(' · '), album: 'Macrodeck' });
        navigator.mediaSession.setActionHandler('play', () => pausaSeguir()); navigator.mediaSession.setActionHandler('pause', () => pausaSeguir());
      } catch (e) {}
    }
    pintarBarra(); pintar();
  }
  function pausaSeguir() { const r = actual(); if (!r || !P.id) return; if (r.el.paused) r.el.play().catch(() => {}); else r.el.pause(); pintarBarra(); pintar(); }
  function detener() {
    const r = actual(); if (r) { try { r.el.pause(); } catch (e) {} r.el.removeAttribute('src'); r.el.load(); if (r.url) { URL.revokeObjectURL(r.url); r.url = null; } }
    P.id = null; pintarBarra(); pintar();
  }
  // Tension: la misma ambientacion con la energia vecina (solo entre los audios ya bajados).
  function cambiarEnergia(dir) {
    const d = dePorId(P.id); if (!d || !d.energia) return;
    const obj = d.energia + dir;
    let c = S.cat.filter((x) => x.id !== d.id && x.energia === obj && S.bajados.has(x.id));
    const mismo = c.filter((x) => x.bioma === d.bioma); if (mismo.length) c = mismo;
    const lug = c.filter((x) => x.lugar === d.lugar); if (lug.length) c = lug;
    if (!c.length) { const t = P.barra && P.barra.querySelector('.au-sub'); if (t) { const ant = t.textContent; t.textContent = 'No hay un audio E' + obj + ' bajado de ' + d.bioma; setTimeout(() => { if (P.id === d.id) t.textContent = ant; }, 2000); } return; }
    reproducir(c[Math.floor(Math.random() * c.length)]);
  }

  // ---------------- barra del reproductor (queda en todas las pestanas) ----------------
  function armarBarra() {
    if (P.barra) return;
    const b = h('div', { class: 'au-barra', id: 'audioBarra', hidden: true });
    b.innerHTML = '<div class="au-l1"><span class="au-cv"></span><div class="au-t"><b class="au-tit"></b><span class="au-sub"></span></div>'
      + '<div class="au-ctl"><button type="button" class="au-pp" aria-label="Pausa / seguir"></button><button type="button" class="au-stop" aria-label="Detener">■</button></div></div>'
      + '<input class="au-seek" type="range" min="0" max="1000" value="0" aria-label="Posición">'
      + '<div class="au-l2"><span class="au-tm"></span><span class="au-esp"></span><span class="au-tension">Tensión</span><button type="button" class="au-em" aria-label="Bajar energía">−</button><span class="au-e"></span><button type="button" class="au-ep" aria-label="Subir energía">+</button></div>';
    const tabs = document.getElementById('tabs'); tabs.parentNode.insertBefore(b, tabs);
    P.barra = b;
    b.querySelector('.au-pp').addEventListener('click', pausaSeguir);
    b.querySelector('.au-stop').addEventListener('click', detener);
    b.querySelector('.au-em').addEventListener('click', () => cambiarEnergia(-1));
    b.querySelector('.au-ep').addEventListener('click', () => cambiarEnergia(1));
    const sk = b.querySelector('.au-seek');
    sk.addEventListener('input', () => { const r = actual(); if (r && isFinite(r.el.duration)) r.el.currentTime = sk.value / 1000 * r.el.duration; });
    setInterval(() => { if (P.id) pintarTiempo(); }, 500);
  }
  const IC_PLAY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>', IC_PAUSA = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
  function pintarBarra() {
    armarBarra();
    const b = P.barra, d = dePorId(P.id), r = actual();
    b.hidden = !d;
    if (!d) return;
    b.querySelector('.au-cv').replaceChildren(portada(d, 44));
    b.querySelector('.au-tit').textContent = d.titulo;
    b.querySelector('.au-sub').textContent = [d.bioma, d.lugar, d.tono].filter(Boolean).join(' · ');
    b.querySelector('.au-pp').innerHTML = r && !r.el.paused ? IC_PAUSA : IC_PLAY;
    b.querySelector('.au-e').textContent = d.energia ? 'E' + d.energia : '';
    b.querySelector('.au-tension').hidden = b.querySelector('.au-em').hidden = b.querySelector('.au-ep').hidden = !d.energia;
    pintarTiempo();
  }
  function pintarTiempo() {
    const b = P.barra, r = actual(); if (!b || !r || !P.id) return;
    const dd = isFinite(r.el.duration) ? r.el.duration : 0, sk = b.querySelector('.au-seek');
    b.querySelector('.au-tm').textContent = dur(r.el.currentTime) + (dd ? ' / ' + dur(dd) : '');
    if (dd && document.activeElement !== sk) sk.value = Math.round(r.el.currentTime / dd * 1000);
    const pp = b.querySelector('.au-pp'), q = r.el.paused ? IC_PLAY : IC_PAUSA; if (pp.dataset.q !== (r.el.paused ? 'p' : 'r')) { pp.innerHTML = q; pp.dataset.q = r.el.paused ? 'p' : 'r'; }
  }

  // ---------------- pantalla ----------------
  let vistaEl = null;
  function vista(app, el) {
    vistaEl = el; APP = app;
    armarBarra();
    if (!MD.Drive.configurado()) {
      el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Audios'), h('p', { class: 'suave' }, 'Primero entrá a Drive (pestaña Drive) con tu nombre y la clave. Después acá aparecen todos los audios de la biblioteca.')));
      return;
    }
    const buscar = h('input', { type: 'search', class: 'au-buscar', placeholder: 'Buscar: lluvia, lobos, taberna…', autocomplete: 'off', value: S.q, 'aria-label': 'Buscar audios' });
    buscar.addEventListener('input', () => { S.q = buscar.value; pintarCuerpo(); });
    buscar.addEventListener('keydown', (e) => e.stopPropagation());
    el.append(h('div', { class: 'au-cab' }, h('h2', null, 'Audios'), h('span', { class: 'au-cuenta suave', id: 'auCuenta' }),
      h('button', { type: 'button', class: 'au-act', id: 'auAct', title: 'Buscar audios nuevos en Drive', onclick: () => actualizar(true) }, '↻')),
      buscar, h('p', { class: 'suave au-ayuda' }, 'Podés marcar varias opciones por fila (Bosque o Pantano). Entre filas se combinan.'),
      h('div', { id: 'auFacetas', class: 'au-facetas' }), h('button', { type: 'button', id: 'auLimpiar', class: 'au-limpiar', hidden: true, onclick: () => { S.filtro = nuevoFiltro(); S.q = ''; buscar.value = ''; pintarCuerpo(); } }, 'Limpiar filtros'),
      h('div', { id: 'auBajada', class: 'au-bajada' }), h('div', { id: 'auLista', class: 'au-lista', 'aria-live': 'polite' }));
    pintarCuerpo();
    actualizar(false);
  }
  function pintar() { if (vistaEl && document.getElementById('auLista') && APP && APP.tab === 'audios') pintarCuerpo(); pintarBarra(); }
  function pintarCuerpo() {
    pintarFacetas(); pintarBajada();
    const lista = document.getElementById('auLista'); if (!lista) return;
    const r = coinciden(null).sort((a, b) => (a.bioma || '').localeCompare(b.bioma || '', 'es') || (a.titulo || '').localeCompare(b.titulo || '', 'es'));
    document.getElementById('auCuenta').textContent = S.cargando ? 'leyendo Drive…' : (r.length + ' de ' + S.cat.length);
    document.getElementById('auLimpiar').hidden = !hayFiltro();
    const frag = document.createDocumentFragment();
    if (S.error) frag.append(h('p', { class: 'aviso' }, S.error));
    if (!S.cat.length && !S.cargando && !S.error) frag.append(h('div', { class: 'au-vacio' }, 'Todavía no hay audios. Se suben desde el programa Macrodeck Audio (botón Sincronizar con Drive).'));
    else if (!r.length && S.cat.length) frag.append(h('div', { class: 'au-vacio' }, 'No hay audios con esa combinación. Probá sacar un filtro.'));
    r.forEach((d) => frag.append(tarjeta(d)));
    lista.replaceChildren(frag);
  }
  function pintarFacetas() {
    const box = document.getElementById('auFacetas'); if (!box) return;
    const frag = document.createDocumentFragment();
    for (const [k, nombre] of FILAS) {
      const cuenta = new Map();
      coinciden(k).forEach((d) => { const v = valor(d, k); if (v != null) cuenta.set(v, (cuenta.get(v) || 0) + 1); });
      S.filtro[k].forEach((v) => { if (!cuenta.has(v)) cuenta.set(v, 0); });
      let vals = [...cuenta.keys()];
      vals = k === 'bioma' ? vals.sort((a, b) => (Object.keys(BIOMAS).indexOf(a) + 99 * (BIOMAS[a] ? 0 : 1)) - (Object.keys(BIOMAS).indexOf(b) + 99 * (BIOMAS[b] ? 0 : 1)))
        : k === 'energia' ? vals.sort((a, b) => a - b) : vals.sort((a, b) => String(a).localeCompare(String(b), 'es'));
      if (!vals.length) continue;
      const fila = h('div', { class: 'au-fila' }, h('b', null, nombre));
      const chips = h('div', { class: 'au-chips' });
      vals.forEach((v) => {
        const on = S.filtro[k].indexOf(v) >= 0;
        const c = h('button', { type: 'button', class: 'au-chip', 'aria-pressed': on ? 'true' : 'false', onclick: () => marcar(k, v) },
          k === 'bioma' ? h('i', { style: 'background:' + (BIOMAS[v] || '#8e8e8e') }) : null, k === 'energia' ? 'E' + v : v, h('small', null, ' ' + cuenta.get(v)));
        chips.append(c);
      });
      fila.append(chips); frag.append(fila);
    }
    box.replaceChildren(frag);
  }
  function tarjeta(d) {
    const bajado = S.bajados.has(d.id), suena = P.id === d.id, r = actual();
    const meta = [d.bioma, d.lugar].filter(Boolean).join(' · ');
    const tags = h('div', { class: 'au-tags' }, d.escena ? h('span', { class: 'au-tag' }, d.escena) : null, d.tono ? h('span', { class: 'au-tag' }, d.tono) : null, d.bpm ? h('span', { class: 'au-tag' }, '♩ ' + Math.round(d.bpm)) : null);
    const acc = h('div', { class: 'au-acc' });
    if (bajado) {
      const pl = h('button', { type: 'button', class: 'au-play', 'aria-label': (suena ? 'Pausa ' : 'Escuchar ') + d.titulo, onclick: () => { if (suena) pausaSeguir(); else reproducir(d); } });
      pl.innerHTML = suena && r && !r.el.paused ? IC_PAUSA : IC_PLAY; acc.append(pl);
    } else {
      const bj = h('button', { type: 'button', class: 'au-bajar', 'aria-label': 'Bajar ' + d.titulo, title: 'Bajar a este equipo (' + mb(d.tam) + ')', onclick: () => bajarLista([d]) });
      bj.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M5 20h14v-2H5zM19 9h-4V3H9v6H5l7 7z"/></svg>';
      if (S.dl.activo && S.dl.actual === d.titulo) { bj.disabled = true; bj.textContent = Math.round(S.dl.pct * 100) + '%'; }
      acc.append(bj);
    }
    acc.append(h('span', { class: 'au-dur' }, dur(d.duracion_s)));
    if (!bajado) acc.append(h('span', { class: 'au-dur' }, mb(d.tam)));
    return h('div', { class: 'au-card' + (suena ? ' suena' : '') + (bajado ? '' : ' nobaj'), 'data-id': d.id }, portada(d, 64), h('div', { class: 'au-info' }, h('h3', null, d.titulo), h('div', { class: 'au-meta' }, meta), tags), acc);
  }
  function pintarTarjeta(id) {
    const e = vistaEl && document.querySelector('.au-card[data-id="' + id + '"]'), d = dePorId(id);
    if (e && d && APP && APP.tab === 'audios') e.replaceWith(tarjeta(d));
    pintarBajada();
  }
  // Resumen de bajada: cuanto falta bajar de lo que se ve, de todo, y cuanto lugar queda en el equipo.
  async function pintarBajada() {
    const box = document.getElementById('auBajada'); if (!box) return;
    const D = S.dl, vis = coinciden(null).filter((d) => !S.bajados.has(d.id)), todo = S.cat.filter((d) => !S.bajados.has(d.id));
    const suma = (l) => l.reduce((t, d) => t + (d.tam || 0), 0);
    const bt = document.querySelector('.au-card .au-bajar:disabled'); if (bt && D.activo) bt.textContent = Math.round(D.pct * 100) + '%';
    if (D.activo && box.firstChild && box.querySelector('.au-prog i')) {            // en plena bajada solo se mueve la barra y el texto (sin rehacer la caja)
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
      const t = h('div', { class: 'au-bj-txt' }, h('b', null, S.bajados.size + ' de ' + S.cat.length + ' bajados'), h('span', { class: 'suave', id: 'auCupo' }, ''));
      f.append(t);
      if (hayFiltro() && vis.length && vis.length < todo.length) f.append(h('button', { type: 'button', onclick: () => bajarLista(vis) }, 'Bajar lo que veo (' + vis.length + ' · ' + mb(suma(vis)) + ')'));
      if (todo.length) f.append(h('button', { type: 'button', onclick: () => bajarLista(todo) }, 'Bajar todo (' + todo.length + ' · ' + mb(suma(todo)) + ')'));
      box.append(f);
      try { const e = await navigator.storage.estimate(); const c = document.getElementById('auCupo'); if (c && e.quota) c.textContent = 'Usado ' + mb(e.usage) + ' de ' + mb(e.quota) + ' en este equipo'; } catch (x) {}
    }
    if (D.errores.length) box.append(h('p', { class: 'aviso' }, D.errores.slice(-3).join('\n')));
  }
  MD.Audios = { vista, iniciar: async (app) => { APP = app; await leerCache(); armarBarra(); }, _S: S, _P: P, _bajarLista: bajarLista, _reproducir: reproducir };
  window.addEventListener('online', () => { if (APP && APP.tab === 'audios') actualizar(false); });
})(window.MD);
