// celu.js - (v1.3-dev14) Lo que la OLED del Macrodeck muestra de ESTE celu: bateria, volumen de Android y si suena algo (YouTube...).
// Los datos vienen del APK (MD.Nativo.celu / alCelu). En el navegador comun solo se sabe la bateria (si el navegador la da).
// Hacia el Macrodeck viajan 2 tramas: 'z' (bateria, banderas, volumen) y 'y' (titulo de lo que suena, en hasta 3 partes).
// Desde el Macrodeck llega 'Q' (la perilla en modo CEL pide un volumen de Android): A.alTrama llama a MD.Celu.volumen(pct).
window.MD = window.MD || {};
(function (MD) {
  const C = MD.Celu = {
    s: { bat: -1, carga: false, vol: -1, suena: false, sesion: false, acceso: false, titulo: '', app: '' },
    onCambio: null,           // lo pone la pantalla (ui.js) para repintar el aviso de acceso
    A: null
  };
  let ultTrama = '', ultTitulo = null, ultEnvio = 0, volPedidoEn = 0;

  const byte = (n) => (n == null || n < 0 || isNaN(n)) ? 255 : Math.max(0, Math.min(100, Math.round(n)));

  // Mezcla lo que informa Android con lo que sabe el navegador (bateria por la API del navegador si el APK no la dio)
  C.aplicar = function (d) {
    if (!d || typeof d !== 'object') return;
    const s = C.s, antes = JSON.stringify(s);
    if (typeof d.bat === 'number') s.bat = d.bat;
    if (typeof d.carga === 'boolean') s.carga = d.carga;
    if (typeof d.vol === 'number') {
      // si justo se pidio un volumen desde el Macrodeck, no pisar con el valor viejo que ya venia en camino
      if (Date.now() - volPedidoEn > 1200) s.vol = d.vol;
    }
    if (typeof d.suena === 'boolean') s.suena = d.suena;
    if (typeof d.sesion === 'boolean') s.sesion = d.sesion;
    if (typeof d.acceso === 'boolean') s.acceso = d.acceso;
    if (typeof d.titulo === 'string') s.titulo = d.titulo;
    if (typeof d.app === 'string') s.app = d.app;
    if (JSON.stringify(s) !== antes && C.onCambio) { try { C.onCambio(); } catch (e) {} }
    C.enviar(false);
  };

  function valores() {
    const s = C.s, A = C.A;
    let bat = s.bat, carga = s.carga;
    if (bat < 0 && A && A.bat) { bat = Math.round(A.bat.level * 100); carga = !!A.bat.charging; }
    return { bat, carga };
  }

  // forzar=true: manda todo aunque no haya cambiado (al conectar o si el Macrodeck lo pide)
  C.enviar = function (forzar) {
    const A = C.A; if (!A || !A.tr || !A.tr.conectado) return;
    const s = C.s, v = valores();
    const flags = (v.carga ? 1 : 0) | (s.suena ? 2 : 0) | (s.sesion ? 4 : 0) | (s.acceso ? 8 : 0);
    const clave = byte(v.bat) + ':' + flags + ':' + byte(s.vol), ahora = Date.now();
    if (forzar || clave !== ultTrama || ahora - ultEnvio > 5000) {
      A.tr.send(MD.P.enc.celu(byte(v.bat), flags, byte(s.vol)));
      ultTrama = clave; ultEnvio = ahora;
    }
    const titulo = (s.suena || s.sesion) ? s.titulo : '';
    if (forzar || titulo !== ultTitulo) {
      A.tr.sendVarias(MD.P.tramasTitulo(titulo));
      ultTitulo = titulo;
    }
  };

  // Al (re)conectar el Macrodeck o cuando pide "reenviar": todo de nuevo
  C.reiniciar = function () { ultTrama = ''; ultTitulo = null; ultEnvio = 0; C.refrescar(); C.enviar(true); };

  // La perilla (modo CEL) pide un volumen de musica de Android
  C.volumen = function (pct) {
    pct = Math.max(0, Math.min(100, pct | 0));
    volPedidoEn = Date.now(); C.s.vol = pct;
    if (MD.Nativo && MD.Nativo.volumenCelu) MD.Nativo.volumenCelu(pct);
  };

  C.refrescar = function () {
    if (MD.Nativo && MD.Nativo.celu) MD.Nativo.celu().then(C.aplicar);
    else C.enviar(false);
  };

  C.pedirAcceso = function () { if (MD.Nativo && MD.Nativo.pedirAccesoMedios) MD.Nativo.pedirAccesoMedios(); };

  C.iniciar = function (A) {
    C.A = A;
    if (MD.Nativo && MD.Nativo.alCelu) MD.Nativo.alCelu(C.aplicar);
    C.refrescar();
    setInterval(() => C.enviar(false), 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') C.refrescar(); });   // al volver de la pantalla de permisos
  };
})(window.MD);
