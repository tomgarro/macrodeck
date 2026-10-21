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
    const g = m.ctx.createGain(); m.ctx.createMediaElementSource(el).connect(g); g.connect(salida);
    const now = m.ctx.currentTime; g.gain.setValueAtTime(0, now); if (entrada > 0) g.gain.setValueCurveAtTime(curva(true), now, entrada); else g.gain.setValueAtTime(1, now);
    try { await el.play(); } catch (e) { aviso('No se pudo reproducir: ' + (e.message || e)); URL.revokeObjectURL(url); return false; }
    sumados.set(i, { el, g, url, id: d.id });
    return true;
  }
  function soltarSumado(i, seg) {
    const x = sumados.get(i); if (!x) return;
    sumados.delete(i);
    const fin = () => { try { x.el.pause(); x.el.removeAttribute('src'); x.el.load(); } catch (e) {} URL.revokeObjectURL(x.url); marcar(); };
    if (seg > 0.05) { const now = x.g.context.currentTime; x.g.gain.cancelScheduledValues(now); x.g.gain.setValueAtTime(x.g.gain.value, now); x.g.gain.linearRampToValueAtTime(0, now + seg); setTimeout(fin, seg * 1000 + 80); } else fin();
  }

  const Amb = {
    async tecla(m, i, t, e) {
      motorRef = m;
      const Au = MD.Au, c = carril();
      if (!Au || !c) return;
      const entrada = t.entrada > 0 ? t.entrada : 3, salida = t.salida > 0 ? t.salida : 3;
      // segundo toque: apaga
      if (sumados.has(i)) { soltarSumado(i, salida); e.loop = false; marcar(); return; }
      if (dueno === i && c.P.id && !c.P.apagando) { c.apagarSuave(salida); dueno = null; e.loop = false; marcar(); return; }
      const d = Au.dePorId(t.audio);
      if (!d) { aviso(t.audio ? 'Este ambiente no está en el catálogo de este celu todavía (sincronizá).' : 'La tecla no tiene ambiente elegido.'); return; }
      if (!Au.bajado(d.id)) { aviso('«' + d.titulo + '» no está bajado todavía.'); return; }
      await m.iniciar();
      if (t.sumar) { if (await sumar(m, i, t, d, entrada)) e.loop = true; }
      else {
        const viejo = dueno; dueno = i;
        if (await c.ambienteTecla(d, entrada)) { e.loop = true; if (viejo != null && viejo !== i && m.estadoTecla[viejo]) m.estadoTecla[viejo].loop = false; }
        else dueno = viejo;
      }
      marcar();
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
