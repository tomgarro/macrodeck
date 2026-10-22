// sostener.js - Mantiene la compu "despierta" mientras se descarga (audios, sonidos, todo).
// Problema: si la Mac se bloquea o apaga la pantalla por inactividad, Chrome frena la pestana y la descarga se traba.
// Solucion: mientras haya una descarga en curso se piden DOS cosas al navegador:
//  1) Wake Lock de pantalla: la pantalla NO se apaga ni se bloquea sola por inactividad (se vuelve a pedir si cambias de pestana y volves).
//  2) Web Lock: Chrome no "congela" ni frena a fondo la pestana mientras lo tenga.
// Ademas avisa antes de cerrar la pestana. Se puede pedir varias veces a la vez (cuenta cuantas descargas hay); se suelta solo al terminar la ultima.
// Limite honesto: si la tapa de la Mac se cierra o la bloqueas A MANO (Ctrl+Cmd+Q) o se duerme el sistema, eso ningun sitio web lo puede impedir.
window.MD = window.MD || {};
(function (MD) {
  let n = 0, wl = null, lockPedido = false, soltarLock = null;
  const avisar = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
  async function pedirPantalla() {
    try {
      if (n > 0 && !wl && navigator.wakeLock && document.visibilityState === 'visible') {
        wl = await navigator.wakeLock.request('screen');
        wl.addEventListener('release', () => { wl = null; });
      }
    } catch (e) { wl = null; }
  }
  function pedirLock() {
    if (lockPedido || !(navigator.locks && navigator.locks.request)) return;
    lockPedido = true;
    try {
      navigator.locks.request('macrodeck-descarga', () => new Promise((ok) => { soltarLock = () => { soltarLock = null; lockPedido = false; ok(); }; if (n === 0) soltarLock(); })).catch(() => { lockPedido = false; });
    } catch (e) { lockPedido = false; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pedirPantalla(); });
  MD.Sostener = {
    // Pide mantener despierta la compu. Devuelve una funcion para soltar (llamala en un 'finally').
    tomar() {
      n++;
      if (n === 1) { try { window.addEventListener('beforeunload', avisar); } catch (e) {} }
      pedirPantalla(); pedirLock();
      let suelto = false;
      return function soltar() {
        if (suelto) return; suelto = true; n = Math.max(0, n - 1);
        if (n === 0) {
          try { window.removeEventListener('beforeunload', avisar); } catch (e) {}
          if (wl) { try { wl.release(); } catch (e) {} wl = null; }
          if (soltarLock) soltarLock();
        }
      };
    },
    activo: () => n > 0,
    pantallaDespierta: () => !!wl,
    soportado: () => !!navigator.wakeLock,
  };
})(window.MD);
