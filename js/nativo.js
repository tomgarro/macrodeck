// nativo.js - La "puerta" entre la app web y el APK envoltorio (Android).
//
// Dentro del APK (Capacitor) existe un plugin nativo llamado MacrodeckNativo. Este archivo lo busca y arma MD.Nativo.
// Afuera del APK (navegador comun) MD.Nativo NO existe y la app sigue usando Web Bluetooth como siempre.
// Con "?nativo=sim" en la direccion, nativo_sim.js inventa un Android de mentira para probar todo en la compu.
//
// CONTRATO del plugin (lo que tiene que implementar la parte Kotlin del APK; datos siempre en JSON, bytes en base64):
//   conectar({servicio, rx, tx})   busca el Macrodeck por su servicio BLE y se conecta (reintenta solo si se corta)
//   desconectar()                  corta y deja de reintentar
//   escribir({b64})                escribe una trama (<= 20 bytes) en la caracteristica RX
//   duck({on})                     on=true pide el foco de audio "AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK"; on=false lo suelta
//   servicio({on, titulo, texto})  prende/apaga el servicio en primer plano (notificacion) + wake lock parcial
//   bateria()                      -> {exento:boolean}  si la app esta excluida del ahorro de bateria
//   pedirExencionBateria()         abre el pedido de Android para excluirla
//   celuEstado()                   -> {bat, carga, vol, suena, sesion, acceso, titulo, app}  (v1.3-dev14) bateria 0..100 (-1 = no se sabe), si carga, volumen de
//                                     musica de Android 0..100, si suena algo (YouTube...), si hay una sesion de medios (sonando o en pausa), si la app tiene
//                                     "Acceso a notificaciones" (hace falta para leer lo que suena), titulo y paquete de la app que suena
//   volumenCelu({pct})             fija el volumen de musica de Android (0..100)
//   pedirAccesoMedios()            abre la pantalla de Android donde se da el "Acceso a notificaciones" a la app
//   eventos:  'estado' {estado:'buscando'|'conectando'|'conectado'|'desconectado', detalle}   y   'trama' {b64}
//             'parar' {}  (v1.3-dev8) el usuario toco "Parar todo" en la notificacion del servicio
//             'celu' {…}  (v1.3-dev14) cambio algo del celu (mismo formato que celuEstado)
window.MD = window.MD || {};
(function (MD) {
  function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function u8(b) { const s = atob(b || ''), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }

  const cap = window.Capacitor;
  let pl = null;
  try {
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
      pl = (cap.Plugins && cap.Plugins.MacrodeckNativo) || (typeof cap.registerPlugin === 'function' ? cap.registerPlugin('MacrodeckNativo') : null);
    }
  } catch (e) { pl = null; }
  if (!pl) return;                                     // navegador comun: MD.Nativo no existe

  const sinError = (p) => { try { return Promise.resolve(p).catch(() => {}); } catch (e) { return Promise.resolve(); } };
  MD.Nativo = {
    simulado: !!window.__MD_NATIVO_SIM,
    ble: pl,                                           // el plugin en si (conectar / escribir / addListener...)
    b64, u8,
    duck: (on) => sinError(pl.duck({ on: !!on })),
    servicio: (on, titulo, texto) => sinError(pl.servicio({ on: !!on, titulo: titulo || 'Macrodeck conectado', texto: texto || '' })),
    alParar: (fn) => { try { return pl.addListener('parar', () => { try { fn(); } catch (e) {} }); } catch (e) { return null; } },
    bateria: () => Promise.resolve(pl.bateria ? pl.bateria() : { exento: false }).catch(() => ({ exento: false })),
    pedirExencionBateria: () => sinError(pl.pedirExencionBateria && pl.pedirExencionBateria()),
    // v1.3-dev14: estado del celu para la OLED del Macrodeck
    celu: () => Promise.resolve(pl.celuEstado ? pl.celuEstado() : null).catch(() => null),
    alCelu: (fn) => { try { return pl.addListener('celu', (d) => { try { fn(d); } catch (e) {} }); } catch (e) { return null; } },
    volumenCelu: (pct) => sinError(pl.volumenCelu && pl.volumenCelu({ pct: Math.max(0, Math.min(100, pct | 0)) })),
    pedirAccesoMedios: () => sinError(pl.pedirAccesoMedios && pl.pedirAccesoMedios())
  };
})(window.MD);
