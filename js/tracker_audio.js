// tracker_audio.js - Initiative Tracker: el sonido y la luz de cada movimiento.
// Sonido: su propio AudioContext (separado del Macrodeck), con los buffers ya decodificados de antemano para que suene al instante.
//   Los de fabrica salen de tracker/sfx/*.mp3 (viajan con la app); los de la biblioteca, de la pestana Sonidos (IndexedDB).
//   Con ducking prendido le baja el volumen a la musica de otras apps (YouTube, Spotify...) mientras suena (solo en la APK).
// Luz: se pide al servidor de luces de D&D como un efecto de "momento" (mismo camino que las teclas del Macrodeck).
window.MD = window.MD || {};
(function (MD) {
  const Trk = MD.Trk || (MD.Trk = {});
  const Au = Trk.Audio = {
    ctx: null, buffers: new Map(), pend: new Map(), ultimo: {}, activas: 0, tDuck: 0, duckOn: false, volumen: 1, duck: true, bibliotecaMeta: () => [], fallos: [],
  };
  Au.asegurar = function () {
    try {
      if (!Au.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return false; Au.ctx = new C({ latencyHint: 'interactive' }); }
      if (Au.ctx.state !== 'running') Au.ctx.resume().catch(() => {});
      return true;
    } catch (e) { return false; }
  };
  Au.listo = () => !!Au.ctx && Au.ctx.state === 'running';
  const nombreDe = (ref) => { const n = ref.slice(2); return ref[0] === 'f' ? (Trk.SFX_NOMBRES[n] || n) : ((Au.bibliotecaMeta().find((s) => s.id === n) || {}).nombre || 'sonido borrado'); };
  Au.nombreDe = nombreDe;
  Au.existe = (ref) => ref[0] === 'f' ? Trk.SFX_FABRICA.indexOf(ref.slice(2)) >= 0 : !!Au.bibliotecaMeta().find((s) => s.id === ref.slice(2));
  async function bytes(ref) {
    const n = ref.slice(2);
    if (ref[0] === 'f') { const r = await fetch(new URL('tracker/sfx/' + n + '.mp3', document.baseURI)); if (!r.ok) throw new Error('falta ' + n + '.mp3'); return r.arrayBuffer(); }
    const reg = await MD.Almacen.leerSonido(n); if (!reg || !reg.blob) throw new Error('el sonido ya no está en la biblioteca');
    return reg.blob.arrayBuffer();
  }
  Au.buffer = function (ref) {
    if (Au.buffers.has(ref)) return Promise.resolve(Au.buffers.get(ref));
    if (Au.pend.has(ref)) return Au.pend.get(ref);
    if (!Au.asegurar()) return Promise.resolve(null);
    const p = bytes(ref).then((ab) => new Promise((ok, mal) => Au.ctx.decodeAudioData(ab, ok, mal))).then((b) => { Au.buffers.set(ref, b); Au.pend.delete(ref); return b; })
      .catch((e) => { Au.pend.delete(ref); Au.fallos.push(ref + ': ' + ((e && e.message) || e)); if (Au.fallos.length > 20) Au.fallos.shift(); return null; });
    Au.pend.set(ref, p); return p;
  };
  // decodifica de antemano todo lo que se puede llegar a usar (fabrica + lo elegido)
  Au.precargar = function (cfg) {
    const refs = new Set(Trk.SFX_FABRICA.map((f) => 'f:' + f));
    const juntar = (o) => { if (o && o.s) o.s.forEach((r) => refs.add(r)); };
    Object.keys(cfg.ev || {}).forEach((k) => juntar(cfg.ev[k]));
    Object.keys(cfg.cl || {}).forEach((t) => Object.keys(cfg.cl[t]).forEach((k) => juntar(cfg.cl[t][k])));
    return Promise.all([...refs].map((r) => Au.buffer(r)));
  };
  function duckMas() { clearTimeout(Au.tDuck); Au.activas++; if (Au.duck && MD.Nativo && !Au.duckOn) { Au.duckOn = true; MD.Nativo.duck(true); } }
  function duckMenos() { Au.activas = Math.max(0, Au.activas - 1); if (Au.activas === 0 && Au.duckOn) { clearTimeout(Au.tDuck); Au.tDuck = setTimeout(() => { if (Au.activas === 0 && Au.duckOn) { Au.duckOn = false; if (MD.Nativo) MD.Nativo.duck(false); } }, 900); } }
  // Toca UNO de la lista (al azar, sin repetir el ultimo de esa clave). Devuelve el ref que eligio (o null).
  Au.tocar = function (refs, vol, clave) {
    const lista = (refs || []).filter(Au.existe); if (!lista.length) return null;
    let c = lista.filter((r) => r !== Au.ultimo[clave]); if (!c.length) c = lista;
    const ref = c[Math.floor(Math.random() * c.length)]; Au.ultimo[clave] = ref;
    const v = Math.max(0, Math.min(1, (vol == null ? 1 : vol))) * Au.volumen * (ref[0] === 's' ? Math.min(2, (Au.bibliotecaMeta().find((s) => s.id === ref.slice(2)) || {}).volumen || 1) : 1);
    const lanzar = (buf) => {
      if (!buf || !Au.ctx) return;
      const src = Au.ctx.createBufferSource(), g = Au.ctx.createGain(); src.buffer = buf; g.gain.value = Math.min(1.5, v);
      src.connect(g); g.connect(Au.ctx.destination); duckMas(); src.onended = () => { try { g.disconnect(); } catch (e) {} duckMenos(); }; src.start();
    };
    const b = Au.buffers.get(ref);
    if (b) lanzar(b); else Au.buffer(ref).then(lanzar);
    return ref;
  };
  Au.parar = function () { /* los sonidos son cortos: se dejan terminar */ };

  // ---------- luz ----------
  Trk.Luz = {
    // l = { look, seg, lamp }  ->  true si se pidio
    disparar(l) {
      const L = MD.LucesDnd; if (!l || !L || !L.aj || !L.aj.activo) return false;
      const look = L.look(l.look); if (!look) return false;
      const dest = l.lamp === 'dnd-1' || l.lamp === 'dnd-2' ? { luz: l.lamp } : { grupo: 'dnd' };
      L.enviar([Object.assign(dest, { look: L.lookServidor(look), capa: 'momento', segundos: l.seg || 3, id: 'trk' })]);
      return true;
    },
    nombreLook(id) { const L = MD.LucesDnd, k = L && L.look && L.look(id); return k ? k.nombre : 'look borrado'; },
    disponible() { const L = MD.LucesDnd; return !!(L && L.aj && L.aj.activo); },
  };
})(window.MD);
