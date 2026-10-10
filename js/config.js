// config.js - La configuracion (escenas, teclas, sonidos): forma, valores por defecto y limpieza.
window.MD = window.MD || {};
(function (MD) {
  const TIPOS = [
    { id: 'una_vez',   nombre: 'Una vez',        ayuda: 'Suena completo cada vez que lo tocas.' },
    { id: 'loop',      nombre: 'Loop',           ayuda: 'Un toque lo prende, otro lo apaga (con fundido). Ideal para ambientes.' },
    { id: 'azar',      nombre: 'Al azar',        ayuda: 'Elige uno de la lista sin repetir seguido, con una pequena variacion de tono.' },
    { id: 'mantener',  nombre: 'Mantener',       ayuda: 'Suena mientras mantenes la tecla apretada.' },
    { id: 'secuencia', nombre: 'Secuencia',      ayuda: 'Cada toque suena el siguiente de la lista.' },
    { id: 'dado',      nombre: 'Dado',           ayuda: 'Tira un dado de verdad y muestra el numero en el Macrodeck. Un 1 o el maximo pueden tener su sonido.' },
    { id: 'silenciar', nombre: 'Silenciar todo', ayuda: 'Corta TODO el sonido de la app (otra vez lo devuelve). No afecta a la musica de otras apps.' },
    { id: 'fadeout',   nombre: 'Fade-out total', ayuda: 'Apaga con un fundido todos los loops y sonidos largos.' },
  ];
  const CATEGORIAS = [
    { id: 'ambiente', nombre: 'Ambiente', color: '#d9b21a' },
    { id: 'combate',  nombre: 'Combate',  color: '#d4342c' },
    { id: 'efecto',   nombre: 'Efecto',   color: '#e9e4d8' },
    { id: 'accion',   nombre: 'Accion',   color: '#8a8478' },
  ];
  const RETOQUES = [
    { id: 'superponer', nombre: 'Superponer (suenan los dos)' },
    { id: 'reiniciar',  nombre: 'Reiniciar (corta el anterior)' },
    { id: 'ignorar',    nombre: 'Ignorar (si ya suena, nada)' },
  ];
  let contador = 0;
  function nuevoId(pref) { return pref + Date.now().toString(36) + (contador++).toString(36) + Math.random().toString(36).slice(2, 5); }

  function teclaNueva(extra) {
    return Object.assign({ nombre: '', categoria: 'efecto', tipo: 'una_vez', sonidos: [], volumen: 1, entrada: 0, salida: 0.4,
      retoque: 'superponer', grupo: '', icono: '', dado: 20, dadoCritico: '', dadoPifia: '' }, extra || {});
  }
  function escenaNueva(nombre) { return { id: nuevoId('e'), nombre: nombre || 'Escena', teclas: Array.from({ length: 10 }, () => null) }; }
  function configNueva() {
    return { version: 1, nombre: 'Mi campana', escenas: [escenaNueva('Escena 1')], sonidos: [],
      ajustes: { volMax: 0.9, escenaInicial: 0, sorpresa: false } };
  }
  const num = (v, d, mn, mx) => { v = Number(v); if (!isFinite(v)) v = d; return Math.min(mx, Math.max(mn, v)); };
  // Limpia lo que venga (de un pack o de la memoria) para que nunca rompa nada
  function normalizar(c) {
    const base = configNueva();
    if (!c || typeof c !== 'object') return base;
    const out = { version: 1, nombre: String(c.nombre || base.nombre).slice(0, 60), escenas: [], sonidos: [], ajustes: Object.assign({}, base.ajustes, c.ajustes || {}) };
    out.ajustes.volMax = num(out.ajustes.volMax, 0.9, 0.1, 1);
    out.ajustes.escenaInicial = num(out.ajustes.escenaInicial, 0, 0, 9) | 0;
    for (const s of c.sonidos || []) out.sonidos.push({ id: String(s.id), nombre: String(s.nombre || 'Sonido').slice(0, 60), volumen: num(s.volumen, 1, 0, 2), duracion: num(s.duracion, 0, 0, 36000), archivoOriginal: s.archivoOriginal || '', carpeta: String(s.carpeta || '').slice(0, 80), driveMod: num(s.driveMod, 0, 0, 1e15) });
    for (const e of (c.escenas || []).slice(0, 10)) {
      const esc = { id: String(e.id || nuevoId('e')), nombre: String(e.nombre || 'Escena').slice(0, 30), teclas: [] };
      for (let i = 0; i < 10; i++) {
        const t = (e.teclas || [])[i];
        if (!t) { esc.teclas.push(null); continue; }
        const x = teclaNueva(t);
        x.nombre = String(x.nombre).slice(0, 18);
        if (!TIPOS.some(q => q.id === x.tipo)) x.tipo = 'una_vez';
        if (!CATEGORIAS.some(q => q.id === x.categoria)) x.categoria = 'efecto';
        if (!RETOQUES.some(q => q.id === x.retoque)) x.retoque = 'superponer';
        x.sonidos = Array.isArray(x.sonidos) ? x.sonidos.map(String) : [];
        x.volumen = num(x.volumen, 1, 0, 2); x.entrada = num(x.entrada, 0, 0, 10); x.salida = num(x.salida, 0.4, 0, 10);
        x.dado = [4, 6, 8, 10, 12, 20, 100].includes(Number(x.dado)) ? Number(x.dado) : 20;
        x.grupo = String(x.grupo || '').slice(0, 20);
        x.icono = (typeof x.icono === 'string' && /^[0-9a-f]{144}$/i.test(x.icono)) ? x.icono.toLowerCase() : '';
        esc.teclas.push(x);
      }
      out.escenas.push(esc);
    }
    if (!out.escenas.length) out.escenas.push(escenaNueva('Escena 1'));
    return out;
  }
  MD.Config = { TIPOS, CATEGORIAS, RETOQUES, nuevoId, teclaNueva, escenaNueva, configNueva, normalizar };
})(window.MD);
