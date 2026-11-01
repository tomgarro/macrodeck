// drive.js - Habla con tu Google Drive a traves del Apps Script (herramientas/drive/Code.gs).
// Lista y baja sonidos, sube sonidos nuevos y sincroniza las escenas. La direccion fija va en drive_config.js; la clave se guarda en este celu (localStorage).
window.MD = window.MD || {};
(function (MD) {
  const LS = 'md_drive';
  function leer() { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } }
  function guardar(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }
  let aj = leer();
  // La direccion fija viene de drive_config.js; si todavia no se completo, la app la pide a mano (modo avanzado).
  const URL_FIJA = (MD.DRIVE_URL && /^https:\/\/script\.google\.com\//.test(MD.DRIVE_URL)) ? MD.DRIVE_URL : '';
  const USUARIOS = Array.isArray(MD.DRIVE_USUARIOS) && MD.DRIVE_USUARIOS.length ? MD.DRIVE_USUARIOS : ['Tom', 'Frodo'];
  const urlActual = () => URL_FIJA || aj.url || '';

  // 2.0-dev15: TODO pedido a Drive tiene tiempo limite. Antes el fetch podia quedar esperando para siempre (Google no contesta, Wi-Fi sin salida, etc.)
  // y "Sincronizar todo" se colgaba en el primer paso sin mostrar ningun error. Ahora corta y avisa en pantalla.
  const MS_LIVIANO = 30000, MS_PESADO = 90000, MS_SUBIDA = 180000;
  const LIVIANAS = ['ping', 'escenas', 'escenas_guardar', 'listar', 'catalogo'];
  const msDe = (accion) => accion === 'subir' ? MS_SUBIDA : (LIVIANAS.indexOf(accion) >= 0 || !accion) ? MS_LIVIANO : MS_PESADO;
  // Hace el fetch y lee el JSON con un solo reloj (si se pasa el tiempo, aborta tambien la lectura). Tira un Error con .codigo = 'timeout' | 'red' | 'json'.
  async function pedir(url, opts, ms) {
    const ctl = (typeof AbortController === 'function') ? new AbortController() : null;
    let vencio = false;
    const t = setTimeout(() => { vencio = true; if (ctl) ctl.abort(); }, ms);
    let t2;
    const tope = new Promise((_, mal) => { t2 = setTimeout(() => { vencio = true; mal(Object.assign(new Error('timeout'), { codigo: 'timeout' })); }, ms + 1500); });   // por si el abort no corta
    try {
      return await Promise.race([tope, (async () => {
        let r;
        try { r = await fetch(url, Object.assign({}, opts, ctl ? { signal: ctl.signal } : {})); }
        catch (e) { throw Object.assign(new Error('red'), { codigo: vencio ? 'timeout' : 'red' }); }
        try { return await r.json(); }
        catch (e) { throw Object.assign(new Error('json'), { codigo: vencio ? 'timeout' : 'json' }); }
      })()]);
    } finally { clearTimeout(t); clearTimeout(t2); }
  }
  const msgTimeout = (ms) => 'Drive no respondió en ' + Math.round(ms / 1000) + ' s. Revisá que este Wi-Fi tenga internet (abrí una página en el navegador) y probá de nuevo.';

  async function get(params) {
    if (!urlActual() || !aj.clave) throw new Error('Falta la direccion o la clave de Drive.');
    if (MD.Red) await MD.Red.verificar(params && params.accion);          // 1.3-dev35: en una red prohibida (ej. el Wi-Fi "Tom's Phone") no se descarga nada
    let u;
    try { u = new URL(urlActual()); } catch (e) { throw new Error('La direccion no es valida (tiene que empezar con https:// y terminar en /exec).'); }
    u.searchParams.set('clave', aj.clave);
    for (const k in params) u.searchParams.set(k, params[k]);
    const ms = msDe(params && params.accion);
    let j;
    try { j = await pedir(u.toString(), {}, ms); }
    catch (e) {
      if (e.codigo === 'timeout') throw new Error(msgTimeout(ms));
      if (e.codigo === 'json') throw new Error('Drive contesto algo raro. Revisa que el acceso del script sea "Cualquier persona".');
      throw new Error('No se pudo conectar con Drive. Revisa internet y que la direccion sea la correcta.');
    }
    if (!j.ok) throw new Error(j.error === 'clave' ? 'La clave no coincide con la del script.' : (j.error || 'Error de Drive.'));
    return j;
  }

  // Los POST van como texto plano con fetch: asi el navegador no hace la consulta previa (CORS) que Apps Script no contesta.
  // OJO: no usar XMLHttpRequest con upload.onprogress, eso fuerza esa consulta previa y el POST falla con "No se pudo conectar".
  async function post(obj) {
    if (!urlActual() || !aj.clave) throw new Error('Falta la direccion o la clave de Drive.');
    if (MD.Red) await MD.Red.verificar(obj && obj.accion);
    obj.clave = aj.clave;
    const ms = msDe(obj && obj.accion);
    let j;
    try { j = await pedir(urlActual(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(obj) }, ms); }
    catch (e) {
      if (e.codigo === 'timeout') throw new Error(msgTimeout(ms));
      if (e.codigo === 'json') throw new Error('Drive contesto algo raro. Si cambiaste el script, publica una nueva version en Implementar > Administrar implementaciones.');
      throw new Error('No se pudo conectar con Drive. Revisa internet (si es un archivo grande, puede haberse cortado).');
    }
    if (!j.ok && !j.conflicto) throw new Error(j.error === 'clave' ? 'La clave no coincide con la del script.' : (j.error || 'Error de Drive.'));
    return j;
  }
  const LSB = 'md_drive_base';
  function leerBase() { try { return JSON.parse(localStorage.getItem(LSB) || 'null'); } catch (e) { return null; } }
  function leerArchivo(f) { return new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => mal(new Error('No se pudo leer el archivo.')); r.readAsDataURL(f); }); }

  MD.Drive = {
    usuarios: USUARIOS,
    urlFija: !!URL_FIJA,
    ajustes: () => ({ url: urlActual(), clave: aj.clave || '', por: aj.por || USUARIOS[0] }),
    configurado: () => !!(urlActual() && aj.clave),
    fijar(url, clave, por) { aj = { url: URL_FIJA ? '' : String(url || '').trim(), clave: String(clave || ''), por: String(por || '').trim() }; guardar(aj); },
    MAX_SUBIDA: 12 * 1048576,
    ping: () => get({ accion: 'ping' }),
    // Sube un sonido a la subcarpeta 'carpeta' (si no existe, va a "Sin categoria"). Devuelve {id, nombre, carpeta, tam}.
    async subir(file, carpeta) {
      if (file.size > MD.Drive.MAX_SUBIDA) throw new Error('"' + file.name + '" pesa ' + (file.size / 1048576).toFixed(1) + ' MB y el maximo es 12 MB.');
      return post({ accion: 'subir', nombre: file.name, mime: file.type || 'audio/mpeg', carpeta: carpeta || '', por: aj.por || 'alguien', datos: await leerArchivo(file) });
    },
    // Escenas compartidas (con numero de version para detectar si alguien guardo en el medio)
    escenasLeer: () => get({ accion: 'escenas' }),
    // 1.3-dev21: el rol sale del nombre elegido al entrar a Drive. Frodo (el DM) arma escenas en borrador y las confirma; Tom solo recibe las confirmadas.
    esDM: () => String(aj.por || '').toLowerCase() === 'frodo',
    escenasGuardar: (baseVersion, config) => post({ accion: 'escenas_guardar', baseVersion: baseVersion, config: config, por: aj.por || '' }),
    baseEscenas: leerBase,
    fijarBaseEscenas(version, escenas, looks, listas, extra) { try { localStorage.setItem(LSB, JSON.stringify(Object.assign({ version: version, escenas: escenas, looks: looks || [], listas: listas || [] }, extra || {}))); } catch (e) {} },
    listar: () => get({ accion: 'listar' }),
    // Pestana Audios (dev23): el catalogo (catalogo_app.json) y los audios grandes, por tramos de 6 MB (Audios.gs)
    catalogoAudios: () => get({ accion: 'catalogo' }),
    bajarAudio: (id, parte) => get({ accion: 'audio', id: id, parte: parte }),
    caratulas: (ids) => get({ accion: 'caratulas', ids: ids.join(',') }),     // dev24: varias tapas en una sola consulta
    // Baja un sonido entero (el script lo entrega en trozos). 'progreso' recibe 0..1.
    async bajar(id, progreso) {
      const trozos = []; let mime = 'audio/mpeg';
      for (let p = 0, partes = 1; p < partes; p++) {
        const j = await get({ accion: 'bajar', id: id, parte: p });
        partes = j.partes; mime = j.mime || mime;
        const bin = atob(j.datos), a = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
        trozos.push(a);
        if (progreso) progreso((p + 1) / partes);
      }
      return new Blob(trozos, { type: mime });
    },
  };
})(window.MD);
