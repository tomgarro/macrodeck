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
    { id: 'ambiente',  nombre: 'Ambiente (de Audios)', ayuda: 'Prende un audio de tipo Ambiente de la pestana Audios (una taberna, la lluvia, un bosque) como un loop con fundido de entrada y de salida. Con el Macrodeck: 1 toque play / pausa, 2 toques siguiente (si elegís una lista), 3 anterior, mantener + perilla = volumen. Suena en el carril de Ambientes.' },
    // 2.0-dev8: teclas de MUSICA (el carril de Musica de la pestana Audios, con listas armadas por el DM).
    { id: 'musica',    nombre: 'Música (de una lista)', ayuda: 'Prende una lista de la pestana Audios (combate, taberna, tension...) y reemplaza la musica que suena, con fundido. Con el Macrodeck: 1 toque play / pausa, 2 toques siguiente tema, 3 anterior, mantener + perilla = volumen de la tecla.' },
    { id: 'musica_sig', nombre: 'Música: siguiente tema', ayuda: 'Salta al siguiente tema de la musica que esta sonando (con fundido).' },
    { id: 'musica_pausa', nombre: 'Música: pausa / seguir', ayuda: 'Pausa la musica sin perder el lugar; otro toque sigue. No toca los ambientes ni los efectos.' },
    { id: 'luz_toggle', nombre: 'Cambio de luz (toggle)', ayuda: 'Cada toque pasa al siguiente estado de luz (por ejemplo Dia / Noche) SIN cambiar de escena ni cortar los sonidos. Podes poner de 2 a 4 estados.' },
    // 1.3-dev31: la tecla Intensidad queda en PENDIENTES (Tom, 21/10): no se ofrece al crear teclas nuevas, pero todo su codigo sigue (si una tecla ya la usa, anda igual).
    // Para volver a ofrecerla: FUNC_INTENSIDAD = true.
    { id: 'intensidad', nombre: 'Intensidad',    oculto: true, ayuda: 'Regula el ULTIMO loop que prendiste (el sonido y las luces de ese loop a la vez). Cada toque sube un nivel de 1 a 5; del 5 vuelve al 1. Sin un loop sonando no hace nada.' },
  ];
  const FUNC_INTENSIDAD = false;
  const tiposVisibles = (actual) => TIPOS.filter(t => !t.oculto || FUNC_INTENSIDAD || t.id === actual);
  // v1.3: la categoria (Ambiente/Combate/...) se elimino. El color del marco en el mapa del Macrodeck lo decide el COMPORTAMIENTO:
  //   Loop e Intro + Loop amarillo | Constante (mantener) rojo | Unico, Al azar y Secuencia blanco | Silenciar y Fade-out gris.
  // El DUCKING (baja la musica del celu mientras suena) se marca con marco doble + parlante con flecha.
  const MODO_COLOR = { loop: 'amarillo', intro_loop: 'amarillo', ambiente: 'amarillo', musica: 'amarillo', musica_pausa: 'gris', luz_toggle: 'amarillo', mantener: 'rojo', silenciar: 'gris', fadeout: 'gris', intensidad: 'gris' };
  const colorModo = (tipo) => MODO_COLOR[tipo] || 'blanco';
  const COLOR_HEX = { amarillo: '#e0b21f', rojo: '#d4342c', blanco: '#e6e6e6', gris: '#808080' };
  const esLoop = (tipo) => tipo === 'loop' || tipo === 'intro_loop' || tipo === 'ambiente';       // las teclas que se prenden y se apagan con otro toque
  // 2.0-dev8: teclas que NO son un sonido propio (no llevan sonidos, ni ducking, ni fader en el Mezclador)
  const SIN_SONIDO = ['silenciar', 'fadeout', 'intensidad', 'ambiente', 'luz_toggle', 'musica', 'musica_sig', 'musica_pausa'];
  const sinSonido = (tipo) => SIN_SONIDO.includes(tipo);
  // 2.0-dev9: las teclas que tienen un audio (sonido, ambiente o lista de musica) tienen fader en el Mezclador; las que son solo acciones, no.
  const SIN_FADER = ['silenciar', 'fadeout', 'intensidad', 'luz_toggle', 'musica_sig', 'musica_pausa'];
  const conVolumen = (tipo) => !SIN_FADER.includes(tipo);
  const admiteDucking = (tipo) => !sinSonido(tipo);
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
    ambiente:  ["..#.#.#..", ".#.#.#.#.", "#########", ".#.#.#.#.", "..#.#.#..", "....#....", "....#...."],
    musica:    ["..#######", "..#.....#", "..#.....#", "..#.....#", ".##....##", "###...###", ".##....##"],
    musica_sig: ["#.....#", "##....#", "###...#", "####..#", "###...#", "##....#", "#.....#"],
    musica_pausa: ["###...###", "###...###", "###...###", "###...###", "###...###", "###...###", "###...###"],
    luz_toggle: ["...#...#...", ".#..#.#..#.", "..#.###.#..", "#...#####..#", "..#.###.#..", ".#..#.#..#.", "...#...#..."],
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
  // 1.3-dev31: Frodo prepara MUCHAS escenas; el Macrodeck solo muestra hasta 10 (las que tienen "Mostrar en el Macrodeck" tildado).
  const MAX_ESCENAS = 60, MAX_EN_MACRODECK = 10;
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
    return { version: 1, nombre: 'Mi campana', escenas: [escenaNueva('Escena 1')], sonidos: [], looks: [], listas: [], favoritos: [],
      ajustes: { volMax: 0.9, escenaInicial: 0, sorpresa: false, luzBase: { modo: 'foto', look: '' } } };
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
  // 1.3-dev31: luz de reposo = a que quedan las lamparas cuando la escena no define su luz (y cuando termina un efecto): 'foto' = como estaban antes
  // (lo que hacia siempre el servidor: volvian a la luz de antes, p. ej. calida), 'look' = un look elegido, 'apagar' = apagadas.
  function normLuzBase(o) {
    const modo = o && ['foto', 'look', 'apagar'].includes(o.modo) ? o.modo : 'foto';
    const look = o && typeof o.look === 'string' ? o.look.slice(0, 40) : '';
    return { modo: modo === 'look' && !look ? 'foto' : modo, look: modo === 'look' ? look : '' };
  }
  // Estados de una tecla "Cambio de luz": de 2 a 4. Cada uno = { nombre, luz: { 'dnd-1': idLook, 'dnd-2': idLook } }; sin lampara = "la luz de la escena".
  function normEstadosToggle(lista) {
    const LZ = MD.LucesDnd, out = [];
    for (const e of (Array.isArray(lista) ? lista : []).slice(0, 4)) {
      if (!e || typeof e !== 'object') continue;
      out.push({ nombre: String(e.nombre || 'Estado ' + (out.length + 1)).slice(0, 10), luz: LZ ? LZ.normLuzEscena(e.luz) : {} });
    }
    const def = [{ nombre: 'Dia', luz: {} }, { nombre: 'Noche', luz: { 'dnd-1': 'lf_noche', 'dnd-2': 'lf_noche' } }];
    while (out.length < 2) out.push(def[out.length]);
    return out;
  }
  // Limpia lo que venga (de un pack o de la memoria) para que nunca rompa nada
  function normalizar(c) {
    const base = configNueva();
    if (!c || typeof c !== 'object') return base;
    const out = { version: 1, nombre: String(c.nombre || base.nombre).slice(0, 60), escenas: [], sonidos: [], ajustes: Object.assign({}, base.ajustes, c.ajustes || {}) };
    out.ajustes.luzBase = normLuzBase(out.ajustes.luzBase);
    out.favoritos = [...new Set((Array.isArray(c.favoritos) ? c.favoritos : []).filter(x => typeof x === 'string' && x).map(x => x.slice(0, 80)))].slice(0, 2000);   // 1.3-dev31: los favoritos de Audios viajan con la campana
    const LZ = MD.LucesDnd;                                   // 1.3-dev16: luces de D&D (looks propios, ambiente por escena, luces por tecla)
    out.looks = LZ ? LZ.normLooks(c.looks) : [];
    out.listas = normListas(c.listas);                         // 1.3-dev25: listas de reproduccion de la pestana Audios
    out.ajustes.volMax = num(out.ajustes.volMax, 0.9, 0.1, 1);
    out.ajustes.escenaInicial = num(out.ajustes.escenaInicial, 0, 0, MAX_ESCENAS - 1) | 0;
    for (const s of c.sonidos || []) out.sonidos.push({ id: String(s.id), nombre: String(s.nombre || 'Sonido').slice(0, 60), volumen: num(s.volumen, 1, 0, 2), duracion: num(s.duracion, 0, 0, 36000), archivoOriginal: s.archivoOriginal || '', carpeta: String(s.carpeta || '').slice(0, 80), driveMod: num(s.driveMod, 0, 0, 1e15) });
    for (const e of (c.escenas || []).slice(0, MAX_ESCENAS)) {
      const esc = { id: String(e.id || nuevoId('e')), nombre: String(e.nombre || 'Escena').slice(0, 30), teclas: [] };
      if (e.estado === 'borrador') esc.estado = 'borrador';            // (sin campo = confirmada)
      if (e.macrodeck === false) esc.macrodeck = false;                // 1.3-dev31: (sin campo = se muestra en el selector del Macrodeck)
      if (e.volMusica != null && isFinite(+e.volMusica)) esc.volMusica = num(e.volMusica, 1, 0, 1.5);   // 2.0-dev8: volumen del carril de Musica que lleva esta escena
      if (e.volAmbiente != null && isFinite(+e.volAmbiente)) esc.volAmbiente = num(e.volAmbiente, 1, 0, 1.5);   // 2.0-dev7: volumen del carril de Ambientes que lleva esta escena (viaja con ella)
      if (e.ambiente && typeof e.ambiente === 'object' && typeof e.ambiente.id === 'string' && e.ambiente.id) esc.ambiente = { id: e.ambiente.id.slice(0, 80), arranca: e.ambiente.arranca !== false };   // 1.3-dev31: ambiente de fondo de la escena (audio de tipo Ambiente)
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
        if (x.tipo === 'ambiente') {                           // 1.3-dev31: un audio de la biblioteca (Audios) que suena como loop en el carril de Ambientes
          x.audio = typeof x.audio === 'string' ? x.audio.slice(0, 80) : ''; x.audioTitulo = String(x.audioTitulo || '').slice(0, 60); x.sumar = !!x.sumar; x.sonidos = [];
        } else { delete x.audio; delete x.audioTitulo; delete x.sumar; }
        // 2.0-dev8: una lista de Audios que suena en el carril de Musica. 2.0-dev11: una tecla Ambiente tambien puede traer una LISTA (de ambientes) en vez de un solo audio.
        if (x.tipo === 'musica' || x.tipo === 'ambiente') {
          x.lista = String(x.lista || '').slice(0, 40); x.listaNombre = String(x.listaNombre || '').slice(0, 40); x.azarLista = !!x.azarLista;
          if (x.tipo === 'musica') { x.sonidos = []; x.grupo = ''; } else if (x.lista) x.sumar = false;
        } else { delete x.lista; delete x.listaNombre; delete x.azarLista; }
        if (x.tipo === 'musica_sig' || x.tipo === 'musica_pausa') { x.sonidos = []; x.grupo = ''; }
        if (x.tipo === 'luz_toggle') { x.estados = normEstadosToggle(x.estados); x.fundido = num(x.fundido, 4, 0, 60); x.sonidos = []; delete x.luces; } else { delete x.estados; delete x.fundido; }
        if (LZ) { const lt = LZ.normLucesTecla(x.luces); if (lt.length) x.luces = lt; else delete x.luces; }
        esc.teclas.push(x);
      }
      out.escenas.push(esc);
    }
    if (!out.escenas.length) out.escenas.push(escenaNueva('Escena 1'));
    return out;
  }
  MD.Config = { TIPOS, tiposVisibles, FUNC_INTENSIDAD, MAX_ESCENAS, MAX_EN_MACRODECK, normLuzBase, normEstadosToggle, RETOQUES, colorModo, esLoop, COLOR_HEX, admiteDucking, sinSonido, conVolumen, ICONO_INTENSIDAD, ARTE, pintarArte, canvasArte, nuevoId, teclaNueva, escenaNueva, configNueva, normalizar, normListas };
})(window.MD);
