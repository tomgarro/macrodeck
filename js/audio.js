// audio.js - El motor de sonido: varios sonidos a la vez (polifonia), loops con fundidos, azar, mantener, secuencias, dado.
// Todo pasa por Web Audio: cada sonido tiene su "perilla" de volumen (gain), y todos van a un volumen general (el de la
// perilla del Macrodeck) y a un limitador suave para que muchos sonidos juntos no saturen.
window.MD = window.MD || {};
(function (MD) {
  const MAX_VOCES = 24;
  const UMBRAL_STREAMING = 6 * 1024 * 1024;       // archivos mas grandes que esto se reproducen "en directo" (sin decodificar todo a la vez)
  const PRESUPUESTO_BUFFERS = 160 * 1024 * 1024;  // memoria maxima de sonidos ya decodificados

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
      this.onDado = () => {};
      this.log = [];                  // para pruebas
      this.sonidos = new Map();       // id -> {id,nombre,volumen}
    }
    _estadoNuevo() { return { voces: new Set(), loop: false, abajo: false, sec: 0, bolsa: [], ultimo: -1, flashHasta: 0, azarHasta: 0 }; }

    async iniciar() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC({ latencyHint: 'interactive' });
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
        if (t.dadoCritico) await this._buffer(t.dadoCritico);
        if (t.dadoPifia) await this._buffer(t.dadoPifia);
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
      const vol = (o.volumen == null ? 1 : o.volumen) * (meta ? meta.volumen : 1);
      const g = this.ctx.createGain();
      g.connect(this.master);
      const t = this.ctx.currentTime;
      let fuente = null, el = null;
      const voz = { sonidoId: idSonido, tecla: o.tecla, gain: g, vol, loop: !!o.loop, fin: false, inicio: t, parar: null };
      if (this._streaming(idSonido)) {
        if (!this.urls.has(idSonido)) this.urls.set(idSonido, URL.createObjectURL(this.regs.get(idSonido).blob));
        el = new Audio(this.urls.get(idSonido)); el.loop = !!o.loop; el.preservesPitch = false; el.playbackRate = o.rate || 1;
        fuente = this.ctx.createMediaElementSource(el); fuente.connect(g);
        el.onended = () => this._terminar(voz);
        voz.parar = () => { try { el.pause(); } catch (e) {} fuente.disconnect(); this._terminar(voz); };
        try { await el.play(); } catch (e) { this.log.push('no se pudo reproducir ' + idSonido); return null; }
      } else {
        const buf = await this._buffer(idSonido);
        if (!buf) return null;
        const src = this.ctx.createBufferSource();
        src.buffer = buf; src.loop = !!o.loop; src.playbackRate.value = o.rate || 1;
        src.connect(g);
        src.onended = () => this._terminar(voz);
        voz.parar = () => { try { src.stop(); } catch (e) {} };
        src.start();
        voz.duracion = buf.duration / (o.rate || 1);
      }
      const ahora = this.ctx.currentTime;
      g.gain.cancelScheduledValues(ahora);
      if (o.entrada > 0.02) { g.gain.setValueAtTime(0.0001, ahora); g.gain.linearRampToValueAtTime(vol, ahora + o.entrada); }
      else g.gain.setValueAtTime(vol, ahora);
      this.voces.add(voz);
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
      this.voces.delete(voz);
      if (voz.tecla != null) { const e = this.estadoTecla[voz.tecla]; e.voces.delete(voz); if (voz.loop && e.voces.size === 0) e.loop = false; }
      try { voz.gain.disconnect(); } catch (e) {}
      this.log.push('voz- ' + voz.sonidoId);
      this.onCambio();
    }
    _apagar(voz, fundido) {
      if (voz.fin || voz.apagando) return;
      voz.apagando = true;
      const t = this.ctx.currentTime;
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
      switch (t.tipo) {
        case 'silenciar': this.alternarSilencio(); e.flashHasta = performance.now() + 400; break;
        case 'fadeout': this.fadeoutTotal(Math.max(0.5, t.salida || 2)); e.flashHasta = performance.now() + 500; break;
        case 'dado': await this._dado(i, t, e); break;
        case 'loop': await this._loop(i, t, e); break;
        case 'mantener': if (!(await this._permitido(t, e))) break; await this._una(i, t, e, t.sonidos[0], { loop: true, entrada: t.entrada }); break;
        case 'azar': if (!(await this._permitido(t, e))) break; { const id = this._azar(t, e); e.azarHasta = performance.now() + 700; await this._una(i, t, e, id, { rate: 1 + (Math.random() * 0.08 - 0.04), entrada: t.entrada }); } break;
        case 'secuencia': if (!(await this._permitido(t, e))) break; { if (!t.sonidos.length) break; const id = t.sonidos[e.sec % t.sonidos.length]; e.sec++; await this._una(i, t, e, id, { entrada: t.entrada }); } break;
        default: if (!(await this._permitido(t, e))) break; await this._una(i, t, e, t.sonidos[0], { entrada: t.entrada });
      }
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
      await this._crearVoz(id, Object.assign({ tecla: i, volumen: t.volumen }, extra));
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
      // grupo exclusivo: se apagan (con fundido cruzado) los otros loops del mismo grupo
      if (t.grupo) {
        this.teclas.forEach((o, j) => { if (j !== i && o && o.tipo === 'loop' && o.grupo === t.grupo && this.estadoTecla[j].loop) { this.estadoTecla[j].loop = false; for (const v of [...this.estadoTecla[j].voces]) this._apagar(v, Math.max(1.5, o.salida)); } });
      }
      e.loop = true;
      const v = await this._crearVoz(t.sonidos[0], { tecla: i, volumen: t.volumen, loop: true, entrada: Math.max(t.entrada, t.grupo ? 1.5 : 0) });
      if (!v) e.loop = false;
    }
    async _dado(i, t, e) {
      const caras = t.dado || 20;
      const valor = 1 + Math.floor(Math.random() * caras);
      e.flashHasta = performance.now() + 500;
      this.onDado(valor, caras, i);
      const critico = valor === caras && t.dadoCritico, pifia = valor === 1 && t.dadoPifia;
      const id = critico ? t.dadoCritico : pifia ? t.dadoPifia : t.sonidos[0];
      if (id) await this._una(i, t, e, id, {});
      return valor;
    }
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
        if (t.tipo === 'loop') return e.loop ? 2 : 0;
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
