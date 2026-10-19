// audio.js - El motor de sonido: varios sonidos a la vez (polifonia), loops con fundidos, intro + loop, azar, mantener, secuencias.
// Todo pasa por Web Audio: cada sonido tiene su "perilla" de volumen (gain), y todos van a un volumen general (el de la
// perilla del Macrodeck) y a un limitador suave para que muchos sonidos juntos no saturen.
window.MD = window.MD || {};
(function (MD) {
  const MAX_VOCES = 24;
  // v1.3-dev8: el ducking tiene 3 modos (se elige en Herramientas, solo en el APK). 'antes' = ms que se ESPERA entre pedirle a Android que baje la
  // musica y arrancar el sonido (asi el sonido ya entra con la musica abajo). 'cola' = ms que la musica sigue abajo DESPUES de que termina el ultimo
  // sonido (evita que "bombee" entre toques seguidos). Antes de dev8 era antes=0 y cola=700.
  const DUCK_MODOS = {
    agil:   { nombre: 'Agil',   antes: 60,  cola: 250, ayuda: 'La musica baja casi al instante y vuelve rapido. Puede "bombear" si tocas muchas teclas seguidas.' },
    normal: { nombre: 'Normal', antes: 120, cola: 450, ayuda: 'Punto medio (recomendado para empezar).' },
    suave:  { nombre: 'Suave',  antes: 180, cola: 900, ayuda: 'La musica tarda mas en volver: ideal si tocas varias teclas seguidas.' },
  };
  MD.DUCK_MODOS = DUCK_MODOS;
  const UMBRAL_STREAMING = 6 * 1024 * 1024;       // archivos mas grandes que esto se reproducen "en directo" (sin decodificar todo a la vez)
  const PRESUPUESTO_BUFFERS = 160 * 1024 * 1024;  // memoria maxima de sonidos ya decodificados
  // 1.3-dev20: INTENSIDAD de un loop (niveles 1 a 5). El nivel 5 es el volumen de siempre; los demas lo bajan (y las luces, a la vez, en el servidor).
  const FACTOR_NIVEL = [0.25, 0.45, 0.65, 0.85, 1];

  class Motor {
    constructor() {
      this.ctx = null; this.master = null; this.silenciado = false; this.volGeneral = 0.5; this.volMax = 0.9;
      this.buffers = new Map();       // id -> {buffer, bytes, uso}
      this.urls = new Map();          // id -> url (streaming)
      this.regs = new Map();          // id -> registro del almacen {blob,nombre,tipo}
      this.teclas = Array.from({ length: 10 }, () => null);
      this.estadoTecla = Array.from({ length: 10 }, () => this._estadoNuevo());
      this.voces = new Set();
      this.onCambio = () => {};
      this.log = [];                  // para pruebas
      this.sonidos = new Map();       // id -> {id,nombre,volumen}
      // DUCKING (v1.3): las teclas con ducking piden "bajar la musica de otras apps" mientras suenan. Aca solo se lleva la cuenta y se avisa
      // por onDuck(true/false); quien baja la musica de verdad es la app Android (MD.Nativo.duck). En el navegador no hay forma de hacerlo.
      this.duckN = 0; this.duckActivo = false; this.duckTimer = null; this.onDuck = () => {}; this.duckModo = 'normal';
      // INTENSIDAD (1.3-dev20): la tecla "Intensidad" regula el ULTIMO loop que se prendio. seqLoops numera los loops en el orden en que se prenden;
      // nivelInicial(i, tecla) = de que nivel parte un loop que todavia no se toco (lo pone luces_dnd.js: la intensidad del look); onNivel(i, n, tecla)
      // avisa que el nivel cambio (luces_dnd.js se lo pasa al servidor de luces); avisoNivel = ultimo aviso para mostrar en pantalla.
      this.seqLoops = 0; this.nivelInicial = () => 5; this.onNivel = () => {}; this.avisoNivel = null;
    }
    fijarDuckModo(m) { if (DUCK_MODOS[m]) this.duckModo = m; }
    _duck() { return DUCK_MODOS[this.duckModo] || DUCK_MODOS.normal; }
    _duckMas() {
      this.duckN++;
      if (this.duckTimer) { clearTimeout(this.duckTimer); this.duckTimer = null; }
      if (!this.duckActivo) { this.duckActivo = true; try { this.onDuck(true); } catch (e) {} }
    }
    _duckMenos() {
      this.duckN = Math.max(0, this.duckN - 1);
      if (this.duckN === 0 && this.duckActivo && !this.duckTimer) {
        this.duckTimer = setTimeout(() => { this.duckTimer = null; if (this.duckN === 0 && this.duckActivo) { this.duckActivo = false; try { this.onDuck(false); } catch (e) {} } }, this._duck().cola);
      }
    }
    _estadoNuevo() { return { voces: new Set(), loop: false, abajo: false, sec: 0, bolsa: [], ultimo: -1, flashHasta: 0, azarHasta: 0, nivel: 0, seq: 0 }; }

    async iniciar() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC({ latencyHint: 'interactive' });
        this.ctx.onstatechange = () => { try { if (MD.Diag) MD.Diag.anotar('audio ' + this.ctx.state); } catch (e) {} };
        this.master = this.ctx.createGain();
        this.limitador = this.ctx.createDynamicsCompressor();
        this.limitador.threshold.value = -8; this.limitador.knee.value = 10; this.limitador.ratio.value = 8; this.limitador.attack.value = 0.003; this.limitador.release.value = 0.2;
        this.master.connect(this.limitador); this.limitador.connect(this.ctx.destination);
        this._aplicarMaster(true);
      }
      if (this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch (e) {} }
    }
    // El volumen general viene de la perilla (0..1). Curva cuadratica: mas fina en volumenes bajos. Con tope (volMax) y arranque suave.
    fijarVolumen(v01) { this.volGeneral = Math.min(1, Math.max(0, v01)); this._aplicarMaster(false); }
    fijarTope(v) { this.volMax = v; this._aplicarMaster(false); }
    _aplicarMaster(inmediato) {
      if (!this.master) return;
      const g = this.silenciado ? 0 : this.volMax * this.volGeneral * this.volGeneral;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      if (inmediato) this.master.gain.setValueAtTime(g, t); else this.master.gain.setTargetAtTime(g, t, 0.04);
    }
    alternarSilencio() { this.silenciado = !this.silenciado; this._aplicarMaster(false); this.onCambio(); return this.silenciado; }

    // ---- sonidos disponibles ----
    registrar(sonidos) { this.sonidos = new Map(sonidos.map(s => [s.id, s])); }
    async fijarArchivo(id, reg) {
      this.regs.set(id, reg);
      this.buffers.delete(id);
      if (this.urls.has(id)) { URL.revokeObjectURL(this.urls.get(id)); this.urls.delete(id); }
    }
    olvidarArchivo(id) { this.regs.delete(id); this.buffers.delete(id); if (this.urls.has(id)) { URL.revokeObjectURL(this.urls.get(id)); this.urls.delete(id); } }
    _streaming(id) { const r = this.regs.get(id); return !!r && r.blob.size > UMBRAL_STREAMING; }
    async _buffer(id) {
      const hit = this.buffers.get(id);
      if (hit) { hit.uso = performance.now(); return hit.buffer; }
      const reg = this.regs.get(id);
      if (!reg) return null;
      const datos = await reg.blob.arrayBuffer();
      let buf;
      try { buf = await this.ctx.decodeAudioData(datos); } catch (e) { this.log.push('error decodificando ' + id); return null; }
      const bytes = buf.length * buf.numberOfChannels * 4;
      this.buffers.set(id, { buffer: buf, bytes, uso: performance.now() });
      this._limpiarBuffers();
      return buf;
    }
    _limpiarBuffers() {
      let total = 0; this.buffers.forEach(b => total += b.bytes);
      if (total <= PRESUPUESTO_BUFFERS) return;
      const orden = [...this.buffers.entries()].sort((a, b) => a[1].uso - b[1].uso);
      for (const [id, b] of orden) { if (total <= PRESUPUESTO_BUFFERS) break; if ([...this.voces].some(v => v.sonidoId === id)) continue; this.buffers.delete(id); total -= b.bytes; }
    }
    // Decodifica de antemano los sonidos de las teclas (para que suenen sin demora al apretar)
    async precargar(teclas) {
      for (const t of teclas) {
        if (!t) continue;
        for (const id of t.sonidos || []) if (!this._streaming(id)) await this._buffer(id);
      }
    }
    fijarTeclas(teclas) {
      // al cambiar de escena: todo lo que sonaba se apaga con un fundido
      this.fadeoutTotal(1.2);
      this.teclas = teclas;
      this.estadoTecla = Array.from({ length: 10 }, () => this._estadoNuevo());
      this.onCambio();
    }

    // ---- voces ----
    async _crearVoz(idSonido, o) {
      if (!this.ctx) await this.iniciar();
      const meta = this.sonidos.get(idSonido);
      const volBase = (o.volumen == null ? 1 : o.volumen) * (meta ? meta.volumen : 1);
      const eNivel = o.tecla != null ? this.estadoTecla[o.tecla] : null;               // si el loop ya fue regulado, las voces nuevas (Intro + Loop) nacen en ese nivel
      const vol = volBase * (eNivel && eNivel.nivel ? this.factorNivel(eNivel.nivel) : 1);
      const g = this.ctx.createGain();
      g.connect(this.master);
      const t = this.ctx.currentTime;
      let fuente = null, el = null;
      // v1.3-dev13: o.cuando = momento (reloj de Web Audio) en que tiene que EMPEZAR; se usa para encadenar intro + loop sin cortes
      const futuro = o.cuando && o.cuando > t + 0.02;
      const voz = { sonidoId: idSonido, tecla: o.tecla, gain: g, vol, volBase, loop: !!o.loop, fin: false, inicio: futuro ? o.cuando : t, parar: null };
      if (this._streaming(idSonido)) {
        if (!this.urls.has(idSonido)) this.urls.set(idSonido, URL.createObjectURL(this.regs.get(idSonido).blob));
        el = new Audio(this.urls.get(idSonido)); el.loop = !!o.loop; el.preservesPitch = false; el.playbackRate = o.rate || 1;
        fuente = this.ctx.createMediaElementSource(el); fuente.connect(g);
        el.onended = () => this._terminar(voz);
        voz.parar = () => { clearTimeout(voz.timer); try { el.pause(); } catch (e) {} fuente.disconnect(); this._terminar(voz); };
        if (futuro) {                                                // archivo grande (en directo): no se puede agendar con precision, se arranca con un temporizador
          voz.timer = setTimeout(() => { if (!voz.fin && !voz.apagando) el.play().catch(() => { this.log.push('no se pudo reproducir ' + idSonido); voz.parar(); }); }, (o.cuando - t) * 1000);
        } else {
          try { await el.play(); } catch (e) { this.log.push('no se pudo reproducir ' + idSonido); return null; }
        }
      } else {
        const buf = await this._buffer(idSonido);
        if (!buf) return null;
        const src = this.ctx.createBufferSource();
        src.buffer = buf; src.loop = !!o.loop; src.playbackRate.value = o.rate || 1;
        src.connect(g);
        src.onended = () => this._terminar(voz);
        voz.parar = () => { try { src.stop(); } catch (e) {} };
        src.start(futuro ? o.cuando : 0);
        voz.duracion = buf.duration / (o.rate || 1);
      }
      const ahora = voz.inicio;
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      if (o.entrada > 0.02) { g.gain.setValueAtTime(0.0001, ahora); g.gain.linearRampToValueAtTime(vol, ahora + o.entrada); }
      else g.gain.setValueAtTime(vol, ahora);
      this.voces.add(voz);
      if (o.ducking) { voz.duck = true; this._duckMas(); }
      if (o.tecla != null) this.estadoTecla[o.tecla].voces.add(voz);
      // demasiadas voces: se corta la mas vieja que no sea un loop
      if (this.voces.size > MAX_VOCES) { const vieja = [...this.voces].find(v => !v.loop && v !== voz); if (vieja) this._apagar(vieja, 0.05); }
      this.log.push('voz+ ' + idSonido);
      this.onCambio();
      return voz;
    }
    _terminar(voz) {
      if (voz.fin) return;
      voz.fin = true;
      if (voz.duck) { voz.duck = false; this._duckMenos(); }
      this.voces.delete(voz);
      if (voz.tecla != null) { const e = this.estadoTecla[voz.tecla]; e.voces.delete(voz); if (e.voces.size === 0 && e.loop) e.loop = false; }
      try { voz.gain.disconnect(); } catch (e) {}
      this.log.push('voz- ' + voz.sonidoId);
      this.onCambio();
    }
    _apagar(voz, fundido) {
      if (voz.fin || voz.apagando) return;
      voz.apagando = true;
      const t = this.ctx.currentTime;
      if (voz.inicio > t + 0.02) fundido = 0;                    // todavia no empezo (la parte "loop" de un Intro + Loop): se corta de una
      if (fundido > 0.03) {
        voz.gain.gain.cancelScheduledValues(t);
        voz.gain.gain.setValueAtTime(Math.max(voz.gain.gain.value, 0.0001), t);
        voz.gain.gain.linearRampToValueAtTime(0.0001, t + fundido);
        setTimeout(() => { if (!voz.fin) voz.parar && voz.parar(); }, fundido * 1000 + 60);
      } else voz.parar && voz.parar();
    }

    // ---- teclas ----
    async tecla(i, abajo) {
      const t = this.teclas[i];
      if (!t) return;
      if (!this.ctx) await this.iniciar();
      const e = this.estadoTecla[i];
      e.abajo = abajo;
      if (!abajo) { this._soltar(i, t, e); return; }
      this.log.push('tecla ' + i + ' ' + t.tipo);
      // v1.3-dev8: si la tecla tiene ducking y la musica todavia esta arriba, se pide el ducking ANTES y el sonido arranca unos ms despues.
      // La "reserva" cubre ese hueco y se suelta al final (el sonido ya cuenta por su cuenta en _crearVoz).
      let reserva = false;
      if (t.ducking && t.tipo !== 'silenciar' && t.tipo !== 'fadeout' && !this.duckActivo) {
        reserva = true; this._duckMas();
        const ms = this._duck().antes;
        if (ms > 0) await new Promise(r => setTimeout(r, ms));
      }
      try {
      switch (t.tipo) {
        case 'silenciar': this.alternarSilencio(); e.flashHasta = performance.now() + 400; break;
        case 'fadeout': this.fadeoutTotal(Math.max(0.5, t.salida || 2)); e.flashHasta = performance.now() + 500; break;
        case 'intensidad': e.flashHasta = performance.now() + 300; this.ciclarIntensidad(); break;
        case 'intro_loop':
        case 'loop': await this._loop(i, t, e); break;
        case 'mantener': if (!e.abajo) break; /* soltada durante la espera del ducking: no arrancar */ if (!(await this._permitido(t, e))) break; await this._una(i, t, e, t.sonidos[0], { loop: true, entrada: t.entrada }); break;
        case 'azar': if (!(await this._permitido(t, e))) break; { const id = this._azar(t, e); e.azarHasta = performance.now() + 700; await this._una(i, t, e, id, { rate: 1 + (Math.random() * 0.08 - 0.04), entrada: t.entrada }); } break;
        case 'secuencia': if (!(await this._permitido(t, e))) break; { if (!t.sonidos.length) break; const id = t.sonidos[e.sec % t.sonidos.length]; e.sec++; await this._una(i, t, e, id, { entrada: t.entrada }); } break;
        default: if (!(await this._permitido(t, e))) break; await this._una(i, t, e, t.sonidos[0], { entrada: t.entrada });
      }
      } finally { if (reserva) this._duckMenos(); }
      this.onCambio();
    }
    _soltar(i, t, e) {
      if (t.tipo === 'mantener') for (const v of [...e.voces]) this._apagar(v, t.salida || 0.15);
      this.onCambio();
    }
    async _permitido(t, e) {                       // que pasa si la tecla ya esta sonando
      if (e.voces.size === 0) return true;
      if (t.retoque === 'ignorar') return false;
      if (t.retoque === 'reiniciar') { for (const v of [...e.voces]) this._apagar(v, 0.04); }
      return true;
    }
    async _una(i, t, e, id, extra) {
      if (!id) return;
      await this._crearVoz(id, Object.assign({ tecla: i, volumen: t.volumen, ducking: !!t.ducking }, extra));
    }
    _azar(t, e) {                                   // bolsa barajada: no repite seguido
      if (!t.sonidos.length) return null;
      if (e.bolsa.length === 0) {
        e.bolsa = t.sonidos.slice();
        for (let k = e.bolsa.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [e.bolsa[k], e.bolsa[j]] = [e.bolsa[j], e.bolsa[k]]; }
        if (e.bolsa.length > 1 && e.bolsa[e.bolsa.length - 1] === e.ultimo) { const x = e.bolsa.pop(); e.bolsa.unshift(x); }
      }
      const id = e.bolsa.pop(); e.ultimo = id; return id;
    }
    async _loop(i, t, e) {
      if (e.loop) {                                 // estaba prendido: se apaga con fundido
        e.loop = false;
        for (const v of [...e.voces]) this._apagar(v, t.salida);
        return;
      }
      if (!t.sonidos.length) return;
      // grupo exclusivo: se apagan (con fundido cruzado) los otros loops (Loop o Intro + Loop) del mismo grupo
      if (t.grupo) {
        this.teclas.forEach((o, j) => { if (j !== i && o && MD.Config.esLoop(o.tipo) && o.grupo === t.grupo && this.estadoTecla[j].loop) { this.estadoTecla[j].loop = false; for (const v of [...this.estadoTecla[j].voces]) this._apagar(v, Math.max(1.5, o.salida)); } });
      }
      e.loop = true; e.nivel = 0; e.seq = ++this.seqLoops;       // 1.3-dev20: un loop recien prendido parte sin regular (y pasa a ser "el ultimo")
      const entrada = Math.max(t.entrada, t.grupo ? 1.5 : 0);
      if (t.tipo === 'intro_loop' && t.sonidos.length > 1) { await this._introLoop(i, t, e, entrada); return; }
      const idLoop = t.tipo === 'intro_loop' ? t.sonidos[t.sonidos.length - 1] : t.sonidos[0];
      const v = await this._crearVoz(idLoop, { tecla: i, volumen: t.volumen, ducking: !!t.ducking, loop: true, entrada });
      if (!v) e.loop = false;
    }
    // v1.3-dev13: Intro + Loop. La lista de sonidos de la tecla es: [intro 1, intro 2, ..., loop]. Todos se AGENDAN de una vez en el reloj de
    // Web Audio (cada uno arranca justo cuando termina el anterior) y el ultimo se repite: no hay hueco entre la intro y el loop.
    async _introLoop(i, t, e, entrada) {
      const ids = t.sonidos.slice(), idLoop = ids.pop();
      for (const id of t.sonidos) if (!this._streaming(id)) await this._buffer(id);     // decodificados de antemano: la duracion exacta sale del buffer
      if (!e.loop) return;                                                              // lo apagaron mientras se preparaba
      const base = { tecla: i, volumen: t.volumen, ducking: !!t.ducking };
      let cuando = this.ctx.currentTime + 0.08, primera = true;
      for (const id of ids) {
        const v = await this._crearVoz(id, Object.assign({}, base, { entrada: primera ? entrada : 0, cuando }));
        if (!e.loop) { if (v) this._apagar(v, 0); return; }
        if (!v) continue;                                                               // una intro que no se pudo cargar se saltea
        primera = false;
        const meta = this.sonidos.get(id);
        cuando += v.duracion || (meta && meta.duracion) || 0;
      }
      const v = await this._crearVoz(idLoop, Object.assign({}, base, { loop: true, entrada: primera ? entrada : 0, cuando }));
      if (!e.loop) { if (v) this._apagar(v, 0); return; }
      if (!v && primera) e.loop = false;
    }
    // ---- INTENSIDAD (1.3-dev20) ----
    factorNivel(n) { return FACTOR_NIVEL[Math.min(5, Math.max(1, Math.round(n))) - 1]; }
    // El loop que se prendio ULTIMO y sigue prendido (si se apaga, pasa a ser el anterior que siga sonando). -1 = ninguno.
    ultimoLoop() {
      let mejor = -1, seq = -1;
      this.teclas.forEach((t, i) => { const e = this.estadoTecla[i]; if (t && MD.Config.esLoop(t.tipo) && e && e.loop && e.seq > seq) { seq = e.seq; mejor = i; } });
      return mejor;
    }
    nivelDe(i) {
      const e = this.estadoTecla[i], t = this.teclas[i];
      if (e && e.nivel) return e.nivel;
      let n = 5; try { n = Math.round(this.nivelInicial(i, t)) || 5; } catch (x) {}
      return Math.min(5, Math.max(1, n));
    }
    // Pone el nivel (1 a 5) de un loop: el volumen de sus voces baja o sube con un fundido corto, y se avisa para que las luces hagan lo mismo.
    fijarNivel(i, n) {
      const t = this.teclas[i], e = this.estadoTecla[i];
      if (!t || !e || !e.loop) return false;
      n = Math.min(5, Math.max(1, Math.round(n)));
      e.nivel = n;
      if (this.ctx) {
        const f = this.factorNivel(n), ahora = this.ctx.currentTime;
        for (const v of e.voces) {
          if (v.fin || v.apagando) continue;
          const g = v.gain.gain, destino = Math.max(0.0001, (v.volBase == null ? v.vol : v.volBase) * f);
          g.cancelScheduledValues(ahora);
          g.setValueAtTime(Math.max(g.value, 0.0001), ahora);
          g.linearRampToValueAtTime(destino, ahora + 0.45);
          v.vol = destino;
        }
      }
      this.avisoNivel = { texto: 'Intensidad ' + (t.nombre || 'del loop') + ': ' + n + '/5', n, hasta: performance.now() + 2500 };
      this.log.push('nivel ' + i + ' ' + n);
      try { this.onNivel(i, n, t); } catch (x) {}
      this.onCambio();
      return true;
    }
    // La tecla "Intensidad": cada toque sube un nivel del ULTIMO loop prendido (del 5 vuelve al 1)
    ciclarIntensidad() {
      const j = this.ultimoLoop();
      if (j < 0) { this.avisoNivel = { texto: 'Intensidad: no hay un loop sonando', n: 0, hasta: performance.now() + 2000 }; this.onCambio(); return; }
      const cur = this.nivelDe(j);
      this.fijarNivel(j, cur >= 5 ? 1 : cur + 1);
    }
    // Para la perilla (paso siguiente): fija el nivel del ultimo loop directamente
    intensidadUltimo(n) { const j = this.ultimoLoop(); return j < 0 ? false : this.fijarNivel(j, n); }

    fadeoutTotal(seg) {
      this.estadoTecla.forEach(e => { e.loop = false; });
      for (const v of [...this.voces]) this._apagar(v, seg);
    }
    pararTodo() { this.estadoTecla.forEach(e => { e.loop = false; }); for (const v of [...this.voces]) this._apagar(v, 0.03); }

    // ---- lo que se muestra: LEDs de las teclas y la lista de "sonando" ----
    ledsEstado() {
      const ahora = performance.now();
      return this.teclas.map((t, i) => {
        if (!t) return 0;
        const e = this.estadoTecla[i];
        if (e.flashHasta > ahora) return 3;
        if (t.tipo === 'silenciar') return this.silenciado ? 1 : 0;
        if (MD.Config.esLoop(t.tipo)) return e.loop ? 2 : 0;
        if (e.voces.size) return (t.tipo === 'azar' && e.azarHasta > ahora) ? 4 : 1;
        return 0;
      });
    }
    sonando() {
      const lista = [];
      this.teclas.forEach((t, i) => { if (t && this.estadoTecla[i].voces.size) lista.push(t.nombre || ('Tecla ' + (i + 1))); });
      return lista;
    }
    cantidadVoces() { return this.voces.size; }
  }
  MD.Motor = Motor;
})(window.MD);
