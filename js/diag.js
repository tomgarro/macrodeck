// diag.js - Diagnostico de "segundo plano": anota con la hora lo que pasa cuando el celu se bloquea o la app queda atras.
// Sirve para saber si lo que se duerme es el JavaScript (aparece "JS estuvo dormido N s"), el audio ("audio suspended") o el Bluetooth.
// Se lee en Herramientas > "Diagnostico de segundo plano". Guarda las ultimas lineas tambien en el celu (por si Android reinicia la app).
(function () {
  const MD = window.MD = window.MD || {};
  const MAX = 100, CLAVE = 'md_diag';
  let lineas = [];
  try { lineas = JSON.parse(localStorage.getItem(CLAVE) || '[]'); if (!Array.isArray(lineas)) lineas = []; } catch (e) { lineas = []; }

  function hora(t) { try { return new Date(t).toTimeString().slice(0, 8); } catch (e) { return '--:--:--'; } }
  function anotar(txt) {
    lineas.push(hora(Date.now()) + ' ' + txt);
    if (lineas.length > MAX) lineas.splice(0, lineas.length - MAX);
    try { localStorage.setItem(CLAVE, JSON.stringify(lineas)); } catch (e) {}
  }

  // Latido: cada segundo mira cuanto paso de verdad. Si pasaron mas de 4 s, el JavaScript estuvo dormido (o muy frenado) todo ese rato.
  let ultimo = Date.now();
  setInterval(() => {
    const ahora = Date.now(), dt = ahora - ultimo; ultimo = ahora;
    if (dt > 4000) anotar('JS estuvo dormido ' + (dt >= 90000 ? Math.round(dt / 60000) + ' min' : Math.round(dt / 1000) + ' s'));
  }, 1000);
  document.addEventListener('visibilitychange', () => anotar('pantalla ' + (document.visibilityState === 'visible' ? 'VISIBLE' : 'oculta')));
  document.addEventListener('freeze', () => anotar('Chromium CONGELO la pagina'));
  document.addEventListener('resume', () => anotar('Chromium desperto la pagina'));
  anotar('--- app abierta (v' + (MD.VERSION || '?') + ') ---');

  MD.Diag = {
    anotar,
    texto() { return lineas.join('\n'); },
    ultimas(n) { return lineas.slice(-(n || 40)); },
    borrar() { lineas = []; try { localStorage.removeItem(CLAVE); } catch (e) {} }
  };
})();
