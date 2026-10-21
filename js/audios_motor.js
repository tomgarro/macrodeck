// audios_motor.js - Los reproductores de la pestana Audios. Desde la 1.3-dev31 hay DOS CARRILES que suenan a la vez, cada uno con su volumen:
//   · 'musica'   (audios de tipo Musica)  y   · 'ambiente' (audios de tipo Ambiente: lluvia, taberna, bosque...).
// Cada carril es un reproductor completo (lo que antes era el unico): dos "ranuras" (cada una con su <audio> y su volumen) para el PASE entre audios,
// la cola, el orden de la lista, aleatorio / repetir, "aleatorio inteligente" (mismo bioma y lugar) y el fundido de salida.
//
// PASE (regla de Tom): cuando al audio que suena le quedan 'fundido' segundos (15 por defecto), entra el siguiente arrancando desde su
// segundo 'intro' (15 por defecto, para saltear la intro) y los dos se mezclan con fundido de POTENCIA CONSTANTE (seno / coseno).
// Esta version mezcla solo por volumen. Todavia NO iguala el tempo ni alinea los pulsos (el BPM ya esta en el catalogo para una proxima version).
// El carril de AMBIENTES repite por defecto el mismo audio (el "pase" lo mezcla consigo mismo: un loop sin cortes) y no saltea la intro.
//
// La API vieja (Au.siguiente, Au.pausaSeguir, Au.P, Au.estado...) sigue existiendo: trabaja sobre el carril "en foco" (Au.foco), que es el que
// se ve en el reproductor. Au.reproducirUno / Au.reproducirLista eligen solos el carril segun el tipo del audio.
window.MD = window.MD || {};
(function (MD) {
  const Au = MD.Au, S = Au.S;
  const hooks = [];
  Au.alCambiar = (fn) => hooks.push(fn);
  const emitir = () => { hooks.forEach((f) => { try { f(); } catch (e) {} }); };
  Au.emitir = emitir;
  const carriles = {};
  Au.carriles = carriles; Au.foco = 'musica';
  Au.NOMBRES_CARRIL = { musica: 'Música', ambiente: 'Ambientes' };

  function crearCarril(nombre) {
    const pr = Au.prefsDe(nombre);                       // { vol, azar, repetir, inteligente, fundido, intro } de ESTE carril
    const P = { nombre, ranuras: [], salida: null, id: null, activa: 0, ctx: null, cola: [], hist: [], trans: null, apagando: false, pasoEnCurso: false, jugados: new Set() };
    const api = { nombre, P, pr };
    const actual = () => P.ranuras[P.activa];
    api.actual = actual;

    async function ranura(i) {
      if (P.ranuras[i]) return P.ranuras[i];
      const APP = Au.app();
      await APP.audioPrimero();
      const m = APP.motor; await m.iniciar();
      await salida();
      const el = new Audio(); el.preload = 'auto';
      const fuente = m.ctx.createMediaElementSource(el), g = m.ctx.createGain();
      fuente.connect(g); g.connect(P.salida);
      return (P.ranuras[i] = { el, g, url: null, id: null });
    }
    // La salida del carril (su volumen propio) -> volumen general del Macrodeck. Tambien la usan los ambientes "sumados" de ambientes.js.
    async function salida() {
      const m = Au.app().motor; await m.iniciar();
      if (!P.salida) { P.salida = m.ctx.createGain(); P.salida.gain.value = pr.vol; P.salida.connect(m.master); }
      return P.salida;
    }
    api.salida = salida;
    api.setVol = (v) => { pr.vol = Math.min(1, Math.max(0, v)); if (P.salida) P.salida.gain.value = pr.vol; Au.guardarPrefs(); };

    async function cargar(r, d, desde) {
      const reg = await MD.Almacen.leerAudio(d.id);
      if (!reg) return false;
      if (r.url) URL.revokeObjectURL(r.url);
      r.url = URL.createObjectURL(reg.blob); r.id = d.id; r.el.src = r.url;
      if (desde > 0) {
        await new Promise((ok) => { r.el.addEventListener('loadedmetadata', ok, { once: true }); setTimeout(ok, 5000); });
        try { r.el.currentTime = desde; } catch (e) {}
      }
      return true;
    }
    function soltar(r) { if (!r) return; try { r.el.pause(); } catch (e) {} r.el.onended = null; r.el.removeAttribute('src'); try { r.el.load(); } catch (e) {} if (r.url) { URL.revokeObjectURL(r.url); r.url = null; } r.id = null; }
    function fijarGanancia(r, v) { const g = r.g.gain, t = r.g.context.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(v, t); }
    function curva(sube) { const n = 64, a = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / (n - 1); a[i] = sube ? Math.sin(t * Math.PI / 2) : Math.cos(t * Math.PI / 2); } return a; }
    function cerrarPase() {
      if (!P.trans) return;
      const v = P.ranuras[P.trans.vieja]; if (v && P.ranuras.indexOf(v) !== P.activa) { fijarGanancia(v, 1); soltar(v); }
      P.trans = null;
    }
    function alTerminar(r, d) { r.el.onended = () => { if (P.id === d.id && P.ranuras[P.activa] === r && !P.trans) terminoNatural(); }; }
    function mediaSesion(d) {
      if (!('mediaSession' in navigator)) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: d.titulo, artist: [d.bioma, d.lugar].filter(Boolean).join(' · '), album: P.ctx ? P.ctx.nombre : 'Macrodeck' });
        navigator.mediaSession.setActionHandler('play', () => api.pausaSeguir()); navigator.mediaSession.setActionHandler('pause', () => api.pausaSeguir());
        navigator.mediaSession.setActionHandler('nexttrack', () => api.siguiente(true)); navigator.mediaSession.setActionHandler('previoustrack', () => api.anterior());
      } catch (e) {}
    }

    // Empieza 'd' YA. Si algo estaba sonando y 'seg' > 0, lo mezcla con fundido; si no, arranca limpio (con 'entrada' segundos de fundido de entrada, si se pide).
    // 'desde' = segundo donde entra.
    async function empezar(d, desde, seg, entrada) {
      cerrarPase();
      P.apagando = false;
      const vieja = P.activa, sonandoAlgo = P.id && P.ranuras[vieja] && !P.ranuras[vieja].el.paused;
      if (!sonandoAlgo || !(seg > 0)) {
        const r = await ranura(P.activa);
        if (!(await cargar(r, d, desde))) { Au.aviso('«' + d.titulo + '» no está bajado todavía.'); return false; }
        if (entrada > 0) {                                                   // fundido de entrada desde el silencio (teclas Ambiente)
          const t = r.g.context.currentTime;
          r.g.gain.cancelScheduledValues(t); r.g.gain.setValueAtTime(0, t); r.g.gain.setValueCurveAtTime(curva(true), t, entrada);
        } else fijarGanancia(r, 1);
        if (P.id && P.id !== d.id) P.hist.push(P.id);
        P.id = d.id; alTerminar(r, d);
        try { await r.el.play(); } catch (e) { Au.aviso('No se pudo reproducir: ' + (e.message || e)); }
      } else {
        const nueva = 1 - vieja, rn = await ranura(nueva), rv = P.ranuras[vieja];
        if (!(await cargar(rn, d, desde))) { Au.aviso('«' + d.titulo + '» no está bajado todavía.'); return false; }
        const t = rn.g.context.currentTime;
        rn.g.gain.cancelScheduledValues(t); rn.g.gain.setValueAtTime(0, t); rn.g.gain.setValueCurveAtTime(curva(true), t, seg);
        rv.g.gain.cancelScheduledValues(t); rv.g.gain.setValueAtTime(1, t); rv.g.gain.setValueCurveAtTime(curva(false), t, seg);
        rv.el.onended = null;
        try { await rn.el.play(); } catch (e) { Au.aviso('No se pudo reproducir: ' + (e.message || e)); }
        if (P.id && P.id !== d.id) P.hist.push(P.id);
        P.activa = nueva; P.id = d.id; P.trans = { vieja, hasta: Date.now() + seg * 1000 + 150 };
        alTerminar(rn, d);
      }
      if (P.hist.length > 60) P.hist.shift();
      P.jugados.add(d.id); Au.registrarReciente(d.id);
      mediaSesion(d); emitir(); Au.pintar();
      return true;
    }
    api.empezar = empezar;

    // ---------------- que sigue ----------------
    // Un audio "parecido": del mismo bioma y lugar, de energia cercana, entre los bajados y que no hayan sonado hace poco.
    function parecido(base) {
      base = base || Au.dePorId(P.id);
      let c = S.cat.filter((x) => Au.bajado(x.id) && (!base || x.id !== base.id));
      if (!c.length) return null;
      if (base && base.tipo) { const mt = c.filter((x) => x.tipo === base.tipo); if (mt.length) c = mt; }       // la musica sigue con musica y el ambiente con ambiente
      if (base) {
        const bio = c.filter((x) => x.bioma === base.bioma);
        if (bio.length) {
          c = bio;
          const lug = c.filter((x) => x.lugar === base.lugar); if (lug.length) c = lug;
          if (base.energia) { const en = c.filter((x) => x.energia && Math.abs(x.energia - base.energia) <= 1); if (en.length) c = en; }
        }
      }
      const sinRec = c.filter((x) => !Au.esReciente(x.id)); if (sinRec.length) c = sinRec;     // primero lo parecido, y dentro de eso, lo que no sono hace poco
      return c[Math.floor(Math.random() * c.length)];
    }
    api.parecido = parecido;
    function azarDeLista(c) {
      let ids = c.ids.filter((id) => id !== P.id && Au.bajado(id));
      if (!ids.length) return null;
      let nuevos = ids.filter((id) => !P.jugados.has(id));
      if (!nuevos.length) { c.ids.forEach((id) => P.jugados.delete(id)); P.jugados.add(P.id); nuevos = ids; }
      const sinRec = nuevos.filter((id) => !Au.esReciente(id)); if (sinRec.length) nuevos = sinRec;
      return nuevos[Math.floor(Math.random() * nuevos.length)];
    }
    const repetirDe = (c) => (c && c.repetir) || pr.repetir;                   // una tecla Ambiente fuerza 'uno' en su contexto
    // Saca (consume) el siguiente audio: primero lo de la cola, despues la lista, y si se acaba, "parecido" (si esta prendido).
    function tomarSiguiente() {
      while (P.cola.length) { const id = P.cola.shift(); const d = Au.dePorId(id); if (d && Au.bajado(id)) return d; }
      const c = P.ctx;
      if (c && c.ids.length) {
        if (repetirDe(c) === 'uno' && P.id) return Au.dePorId(P.id);
        const azar = c.azar != null ? c.azar : pr.azar;
        if (azar) { const id = azarDeLista(c); if (id) { c.pos = c.ids.indexOf(id); return Au.dePorId(id); } }
        else {
          for (let k = 1; k <= c.ids.length; k++) {
            let pos = c.pos + k;
            if (pos >= c.ids.length) { if (repetirDe(c) === 'lista') pos %= c.ids.length; else break; }
            if (Au.bajado(c.ids[pos]) && c.ids[pos] !== P.id) { c.pos = pos; return Au.dePorId(c.ids[pos]); }
            if (repetirDe(c) === 'lista' && c.ids.length === 1 && Au.bajado(c.ids[0])) return Au.dePorId(c.ids[0]);
          }
        }
      }
      return pr.inteligente || (c && c.parecido) ? parecido() : null;
    }
    // El que SIGUE (sin consumirlo), para mostrarlo en pantalla.
    api.proximo = () => {
      for (const id of P.cola) { const d = Au.dePorId(id); if (d && Au.bajado(id)) return d; }
      const c = P.ctx;
      if (c && c.ids.length) {
        if (repetirDe(c) === 'uno' && P.id) return Au.dePorId(P.id);
        if ((c.azar != null ? c.azar : pr.azar)) return null;                // al azar: no se sabe todavia
        for (let k = 1; k <= c.ids.length; k++) {
          let pos = c.pos + k;
          if (pos >= c.ids.length) { if (repetirDe(c) === 'lista') pos %= c.ids.length; else break; }
          if (Au.bajado(c.ids[pos]) && c.ids[pos] !== P.id) return Au.dePorId(c.ids[pos]);
        }
      }
      return null;
    };
    const faltaPara = (c) => (c && isFinite(c.fundido)) ? c.fundido : pr.fundido;
    const saltoIntro = (d, c) => { const n = c ? c.intro : pr.intro; return (n > 0 && (d.duracion_s || 0) > n + 60) ? n : 0; };

    // Cuando termina un audio sin pase (era muy corto, o el fundido es 0): sigue el que toque.
    async function terminoNatural() {
      const sig = tomarSiguiente();
      if (!sig) { api.detener(); return; }
      await empezar(sig, saltoIntro(sig, P.ctx), 0);
    }
    async function pasar() {
      if (P.pasoEnCurso) return;
      P.pasoEnCurso = true;
      try {
        const sig = tomarSiguiente();
        if (!sig) return;
        await empezar(sig, saltoIntro(sig, P.ctx), faltaPara(P.ctx));
      } finally { P.pasoEnCurso = false; }
    }
    // Vigila el tiempo: cierra el pase que termino y arranca el pase cuando al que suena le quedan 'fundido' segundos.
    api.vigilar = function () {
      const r = actual();
      if (!r || !P.id) return;
      if (P.trans && Date.now() >= P.trans.hasta) { cerrarPase(); emitir(); }
      if (P.trans || P.apagando || P.pasoEnCurso || r.el.paused) return;
      const dd = r.el.duration, f = faltaPara(P.ctx);
      if (!isFinite(dd) || f <= 0 || dd < f * 2 + 10) return;                  // muy corto para mezclar: sigue cuando termina
      if (dd - r.el.currentTime <= f + 0.25) pasar();
    };

    // ---------------- acciones ----------------
    function contexto(nombre, ids, pos, extra) { P.ctx = Object.assign({ nombre, ids, pos, listaId: null, fundido: pr.fundido, intro: pr.intro }, extra || {}); P.jugados = new Set(); }
    // Un audio de la biblioteca: la "lista" para seguir es lo que se ve en pantalla (solo lo bajado).
    api.reproducirUno = async (d, idsVisibles) => {
      const ids = (idsVisibles || [d.id]).filter((id) => Au.bajado(id)), pos = Math.max(0, ids.indexOf(d.id));
      contexto('Biblioteca', ids, pos);
      return empezar(d, 0, P.id ? 2 : 0);
    };
    // Un ambiente que se prende desde una TECLA: se repite solo (pase consigo mismo) y entra con fundido desde el silencio.
    api.ambienteTecla = async (d, entrada) => {
      contexto('Ambiente', [d.id], 0, { repetir: 'uno', intro: 0, fundido: Math.min(pr.fundido || 10, 10) || 10, deTecla: true });
      return empezar(d, 0, P.id ? Math.max(1, entrada || 1) : 0, entrada);
    };
    api.reproducirLista = async (lista, opc) => {
      opc = opc || {};
      const ids = Au.idsDeLista(lista), buenos = ids.filter((id) => Au.bajado(id));
      if (!ids.length) { Au.aviso('La lista «' + lista.nombre + '» está vacía.'); return false; }
      if (!buenos.length) { Au.aviso('Ningún audio de «' + lista.nombre + '» está bajado todavía.'); return false; }
      const azar = opc.azar != null ? !!opc.azar : null;
      contexto(lista.nombre, ids, 0, { listaId: lista.id, fundido: lista.fundido, intro: lista.intro, azar });
      let d;
      if (opc.desde != null && Au.bajado(ids[opc.desde])) d = Au.dePorId(ids[opc.desde]);
      else if ((azar != null ? azar : pr.azar)) d = Au.dePorId(buenos[Math.floor(Math.random() * buenos.length)]);
      else d = Au.dePorId(buenos[0]);
      P.ctx.pos = ids.indexOf(d.id);
      return empezar(d, 0, P.id ? Math.min(4, lista.fundido || 4) : 0);
    };
    api.siguiente = async (manual) => {
      const sig = tomarSiguiente();
      if (!sig) { if (manual) Au.aviso('No hay más audios para seguir.'); return; }
      if (manual) await empezar(sig, 0, 1.5);
      else await empezar(sig, saltoIntro(sig, P.ctx), faltaPara(P.ctx));
    };
    api.anterior = async () => {
      const r = actual(); if (!r || !P.id) return;
      if (r.el.currentTime > 4 || !P.hist.length) { try { r.el.currentTime = 0; } catch (e) {} return; }
      const id = P.hist.pop(), d = Au.dePorId(id);
      if (!d) return;
      P.hist.pop();                                                              // empezar() vuelve a anotar el actual: se saca el duplicado
      if (P.ctx) { const i = P.ctx.ids.indexOf(id); if (i >= 0) P.ctx.pos = i; }
      await empezar(d, 0, 1.5);
    };
    api.pausaSeguir = () => {
      const r = actual(); if (!r || !P.id) return;
      const v = P.trans && P.ranuras[P.trans.vieja];
      if (r.el.paused) { r.el.play().catch(() => {}); if (v && v.el.src) v.el.play().catch(() => {}); } else { r.el.pause(); if (v) v.el.pause(); }
      emitir(); Au.pintar();
    };
    // Borra del equipo (NO de Drive) los audios bajados: frena lo que suene, saca de la cola y libera el espacio.
    api.liberar = (set) => {
      const vieja = P.trans && P.ranuras[P.trans.vieja];
      if ((P.id && set.has(P.id)) || (vieja && vieja.id && set.has(vieja.id))) api.detener();
      P.ranuras.forEach((r) => { if (r && r.id && set.has(r.id)) soltar(r); });
      P.cola = P.cola.filter((id) => !set.has(id));
    };
    api.detener = () => {
      P.apagando = false; cerrarPase();
      P.ranuras.forEach((r, i) => { if (r) { fijarGanancia(r, 1); soltar(r); } });
      P.id = null;                                                                // la lista y la cola quedan por si se vuelve a dar play
      emitir(); Au.pintar();
    };
    // Apagar suave: baja el volumen del que suena (y del que entra) a cero y para.
    api.apagarSuave = (seg) => {
      const r = actual(); if (!r || !P.id) return;
      seg = seg || 8; P.apagando = true;
      const t = r.g.context.currentTime;
      P.ranuras.forEach((x) => { if (x && x.el.src) { const g = x.g.gain; const v = g.value; g.cancelScheduledValues(t); g.setValueAtTime(v, t); g.linearRampToValueAtTime(0, t + seg); } });
      setTimeout(() => { if (P.apagando) api.detener(); }, seg * 1000 + 100);
      emitir();
    };
    api.saltarEnergia = async (min, max, seg) => {
      const d = Au.dePorId(P.id);
      let c = S.cat.filter((x) => Au.bajado(x.id) && x.energia >= min && x.energia <= max && (!d || x.id !== d.id));
      if (!c.length) { Au.aviso('No hay un audio E' + min + (max > min ? '–E' + max : '') + ' bajado' + (d ? ' de ' + d.bioma : '') + '.'); return false; }
      if (d) { const mismo = c.filter((x) => x.bioma === d.bioma); if (mismo.length) { c = mismo; const lug = c.filter((x) => x.lugar === d.lugar); if (lug.length) c = lug; } }
      const sinRec = c.filter((x) => !Au.esReciente(x.id)); if (sinRec.length) c = sinRec;
      return empezar(c[Math.floor(Math.random() * c.length)], 0, seg || 3);
    };
    api.cambiarEnergia = (dir) => { const d = Au.dePorId(P.id); if (!d || !d.energia) return; const o = d.energia + dir; if (o < 1 || o > 5) return; return api.saltarEnergia(o, o, 3); };
    api.parecidoAhora = async () => { const d = parecido(); if (!d) { Au.aviso('No hay otro audio bajado parecido.'); return; } await empezar(d, 0, 3); };
    api.seguirConParecido = (on) => { pr.inteligente = !!on; Au.guardarPrefs(); emitir(); };

    // cola
    api.alCola = (id, alFrente) => { if (!Au.bajado(id)) { Au.aviso('Ese audio todavía no está bajado.'); return false; } if (alFrente) P.cola.unshift(id); else P.cola.push(id); Au.aviso(alFrente ? 'Va primero en la cola.' : 'Agregado al final de la cola.'); emitir(); Au.pintar(); return true; };
    api.quitarDeCola = (i) => { P.cola.splice(i, 1); emitir(); };
    api.vaciarCola = () => { P.cola = []; emitir(); };
    api.moverCola = (de, a) => { if (a < 0 || a >= P.cola.length || de === a) return; const [x] = P.cola.splice(de, 1); P.cola.splice(a, 0, x); emitir(); };

    // Lo que se muestra: estado resumido del reproductor
    api.estado = () => { const r = actual(); return { carril: nombre, id: P.id, d: Au.dePorId(P.id), sonando: !!(r && P.id && !r.el.paused), t: r ? r.el.currentTime : 0, dur: r && isFinite(r.el.duration) ? r.el.duration : 0, pase: !!P.trans, apagando: !!P.apagando }; };
    return api;
  }

  carriles.musica = crearCarril('musica');
  carriles.ambiente = crearCarril('ambiente');
  const todos = () => [carriles.musica, carriles.ambiente];
  Au.carril = (n) => carriles[n || Au.foco] || carriles.musica;
  Au.pc = (n) => Au.carril(n).pr;                                               // preferencias (azar, repetir, volumen...) de un carril
  Au.estadoDe = (n) => Au.carril(n).estado();
  Au.carrilDe = (d) => (d && d.tipo === 'Ambiente') ? 'ambiente' : 'musica';    // a que carril va un audio, segun su tipo
  Au.suenaAhora = (id) => todos().some((c) => c.P.id === id);
  Au.enFoco = (n) => { if (carriles[n]) { Au.foco = n; emitir(); } };
  Object.defineProperty(Au, 'P', { get: () => Au.carril().P, configurable: true });

  // La API vieja: trabaja sobre el carril en foco.
  ['actual', 'setVol', 'empezar', 'parecido', 'proximo', 'siguiente', 'anterior', 'pausaSeguir', 'detener', 'apagarSuave', 'saltarEnergia', 'cambiarEnergia', 'parecidoAhora', 'seguirConParecido', 'alCola', 'quitarDeCola', 'vaciarCola', 'moverCola', 'estado']
    .forEach((k) => { Au[k] = (...a) => Au.carril()[k](...a); });
  // Reproducir un audio / una lista: el carril lo decide el TIPO (los ambientes van a su carril) y pasa a ser el que se ve.
  Au.reproducirUno = async (d, idsVisibles) => { const n = Au.carrilDe(d); Au.foco = n; return carriles[n].reproducirUno(d, idsVisibles); };
  Au.carrilDeLista = (lista) => {
    const ds = Au.idsDeLista(lista).slice(0, 12).map(Au.dePorId).filter(Boolean);
    return ds.length && ds.filter((d) => d.tipo === 'Ambiente').length * 2 > ds.length ? 'ambiente' : 'musica';
  };
  Au.reproducirLista = async (lista, opc) => { const n = (opc && opc.carril) || Au.carrilDeLista(lista); Au.foco = n; return carriles[n].reproducirLista(lista, opc); };
  Au.borrarDelEquipo = async (ids) => {
    const set = new Set((ids || []).filter((id) => Au.bajado(id)));
    if (!set.size) return 0;
    todos().forEach((c) => c.liberar(set));
    let n = 0;
    for (const id of set) { try { await MD.Almacen.borrarAudio(id); S.bajados.delete(id); n++; } catch (e) {} }
    Au.pintar();
    return n;
  };
  Au.detenerTodo = () => todos().forEach((c) => c.detener());

  // Al entrar a una escena: la musica de fondo (lista) va al carril de Musica y el ambiente de fondo (un audio de tipo Ambiente) al de Ambientes.
  Au.alEscena = (esc) => {
    if (!esc) return;
    if (esc.lista) {
      const l = Au.lista(esc.lista.id);
      if (!l) { Au.aviso('La lista de esta escena no está en este celu todavía (sincronizá en Drive).'); }
      else if (esc.lista.arranca === false) { carriles.musica.P.listaLista = l.id; emitir(); }
      else if (!(carriles.musica.P.ctx && carriles.musica.P.ctx.listaId === l.id && carriles.musica.P.id)) carriles.musica.reproducirLista(l, { azar: esc.lista.azar });     // si ya suena esa lista, no se reinicia
    }
    if (esc.ambiente && esc.ambiente.id) {
      const d = Au.dePorId(esc.ambiente.id);
      if (!d) Au.aviso('El ambiente de esta escena no está en el catálogo de este celu todavía (sincronizá).');
      else if (esc.ambiente.arranca === false) { /* queda listo: se prende con la tecla o desde Audios */ }
      else if (!Au.bajado(d.id)) Au.aviso('«' + d.titulo + '» (ambiente de la escena) no está bajado todavía.');
      else if (!(carriles.ambiente.P.id === d.id && !carriles.ambiente.P.apagando)) carriles.ambiente.ambienteTecla(d, 4);
    }
  };
  function enganchar(A) {
    const activar = A.activar;
    A.activar = function (i) {
      const r = activar.apply(this, arguments);
      try { Au.alEscena(A.cfg.escenas[i]); } catch (e) {}
      return r;
    };
  }
  let timer = 0;
  function iniciar() { if (!timer) timer = setInterval(() => { todos().forEach((c) => { try { c.vigilar(); } catch (e) {} }); }, 250); }
  Au.motor = { iniciar, enganchar, reproducirUno: (d) => Au.reproducirUno(d) };
})(window.MD);
