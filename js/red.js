// red.js - NO descargar (ni subir) nada cuando el celu esta en una red "prohibida", por ejemplo el Wi-Fi "Tom's Phone" (la zona wifi de otro celu: gasta datos moviles).
// Solo en el APK (la parte Android sabe a que red esta conectado el celu). En la web (la compu) no hace nada.
// Para leer el NOMBRE del Wi-Fi Android exige el permiso de ubicacion (se pide desde Herramientas > Redes sin descargas).
// Si no se puede leer el nombre pero Android marca el Wi-Fi como "de uso medido" (asi marca las zonas wifi de otros celus), tambien se frena.
window.MD = window.MD || {};
(function (MD) {
  const LS = 'md_red';
  const POR_DEFECTO = { bloquear: ["Tom's Phone"], sinDatos: false, liviano: true };
  // (2.0-dev3) Pedidos LIVIANOS (unos pocos KB): escenas, looks, listas, catalogo y lista de sonidos. Pasan aunque la red este en la lista, asi se sincroniza
  // una escena sin soltar el hotspot de las luces. Lo PESADO (audios, sonidos, caratulas, subir archivos) sigue pausado.
  const LIVIANAS = ['ping', 'escenas', 'escenas_guardar', 'listar', 'catalogo'];
  function leer() {
    try { const o = JSON.parse(localStorage.getItem(LS) || 'null'); if (o && Array.isArray(o.bloquear)) return { bloquear: o.bloquear.filter(x => typeof x === 'string' && x.trim()), sinDatos: !!o.sinDatos, liviano: o.liviano !== false }; } catch (e) {}
    return { bloquear: POR_DEFECTO.bloquear.slice(), sinDatos: POR_DEFECTO.sinDatos, liviano: POR_DEFECTO.liviano };
  }
  let cfg = leer();
  const guardar = () => { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) {} };
  // el apostrofe puede venir recto o curvo segun el celu: se compara sin mayusculas ni diferencias de comillas
  const norm = (s) => String(s || '').replace(/[‘’´`]/g, "'").trim().toLowerCase();
  let cache = null, cacheT = 0;

  async function estado(forzar) {
    if (!MD.Nativo || !MD.Nativo.red) return { nativo: false, tipo: 'web' };
    if (!forzar && cache && Date.now() - cacheT < 3000) return cache;
    const r = await MD.Nativo.red();
    cache = r ? Object.assign({ nativo: true }, r) : { nativo: false, tipo: 'web' }; cacheT = Date.now();
    return cache;
  }
  // { bloqueada, motivo, red } para la red de AHORA
  async function revisar(forzar) {
    const e = await estado(forzar);
    if (!e.nativo) return { bloqueada: false, motivo: '', red: e };
    if (e.tipo === 'wifi') {
      if (e.ssidLegible && cfg.bloquear.some(n => norm(n) === norm(e.ssid)))
        return { bloqueada: true, red: e, motivo: 'Descargas pausadas: estás en el Wi-Fi «' + e.ssid + '», que usa los datos de tu celu. Conectate a otro Wi-Fi (o sacá esa red en Más > Herramientas > Redes sin descargas).' };
      if (!e.ssidLegible && e.medida)
        return { bloqueada: true, red: e, motivo: 'Descargas pausadas: este Wi-Fi tiene límite de datos (Android lo marca como "de uso medido") y no puedo leer su nombre. Dale el permiso de ubicación en Más > Herramientas > Redes sin descargas, o conectate a otro Wi-Fi.' };
    }
    if (e.tipo === 'datos' && cfg.sinDatos)
      return { bloqueada: true, red: e, motivo: 'Descargas pausadas: estás con datos móviles. Conectate a un Wi-Fi (o apagá esa opción en Más > Herramientas > Redes sin descargas).' };
    return { bloqueada: false, motivo: '', red: e };
  }
  // Lo llama drive.js antes de cada pedido: si la red esta prohibida, corta con un mensaje claro y NO sale nada a internet.
  async function verificar(accion) { const r = await revisar(false); if (r.bloqueada && cfg.liviano && LIVIANAS.includes(accion)) return; if (r.bloqueada) { const x = new Error(r.motivo); x.redBloqueada = true; throw x; } }

  MD.Red = {
    config: () => ({ bloquear: cfg.bloquear.slice(), sinDatos: cfg.sinDatos, liviano: cfg.liviano }),
    // true si hoy la red esta en la lista pero se permiten los pedidos livianos (para avisar en el resumen de Sincronizar)
    async soloLiviano() { const r = await revisar(false); return !!(r.bloqueada && cfg.liviano); },
    fijarLiviano(v) { cfg.liviano = !!v; guardar(); cache = null; },
    estado, revisar, verificar,
    agregar(nombre) { const n = String(nombre || '').trim(); if (!n || cfg.bloquear.some(x => norm(x) === norm(n))) return false; cfg.bloquear.push(n); guardar(); cache = null; return true; },
    quitar(nombre) { cfg.bloquear = cfg.bloquear.filter(x => norm(x) !== norm(nombre)); guardar(); cache = null; },
    fijarSinDatos(v) { cfg.sinDatos = !!v; guardar(); cache = null; },
    pedirUbicacion: async () => { const r = MD.Nativo && MD.Nativo.pedirUbicacion ? await MD.Nativo.pedirUbicacion() : null; cache = null; return r; },
  };
})(window.MD);
