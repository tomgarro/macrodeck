// almacen.js - Guarda todo en el celu/compu (IndexedDB): la configuracion y los sonidos. Y los "packs" (.zip) para pasarse todo.
window.MD = window.MD || {};
(function (MD) {
  const NOMBRE = 'macrodeck-dnd', VERSION = 3;     // 2 (dev23): tienda 'audios' (los .opus). 3 (dev24): tienda 'caratulas' (las tapas reales de los audios)
  let dbP = null;
  function abrir() {
    if (dbP) return dbP;
    dbP = new Promise((ok, mal) => {
      const r = indexedDB.open(NOMBRE, VERSION);
      r.onupgradeneeded = () => { const d = r.result; for (const t of ['config', 'sonidos', 'audios', 'caratulas']) if (!d.objectStoreNames.contains(t)) d.createObjectStore(t); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    return dbP;
  }
  async function tx(tienda, modo, fn) {
    const d = await abrir();
    return new Promise((ok, mal) => {
      const t = d.transaction(tienda, modo), s = t.objectStore(tienda);
      const r = fn(s);
      t.oncomplete = () => ok(r && r.result);
      t.onerror = () => mal(t.error);
      t.onabort = () => mal(t.error);
    });
  }
  const A = {
    leerConfig: () => tx('config', 'readonly', s => s.get('main')),
    guardarConfig: (c) => tx('config', 'readwrite', s => s.put(c, 'main')),
    guardarSonido: (id, reg) => tx('sonidos', 'readwrite', s => s.put(reg, id)),   // reg = {blob, nombre, tipo}
    leerSonido: (id) => tx('sonidos', 'readonly', s => s.get(id)),
    borrarSonido: (id) => tx('sonidos', 'readwrite', s => s.delete(id)),
    // Pestana Audios: el catalogo va en 'config' con su propia clave (no pisa la configuracion principal) y los audios en su tienda.
    leerConfigClave: (k) => tx('config', 'readonly', s => s.get(k)),
    guardarConfigClave: (k, v) => tx('config', 'readwrite', s => s.put(v, k)),
    guardarAudio: (id, reg) => tx('audios', 'readwrite', s => s.put(reg, id)),      // reg = {blob, tam, md5, titulo}
    leerAudio: (id) => tx('audios', 'readonly', s => s.get(id)),
    borrarAudio: (id) => tx('audios', 'readwrite', s => s.delete(id)),
    audiosIds: () => tx('audios', 'readonly', s => s.getAllKeys()),
    guardarCaratula: (id, blob) => tx('caratulas', 'readwrite', s => s.put(blob, id)),   // dev24: tapa real (jpg) de un audio, por id de Drive
    leerCaratulas: async () => { const d = await abrir(); return new Promise((ok, mal) => { const t = d.transaction('caratulas', 'readonly'), s = t.objectStore('caratulas'), out = new Map(), q = s.openCursor(); q.onsuccess = () => { const c = q.result; if (c) { out.set(c.key, c.value); c.continue(); } else ok(out); }; q.onerror = () => mal(q.error); }); },
    todosSonidosIds: () => tx('sonidos', 'readonly', s => s.getAllKeys()),
    borrarTodo: async () => { await tx('config', 'readwrite', s => s.clear()); await tx('sonidos', 'readwrite', s => s.clear()); },
    pedirPersistencia: async () => { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; } },
  };

  // ---- packs ----
  function extension(nombre, tipo) {
    const m = /\.([a-z0-9]{2,4})$/i.exec(nombre || '');
    if (m) return m[1].toLowerCase();
    if (/mpeg|mp3/.test(tipo)) return 'mp3'; if (/ogg/.test(tipo)) return 'ogg'; if (/wav/.test(tipo)) return 'wav'; if (/mp4|aac|m4a/.test(tipo)) return 'm4a';
    return 'bin';
  }
  // Arma el .zip: config.json + sonidos/<id>.<ext>.  'config' es el objeto de configuracion.
  async function exportarPack(config) {
    const zip = new JSZip();
    const cfg = JSON.parse(JSON.stringify(config));
    for (const s of cfg.sonidos) {
      const reg = await A.leerSonido(s.id);
      if (!reg) continue;
      s.archivo = 'sonidos/' + s.id + '.' + extension(reg.nombre, reg.tipo);
      zip.file(s.archivo, reg.blob);
    }
    zip.file('config.json', JSON.stringify(cfg, null, 1));
    return zip.generateAsync({ type: 'blob', compression: 'STORE' });      // STORE: los audios ya vienen comprimidos
  }
  // Lee un .zip y devuelve {config, sonidos:[{id, blob, nombre, tipo}]}  (no toca el almacen)
  async function leerPack(archivo) {
    const zip = await JSZip.loadAsync(archivo);
    const f = zip.file('config.json');
    if (!f) throw new Error('El archivo no es un pack del Macrodeck (falta config.json)');
    const config = JSON.parse(await f.async('string'));
    const sonidos = [];
    for (const s of config.sonidos || []) {
      const z = s.archivo && zip.file(s.archivo);
      if (!z) continue;
      const blob = await z.async('blob');
      const ext = extension(s.archivo, '');
      const tipo = { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', webm: 'audio/webm', flac: 'audio/flac' }[ext] || 'audio/mpeg';
      sonidos.push({ id: s.id, blob: new Blob([blob], { type: tipo }), nombre: s.archivoOriginal || (s.nombre + '.' + ext), tipo });
    }
    return { config, sonidos };
  }
  async function instalarPack(pack, reemplazar) {
    if (reemplazar) await A.borrarTodo();
    for (const s of pack.sonidos) await A.guardarSonido(s.id, { blob: s.blob, nombre: s.nombre, tipo: s.tipo });
    await A.guardarConfig(pack.config);
  }
  MD.Almacen = Object.assign(A, { exportarPack, leerPack, instalarPack });
})(window.MD);
