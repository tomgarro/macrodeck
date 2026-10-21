// audios.js - Base de la pestana "Audios": el catalogo de Drive, los filtros, las tapas, la bajada de audios al equipo y las preferencias.
// (El reproductor esta en audios_motor.js y las pantallas en audios_ui.js.)
// El catalogo (catalogo_app.json) y los audios los entrega el Apps Script (herramientas/drive/Audios.gs).
window.MD = window.MD || {};
(function (MD) {
  const BIOMAS = { 'Bosque': '#3f8f55', 'Desierto': '#c98a4b', 'Montaña y nieve': '#7fb2c9', 'Pantano': '#5f7a3a', 'Agua': '#2f86c8', 'Cielo y tormenta': '#5a6fa8', 'Subterráneo': '#7a62b8', 'Volcánico y fuego': '#d4342c', 'Llanura y campo': '#a9b04a', 'Plano arcano': '#a65fc4', 'Neutro': '#8e8e8e' };
  const FILAS = [['equipo', 'En este equipo'], ['tipo', 'Tipo'], ['bioma', 'Bioma'], ['lugar', 'Lugar'], ['escena', 'Escena'], ['tono', 'Tono'], ['energia', 'Energía']];
  const LS_CAT = 'audios_catalogo', LS_PREFS = 'audios_prefs', TROZO = 6 * 1024 * 1024, PARALELO = 3;

  const nuevoFiltro = () => ({ equipo: [], tipo: [], bioma: [], lugar: [], escena: [], tono: [], energia: [] });
  const S = { cat: [], cargado: null, cargando: false, error: '', bajados: new Map(), filtro: nuevoFiltro(), q: '', dl: { activo: false, cancelar: false, hechos: 0, total: 0, actual: '', pct: 0, errores: [] }, cv: { activo: false } };
  const prefs = { fav: [], rec: [], azar: false, repetir: 'no', inteligente: false, fundido: 15, intro: 15, vol: 1, amb: { azar: false, repetir: 'uno', inteligente: false, fundido: 10, intro: 0, vol: 1 } };
  const cov = new Map();                                       // id de la tapa en Drive -> direccion (blob:) de la imagen ya bajada
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dur = (s) => { s = Math.round(s || 0); const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60; return hh ? hh + ':' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0') : mm + ':' + String(ss).padStart(2, '0'); };
  const durLarga = (s) => { s = Math.round(s || 0); const hh = Math.floor(s / 3600), mm = Math.round(s % 3600 / 60); return hh ? hh + ' h ' + String(mm).padStart(2, '0') + ' min' : Math.max(1, mm) + ' min'; };
  const mb = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : Math.round(n / 1e6) + ' MB';
  const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
  let APP = null;                                                // la app (la entrega app.js al iniciar y cada vez que se abre la pestana)
  const Au = { S, P: null, prefs, cov, BIOMAS, FILAS, norm, esc, dur, durLarga, mb, dormir, nuevoFiltro, app: () => APP };
  const h = (...a) => MD.UI.h(...a);

  // ---------------- preferencias de ESTE equipo (favoritos, escuchados hace poco, aleatorio, repetir...) ----------------
  let tPref = 0;
  Au.guardarPrefs = () => { clearTimeout(tPref); tPref = setTimeout(() => { try { MD.Almacen.guardarConfigClave(LS_PREFS, prefs); } catch (e) {} }, 400); };
  async function leerPrefs() {
    try {
      const p = await MD.Almacen.leerConfigClave(LS_PREFS);
      if (p && typeof p === 'object') {
        if (Array.isArray(p.fav)) prefs.fav = p.fav.map(String).slice(0, 2000);
        if (Array.isArray(p.rec)) prefs.rec = p.rec.map(String).slice(0, 60);
        prefs.azar = !!p.azar; prefs.inteligente = !!p.inteligente;
        prefs.repetir = ['no', 'lista', 'uno'].includes(p.repetir) ? p.repetir : 'no';
        prefs.fundido = [0, 8, 15, 20].includes(Number(p.fundido)) ? Number(p.fundido) : 15;
        prefs.intro = [0, 15].includes(Number(p.intro)) ? Number(p.intro) : 15;
        prefs.vol = isFinite(p.vol) ? Math.min(1, Math.max(0, Number(p.vol))) : 1;
        const a = p.amb && typeof p.amb === 'object' ? p.amb : {};
        prefs.amb.azar = !!a.azar; prefs.amb.inteligente = !!a.inteligente;
        prefs.amb.repetir = ['no', 'lista', 'uno'].includes(a.repetir) ? a.repetir : 'uno';
        prefs.amb.fundido = [0, 5, 8, 10, 15, 20].includes(Number(a.fundido)) ? Number(a.fundido) : 10;
        prefs.amb.intro = 0;
        prefs.amb.vol = isFinite(a.vol) ? Math.min(1, Math.max(0, Number(a.vol))) : 1;
      }
    } catch (e) {}
  }
  // Preferencias de cada carril: la musica usa las de siempre (prefs), los ambientes las suyas (prefs.amb).
  Au.prefsDe = (carril) => carril === 'ambiente' ? prefs.amb : prefs;
  // 1.3-dev31: los favoritos viven en la configuracion (cfg.favoritos) para viajar a Drive con "Sincronizar todo"; prefs.fav queda solo como respaldo/migracion.
  Au.favs = () => (APP && APP.cfg && Array.isArray(APP.cfg.favoritos)) ? APP.cfg.favoritos : prefs.fav;
  Au.esFav = (id) => Au.favs().indexOf(id) >= 0;
  Au.alternarFav = (id) => { const f = Au.favs(), i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); if (f !== prefs.fav && APP) APP.cambio(false); else Au.guardarPrefs(); };
  function migrarFavs() { if (!prefs.fav.length || !APP || !APP.cfg) return; const f = Au.favs(); if (f === prefs.fav) return; prefs.fav.forEach((id) => { if (f.indexOf(id) < 0) f.push(id); }); prefs.fav = []; APP.cambio(false); Au.guardarPrefs(); }
  Au.esReciente = (id) => prefs.rec.indexOf(id) >= 0 && prefs.rec.indexOf(id) < 25;      // "escuchado hace poco" = entre los ultimos 25
  Au.registrarReciente = (id) => { const i = prefs.rec.indexOf(id); if (i >= 0) prefs.rec.splice(i, 1); prefs.rec.unshift(id); prefs.rec.length = Math.min(prefs.rec.length, 60); Au.guardarPrefs(); };

  // ---------------- catalogo ----------------
  function preparar(lista) {
    return (lista || []).filter((d) => d && d.id && d.drive_id).map((d) => Object.assign({ etiquetas: [], energia: null }, d, {
      _buscar: norm([d.titulo, d.tipo, d.bioma, d.lugar, d.escena, d.tono, (d.etiquetas || []).join(' '), d.energia ? 'e' + d.energia : '', d.bpm ? 'bpm' + Math.round(d.bpm) : ''].join(' ')),
    }));
  }
  Au.dePorId = (id) => S.cat.find((x) => x.id === id);
  Au.bajado = (id) => S.bajados.has(id);
  async function leerCache() {
    await leerPrefs();
    try { const c = await MD.Almacen.leerConfigClave(LS_CAT); if (c && c.audios) { S.cat = preparar(c.audios); S.cargado = c.cuando || null; } } catch (e) {}
    try { S.bajados = new Map((await MD.Almacen.audiosIds()).map((k) => [k, true])); } catch (e) {}
    try { (await MD.Almacen.leerCaratulas()).forEach((blob, id) => { try { cov.set(id, URL.createObjectURL(blob)); } catch (e) {} }); } catch (e) {}
  }
  async function actualizar(forzar) {
    if (S.cargando || !MD.Drive.configurado() || !navigator.onLine) return;
    if (!forzar && S.cargado && Date.now() - S.cargado < 10 * 60e3) { bajarCaratulas(); return; }
    S.cargando = true; S.error = ''; Au.pintar();
    try {
      const j = await MD.Drive.catalogoAudios();
      const c = JSON.parse(j.texto);
      S.cat = preparar(c.audios); S.cargado = Date.now();
      await MD.Almacen.guardarConfigClave(LS_CAT, { audios: c.audios, cuando: S.cargado, carpeta: c.carpeta });
    } catch (e) { S.error = e.message || String(e); }
    S.cargando = false; Au.pintar();
    bajarCaratulas();
  }
  Au.actualizar = actualizar;

  // ---------------- filtros ----------------
  const valor = (d, k) => k === 'equipo' ? (Au.bajado(d.id) ? 'Bajados' : 'Sin bajar') : d[k] == null || d[k] === '' ? null : d[k];
  // 'f' = {filtro, q}; sin 'f' usa el filtro de la pantalla. 'omitir' = la fila que no cuenta (para los numeritos de cada opcion).
  function coinciden(omitir, f) {
    const filtro = f ? f.filtro : S.filtro, ws = norm(f ? f.q : S.q).split(/\s+/).filter(Boolean);
    return S.cat.filter((d) => {
      for (const [k] of FILAS) { if (k !== omitir && filtro[k] && filtro[k].length && filtro[k].indexOf(valor(d, k)) < 0) return false; }
      return ws.every((w) => d._buscar.indexOf(w) >= 0);
    });
  }
  Au.valor = valor; Au.coinciden = coinciden;
  Au.orden = (a, b) => (a.bioma || '').localeCompare(b.bioma || '', 'es') || (a.titulo || '').localeCompare(b.titulo || '', 'es');
  Au.hayFiltro = () => !!(S.q || FILAS.some(([k]) => S.filtro[k].length));
  Au.copiaFiltro = () => ({ filtro: JSON.parse(JSON.stringify(S.filtro)), q: S.q });
  Au.textoFiltro = (f) => [].concat(...FILAS.map(([k]) => (f.filtro[k] || []).map((v) => k === 'energia' ? 'E' + v : v)), f.q ? ['«' + f.q + '»'] : []).join(' + ');

  // ---------------- tapas ----------------
  // Mientras no llega la tapa real se dibuja una simple (color del bioma + lugar + energia). La tapa real (jpg del programa de audio) se baja sola, de a poco, y queda guardada.
  function dibujo(d) {
    const c = BIOMAS[d.bioma] || '#8e8e8e', e = d.energia || 0;
    let pills = '';
    for (let i = 0; i < 5; i++) pills += '<rect x="' + (8 + i * 8) + '" y="85" width="6" height="10" rx="1.5" fill="#fff" opacity="' + (i < e ? 1 : 0.22) + '"/>';
    return '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"><rect width="100" height="100" fill="' + c + '"/><rect width="100" height="100" fill="#fff" opacity=".18"/>'
      + '<circle cx="50" cy="50" r="22" fill="#3a3a3a" opacity=".85"/><rect width="100" height="20" fill="#161616" opacity=".86"/><circle cx="14.5" cy="10" r="6.5" fill="#fff"/>'
      + '<text x="24.5" y="13.5" font-size="8.2" fill="#fff" font-family="system-ui,sans-serif">' + esc((d.lugar || '').slice(0, 20)) + '</text>'
      + '<rect y="80" width="100" height="20" fill="#161616" opacity=".86"/>' + pills
      + (e ? '<text x="93" y="95" text-anchor="end" font-size="14" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">E' + e + '</text>' : '') + '</svg>';
  }
  const claveTapa = (d) => d.caratula_id || ('a_' + d.id);
  function rellenar(s, d) {
    const u = cov.get(claveTapa(d));
    if (u) { s.innerHTML = ''; const im = document.createElement('img'); im.src = u; im.alt = ''; im.decoding = 'async'; im.draggable = false; im.onerror = () => { s.innerHTML = dibujo(d); }; s.append(im); }
    else s.innerHTML = dibujo(d);
  }
  Au.portada = (d, px) => {
    const s = h('span', { class: 'au-car' }); s.style.width = s.style.height = (px || 64) + 'px';
    s.dataset.cv = claveTapa(d);
    rellenar(s, d); return s;
  };
  // Mosaico de 4 tapas (para las listas)
  Au.mosaico = (ids, px) => {
    const m = h('span', { class: 'au-mos' }); m.style.width = m.style.height = px + 'px';
    const ds = ids.map(Au.dePorId).filter(Boolean);
    for (let i = 0; i < 4; i++) { const d = ds[i % Math.max(1, ds.length)]; m.append(d ? Au.portada(d, px / 2) : h('span', { class: 'au-car vacio' })); }
    if (!ds.length) m.classList.add('vacio');
    return m;
  };
  function pintarTapa(id) { document.querySelectorAll('.au-car[data-cv="' + id + '"]').forEach((el) => { const d = S.cat.find((x) => claveTapa(x) === id); if (d) rellenar(el, d); }); }

  // La tapa viene DENTRO del .opus (etiqueta METADATA_BLOCK_PICTURE en OpusTags). La sacamos de ahi: no hace falta pedirla aparte.
  function tapaDeOpus(u8) {
    try {
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      let pos = 0, paquetes = [], actual = [], largo = 0;
      while (pos + 27 <= u8.length && paquetes.length < 2) {
        if (u8[pos] !== 0x4f || u8[pos + 1] !== 0x67 || u8[pos + 2] !== 0x67 || u8[pos + 3] !== 0x53) return null;
        const nseg = u8[pos + 26]; let off = pos + 27 + nseg;
        for (let i = 0; i < nseg; i++) {
          const l = u8[pos + 27 + i];
          if (off + l > u8.length) return null;
          actual.push(u8.subarray(off, off + l)); largo += l; off += l;
          if (l < 255) { const p = new Uint8Array(largo); let o = 0; actual.forEach((x) => { p.set(x, o); o += x.length; }); paquetes.push(p); actual = []; largo = 0; if (paquetes.length >= 2) break; }
        }
        pos = off;
      }
      const t = paquetes[1]; if (!t || String.fromCharCode(...t.subarray(0, 8)) !== 'OpusTags') return null;
      const tv = new DataView(t.buffer, t.byteOffset, t.byteLength), dec = new TextDecoder();
      let q = 8; q += 4 + tv.getUint32(q, true); const n = tv.getUint32(q, true); q += 4;
      for (let i = 0; i < n && q + 4 <= t.length; i++) {
        const l = tv.getUint32(q, true); q += 4;
        const txt = dec.decode(t.subarray(q, q + (l > 64 ? 40 : l))); const k = txt.indexOf('=');
        if (k > 0 && txt.slice(0, k).toUpperCase() === 'METADATA_BLOCK_PICTURE') {
          const bin = atob(dec.decode(t.subarray(q + k + 1, q + l)).trim()), f = new Uint8Array(bin.length);
          for (let j = 0; j < bin.length; j++) f[j] = bin.charCodeAt(j);
          const fv = new DataView(f.buffer); let r = 4; const ml = fv.getUint32(r); r += 4; const mime = String.fromCharCode(...f.subarray(r, r + ml)); r += ml;
          r += 4 + fv.getUint32(r); r += 16; const dl = fv.getUint32(r); r += 4;
          return new Blob([f.subarray(r, r + dl)], { type: mime || 'image/jpeg' });
        }
        q += l;
      }
    } catch (e) {}
    return null;
  }
  async function guardarTapaPropia(d, u8) {
    const clave = claveTapa(d); if (cov.has(clave)) return;
    const blob = tapaDeOpus(u8); if (!blob || blob.size < 500) return;
    try { await MD.Almacen.guardarCaratula(clave, blob); } catch (e) {}
    cov.set(clave, URL.createObjectURL(blob)); pintarTapa(clave);
  }
  // Los audios ya bajados que todavia no tienen tapa: se la sacamos del propio archivo (anda sin internet).
  async function rescatarTapas() {
    for (const d of S.cat) {
      if (!S.bajados.has(d.id) || cov.has(claveTapa(d))) continue;
      try { const r = await MD.Almacen.leerAudio(d.id); if (r && r.blob) await guardarTapaPropia(d, new Uint8Array(await r.blob.slice(0, 2 * 1024 * 1024).arrayBuffer())); } catch (e) {}
    }
  }
  Au.rescatarTapas = rescatarTapas;
  async function aBytes(b64) {
    try { return new Uint8Array(await (await fetch('data:application/octet-stream;base64,' + b64)).arrayBuffer()); }
    catch (e) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  }
  async function bajarCaratulas() {
    const C = S.cv;
    if (C.activo || !MD.Drive.configurado() || !navigator.onLine) return;
    const faltan = [...new Set(S.cat.map((d) => d.caratula_id).filter((id) => id && !cov.has(id)))];
    if (faltan.length && C.reint == null) C.reint = 0;
    if (!faltan.length) return;
    C.activo = true;
    let sig = 0, fallos = 0;
    const lotes = []; for (let i = 0; i < faltan.length; i += 6) lotes.push(faltan.slice(i, i + 6));
    async function obrero() {
      while (sig < lotes.length && fallos < 4) {
        const ids = lotes[sig++];
        try {
          const j = await MD.Drive.caratulas(ids);
          for (const id of Object.keys(j.tapas || {})) {
            const blob = new Blob([await aBytes(j.tapas[id])], { type: 'image/jpeg' });
            try { await MD.Almacen.guardarCaratula(id, blob); } catch (e) {}
            cov.set(id, URL.createObjectURL(blob)); pintarTapa(id);
          }
        } catch (e) { fallos++; await dormir(1500); }
      }
    }
    await Promise.all([obrero(), obrero()]);
    C.activo = false;
    if (fallos && (C.reint || 0) < 4) { C.reint = (C.reint || 0) + 1; setTimeout(bajarCaratulas, 15000); } else if (!fallos) C.reint = 0;
  }
  Au.bajarCaratulas = bajarCaratulas;

  // ---------------- bajar audios ----------------
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
    try { await guardarTapaPropia(d, trozos[0]); } catch (e) {}
  }
  async function bajarLista(lista) {
    const D = S.dl;
    if (D.activo) return;
    if (!navigator.onLine) { D.errores = ['No hay internet.']; Au.pintar(); return; }
    lista = lista.filter((d) => !S.bajados.has(d.id));
    if (!lista.length) return;
    MD.Almacen.pedirPersistencia();
    Object.assign(D, { activo: true, cancelar: false, hechos: 0, total: lista.length, actual: '', pct: 0, errores: [] });
    for (const d of lista) {
      if (D.cancelar) break;
      D.actual = d.titulo; D.pct = 0; if (Au.pintarBajada) Au.pintarBajada();
      try { await bajarUno(d, (p) => { D.pct = p; if (Au.pintarBajada) Au.pintarBajada(); }); }
      catch (e) { if (e.message !== 'cancelado') D.errores.push(d.titulo.slice(0, 40) + ': ' + e.message); }
      D.hechos++;
      if (Au.pintarTarjeta) Au.pintarTarjeta(d.id);
    }
    D.activo = false; D.actual = ''; Au.pintar();
  }
  Au.bajarLista = bajarLista;

  Au.pintar = () => { if (Au.ui && Au.ui.pintar) Au.ui.pintar(); };
  Au.aviso = (txt) => { if (Au.ui && Au.ui.aviso) Au.ui.aviso(txt); };

  // ---------------- listas de reproduccion (viven en la configuracion: viajan por Drive con las escenas) ----------------
  const listas = () => (APP && APP.cfg ? (APP.cfg.listas = APP.cfg.listas || []) : []);
  Au.listas = listas;
  Au.lista = (id) => listas().find((l) => l.id === id) || null;
  // ids de los audios de una lista (una "automatica" se arma sola con su filtro)
  Au.idsDeLista = (l) => !l ? [] : l.auto ? coinciden(null, l.auto).sort(Au.orden).map((d) => d.id) : l.items.filter((id) => !!Au.dePorId(id));
  Au.nuevaLista = (nombre, items, auto) => {
    const l = { id: MD.Config.nuevoId('p'), nombre: String(nombre || 'Lista nueva').slice(0, 40), items: auto ? [] : (items || []).slice(0, 500), fundido: prefs.fundido, intro: prefs.intro };
    if (auto) l.auto = auto;
    listas().push(l); Au.cambio(); return l;
  };
  Au.cambio = () => { if (APP) APP.cambio(false); };            // marca la configuracion como cambiada (se guarda sola y se sincroniza)
  Au.borrarLista = (id) => { const a = listas(), i = a.findIndex((l) => l.id === id); if (i >= 0) { a.splice(i, 1); (APP.cfg.escenas || []).forEach((e) => { if (e.lista && e.lista.id === id) delete e.lista; }); Au.cambio(); } };

  MD.Au = Au;
  MD.Audios = {
    // la entrega app.js: al abrir la pestana (vista) y al arrancar (iniciar)
    vista: (app, el) => { APP = app; Au.ui.vista(app, el); },
    iniciar: async (app) => { APP = app; await leerCache(); migrarFavs(); if (MD.Disco) MD.Disco.alCambiar = async () => { try { S.bajados = new Map((await MD.Almacen.audiosIds()).map((k) => [k, true])); } catch (e) {} Au.pintar(); }; Au.ui.armarBarra(); Au.motor.iniciar(); rescatarTapas(); },
    enganchar: (app) => { APP = app; Au.motor.enganchar(app); },
    tarjetaEscena: (app, esc) => Au.ui.tarjetaEscena(app, esc),
    _S: S, _P: () => Au.P, _bajarLista: bajarLista, _reproducir: (d) => Au.motor.reproducirUno(d), Au: Au,
  };
  window.addEventListener('online', () => { if (APP && APP.tab === 'audios') actualizar(false); else bajarCaratulas(); });
})(window.MD);
