// vivo.js - Evita que Android/Chromium CONGELE la pagina cuando el celu se bloquea (dentro del APK).
// Medido el 13/10 en el dummy: con la pantalla apagada el JavaScript queda congelado ("JS estuvo dormido 6 min") aunque el Bluetooth
// nativo siga vivo; las teclas llegan, quedan en cola y recien suenan al volver a la app. Chromium congela las paginas ocultas que no
// tienen motivo para seguir vivas. Dos motivos que lo evitan (se usan los dos, por las dudas):
//   1) un "candado web" (Web Lock) tomado para siempre: una pagina con un candado no se congela.
//   2) un tono grave casi inaudible (18 Hz, -50 dB) por el AudioContext: una pagina que "esta sonando" no se congela. El AudioContext
//      NO le pide el foco de audio a Android, asi que no pausa YouTube; el telefono no reproduce 18 Hz.
// Todo se anota en el Diagnostico (Herramientas). Solo se usa dentro del APK.
(function () {
  const MD = window.MD = window.MD || {};
  const nota = (t) => { try { if (MD.Diag) MD.Diag.anotar(t); } catch (e) {} };
  let candado = false, osc = null, gan = null, ctxTono = null;

  function tomarCandado() {
    if (candado) return;
    try {
      if (!navigator.locks || !navigator.locks.request) { nota('vivo: este WebView no tiene Web Locks'); return; }
      navigator.locks.request('macrodeck-vivo', { mode: 'shared' }, () => new Promise(() => {}));   // nunca se resuelve: el candado queda tomado
      candado = true; nota('vivo: candado web tomado');
    } catch (e) { nota('vivo: candado web fallo (' + (e && e.message) + ')'); }
  }

  function prenderTono(ctx) {
    if (!ctx) { nota('vivo: todavia no hay audio para el tono'); return; }
    if (osc && ctxTono === ctx) return;
    try {
      pararTono();
      osc = ctx.createOscillator(); gan = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 18;
      gan.gain.setValueAtTime(0, ctx.currentTime);
      gan.gain.linearRampToValueAtTime(0.003, ctx.currentTime + 0.6);   // entra suave (sin "pop")
      osc.connect(gan); gan.connect(ctx.destination);                    // directo al destino: no depende de la perilla
      osc.start(); ctxTono = ctx; nota('vivo: tono grave prendido (audio ' + ctx.state + ')');
    } catch (e) { nota('vivo: tono fallo (' + (e && e.message) + ')'); osc = gan = ctxTono = null; }
  }
  function pararTono() {
    try { if (osc) { osc.stop(); osc.disconnect(); } if (gan) gan.disconnect(); } catch (e) {}
    osc = gan = ctxTono = null;
  }

  MD.Vivo = {
    activar(ctx) { tomarCandado(); prenderTono(ctx); },
    parar() { pararTono(); nota('vivo: tono apagado'); }
  };
})();
