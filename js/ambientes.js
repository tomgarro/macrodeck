// ambientes.js - Teclas de tipo "Ambiente (de Audios)": prenden un audio de tipo Ambiente de la pestana Audios como un loop con fundido de entrada y salida.
// Un toque lo prende, otro toque lo apaga. Por defecto REEMPLAZA al ambiente que suena (mezcla con fundido en el carril de Ambientes);
// con "sumar" suena ENCIMA de los demas (por ejemplo lluvia + taberna), con su propio fundido.
// Todo sale por el carril de Ambientes, asi que el volumen de ese carril (en Audios) los regula a todos.
window.MD = window.MD || {};
(function (MD) {
  const sumados = new Map();            // numero de tecla -> { el, g, url, id }
  let dueno = null;                     // tecla que tiene prendido el ambiente del carril (null = ninguna)
  let motorRef = null;
  const carril = () => MD.Au && MD.Au.carriles && MD.Au.carriles.ambiente;
  const aviso = (t) => { try { if (MD.Au) MD.Au.aviso(t); } catch (e) {} };

  function marcar() {                   // deja el estado "prendido" de las teclas igual a lo que de verdad suena
    if (!motorRef) return;
    const c = carril();
    motorRef.estadoTecla.forEach((e, i) => {
      const t = motorRef.teclas[i];
      if (!t || t.tipo !== 'ambiente') return;
      e.loop = sumados.has(i) || (dueno === i && !!c && !!c.P.id && !c.P.apagando);
    });
    if (dueno != null && (!c || !c.P.id)) dueno = null;
    try { motorRef.onCambio(); } catch (e) {}
  }
  function curva(sube) { const n = 64, a = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / (n - 1); a[i] = sube ? Math.sin(t * Math.PI / 2) : Math.cos(t * Math.PI / 2); } return a; }

  async function sumar(m, i, t, d, entrada) {
    const c = carril(), salida = await c.salida();
    const reg = await MD.Almacen.leerAudio(d.id);
    if (!reg) { aviso('«' + d.titulo + '» no está bajado todavía.'); return false; }
    const el = new Audio(); el.loop = true; el.preload = 'auto';
    const url = URL.createObjectURL(reg.blob); el.src = url;
    const g = m.ctx.createGain(), gk = m.ctx.createGain(); gk.gain.value = t.volumen == null ? 1 : t.volumen;      // 2.0-dev9: 'gk' = fader de la tecla en el Mezclador
    m.ctx.createMediaElementSource(el).connect(g); g.connect(gk); gk.connect(salida);
    const now = m.ctx.currentTime; g.gain.setValueAtTime(0, now); if (entrada > 0) g.gain.setValueCurveAtTime(curva(true), now, entrada); else g.gain.setValueAtTime(1, now);
    try { await el.play(); } catch (e) { aviso('No se pudo reproducir: ' + (e.message || e)); URL.revokeObjectURL(url); return false; }
    sumados.set(i, { el, g, gk, url, id: d.id });
    return true;
  }
  function soltarSumado(i, seg) {
    const x = sumados.get(i); if (!x) return;
    sumados.delete(i);
    const fin = () => { try { x.el.pause(); x.el.removeAttribute('src'); x.el.load(); } catch (e) {} URL.revokeObjectURL(x.url); try { x.gk.disconnect(); } catch (e) {} marcar(); };
    if (seg > 0.05) { const now = x.g.context.currentTime; x.g.gain.cancelScheduledValues(now); x.g.gain.setValueAtTime(x.g.gain.value, now); x.g.gain.linearRampToValueAtTime(0, now + seg); setTimeout(fin, seg * 1000 + 80); } else fin();
  }

  // 2.0-dev11: pausa / seguir CON FUNDIDO de un ambiente "sumado" (suena encima de los demas, fuera del carril)
  function pausarSumado(x, seg) {
    if (x.pausado) return false;
    x.pausado = true; seg = seg > 0 ? seg : 0.4;
    const n = x.g.context.currentTime; x.g.gain.cancelScheduledValues(n); x.g.gain.setValueAtTime(Math.max(x.g.gain.value, 0.0001), n); x.g.gain.linearRampToValueAtTime(0.0001, n + seg);
    clearTimeout(x.tp); x.tp = setTimeout(() => { if (x.pausado) { try { x.el.pause(); } catch (e) {} } }, seg * 1000 + 30);
    return true;
  }
  function seguirSumado(x, seg) {
    if (!x.pausado) return false;
    x.pausado = false; seg = seg > 0 ? seg : 0.4; clearTimeout(x.tp);
    const n = x.g.context.currentTime; x.g.gain.cancelScheduledValues(n); x.g.gain.setValueAtTime(x.el.paused ? 0.0001 : Math.max(x.g.gain.value, 0.0001), n); x.g.gain.linearRampToValueAtTime(1, n + seg);
    if (x.el.paused) x.el.play().catch(() => {});
    return true;
  }

  const Amb = {
    // 'soloIniciar' (2.0-dev11): lo usan los gestos, que ya decidieron que hay que ARRANCAR (el segundo toque ya no apaga: pausa).
    async tecla(m, i, t, e, soloIniciar) {
      motorRef = m;
      const Au = MD.Au, c = carril();
      if (!Au || !c) return;
      const entrada = t.entrada > 0 ? t.entrada : 3, salida = t.salida > 0 ? t.salida : 3;
      // segundo toque: apaga (sin gestos)
      if (!soloIniciar) {
        if (sumados.has(i)) { soltarSumado(i, salida); e.loop = false; marcar(); return; }
        if (dueno === i && c.P.id && !c.P.apagando) { c.apagarSuave(salida); dueno = null; e.loop = false; marcar(); return; }
      }
      // 2.0-dev11: una tecla Ambiente puede traer una LISTA de ambientes (en vez de un solo audio): suena en el carril de Ambientes y da la vuelta
      if (t.lista) {
        const l = Au.lista(t.lista);
        if (!l) { aviso('La lista de esta tecla no está en este celu todavía (sincronizá en Drive).'); return; }
        await m.iniciar();
        const viejo = dueno; dueno = i;
        if (await c.reproducirLista(l, { azar: !!t.azarLista, entrada, origen: 'tecla', factor: t.volumen == null ? 1 : t.volumen })) { e.loop = true; if (viejo != null && viejo !== i && m.estadoTecla[viejo]) m.estadoTecla[viejo].loop = false; }
        else dueno = viejo;
        marcar(); return;
      }
      const d = Au.dePorId(t.audio);
      if (!d) { aviso(t.audio ? 'Este ambiente no está en el catálogo de este celu todavía (sincronizá).' : 'La tecla no tiene ambiente elegido.'); return; }
      if (!Au.bajado(d.id)) { aviso('«' + d.titulo + '» no está bajado todavía.'); return; }
      await m.iniciar();
      if (t.sumar) { if (await sumar(m, i, t, d, entrada)) e.loop = true; }
      else {
        const viejo = dueno; dueno = i;
        if (await c.ambienteTecla(d, entrada, { origen: 'tecla', factor: t.volumen == null ? 1 : t.volumen })) { e.loop = true; if (viejo != null && viejo !== i && m.estadoTecla[viejo]) m.estadoTecla[viejo].loop = false; }
        else dueno = viejo;
      }
      marcar();
    },
    // ---- 2.0-dev8: teclas de MUSICA (carril de Musica de Audios). El estado se lee directo del carril: no hace falta anotar nada. ----
    musicaActiva(t) {
      const c = MD.Au && MD.Au.carriles && MD.Au.carriles.musica, l = c && t && t.lista && MD.Au.lista(t.lista);
      return !!(c && l && c.P.id && !c.P.apagando && c.P.ctx && c.P.ctx.listaId === l.id);
    },
    musicaPausada() { const c = MD.Au && MD.Au.carriles && MD.Au.carriles.musica; return !!(c && c.P.id && !c.P.apagando && c.estado().sonando === false); },
    // Un toque: arranca su lista (reemplaza la musica que suene, con fundido). Otro toque con esa lista sonando: la apaga con fundido de salida.
    async musicaTecla(m, i, t, e, soloIniciar) {
      motorRef = m;
      const Au = MD.Au, c = Au && Au.carriles && Au.carriles.musica;
      if (!Au || !c) return;
      const l = t.lista && Au.lista(t.lista);
      if (!l) { aviso(t.lista ? 'La lista de esta tecla no está en este celu todavía (sincronizá en Drive).' : 'La tecla no tiene lista elegida.'); return; }
      if (!soloIniciar && Amb.musicaActiva(t)) { c.apagarSuave(t.salida > 0 ? t.salida : 3); return; }
      await m.iniciar();
      await c.reproducirLista(l, { azar: !!t.azarLista, entrada: t.entrada > 0 ? t.entrada : 3, origen: 'tecla', factor: t.volumen == null ? 1 : t.volumen });
    },
    // ---- 2.0-dev11: lo que usan los GESTOS (gestos.js): toque = play/pausa, doble = siguiente, triple = anterior ----
    // 'sonando' | 'pausa' | 'apagado' (de LO QUE ESA TECLA prendio)
    estadoKey(i, t) {
      const Au = MD.Au; if (!Au || !Au.carriles || !t) return 'apagado';
      if (t.tipo === 'musica') { const c = Au.carriles.musica; return Amb.musicaActiva(t) ? (c.pausado() ? 'pausa' : 'sonando') : 'apagado'; }
      if (t.tipo === 'ambiente') {
        const x = sumados.get(i); if (x) return x.pausado ? 'pausa' : 'sonando';
        const c = carril(); if (dueno === i && c && c.P.id && !c.P.apagando) return c.pausado() ? 'pausa' : 'sonando';
      }
      return 'apagado';
    },
    pausar(i, t, seg) {
      const Au = MD.Au; if (!Au || !Au.carriles) return false;
      if (t.tipo === 'ambiente' && sumados.has(i)) return pausarSumado(sumados.get(i), seg);
      return (t.tipo === 'musica' ? Au.carriles.musica : carril()).pausaSuave(seg);
    },
    seguir(i, t, seg) {
      const Au = MD.Au; if (!Au || !Au.carriles) return false;
      if (t.tipo === 'ambiente' && sumados.has(i)) return seguirSumado(sumados.get(i), seg);
      return (t.tipo === 'musica' ? Au.carriles.musica : carril()).seguirSuave(seg);
    },
    // Un toque. Devuelve { accion: 'play' | 'pausa' | 'sigue', deshacer }. 'deshacer' es null si ARRANCO (un doble toque sobre una tecla apagada la arranca y salta).
    async toggle(m, i, t, e, seg) {
      motorRef = m;
      const st = Amb.estadoKey(i, t);
      if (st === 'apagado') { if (t.tipo === 'musica') await Amb.musicaTecla(m, i, t, e, true); else await Amb.tecla(m, i, t, e, true); marcar(); return { accion: 'play', deshacer: null }; }
      if (st === 'sonando') { Amb.pausar(i, t, seg); marcar(); return { accion: 'pausa', deshacer: () => { Amb.seguir(i, t, seg); marcar(); } }; }
      Amb.seguir(i, t, seg); marcar();
      return { accion: 'sigue', deshacer: () => { Amb.pausar(i, t, seg); marcar(); } };
    },
    // Doble toque: siguiente tema. Triple: anterior. Devuelven false si no habia nada que hacer (no pasa nada).
    _carrilDe(i, t) { const Au = MD.Au; if (!Au || !Au.carriles) return null; if (t.tipo === 'ambiente' && sumados.has(i)) return null; return t.tipo === 'musica' ? Au.carriles.musica : carril(); },
    siguiente(i, t) {
      const c = Amb._carrilDe(i, t);
      if (!c || Amb.estadoKey(i, t) === 'apagado' || !c.haySiguiente()) return false;
      c.siguiente(true); return true;
    },
    anterior(i, t) {
      const c = Amb._carrilDe(i, t);
      if (!c || Amb.estadoKey(i, t) === 'apagado' || !c.haySiguiente()) return false;
      c.anterior(); return true;
    },
    // Titulo de lo que suena en el carril de esa tecla (para la OLED)
    titulo(i, t) {
      const Au = MD.Au, c = Amb._carrilDe(i, t); if (!c || !c.P.id) return '';
      const d = Au.dePorId(c.P.id); return d ? d.titulo : '';
    },
    // 2.0-dev9: el fader de una tecla Ambiente o Musica mueve, en vivo, el volumen de LO QUE ESA TECLA prendio.
    volTecla(i, t, v) {
      const Au = MD.Au; if (!Au || !Au.carriles) return;
      if (t.tipo === 'ambiente') {
        const x = sumados.get(i);
        if (x) { const n = x.gk.context.currentTime; x.gk.gain.cancelScheduledValues(n); x.gk.gain.setTargetAtTime(v, n, 0.04); }
        else if (dueno === i && Au.carriles.ambiente.P.id) Au.carriles.ambiente.setFactor(v);
      } else if (t.tipo === 'musica' && Amb.musicaActiva(t)) Au.carriles.musica.setFactor(v);
    },
    // 'musica_sig' = siguiente tema, 'musica_pausa' = pausa / seguir.
    musicaControl(tipo) {
      const Au = MD.Au, c = Au && Au.carriles && Au.carriles.musica;
      if (!c) return;
      if (!c.P.id) { aviso('No hay música sonando.'); return; }
      if (tipo === 'musica_sig') c.siguiente(true); else c.pausaSeguir();
    },
    // Apaga con fundido todo lo que prendieron las teclas (pausa general / "apagar todo").
    apagarDeTeclas(seg) {
      seg = seg > 0 ? seg : 0.05;
      [...sumados.keys()].forEach((i) => soltarSumado(i, seg));
      const c = carril();
      if (dueno != null && c && c.P.id) { dueno = null; if (seg > 0.2) c.apagarSuave(seg); else c.detener(); }
      dueno = null; marcar();
    },
  };
  MD.Ambientes = Amb;
  const arrancar = () => { if (MD.Au && MD.Au.alCambiar) MD.Au.alCambiar(() => { if (motorRef) marcar(); }); };
  if (MD.Au && MD.Au.alCambiar) arrancar(); else window.addEventListener('DOMContentLoaded', arrancar);
})(window.MD);
