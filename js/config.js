// config.js - La configuracion (escenas, teclas, sonidos): forma, valores por defecto y limpieza.
window.MD = window.MD || {};
(function (MD) {
  const TIPOS = [
    { id: 'una_vez',   nombre: 'Unico',          ayuda: 'Suena completo cada vez que lo tocas.' },
    { id: 'loop',      nombre: 'Loop',           ayuda: 'Un toque lo prende, otro lo apaga (con fundido). Ideal para ambientes.' },
    { id: 'intro_loop', nombre: 'Intro + Loop', ayuda: 'Un toque suena la intro (o las intros, en orden) y entra solo en el loop sin cortes; otro toque lo apaga con fundido. Ej: "Prender antorcha" + "Antorcha en loop".' },
    { id: 'azar',      nombre: 'Al azar',        ayuda: 'Elige uno de la lista sin repetir seguido, con una pequena variacion de tono.' },
    { id: 'mantener',  nombre: 'Constante',      ayuda: 'Suena sin cortarse mientras mantenes la tecla apretada; al soltarla se apaga con un fundido.' },
    { id: 'secuencia', nombre: 'Secuencia',      ayuda: 'Cada toque suena el siguiente de la lista.' },
    { id: 'silenciar', nombre: 'Silenciar todo', ayuda: 'Corta TODO el sonido de la app (otra vez lo devuelve). No afecta a la musica de otras apps.' },
    { id: 'fadeout',   nombre: 'Fade-out total', ayuda: 'Apaga con un fundido todos los loops y sonidos largos.' },
    { id: 'intensidad', nombre: 'Intensidad',    ayuda: 'Regula el ULTIMO loop que prendiste (el sonido y las luces de ese loop a la vez). Cada toque sube un nivel de 1 a 5; del 5 vuelve al 1. Sin un loop sonando no hace nada.' },
  ];
  // v1.3: la categoria (Ambiente/Combate/...) se elimino. El color del marco en el mapa del Macrodeck lo decide el COMPORTAMIENTO:
  //   Loop e Intro + Loop amarillo | Constante (mantener) rojo | Unico, Al azar y Secuencia blanco | Silenciar y Fade-out gris.
  // El DUCKING (baja la musica del celu mientras suena) se marca con marco doble + parlante con flecha.
  const MODO_COLOR = { loop: 'amarillo', intro_loop: 'amarillo', mantener: 'rojo', silenciar: 'gris', fadeout: 'gris', intensidad: 'gris' };
  const colorModo = (tipo) => MODO_COLOR[tipo] || 'blanco';
  const COLOR_HEX = { amarillo: '#e0b21f', rojo: '#d4342c', blanco: '#e6e6e6', gris: '#808080' };
  const esLoop = (tipo) => tipo === 'loop' || tipo === 'intro_loop';       // las teclas que se prenden y se apagan con otro toque
  const admiteDucking = (tipo) => !['silenciar', 'fadeout', 'intensidad'].includes(tipo);
  // 1.3-dev20: icono por defecto de la tecla Intensidad (cinco barras que suben, 24 x 24). El firmware todavia no tiene un glifo propio para este tipo.
  const ICONO_INTENSIDAD = '0000000000000000380000380000380000380003b80003b80003b80003b8003bb8003bb8003bb8003bb803bbb803bbb803bbb803bbb83bbbb83bbbb83bbbb83bbbb8000000000000';
  // Dibujitos de 1 color (arte en texto, igual que en el firmware: programa_dnd.cpp). '#' = punto prendido.
  const ARTE = {
    loop:      [".###...###.", "#...#.#...#", "#....#....#", "#...#.#...#", ".###...###."],
    intro_loop: [".....###.", "#...#...#", "##..#...#", "#...#...#", ".....###."],
    una_vez:   ["#......", "###....", "#####..", "#######", "#####..", "###....", "#......"],
    mantener:  ["..###..", "..###..", "#######", ".#####.", "..###..", "...#...", "#######"],
    azar:      [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
    secuencia: ["#...#....", ".#...#...", "..#...#..", "...#...#.", "..#...#..", ".#...#...", "#...#...."],
    silenciar: ["...#......", "..##.#...#", "####..#.#.", "####...#..", "####..#.#.", "..##.#...#", "...#......"],
    fadeout:   ["#..........", "###........", "####.......", "######.....", "########...", "#########..", "###########"],
    intensidad: ["........#", "........#", "......#.#", "....#.#.#", "..#.#.#.#", "#.#.#.#.#", "#.#.#.#.#"],
    ducking:   ["...#...#..", "..##...#..", "####...#..", "####.#####", "####..###.", "..##...#..", "...#......"],
  };
  // Pinta un dibujito en un canvas 2D (ctx) con 'escala' puntos por punto
  function pintarArte(ctx, x, y, filas, color, escala) {
    ctx.fillStyle = color;
    filas.forEach((f, j) => { for (let i = 0; i < f.length; i++) if (f[i] === '#') ctx.fillRect(x + i * escala, y + j * escala, escala, escala); });
  }
  // Un <canvas> chico con el dibujito (para las teclas de la web y la leyenda)
  function canvasArte(clave, color) {
    const filas = ARTE[clave] || ARTE.una_vez, cv = document.createElement('canvas');
    cv.width = filas[0].length; cv.height = filas.length;
    pintarArte(cv.getContext('2d'), 0, 0, filas, color, 1);
    return cv;
  }
  const RETOQUES = [
    { id: 'superponer', nombre: 'Superponer (suenan los dos)' },
    { id: 'reiniciar',  nombre: 'Reiniciar (corta el anterior)' },
    { id: 'ignorar',    nombre: 'Ignorar (si ya suena, nada)' },
  ];
  let contador = 0;
  function nuevoId(pref) { return pref + Date.now().toString(36) + (contador++).toString(36) + Math.random().toString(36).slice(2, 5); }

  function teclaNueva(extra) {
    return Object.assign({ nombre: '', tipo: 'una_vez', ducking: false, sonidos: [], volumen: 1, entrada: 0, salida: 0.4,
      retoque: 'superponer', grupo: '', icono: '' }, extra || {});
  }
  // 1.3-dev21: 'estado' = 'borrador' (en preparacion: solo lo ve quien la hace) o 'confirmada' (la ven todos). Las escenas viejas cuentan como confirmadas.
  function escenaNueva(nombre, estado) { const e = { id: nuevoId('e'), nombre: nombre || 'Escena', teclas: Array.from({ length: 10 }, () => null) }; if (estado === 'borrador') e.estado = 'borrador'; return e; }
  function configNueva() {
    return { version: 1, nombre: 'Mi campana', escenas: [escenaNueva('Escena 1')], sonidos: [], looks: [], listas: [],
      ajustes: { volMax: 0.9, escenaInicial: 0, sorpresa: false } };
  }
  const num = (v, d, mn, mx) => { v = Number(v); if (!isFinite(v)) v = d; return Math.min(mx, Math.max(mn, v)); };
  // 1.3-dev25: lista de reproduccion = { id, nombre, items:[id de audio...], fundido (s), intro (s que se saltea del que entra), auto: null | {filtro:{bioma:[],..}, q} }
  // Una lista "automatica" se arma sola con el filtro (items queda vacio).
  function normListas(l) {
    const out = [], FK = ['tipo', 'bioma', 'lugar', 'escena', 'tono', 'energia'];
    for (const x of Array.isArray(l) ? l.slice(0, 100) : []) {
      if (!x || typeof x !== 'object' || !x.id || out.some(o => o.id === String(x.id))) continue;
      const li = { id: String(x.id).slice(0, 40), nombre: String(x.nombre || 'Lista').slice(0, 40), items: [], fundido: [0, 8, 15, 20].includes(Number(x.fundido)) ? Number(x.fundido) : 15, intro: [0, 15].includes(Number(x.intro)) ? Number(x.intro) : 15 };
      if (x.auto && typeof x.auto === 'object') {
        const f = {}; FK.forEach(k => { f[k] = Array.isArray(x.auto.filtro && x.auto.filtro[k]) ? x.auto.filtro[k].slice(0, 30).map(v => k === 'energia' ? Number(v) : String(v)) : []; });
        li.auto = { filtro: f, q: String(x.auto.q || '').slice(0, 60) };
      } else li.items = (Array.isArray(x.items) ? x.items : []).slice(0, 500).map(String);
      out.push(li);
    }
    return out;
  }
  // Limpia lo que venga (de un pack o de la memoria) para que nunca rompa nada
  function normalizar(c) {
    const base = configNueva();
    if (!c || typeof c !== 'object') return base;
    const out = { version: 1, nombre: String(c.nombre || base.nombre).slice(0, 60), escenas: [], sonidos: [], ajustes: Object.assign({}, base.ajustes, c.ajustes || {}) };
    const LZ = MD.LucesDnd;                                   // 1.3-dev16: luces de D&D (looks propios, ambiente por escena, luces por tecla)
    out.looks = LZ ? LZ.normLooks(c.looks) : [];
    out.listas = normListas(c.listas);                         // 1.3-dev25: listas de reproduccion de la pestana Audios
    out.ajustes.volMax = num(out.ajustes.volMax, 0.9, 0.1, 1);
    out.ajustes.escenaInicial = num(out.ajustes.escenaInicial, 0, 0, 9) | 0;
    for (const s of c.sonidos || []) out.sonidos.push({ id: String(s.id), nombre: String(s.nombre || 'Sonido').slice(0, 60), volumen: num(s.volumen, 1, 0, 2), duracion: num(s.duracion, 0, 0, 36000), archivoOriginal: s.archivoOriginal || '', carpeta: String(s.carpeta || '').slice(0, 80), driveMod: num(s.driveMod, 0, 0, 1e15) });
    for (const e of (c.escenas || []).slice(0, 10)) {
      const esc = { id: String(e.id || nuevoId('e')), nombre: String(e.nombre || 'Escena').slice(0, 30), teclas: [] };
      if (e.estado === 'borrador') esc.estado = 'borrador';            // (sin campo = confirmada)
      if (LZ) { const lz = LZ.normLuzEscena(e.luz); if (Object.keys(lz).length) esc.luz = lz; }
      if (e.lista && typeof e.lista === 'object' && typeof e.lista.id === 'string' && e.lista.id) esc.lista = { id: e.lista.id.slice(0, 40), arranca: e.lista.arranca !== false, azar: !!e.lista.azar };   // dev25: musica de fondo de la escena
      for (let i = 0; i < 10; i++) {
        const t = (e.teclas || [])[i];
        if (!t) { esc.teclas.push(null); continue; }
        const x = teclaNueva(t);
        x.nombre = String(x.nombre).slice(0, 18);
        if (!TIPOS.some(q => q.id === x.tipo)) x.tipo = 'una_vez';
        delete x.categoria;                                   // (las configuraciones viejas la traian: se descarta)
        x.ducking = !!x.ducking && admiteDucking(x.tipo);
        if (!RETOQUES.some(q => q.id === x.retoque)) x.retoque = 'superponer';
        x.sonidos = Array.isArray(x.sonidos) ? x.sonidos.map(String) : [];
        x.volumen = num(x.volumen, 1, 0, 2); x.entrada = num(x.entrada, 0, 0, 10); x.salida = num(x.salida, 0.4, 0, 10);
        delete x.dado; delete x.dadoCritico; delete x.dadoPifia;   // (el modo Dado se elimino en la 1.3-dev13: Frodo prefiere los dados fisicos)
        x.grupo = String(x.grupo || '').slice(0, 20);
        x.icono = (typeof x.icono === 'string' && /^[0-9a-f]{144}$/i.test(x.icono)) ? x.icono.toLowerCase() : '';
        if (x.tipo === 'intensidad' && !x.icono) x.icono = ICONO_INTENSIDAD;
        if (LZ) { const lt = LZ.normLucesTecla(x.luces); if (lt.length) x.luces = lt; else delete x.luces; }
        esc.teclas.push(x);
      }
      out.escenas.push(esc);
    }
    if (!out.escenas.length) out.escenas.push(escenaNueva('Escena 1'));
    return out;
  }
  MD.Config = { TIPOS, RETOQUES, colorModo, esLoop, COLOR_HEX, admiteDucking, ICONO_INTENSIDAD, ARTE, pintarArte, canvasArte, nuevoId, teclaNueva, escenaNueva, configNueva, normalizar, normListas };
})(window.MD);
