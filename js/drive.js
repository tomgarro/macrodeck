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

  async function get(params) {
    if (!urlActual() || !aj.clave) throw new Error('Falta la direccion o la clave de Drive.');
    let u;
    try { u = new URL(urlActual()); } catch (e) { throw new Error('La direccion no es valida (tiene que empezar con https:// y terminar en /exec).'); }
    u.searchParams.set('clave', aj.clave);
    for (const k in params) u.searchParams.set(k, params[k]);
    let r;
    try { r = await fetch(u.toString()); } catch (e) { throw new Error('No se pudo conectar con Drive. Revisa internet y que la direccion sea la correcta.'); }
    let j;
    try { j = await r.json(); } catch (e) { throw new Error('Drive contesto algo raro. Revisa que el acceso del script sea "Cualquier persona".'); }
    if (!j.ok) throw new Error(j.error === 'clave' ? 'La clave no coincide con la del script.' : (j.error || 'Error de Drive.'));
    return j;
  }

  // Los POST van como texto plano con fetch: asi el navegador no hace la consulta previa (CORS) que Apps Script no contesta.
  // OJO: no usar XMLHttpRequest con upload.onprogress, eso fuerza esa consulta previa y el POST falla con "No se pudo conectar".
  async function post(obj) {
    if (!urlActual() || !aj.clave) throw new Error('Falta la direccion o la clave de Drive.');
    obj.clave = aj.clave;
    let r;
    try { r = await fetch(urlActual(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(obj) }); }
    catch (e) { throw new Error('No se pudo conectar con Drive. Revisa internet (si es un archivo grande, puede haberse cortado).'); }
    let j;
    try { j = await r.json(); } catch (e) { throw new Error('Drive contesto algo raro. Si cambiaste el script, publica una nueva version en Implementar > Administrar implementaciones.'); }
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
    fijarBaseEscenas(version, escenas, looks) { try { localStorage.setItem(LSB, JSON.stringify({ version: version, escenas: escenas, looks: looks || [] })); } catch (e) {} },
    listar: () => get({ accion: 'listar' }),
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
