// luces_dnd.js - Luces de D&D (1.3-dev20).
// 1.3-dev20: cada look tiene INTENSIDAD (1 a 5; 5 = a pleno, como siempre). La tecla 'Intensidad' regula el ultimo loop prendido: el audio baja el volumen
//   (audio.js) y esta app le pide al servidor 'ajustar' la intensidad de las luces de ESE loop, con fundido. La app le pide efectos al servidor de luces (la app "Macrodeck Luces",
// que corre en el MISMO celu) y el servidor los anima. La app solo dice "fuego naranja en la lampara 1" y se desentiende.
//
//   LOOK = receta de luz reutilizable: { id, nombre, efecto, color, brillo, velocidad }. Hay looks de fabrica (no se
//          editan, se duplican) y looks propios (cfg.looks, viajan en el pack).
//   ESCENA: esc.luz = { 'dnd-1': idLook, 'dnd-2': idLook } -> el AMBIENTE de cada lampara al entrar a la escena.
//   TECLA:  t.luces = [{ luz: 'dnd-1', look: idLook, cuando: 'momento' | 'suena' | 'queda', seg: 2 }, ...] (una por lampara)
//           momento = encima del ambiente unos segundos y vuelve · suena = mientras suena el sonido · queda = cambia el ambiente.
//           Los efectos de una lampara se APILAN (1.3-dev17): se ve el ultimo; cuando termina o se corta, vuelve el anterior (el fuego
//           de un loop sigue despues de un hechizo) y, si no queda ninguno, el ambiente de la escena.
//           Un tono nuevo (cuando = 'queda' o una escena nueva) REEMPLAZA a los loops que quedaban: el ultimo tono manda.
//           Cada cambio de escena lleva un NUMERO (1.3-dev19): el servidor descarta las ordenes de una escena anterior que lleguen tarde,
//           y la app corta los pedidos que todavia estaban en vuelo (asi nada viejo se cuela despues de la escena nueva).
//
// Ajustes de ESTE celu (no viajan en el pack): localStorage 'md_luces' = { activo, servidor }.
window.MD = window.MD || {};
(function (MD) {
  const LAMPARAS = [{ id: 'dnd-1', nombre: 'Lampara 1' }, { id: 'dnd-2', nombre: 'Lampara 2' }];
  const EFECTOS = [
    ['fijo', 'Fijo', 'Color quieto'],
    ['fuego', 'Fuego', 'Late lento, titila al azar y tira alguna chispa'],
    ['vela', 'Vela', 'Como el fuego, pero tranquila'],
    ['respirar', 'Respirar', 'Sube y baja suave'],
    ['latido', 'Latido', 'Doble pulso, como un corazon'],
    ['relampago', 'Relampago', 'Dos destellos y queda tenue (ideal como momento)'],
    ['tormenta', 'Tormenta', 'Tenue, con rayos al azar, cada uno distinto (la intensidad va de llovizna a temporal)'],
    ['parpadeo', 'Parpadeo', 'Prende y apaga (alarma)'],
    ['magia', 'Magia', 'El color ondula y respira'],
    ['apagado', 'Apagar', 'Apaga la lampara'],
  ];
  const CUANDO = [
    ['momento', 'Momento'],
    ['suena', 'Mientras suena'],
    ['queda', 'Se queda'],
  ];
  // Looks de fabrica: ids fijos (asi una escena compartida por Drive los encuentra en cualquier celu)
  const FABRICA = [
    { id: 'lf_fogata', nombre: 'Fogata', efecto: 'fuego', color: '#ff5a00', brillo: 85, velocidad: 1 },
    { id: 'lf_antorcha', nombre: 'Antorcha', efecto: 'fuego', color: '#ff8c1a', brillo: 70, velocidad: 1.3 },
    { id: 'lf_vela', nombre: 'Vela', efecto: 'vela', color: '#ffa040', brillo: 45, velocidad: 1 },
    { id: 'lf_taberna', nombre: 'Taberna', efecto: 'fijo', color: '#ff9a3c', brillo: 55, velocidad: 1 },
    { id: 'lf_cueva', nombre: 'Cueva', efecto: 'respirar', color: '#2a46ff', brillo: 22, velocidad: 0.4 },
    { id: 'lf_noche', nombre: 'Noche', efecto: 'fijo', color: '#1b2a80', brillo: 15, velocidad: 1 },
    { id: 'lf_bosque', nombre: 'Bosque', efecto: 'respirar', color: '#2fbf3c', brillo: 40, velocidad: 0.4 },
    { id: 'lf_llovizna', nombre: 'Llovizna', efecto: 'tormenta', color: '#4a6cff', brillo: 70, velocidad: 1, intensidad: 1 },
    { id: 'lf_tormenta', nombre: 'Tormenta', efecto: 'tormenta', color: '#4a6cff', brillo: 70, velocidad: 1, intensidad: 3 },
    { id: 'lf_temporal', nombre: 'Temporal', efecto: 'tormenta', color: '#4a6cff', brillo: 70, velocidad: 1, intensidad: 5 },
    { id: 'lf_combate', nombre: 'Combate', efecto: 'latido', color: '#ff1010', brillo: 90, velocidad: 1.2 },
    { id: 'lf_relampago', nombre: 'Relampago', efecto: 'relampago', color: '#ffffff', brillo: 100, velocidad: 1 },
    { id: 'lf_rugido', nombre: 'Rugido', efecto: 'relampago', color: '#ff2a00', brillo: 100, velocidad: 1 },
    { id: 'lf_hechizo', nombre: 'Hechizo', efecto: 'magia', color: '#9a30ff', brillo: 90, velocidad: 1.2 },
    { id: 'lf_curacion', nombre: 'Curacion', efecto: 'respirar', color: '#ffd24a', brillo: 80, velocidad: 1.6 },
    { id: 'lf_veneno', nombre: 'Veneno', efecto: 'respirar', color: '#62ff1e', brillo: 70, velocidad: 1.5 },
    { id: 'lf_alarma', nombre: 'Alarma', efecto: 'parpadeo', color: '#ff0000', brillo: 100, velocidad: 1 },
    { id: 'lf_apagar', nombre: 'Apagar', efecto: 'apagado', color: '#000000', brillo: 1, velocidad: 1 },
  ];
  const num = (v, d, mn, mx) => { v = Number(v); if (!isFinite(v)) v = d; return Math.min(mx, Math.max(mn, v)); };
  const esColor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  const esLampara = (id) => LAMPARAS.some(l => l.id === id);

  // ---- limpieza (la usa config.js al cargar o importar) ----
  function normLook(l) {
    if (!l || typeof l !== 'object') return null;
    return {
      id: String(l.id || MD.Config.nuevoId('l')).slice(0, 40),
      nombre: String(l.nombre || 'Look').slice(0, 24),
      efecto: EFECTOS.some(e => e[0] === l.efecto) ? l.efecto : 'fijo',
      color: esColor(l.color) ? l.color.toLowerCase() : '#ff8c28',
      brillo: Math.round(num(l.brillo, 80, 1, 100)),
      velocidad: Math.round(num(l.velocidad, 1, 0.25, 3) * 100) / 100,
      intensidad: Math.round(num(l.intensidad, 5, 1, 5)),
    };
  }
  function normLooks(lista) {
    const out = [];
    for (const l of Array.isArray(lista) ? lista.slice(0, 60) : []) { const x = normLook(l); if (x && !x.id.startsWith('lf_') && !out.some(o => o.id === x.id)) out.push(x); }
    return out;
  }
  function normLuzEscena(o) {
    const out = {};
    if (o && typeof o === 'object') for (const l of LAMPARAS) if (typeof o[l.id] === 'string' && o[l.id]) out[l.id] = o[l.id].slice(0, 40);
    return out;
  }
  function normLucesTecla(lista) {
    const out = [];
    for (const x of Array.isArray(lista) ? lista : []) {
      if (!x || !esLampara(x.luz) || typeof x.look !== 'string' || !x.look || out.some(o => o.luz === x.luz)) continue;
      out.push({ luz: x.luz, look: x.look.slice(0, 40), cuando: CUANDO.some(c => c[0] === x.cuando) ? x.cuando : 'momento', seg: Math.round(num(x.seg, 2, 0.5, 60) * 10) / 10 });
    }
    return out;
  }

  // ---- ajustes de este celu ----
  const enApk = () => !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  function leerAjustes() {
    let a = null;
    try { a = JSON.parse(localStorage.getItem('md_luces') || 'null'); } catch (e) {}
    a = Object.assign({ activo: enApk() || !!(MD.Nativo && MD.Nativo.simulado), servidor: 'http://127.0.0.1:8765' }, a || {});
    a.servidor = String(a.servidor || '').trim().replace(/\/+$/, '') || 'http://127.0.0.1:8765';
    return a;
  }

  const L = {
    LAMPARAS, EFECTOS, CUANDO, FABRICA, normLook, normLooks, normLuzEscena, normLucesTecla,
    aj: leerAjustes(), A: null, estado: 'sin probar', ultimoError: '', nombres: {}, conectadas: null, activos: [],
    queda: [], escenaN: 0, vuelo: new Set(),     // escenaN: numero de la escena actual · vuelo: pedidos de ordenes que todavia no volvieron
  };
  L.guardarAjustes = function () { try { localStorage.setItem('md_luces', JSON.stringify(L.aj)); } catch (e) {} };

  L.todosLosLooks = function () { return FABRICA.concat((L.A && L.A.cfg && L.A.cfg.looks) || []); };
  L.look = function (id) { return L.todosLosLooks().find(l => l.id === id) || null; };
  L.nombreLampara = function (id) { return L.nombres[id] || (LAMPARAS.find(l => l.id === id) || {}).nombre || id; };
  L.lookServidor = function (l) { return { efecto: l.efecto, color: l.color, brillo: l.brillo, velocidad: l.velocidad, intensidad: l.intensidad || 5 }; };
  // Nombre del nivel segun el efecto (para el editor de looks y los avisos)
  const NIVELES = { tormenta: ['Llovizna', 'Chubasco', 'Tormenta', 'Fuerte', 'Temporal'], fuego: ['Brasas', 'Fogata chica', 'Fogata', 'Hoguera', 'Incendio'] };
  L.nombreNivel = function (efecto, n) { n = Math.min(5, Math.max(1, Math.round(n || 5))); const nom = (NIVELES[efecto] || [])[n - 1]; return n + '/5' + (nom ? ' · ' + nom : ''); };

  // ---- red: siempre en segundo plano (una lampara que no responde nunca frena un sonido) ----
  async function pedir(ruta, cuerpo, ms, enVuelo) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => { if (ctl) ctl.abort(); }, ms || 2500);
    if (ctl && enVuelo) L.vuelo.add(ctl);
    try {
      // text/plain: el navegador no hace la "consulta previa" (CORS) y el pedido sale de una
      const op = cuerpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(cuerpo) };
      if (ctl) op.signal = ctl.signal;
      const r = await fetch(L.aj.servidor + ruta, op);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) {
        const err = d.error || (d.resultados || []).filter(x => !x.ok).map(x => x.error).join('; ') || ('HTTP ' + r.status);
        throw new Error(err);
      }
      L.estado = 'conectado'; L.ultimoError = '';
      return d;
    } catch (e) {
      if (ctl && ctl.nuestro) throw e;           // lo cortamos nosotros a proposito (cambio de escena): no es una falla de conexion
      L.estado = 'sin conexion';
      L.ultimoError = e.name === 'AbortError' ? 'el servidor de luces no contesto'
        : (e instanceof TypeError ? 'no se pudo hablar con el servidor de luces' : (e.message || String(e)));
      if (MD.Diag) MD.Diag.anotar('luces: ' + L.ultimoError);
      throw e;
    } finally { clearTimeout(t); if (ctl) L.vuelo.delete(ctl); }
  }
  // Corta los pedidos de ordenes que siguen en vuelo (se usa al cambiar de escena: lo que iba a la escena anterior ya no importa).
  L.cortarVuelo = function () {
    for (const ctl of Array.from(L.vuelo)) { ctl.nuestro = true; try { ctl.abort(); } catch (e) {} }
    L.vuelo.clear();
  };
  // Manda ordenes. Cada una lleva el numero de la escena actual: el servidor tira las de una escena anterior que lleguen tarde.
  L.enviar = function (ordenes) {
    if (!L.aj.activo || !ordenes.length) return Promise.resolve(null);
    if (L.escenaN) for (const o of ordenes) if (o && o.escena === undefined) o.escena = L.escenaN;
    for (const f of (L.alOrden || [])) { try { f(ordenes); } catch (e) {} }     // 2.0-dev2: el ambilight mira lo que se manda
    return pedir('/efectos', { ordenes }, 0, true).catch(() => null).then((d) => { L.pintar(); return d; });
  };
  // 2.0-dev2: lo que usa el panel de la cabecera
  L.salud = function () { return pedir('/salud'); };
  L.leer = function () { return pedir('/luces?grupo=dnd'); };
  L.buscar = function () { return pedir('/red/buscar', {}, 5000); };       // reintenta las lamparas caidas y recorre la red
  L.postLuz = function (alias, cuerpo) { return pedir('/luces/' + encodeURIComponent(alias), cuerpo, 6000); };      // orden directa a una lampara (blanco: encendida + brillo + temperatura)
  L.alOrden = [];
  L.probarConexion = async function () {
    try {
      const s = await pedir('/salud');
      const g = (s.grupos || {}).dnd || { luces: 0, conectadas: 0 };
      L.conectadas = g;
      try { const lu = await pedir('/luces?grupo=dnd'); for (const k in lu) if (lu[k] && lu[k].nombre) L.nombres[k] = lu[k].nombre; } catch (e) {}
      return 'Servidor ' + s.version + ': ' + g.conectadas + ' de ' + g.luces + ' luces de D&D conectadas.';
    } catch (e) { return 'No se pudo: ' + L.ultimoError + '. ¿Esta andando el servidor de luces? (es la notificacion «Macrodeck Luces»; viene adentro de esta app)'; }
  };

  // ---- ordenes ----
  function ordenLook(luz, look, extra) {
    if (!look) return null;
    return Object.assign({ luz, look: L.lookServidor(look) }, extra);
  }
  // Ambiente de la escena: lo que tenga asignado cada lampara (si no tiene nada, se deja como esta)
  L.alEscena = function (esc) {
    if (!esc || !L.aj.activo) return;
    L.cortarVuelo();                                           // lo que iba a la escena anterior y no volvio, se corta
    L.escenaN = Math.max(Date.now(), (L.escenaN || 0) + 1);    // numero de escena: siempre creciente (aunque se cambie dos veces en el mismo ms)
    const ordenes = [{ grupo: 'dnd', parar: 'momento' }];      // al cambiar de escena se cortan los momentos que quedaban
    L.cortarSuenan(); L.queda = [];
    const luz = esc.luz || {};
    for (const l of LAMPARAS) {
      const look = L.look(luz[l.id]);
      if (look) ordenes.push(ordenLook(l.id, look, { capa: 'ambiente' }));
      else { const o = L.ordenReposo(l.id); if (o) ordenes.push(o); }          // 1.3-dev31: la escena no define esta lampara -> luz de reposo elegida
    }
    L.enviar(ordenes);
  };
  // 1.3-dev31: LUZ DE REPOSO. Cuando la escena no define la luz de una lampara, a que queda (y a que vuelve cuando termina un efecto):
  //   'foto'   = como estaban antes de D&D (lo que hacia siempre el servidor: vuelve a la luz de antes, p. ej. blanco calido) -> no se manda nada,
  //   'look'   = un look elegido como ambiente,   'apagar' = apagadas.
  L.luzBase = function () { const a = L.A && L.A.cfg && L.A.cfg.ajustes; return (a && a.luzBase) || { modo: 'foto', look: '' }; };
  L.ordenReposo = function (luz) {
    const b = L.luzBase();
    if (b.modo === 'look' && L.look(b.look)) return ordenLook(luz, L.look(b.look), { capa: 'ambiente' });
    if (b.modo === 'apagar') return ordenLook(luz, L.look('lf_apagar'), { capa: 'ambiente' });
    return null;
  };
  // Si se cambia la luz de reposo con la escena ya puesta, se aplica ahora a las lamparas que la escena no define.
  L.alCambiarReposo = function () {
    if (!L.aj.activo || !L.A) return;
    const esc = L.A.cfg.escenas[L.A.activa], luz = (esc && esc.luz) || {}, ordenes = [];
    for (const l of LAMPARAS) { if (L.look(luz[l.id])) continue; const o = L.ordenReposo(l.id); if (o) ordenes.push(Object.assign(o, { conservar: true })); }
    if (ordenes.length) L.enviar(ordenes);
  };
  // ---- CAMBIO DE LUZ (1.3-dev31): la tecla "toggle" pasa al siguiente estado de luz sin cambiar de escena ni cortar sonidos ni efectos ----
  // Cada estado = { nombre, luz: { 'dnd-1': idLook, 'dnd-2': idLook } }. Una lampara sin look en ese estado queda "como la escena" (su ambiente, o la luz de reposo).
  // Se manda como ambiente con conservar: los loops y momentos que estaban encima siguen. 'fundido' = segundos de transicion (lo hace el servidor de luces 0.7.6+;
  // con uno mas viejo el cambio es de golpe).
  L.alToggle = function (i, t, e) {
    const est = (t && t.estados) || [];
    if (est.length < 2) return;
    e.tg = ((e.tg || 0) + 1) % est.length;
    const st = est[e.tg], M = L.A && L.A.motor;
    if (M) M.avisoNivel = { texto: 'Luz: ' + st.nombre, n: 0, oled: ('LUZ ' + st.nombre).slice(0, 10), hasta: performance.now() + 2500 };
    if (!L.aj.activo) return;
    const esc = L.A && L.A.cfg.escenas[L.A.activa], ordenes = [];
    for (const lp of LAMPARAS) {
      const look = L.look((st.luz || {})[lp.id]) || L.look(((esc && esc.luz) || {})[lp.id]);
      if (look) ordenes.push(ordenLook(lp.id, look, { capa: 'ambiente', conservar: true, fundido: t.fundido || 0 }));
      else { const o = L.ordenReposo(lp.id); if (o) ordenes.push(Object.assign(o, { conservar: true, fundido: t.fundido || 0 })); else ordenes.push({ luz: lp.id, parar: 'ambiente' }); }
    }
    L.enviar(ordenes);
  };
  L.pararTodo = function () { L.activos = []; L.queda = []; return L.enviar([{ grupo: 'dnd', parar: 'todo' }]); };
  L.pararMomentos = function () { L.activos = []; return L.enviar([{ grupo: 'dnd', parar: 'momento' }]); };
  L.probarLook = function (look, luz) {
    const destino = luz ? { luz } : { grupo: 'dnd' };
    return L.enviar([Object.assign(destino, { look: L.lookServidor(look), capa: 'momento', segundos: 3, id: 'prueba' })]);
  };

  // Una tecla se apreto (abajo = true). esApagado = era un loop prendido que se apaga con este toque.
  L.alTecla = function (i, t, esApagado) {
    if (!L.aj.activo || !t) return;
    if (t.tipo === 'fadeout') L.pararMomentos();                // el fade-out total tambien corta los efectos de momento
    if (esApagado || !t.luces || !t.luces.length) return;
    const M = L.A && L.A.motor;
    const ordenes = [];
    for (const x of t.luces) {
      const look = L.look(x.look);
      if (!look) continue;
      const etiqueta = 'k' + i + '_' + Date.now().toString(36);
      if (x.cuando === 'queda') {
        // un tono nuevo reemplaza a los loops de esa lampara (el servidor los borra): la app deja de vigilarlos
        L.activos = L.activos.filter(a => a.luz !== x.luz);
        L.queda = L.queda.filter(q => q.luz !== x.luz); L.queda.push({ luz: x.luz, i, teclas: M && M.teclas });    // (para que la tecla Intensidad lo encuentre)
        ordenes.push(ordenLook(x.luz, look, { capa: 'ambiente' }));
      }
      else if (x.cuando === 'suena') {
        // Si ESTA misma tecla ya tenia un efecto "mientras suena" en esa lampara (se la volvio a tocar), se reemplaza.
        // Los de OTRAS teclas NO se tocan: el servidor los apila y cada uno se corta cuando se calla su sonido.
        const previos = L.activos.filter(a => a.luz === x.luz && a.i === i && a.teclas === (M && M.teclas));
        for (const p of previos) ordenes.push({ luz: x.luz, parar: 'momento', id: p.id });
        L.activos = L.activos.filter(a => !previos.includes(a));
        ordenes.push(ordenLook(x.luz, look, { capa: 'momento', segundos: 0, id: etiqueta }));
        L.activos.push({ luz: x.luz, id: etiqueta, i, teclas: M && M.teclas, desde: Date.now(), visto: false });
      } else ordenes.push(ordenLook(x.luz, look, { capa: 'momento', segundos: x.seg || 2, id: etiqueta }));
    }
    L.enviar(ordenes);
  };
  // "Mientras suena": se mira cada 300 ms si la tecla sigue sonando; cuando se calla, se le pide al servidor parar ESE efecto
  // (con su etiqueta: si otra tecla puso otro efecto encima o debajo en esa lampara, esos no se cortan).
  L.cortarSuenan = function () { L.activos = []; };
  function vigilar() {
    const M = L.A && L.A.motor;
    if (!M || !L.activos.length) return;
    const ahora = Date.now(), parar = [];
    L.activos = L.activos.filter((a) => {
      const e = M.estadoTecla && M.estadoTecla[a.i];
      const mismaEscena = M.teclas === a.teclas;
      const suena = mismaEscena && e && (e.voces.size > 0 || e.loop);
      if (suena) { a.visto = true; return true; }
      if (!a.visto && mismaEscena && ahora - a.desde < 4000) return true;   // todavia no arranco (decodificando, ducking)
      parar.push({ luz: a.luz, parar: 'momento', id: a.id });
      return false;
    });
    if (parar.length) L.enviar(parar);
  }
  setInterval(vigilar, 300);

  // ---- INTENSIDAD (1.3-dev20) ----
  // De que nivel parte un loop que nadie regulo: la intensidad del primer look (que no sea "apagar") de sus luces; sin luces, 5.
  L.nivelInicialTecla = function (t) {
    if (t && t.luces) for (const x of t.luces) { const l = L.look(x.look); if (l && l.efecto !== 'apagado') return Math.round(l.intensidad || 5); }
    return 5;
  };
  // El nivel del loop de la tecla i cambio: se les pide a las lamparas de ESE loop que ajusten su intensidad (con fundido, sin reiniciar el efecto).
  L.alNivel = function (i, n) {
    if (!L.aj.activo) return;
    const M = L.A && L.A.motor, teclas = M && M.teclas, ord = [];
    for (const a of L.activos) if (a.i === i && a.teclas === teclas) ord.push({ luz: a.luz, ajustar: true, capa: 'momento', id: a.id, intensidad: n });
    for (const q of L.queda) if (q.i === i && q.teclas === teclas) ord.push({ luz: q.luz, ajustar: true, capa: 'ambiente', intensidad: n });
    if (ord.length) L.enviar(ord);
  };

  // ---- enganche con la app: se envuelven motor.tecla y A.activar sin tocar como funcionan ----
  L.enganchar = function (A) {
    L.A = A;
    let guardado = null; try { guardado = localStorage.getItem('md_luces'); } catch (e) {}
    if (!guardado) L.aj = leerAjustes();                     // sin ajustes guardados: decide el valor por defecto ahora (ya se sabe si es el APK)
    const M = A.motor;
    M.nivelInicial = (i, t) => L.nivelInicialTecla(t);
    M.onNivel = (i, n) => { try { L.alNivel(i, n); } catch (x) {} };
    const tecla = M.tecla.bind(M);
    M.tecla = function (i, abajo) {
      if (abajo) {
        const t = M.teclas && M.teclas[i], e = M.estadoTecla && M.estadoTecla[i];
        const esApagado = !!(t && MD.Config.esLoop(t.tipo) && e && e.loop);
        try { L.alTecla(i, t, esApagado); } catch (x) {}
      }
      return tecla(i, abajo);
    };
    const activar = A.activar;
    A.activar = function (i) {
      const r = activar.apply(this, arguments);
      try { L.alEscena(A.cfg.escenas[i]); } catch (x) {}
      return r;
    };
    if (L.aj.activo) L.probarConexion().then(() => L.pintar());
  };

  // pinta los indicadores que esten en pantalla (la Mesa y Herramientas los registran)
  L.pintores = {};
  L.pintar = function () { for (const k in L.pintores) { try { L.pintores[k](); } catch (e) {} } };

  MD.LucesDnd = L;
})(window.MD);
