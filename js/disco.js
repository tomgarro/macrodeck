// disco.js - Los audios (pestana Audios) pueden guardarse en una CARPETA ELEGIDA (un disco externo USB, por ejemplo) en vez de en la memoria del navegador.
// Pensado para la web de Frodo en la Mac (Chrome): la Mac casi no tiene espacio, asi que los audios van a un disco externo.
// Usa la "API de acceso a carpetas" de Chrome/Edge (showDirectoryPicker). En el APK y en Safari/Firefox no existe: ahi todo sigue igual que antes.
// Funciona "envolviendo" las funciones de audios de MD.Almacen: el resto de la app no se entera (guardarAudio / leerAudio / borrarAudio / audiosIds).
// Si hay un disco elegido pero esta desconectado, NO baja en silencio a la memoria de la Mac: avisa y pide reconectar.
window.MD = window.MD || {};
(function (MD) {
  const Al = MD.Almacen, CLAVE = 'disco_audios', SUB = 'Macrodeck-audios';
  const orig = { guardar: Al.guardarAudio, leer: Al.leerAudio, borrar: Al.borrarAudio, ids: Al.audiosIds };
  const D = { raiz: null, dir: null, nombre: '', listo: false, error: '' };
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
    // Pasa a la carpeta lo que ya estaba guardado en el navegador y lo borra de ahi (libera la Mac). 'progreso(hechos, total)'.
    async moverTodo(progreso) {
      if (!D.raiz || !D.listo) throw new Error('El disco no está conectado.');
      const ids = await orig.ids(); let n = 0;
      for (let i = 0; i < ids.length; i++) {
        const reg = await orig.leer(ids[i]);
        if (reg && reg.blob) { await escribir(ids[i], reg); await orig.borrar(ids[i]); n++; }
        if (progreso) progreso(i + 1, ids.length);
      }
      return n;
    },
    // Deja de usar el disco (los audios que estaban ahi quedan en el disco, pero la app ya no los ve).
    async quitar() { D.raiz = null; D.dir = null; D.listo = false; D.nombre = ''; D.error = ''; try { await Al.guardarConfigClave(CLAVE, null); } catch (e) {} cambio(); },
    // Para pruebas: usa cualquier carpeta (por ejemplo la del navegador, OPFS) como si fuera el disco.
    async _usar(h, nombre) { D.raiz = h; D.nombre = nombre || 'prueba'; await abrirSub(); cambio(); },
  };
})(window.MD);
