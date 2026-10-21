// disco.js - TODO lo pesado (audios de la pestana Audios, sonidos de las teclas y caratulas) puede guardarse en una CARPETA ELEGIDA (un disco externo USB, por ejemplo) en vez de en la memoria del navegador,
// y la configuracion (escenas, teclas, looks, favoritos, listas) se COPIA ahi en cada cambio (espejo) para tener todo junto y poder restaurarlo.
// Pensado para la web de Frodo en la Mac (Chrome): la Mac casi no tiene espacio, asi que los audios van a un disco externo.
// Usa la "API de acceso a carpetas" de Chrome/Edge (showDirectoryPicker). En el APK y en Safari/Firefox no existe: ahi todo sigue igual que antes.
// Funciona "envolviendo" las funciones de MD.Almacen: el resto de la app no se entera. v1.3-dev34: ademas de los audios, ahora tambien sonidos, caratulas y configuracion.
// Si hay un disco elegido pero esta desconectado, NO baja en silencio a la memoria de la Mac: avisa y pide reconectar.
window.MD = window.MD || {};
(function (MD) {
  const Al = MD.Almacen, CLAVE = 'disco_audios', SUB = 'Macrodeck-audios';
  const SUBS = { sonidos: 'Macrodeck-sonidos', caratulas: 'Macrodeck-caratulas', config: 'Macrodeck-config' };   // el audio sigue en 'Macrodeck-audios' (compatible con lo ya guardado)
  const orig = { guardar: Al.guardarAudio, leer: Al.leerAudio, borrar: Al.borrarAudio, ids: Al.audiosIds,
    gSon: Al.guardarSonido, lSon: Al.leerSonido, bSon: Al.borrarSonido, iSon: Al.todosSonidosIds,
    gCar: Al.guardarCaratula, lCar: Al.leerCaratulas, bCar: Al.borrarCaratula,
    lCfg: Al.leerConfig, gCfg: Al.guardarConfig, lClave: Al.leerConfigClave, gClave: Al.guardarConfigClave };
  const D = { raiz: null, dir: null, dirs: {}, nombre: '', listo: false, error: '' };
  const hayApi = () => typeof window.showDirectoryPicker === 'function';
  const arch = (id) => encodeURIComponent(String(id)).replace(/\*/g, '%2A');
  const deArch = (n) => { try { return decodeURIComponent(n); } catch (e) { return n; } };
  const cambio = () => { try { if (MD.Disco.alCambiar) MD.Disco.alCambiar(); } catch (e) {} };

  async function permiso(h, pedir) {
    try {
      const o = { mode: 'readwrite' };
      if ((await h.queryPermission(o)) === 'granted') return true;
      if (pedir && (await h.requestPermission(o)) === 'granted') return true;
    } catch (e) {}
    return false;
  }
  async function abrirSub() {
    D.dir = await D.raiz.getDirectoryHandle(SUB, { create: true });
    D.dirs = {}; for (const k of Object.keys(SUBS)) D.dirs[k] = await D.raiz.getDirectoryHandle(SUBS[k], { create: true });
    D.listo = true; D.error = '';
  }
  function fallo(e) { D.listo = false; D.error = 'El disco no responde (¿está conectado?): ' + (e && e.message || e); cambio(); }

  async function escribir(id, reg) {
    const f = await D.dir.getFileHandle(arch(id) + '.opus', { create: true }), w = await f.createWritable();
    await w.write(reg.blob); await w.close();
    const m = await D.dir.getFileHandle(arch(id) + '.json', { create: true }), wm = await m.createWritable();
    await wm.write(JSON.stringify({ tam: reg.tam || (reg.blob && reg.blob.size) || 0, md5: reg.md5 || '', titulo: reg.titulo || '' })); await wm.close();
  }
  async function leerDisco(id) {
    const f = await D.dir.getFileHandle(arch(id) + '.opus'), blob = await f.getFile();
    let meta = {};
    try { meta = JSON.parse(await (await (await D.dir.getFileHandle(arch(id) + '.json')).getFile()).text()); } catch (e) {}
    return { blob, tam: blob.size, md5: meta.md5 || '', titulo: meta.titulo || '' };
  }

  // ---------- archivos sueltos ----------
  async function escribirArch(dir, nombre, datos) { const f = await dir.getFileHandle(nombre, { create: true }), w = await f.createWritable(); await w.write(datos); await w.close(); }
  async function borrarArch(dir, nombre) { try { await dir.removeEntry(nombre); } catch (e) {} }
  async function nombresEn(dir, ext) { const out = []; try { for await (const [n, h] of dir.entries()) if (h.kind === 'file' && n.endsWith(ext)) out.push(deArch(n.slice(0, -ext.length))); } catch (e) { fallo(e); } return out; }

  // Sonidos de las teclas: <id>.bin (el archivo) + <id>.json (el resto de los datos y el tipo del archivo)
  async function escribirSonido(id, reg) {
    const meta = {}; Object.keys(reg).forEach(k => { if (k !== 'blob') meta[k] = reg[k]; }); meta.mime = (reg.blob && reg.blob.type) || '';
    await escribirArch(D.dirs.sonidos, arch(id) + '.bin', reg.blob);
    await escribirArch(D.dirs.sonidos, arch(id) + '.json', JSON.stringify(meta));
  }
  async function leerSonidoDisco(id) {
    const f = await (await D.dirs.sonidos.getFileHandle(arch(id) + '.bin')).getFile();
    let meta = {}; try { meta = JSON.parse(await (await (await D.dirs.sonidos.getFileHandle(arch(id) + '.json')).getFile()).text()); } catch (e) {}
    const mime = meta.mime || ''; delete meta.mime;
    return Object.assign(meta, { blob: mime ? new Blob([f], { type: mime }) : f });
  }
  Al.guardarSonido = async (id, reg) => {
    if (!D.raiz) return orig.gSon(id, reg);
    if (!D.listo) throw new Error('El disco externo no está conectado. Conectalo y tocá «Reconectar disco».');
    try { await escribirSonido(id, reg); } catch (e) { fallo(e); throw new Error('No se pudo escribir en el disco externo: ' + (e.message || e)); }
  };
  Al.leerSonido = async (id) => {
    const r = await orig.lSon(id);
    if (r || !D.raiz || !D.listo) return r;
    try { return await leerSonidoDisco(id); } catch (e) { return undefined; }
  };
  Al.borrarSonido = async (id) => {
    await orig.bSon(id);
    if (D.raiz && D.listo) { await borrarArch(D.dirs.sonidos, arch(id) + '.bin'); await borrarArch(D.dirs.sonidos, arch(id) + '.json'); }
  };
  Al.todosSonidosIds = async () => {
    const a = await orig.iSon();
    if (!D.raiz || !D.listo) return a;
    return [...new Set(a.concat(await nombresEn(D.dirs.sonidos, '.bin')))];
  };

  // Caratulas (las tapas de los audios): son chiquitas; si el disco esta, van al disco; si no, quedan en el navegador como siempre.
  Al.guardarCaratula = async (id, blob) => {
    if (D.raiz && D.listo) { try { await escribirArch(D.dirs.caratulas, arch(id) + '.jpg', blob); return; } catch (e) { fallo(e); } }
    return orig.gCar(id, blob);
  };
  Al.leerCaratulas = async () => {
    const m = await orig.lCar();
    if (!D.raiz || !D.listo) return m;
    try { for await (const [n, h] of D.dirs.caratulas.entries()) if (h.kind === 'file' && n.endsWith('.jpg')) m.set(deArch(n.slice(0, -4)), await h.getFile()); } catch (e) { fallo(e); }
    return m;
  };

  // Configuracion: el navegador sigue siendo el principal (rapido), pero cada cambio se COPIA al disco (espejo, con un respiro de 1,5 s).
  // Si el navegador esta vacio (compu nueva o datos borrados) y el disco tiene copia, se lee de ahi.
  const pend = new Map(); let tEsp = null;
  const archCfg = (k) => k === 'main' ? 'main.json' : 'clave_' + arch(k) + '.json';
  function espejar(k, v) {
    if (!D.raiz || k === CLAVE) return;
    pend.set(k, v); clearTimeout(tEsp); tEsp = setTimeout(volcarEspejo, 1500);
  }
  async function volcarEspejo() {
    if (!D.raiz || !D.listo) return;
    const lote = [...pend]; pend.clear();
    for (const [k, v] of lote) { try { if (v != null) await escribirArch(D.dirs.config, archCfg(k), JSON.stringify(v)); } catch (e) { fallo(e); return; } }
  }
  async function leerEspejo(k) { try { return JSON.parse(await (await (await D.dirs.config.getFileHandle(archCfg(k))).getFile()).text()); } catch (e) { return undefined; } }
  Al.guardarConfig = async (c) => { const r = await orig.gCfg(c); espejar('main', c); return r; };
  Al.guardarConfigClave = async (k, v) => { const r = await orig.gClave(k, v); espejar(k, v); return r; };
  Al.leerConfig = async () => { const r = await orig.lCfg(); if (r || !D.raiz || !D.listo) return r; return leerEspejo('main'); };
  Al.leerConfigClave = async (k) => { const r = await orig.lClave(k); if (r !== undefined || k === CLAVE || !D.raiz || !D.listo) return r; return leerEspejo(k); };

  Al.guardarAudio = async (id, reg) => {
    if (!D.raiz) return orig.guardar(id, reg);
    if (!D.listo) throw new Error('El disco externo no está conectado. Conectalo y tocá «Reconectar disco».');
    try { await escribir(id, reg); } catch (e) { fallo(e); throw new Error('No se pudo escribir en el disco externo: ' + (e.message || e)); }
  };
  Al.leerAudio = async (id) => {
    const r = await orig.leer(id);
    if (r || !D.raiz || !D.listo) return r;
    try { return await leerDisco(id); } catch (e) { return undefined; }
  };
  Al.borrarAudio = async (id) => {
    await orig.borrar(id);
    if (D.raiz && D.listo) { for (const ext of ['.opus', '.json']) { try { await D.dir.removeEntry(arch(id) + ext); } catch (e) {} } }
  };
  Al.audiosIds = async () => {
    const a = await orig.ids();
    if (!D.raiz || !D.listo) return a;
    const s = new Set(a);
    try { for await (const [n, h] of D.dir.entries()) if (h.kind === 'file' && n.endsWith('.opus')) s.add(deArch(n.slice(0, -5))); } catch (e) { fallo(e); }
    return [...s];
  };

  MD.Disco = {
    alCambiar: null,
    disponible: hayApi,
    activo: () => !!D.raiz,
    listo: () => D.listo,
    nombre: () => D.nombre,
    error: () => D.error,
    // Al arrancar la app: recupera la carpeta elegida la vez anterior. Si el navegador pide permiso de nuevo, queda "sin conectar" hasta que se toque Reconectar.
    async iniciar() {
      if (!hayApi()) return;
      try {
        const g = await Al.leerConfigClave(CLAVE);
        if (!g || !g.handle) return;
        D.raiz = g.handle; D.nombre = g.nombre || g.handle.name || '';
        if (await permiso(D.raiz, false)) { try { await abrirSub(); } catch (e) { fallo(e); } }
        else D.error = 'Hay que dar permiso de nuevo para usar el disco externo (tocá «Reconectar disco»).';
      } catch (e) {}
    },
    // El usuario elige la carpeta (por ejemplo la raiz del disco "Expansion"). Dentro se crea la subcarpeta Macrodeck-audios.
    async elegir() {
      if (!hayApi()) throw new Error('Este navegador no permite elegir una carpeta (usá Chrome o Edge en la compu).');
      const h = await window.showDirectoryPicker({ id: 'macrodeck-audios', mode: 'readwrite' });
      if (!(await permiso(h, true))) throw new Error('Sin permiso para escribir en esa carpeta.');
      D.raiz = h; D.nombre = h.name || 'disco'; await abrirSub();
      await Al.guardarConfigClave(CLAVE, { handle: h, nombre: D.nombre });
      cambio();
      return D.nombre;
    },
    // Despues de reiniciar el navegador (o de reconectar el disco): vuelve a pedir el permiso. Hay que llamarlo desde un toque del usuario.
    async reconectar() {
      if (!D.raiz) return false;
      if (!(await permiso(D.raiz, true))) { D.error = 'No se dio permiso.'; cambio(); return false; }
      try { await abrirSub(); } catch (e) { fallo(e); return false; }
      cambio(); return true;
    },
    // Pasa al disco lo que ya estaba guardado en el navegador (audios, sonidos y caratulas) y lo borra de ahi (libera la compu); la configuracion se COPIA.
    // 'progreso(hechos, total)'. Devuelve { audios, sonidos, caratulas }.
    async moverTodo(progreso) {
      if (!D.raiz || !D.listo) throw new Error('El disco no está conectado.');
      const idsA = await orig.ids(), idsS = await orig.iSon(), cars = await orig.lCar();
      const total = idsA.length + idsS.length + cars.size; let hechos = 0; const n = { audios: 0, sonidos: 0, caratulas: 0 };
      const paso = () => { hechos++; if (progreso) progreso(hechos, total); };
      for (const id of idsA) { const reg = await orig.leer(id); if (reg && reg.blob) { await escribir(id, reg); await orig.borrar(id); n.audios++; } paso(); }
      for (const id of idsS) { const reg = await orig.lSon(id); if (reg && reg.blob) { await escribirSonido(id, reg); await orig.bSon(id); n.sonidos++; } paso(); }
      for (const [id, blob] of cars) { await escribirArch(D.dirs.caratulas, arch(id) + '.jpg', blob); if (orig.bCar) await orig.bCar(id); n.caratulas++; paso(); }
      await this.copiarConfig();
      return n;
    },
    // Copia al disco la configuracion de ahora (escenas, teclas, looks...) y las claves de Audios (catalogo, favoritos, listas).
    async copiarConfig() {
      if (!D.raiz || !D.listo) throw new Error('El disco no está conectado.');
      let n = 0;
      for (const k of await Al.clavesConfig()) {
        if (k === CLAVE) continue;                                   // la carpeta elegida NO se copia (es un permiso del navegador, no un dato)
        const v = await orig.lClave(k); if (v == null) continue;
        await escribirArch(D.dirs.config, archCfg(k), JSON.stringify(v)); n++;
      }
      return n;
    },
    // Trae del disco la configuracion guardada (para una compu nueva o si se borraron los datos del navegador). Despues hay que recargar la app.
    async restaurarConfig() {
      if (!D.raiz || !D.listo) throw new Error('El disco no está conectado.');
      const c = await leerEspejo('main'); if (!c) throw new Error('En el disco no hay una copia de la configuración todavía.');
      await orig.gCfg(c); let claves = 0;
      for (const n of await nombresEn(D.dirs.config, '.json')) { if (n.startsWith('clave_')) { const k = n.slice(6); const v = await leerEspejo(k); if (v !== undefined) { await orig.gClave(k, v); claves++; } } }
      return { escenas: (c.escenas || []).length, claves };
    },
    // Deja de usar el disco (los audios que estaban ahi quedan en el disco, pero la app ya no los ve).
    async quitar() { D.raiz = null; D.dir = null; D.listo = false; D.nombre = ''; D.error = ''; try { await Al.guardarConfigClave(CLAVE, null); } catch (e) {} cambio(); },
    // Para pruebas: usa cualquier carpeta (por ejemplo la del navegador, OPFS) como si fuera el disco.
    async _usar(h, nombre) { D.raiz = h; D.nombre = nombre || 'prueba'; await abrirSub(); cambio(); },
  };
})(window.MD);
