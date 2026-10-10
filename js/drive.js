// drive.js - Habla con tu Google Drive a traves del Apps Script (herramientas/drive/Code.gs).
// Solo LEE por ahora (listar y bajar sonidos). La direccion y la clave se guardan en este celu (localStorage).
window.MD = window.MD || {};
(function (MD) {
  const LS = 'md_drive';
  function leer() { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } }
  function guardar(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }
  let aj = leer();

  async function get(params) {
    if (!aj.url || !aj.clave) throw new Error('Falta la direccion o la clave de Drive.');
    let u;
    try { u = new URL(aj.url); } catch (e) { throw new Error('La direccion no es valida (tiene que empezar con https:// y terminar en /exec).'); }
    u.searchParams.set('clave', aj.clave);
    for (const k in params) u.searchParams.set(k, params[k]);
    let r;
    try { r = await fetch(u.toString()); } catch (e) { throw new Error('No se pudo conectar con Drive. Revisa internet y que la direccion sea la correcta.'); }
    let j;
    try { j = await r.json(); } catch (e) { throw new Error('Drive contesto algo raro. Revisa que el acceso del script sea "Cualquier persona".'); }
    if (!j.ok) throw new Error(j.error === 'clave' ? 'La clave no coincide con la del script.' : (j.error || 'Error de Drive.'));
    return j;
  }

  MD.Drive = {
    ajustes: () => aj,
    configurado: () => !!(aj.url && aj.clave),
    fijar(url, clave, por) { aj = { url: String(url || '').trim(), clave: String(clave || ''), por: String(por || '').trim() }; guardar(aj); },
    ping: () => get({ accion: 'ping' }),
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
