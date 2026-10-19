// ui.js - Las pantallas: Mesa (jugar), Escenas (editar), Sonidos (biblioteca) y Herramientas (packs, logos, ayuda).
window.MD = window.MD || {};
(function (MD) {
  const NOM = ['A1', 'B1', 'C1', 'D1', 'E1', 'A2', 'B2', 'C2', 'D2', 'E2'];
  function h(tag, attrs, ...hijos) {
    const e = document.createElement(tag);
    for (const k in (attrs || {})) {
      const v = attrs[k];
      if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v; else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of hijos.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  }
  function icoCanvas(hex, color) {
    const cv = document.createElement('canvas'); cv.width = 24; cv.height = 24;
    const b = MD.Iconos.deHex(hex); if (b) MD.Iconos.pintar(cv.getContext('2d'), b, 0, 0, 1, color || MD.Config.COLOR_HEX.blanco);
    return cv;
  }
  const tipoDe = id => MD.Config.TIPOS.find(t => t.id === id) || MD.Config.TIPOS[0];
  // v1.3: el marco de cada tecla se pinta igual que en la e-Paper del Macrodeck: el COLOR dice el comportamiento (loop amarillo, constante rojo,
  // silenciar/fade-out gris, el resto blanco) y el DUCKING se ve como marco doble + parlante con flecha.
  function celda(t, i, extra) {
    extra = extra || {};
    if (!t) return h('button', Object.assign({ class: 't vacia mgris', type: 'button' }, extra), h('span', { class: 'id' }, NOM[i]), h('span', { class: 'nom suave' }, 'vacia'));
    const C = MD.Config, col = C.colorModo(t.tipo), duck = !!t.ducking && C.admiteDucking(t.tipo);
    const gl = C.canvasArte(t.tipo, col === 'gris' ? C.COLOR_HEX.blanco : C.COLOR_HEX[col]); gl.className = 'gl'; gl.style.width = (gl.width * 1.5) + 'px';
    let dk = null;
    if (duck) { dk = C.canvasArte('ducking', C.COLOR_HEX.amarillo); dk.className = 'dk'; dk.style.width = (dk.width * 1.5) + 'px'; }
    return h('button', Object.assign({ class: 't m' + col + (duck ? ' duck' : ''), type: 'button' }, extra),
      h('span', { class: 'id' }, NOM[i]), gl, dk,
      t.icono ? icoCanvas(t.icono) : null, h('span', { class: 'nom' + ((t.nombre || '').split(/\s+/).some(p => p.length >= 7) ? ' larga' : '') }, t.nombre || '(sin nombre)'));
  }
  // Leyenda: que significa cada color y dibujito del mapa
  function leyenda() {
    const C = MD.Config;
    const fila = (clave, col, titulo, texto) => {
      const cv = C.canvasArte(clave, C.COLOR_HEX[col === 'gris' ? 'blanco' : col]); cv.style.cssText = 'width:' + (cv.width * 2) + 'px;image-rendering:pixelated;flex:none';
      return h('div', { class: 'ley' }, cv, h('div', null, h('b', { style: 'color:' + C.COLOR_HEX[col] }, titulo), ' ' + texto));
    };
    return h('details', { class: 'tarjeta leyenda' }, h('summary', null, 'Leyenda del mapa (colores y dibujitos)'),
      fila('una_vez', 'blanco', 'Blanco - Unico', 'suena completo cada vez. Tambien blanco: Al azar (?) y Secuencia (>>).'),
      fila('loop', 'amarillo', 'Amarillo - Loop', 'un toque lo prende, otro lo apaga.'),
      fila('intro_loop', 'amarillo', 'Amarillo con triangulo - Intro + Loop', 'suena la intro y entra solo en el loop; otro toque lo apaga.'),
      fila('mantener', 'rojo', 'Rojo - Constante', 'suena mientras mantenes la tecla.'),
      fila('silenciar', 'gris', 'Gris punteado - Acciones', 'Silenciar todo y Fade-out.'),
      fila('intensidad', 'gris', 'Gris con barras - Intensidad', 'regula el ultimo loop que prendiste (sonido y luces): cada toque sube un nivel.'),
      fila('ducking', 'amarillo', 'Marco doble + parlante con flecha - Ducking', 'mientras suena, baja la musica del celu (solo en la app Android).'));
  }
  function avisosTecla(A, t) {
    const out = [];
    if (!t) return out;
    if ((t.nombre || '').split(/\s+/).some(p => p.length > 7)) out.push('El nombre tiene una palabra de mas de 7 letras: en la pantalla e-Paper se va a cortar.');
    if (!t.nombre) out.push('La tecla no tiene nombre: en el Macrodeck se vera solo el icono.');
    if (['una_vez', 'loop', 'intro_loop', 'mantener', 'azar', 'secuencia'].includes(t.tipo) && t.sonidos.length < 1) out.push('Esta tecla no tiene sonido todavia.');
    if (t.tipo === 'intro_loop' && t.sonidos.length === 1) out.push('"Intro + Loop" con un solo sonido es igual que "Loop": agrega la intro ANTES del loop (el ultimo sonido es el que se repite).');
    if (t.tipo === 'azar' && t.sonidos.length === 1) out.push('"Al azar" con un solo sonido es igual que "Una vez".');
    t.sonidos.forEach(id => { if (!A.cfg.sonidos.some(s => s.id === id)) out.push('Falta un sonido que esta tecla usaba (se borro de la biblioteca).'); });
    return out;
  }

  // v1.3-dev13: ACORDEON de Herramientas. Una sola seccion abierta a la vez (A._acor); al tocar la cabecera se abre o se cierra.
  function acordeon(A, id, icono, titulo, resumen, cuerpo) {
    const abierto = A._acor === id;
    const cab = h('button', { type: 'button', class: 'acor-cab', id: 'acor_' + id, 'aria-expanded': abierto ? 'true' : 'false',
      onclick: () => { A._acor = abierto ? null : id; A.render(); } },
      MD.IUI.svg(icono, 'acor-ic'), h('span', { class: 'acor-tit' }, titulo), resumen ? h('span', { class: 'acor-res' }, resumen) : null, MD.IUI.svg('flecha', 'acor-flecha'));
    return h('section', { class: 'acor' + (abierto ? ' abierto' : ''), 'data-acor': id }, cab, abierto ? h('div', { class: 'acor-cuerpo' }, cuerpo()) : null);
  }

  // v1.3-dev8: aviso del ahorro de bateria de Android (solo en el APK). Se ve siempre; el boton solo si la app NO esta excluida.
  function filaBateria(A) {
    const txt = h('span', { id: 'estBateria', class: 'suave' }, 'Ahorro de bateria: comprobando…');
    const btn = h('button', { type: 'button', id: 'btnBateria', hidden: true, onclick: () => MD.Nativo.pedirExencionBateria() }, 'Excluir de ahorro de bateria');
    const poner = (ex) => {
      txt.textContent = ex ? 'Ahorro de bateria: la app esta EXCLUIDA (Android no la duerme).' : 'Ahorro de bateria: la app NO esta excluida, Android puede dormirla.';
      txt.className = ex ? 'suave' : 'aviso'; btn.hidden = !!ex;
    };
    A._bateriaPoner = poner;
    MD.Nativo.bateria().then(b => poner(!!(b && b.exento)));
    return h('div', null, h('p', { style: 'margin:0 0 6px' }, txt), h('div', { class: 'fila' }, btn));
  }
  // v1.3-dev8: modo del ducking (solo en el APK)
  function tarjetaDucking(A) {
    const modos = MD.DUCK_MODOS, cur = modos[A.duckModo] || modos.normal;
    const fila = h('div', { class: 'fila' });
    Object.keys(modos).forEach(k => fila.append(h('button', { type: 'button', id: 'duck_' + k, class: k === A.duckModo ? 'primario' : '', onclick: () => A.fijarDuckModo(k) }, modos[k].nombre)));
    return h('div', null,
      h('p', { class: 'suave', style: 'margin-top:0' }, 'Baja la musica de otras apps mientras suena un sonido. Elegi cuanto tarda la musica en bajar antes de que suene el sonido y cuanto tarda en volver. Probalo con YouTube de fondo y deja el que mejor te suene.'),
      fila,
      h('p', { class: 'suave', style: 'margin-bottom:0' }, cur.ayuda + ' (baja ' + cur.antes + ' ms antes de sonar y vuelve ' + cur.cola + ' ms despues del ultimo sonido.)'));
  }

  // v1.3-dev14: "Celu en la OLED" (solo en el APK). Muestra lo que ve el Macrodeck del celu y deja dar el "Acceso a notificaciones",
  // que Android exige para poder leer que esta sonando (YouTube, Spotify...). Se repinta solo, sin redibujar toda la pantalla.
  function textoCelu() {
    const c = MD.Celu ? MD.Celu.s : null; if (!c) return '';
    const bat = c.bat >= 0 ? c.bat + '%' + (c.carga ? ' (cargando)' : '') : 'no se sabe';
    const vol = c.vol >= 0 ? c.vol + '%' : 'no se sabe';
    const med = !c.acceso ? 'sin acceso (falta darlo)' : (c.suena ? 'suena: ' + (c.titulo || c.app || '?') : (c.sesion ? 'en pausa: ' + (c.titulo || c.app || '?') : 'no hay nada'));
    return 'Bateria del celu: ' + bat + ' · Volumen de musica: ' + vol + ' · Reproduccion: ' + med;
  }
  function tarjetaCelu(A) {
    const estado = h('p', { id: 'celuEstado', class: 'suave', style: 'margin-top:0' }, textoCelu());
    const aviso = h('p', { id: 'celuAcceso' });
    const btn = h('button', { type: 'button', id: 'btnAccesoMedios', onclick: () => MD.Celu.pedirAcceso() }, 'Dar acceso a notificaciones');
    const pintar = () => {
      estado.textContent = textoCelu();
      const ok = !!(MD.Celu && MD.Celu.s.acceso);
      aviso.className = ok ? 'suave' : 'aviso';
      aviso.textContent = ok ? 'Acceso a notificaciones: dado. El Macrodeck puede ver si suena YouTube y como se llama.' : 'Falta el "Acceso a notificaciones". Sin eso Android no deja ver que esta sonando. Toca el boton, busca "Macrodeck" en la lista y activalo.';
      btn.hidden = ok;
    };
    pintar(); A._celuPintar = pintar;
    return h('div', null,
      h('p', { class: 'suave', style: 'margin-top:0' }, 'La OLED del Macrodeck muestra la bateria de este celu, su volumen y si suena algo de YouTube. Para que sepa si suena y el titulo, Android pide un permiso unico.'),
      estado, aviso, h('div', { class: 'fila' }, btn),
      h('p', { class: 'suave', style: 'margin-bottom:0' }, 'Que volumen mueve la perilla en el programa D&D (sonidos o celu) se elige en el Macrodeck: Ajustes > Knob > D&D knob. En el programa, HOME + B1 lo cambia al vuelo.'));
  }

  // ===================== MESA =====================
  function vistaMesa(A, el) {
    const con = h('div', { class: 'tarjeta' });
    const esBle = A.tr && A.tr.tipo === 'ble' && A.tr.estado !== 'desconectado';
    const esSim = A.tr && A.tr.tipo === 'sim' && A.tr.conectado;
    con.append(h('h3', null, 'Conexion'));
    if (MD.Nativo) con.append(filaBateria(A));      // v1.3-dev8: el estado del ahorro de bateria se ve siempre, conectado o no
    if (MD.Nativo && MD.Celu && !MD.Celu.s.acceso) con.append(h('p', { class: 'suave', id: 'avisoAccesoMedios' }, 'Para ver en la OLED si suena YouTube falta un permiso: Herramientas > Celu en la OLED.'));
    if (!esBle && !esSim) {
      if (MD.Nativo) con.append(h('p', { class: 'suave', id: 'avisoApk' }, 'Modo APK' + (MD.Nativo.simulado ? ' (Android simulado)' : '') + ': Bluetooth nativo, servicio en segundo plano y ducking real.'));
      else if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform())
        con.append(h('p', { class: 'aviso', id: 'avisoApkSin' }, 'Este APK se armo SIN el plugin nativo (version de emergencia): abre la app y reproduce sonidos, pero no se conecta por Bluetooth.'));
      if (!MD.hayBle()) con.append(h('p', { class: 'aviso' }, 'Este navegador no tiene Bluetooth web. En el celu usa Chrome (Android). En la compu, Chrome o Edge. Mientras tanto podes probar con el simulador.'));
      con.append(h('div', { class: 'fila' },
        h('button', { class: 'primario', type: 'button', id: 'btnConectar', onclick: () => A.conectarBle() }, 'Conectar Macrodeck'),
        h('button', { type: 'button', id: 'btnSim', onclick: () => A.usarSimulador() }, 'Probar con el simulador')));
      con.append(h('p', { class: 'suave' }, 'En el Macrodeck abri el programa D&D (desde el lobby): va a decir "Buscando…". Despues toca "Conectar" y elegi "Macrodeck".'));
    } else {
      con.append(h('div', { class: 'fila' }, h('span', { class: 'crece' }, esSim ? 'Simulador activo' : 'Estado: ' + A.tr.estado + (A.tr.detalle ? ' (' + A.tr.detalle + ')' : '')),
        h('button', { type: 'button', onclick: () => A.cortar() }, 'Desconectar')));
    }
    el.append(con);

    const bar = h('div', { class: 'escenas' });
    A.cfg.escenas.forEach((e, i) => bar.append(h('button', { type: 'button', class: i === A.activa ? 'on' : '', onclick: () => A.activar(i) }, e.nombre)));
    el.append(bar);

    const rej = h('div', { class: 'rejilla' });
    const esc = A.cfg.escenas[A.activa];
    A.mesaCeldas = esc.teclas.map((t, i) => {
      const c = celda(t, i, {});
      const dn = (e) => { e.preventDefault(); A.audioPrimero(); A.motor.tecla(i, true); };
      const up = (e) => { e.preventDefault(); A.motor.tecla(i, false); };
      c.addEventListener('pointerdown', dn); c.addEventListener('pointerup', up); c.addEventListener('pointerleave', up); c.addEventListener('pointercancel', up);
      rej.append(c); return c;
    });
    el.append(rej);
    el.append(leyenda());
    if (MD.LucesDnd) { const lm = lucesMesa(A); if (lm) el.append(lm); }

    const vol = h('input', { type: 'range', min: 0, max: 255, value: Math.round(A.motor.volGeneral * 255), oninput: (e) => { A.motor.fijarVolumen(e.target.value / 255); } });
    A.mesaVol = vol;
    A.mesaSonando = h('div', { class: 'sonando' });
    A.mesaDuck = h('span', { class: 'duck-badge', hidden: !A.duckActivo }, 'Ducking');
    el.append(h('div', { class: 'tarjeta', style: 'margin-top:14px' },
      h('div', { class: 'fila' }, h('div', { class: 'crece' }, h('label', { style: 'margin:0' }, 'Volumen (la perilla del Macrodeck lo mueve)'), vol), A.mesaDuck),
      A.mesaSonando,
      h('div', { class: 'fila' },
        h('button', { type: 'button', onclick: () => A.motor.alternarSilencio() }, 'Silenciar / devolver'),
        h('button', { type: 'button', onclick: () => A.motor.fadeoutTotal(2.5) }, 'Fade-out'),
        h('button', { class: 'peligro', type: 'button', onclick: () => A.motor.pararTodo() }, 'Cortar todo'))));

    if (A.tr && A.tr.tipo === 'sim' && !(MD.Maqueta && MD.Maqueta.activa())) {      // 1.3-dev22: en pantalla ancha el simulador vive en el panel de la derecha
      const caja = h('div', { class: 'tarjeta' }, h('h3', null, 'Macrodeck simulado'));
      caja.append(A.simRaiz); el.append(caja);
    }
  }

  // ===================== LUCES DE D&D (1.3-dev16) =====================
  // Select de looks: "(nada)" + de fabrica + propios. valor = id del look ('' = nada)
  function selLook(A, valor, alCambiar, textoNada) {
    const LZ = MD.LucesDnd, propios = A.cfg.looks || [];
    const op = (l) => h('option', { value: l.id, selected: l.id === valor }, l.nombre + ' · ' + ((LZ.EFECTOS.find(e => e[0] === l.efecto) || [])[1] || l.efecto));
    const huerfano = valor && !LZ.look(valor) ? h('option', { value: valor, selected: true }, '(look que no esta en este celu)') : null;
    return h('select', { onchange: (e) => alCambiar(e.target.value) },
      h('option', { value: '', selected: !valor }, textoNada || '(nada)'), huerfano,
      h('optgroup', { label: 'De fabrica' }, LZ.FABRICA.map(op)),
      propios.length ? h('optgroup', { label: 'Mis looks' }, propios.map(op)) : null);
  }
  function muestraLook(l) {
    return h('span', { class: 'look-muestra ef-' + (l ? l.efecto : 'nada'), style: l && l.efecto !== 'apagado' ? '--lc:' + l.color : '' });
  }
  function avisoLucesApagadas(A) {
    const LZ = MD.LucesDnd;
    if (LZ.aj.activo) return null;
    return h('p', { class: 'suave', style: 'margin:4px 0 0' }, 'Las luces estan apagadas en este celu (se guardan igual). Se prenden en Herramientas > Luces de D&D.');
  }
  // En el editor de la tecla: una fila por lampara (look + cuando)
  function lucesTecla(A, t) {
    const LZ = MD.LucesDnd;
    const caja = h('div', { class: 'tarjeta luces-tecla', style: 'background:var(--panel2);margin-top:14px' },
      h('div', { class: 'fila' }, MD.IUI.svg('luz', 'ic-luz'), h('strong', null, 'Luces de D&D')));
    const lista = () => (t.luces = t.luces || []);
    LZ.LAMPARAS.forEach((lp) => {
      const x = (t.luces || []).find(o => o.luz === lp.id);
      const fila = h('div', { class: 'luz-fila' });
      const quitar = () => { t.luces = (t.luces || []).filter(o => o.luz !== lp.id); if (!t.luces.length) delete t.luces; };
      const sel = selLook(A, x ? x.look : '', (v) => {
        if (!v) quitar(); else { const y = lista().find(o => o.luz === lp.id); if (y) y.look = v; else lista().push({ luz: lp.id, look: v, cuando: MD.Config.esLoop(t.tipo) ? 'suena' : 'momento', seg: 2 }); }
        A.cambio(false); A.render();
      }, '(no la toca)');
      fila.append(h('label', { style: 'margin-top:6px' }, LZ.nombreLampara(lp.id)), h('div', { class: 'fila' }, muestraLook(x && LZ.look(x.look)), h('div', { class: 'crece' }, sel)));
      if (x) {
        const cuando = h('select', { onchange: (e) => { x.cuando = e.target.value; A.cambio(false); A.render(); } }, LZ.CUANDO.map(c => h('option', { value: c[0], selected: c[0] === x.cuando }, c[1])));
        const extra = x.cuando === 'momento'
          ? h('div', { class: 'seg' }, h('input', { type: 'number', min: 0.5, max: 60, step: 0.5, value: x.seg, 'aria-label': 'Segundos', oninput: (e) => { x.seg = Math.max(0.5, Math.min(60, Number(e.target.value) || 2)); A.cambio(false); } }), h('span', { class: 'suave' }, 's'))
          : null;
        fila.append(h('div', { class: 'fila', style: 'margin-top:6px' }, h('div', { class: 'crece' }, cuando), extra,
          h('button', { type: 'button', title: 'Probar en la lampara', onclick: () => { const l = LZ.look(x.look); if (l) LZ.probarLook(l, lp.id); } }, 'Probar')));
      }
      caja.append(fila);
    });
    caja.append(h('p', { class: 'suave', style: 'margin:8px 0 0' }, 'Momento: el efecto va encima del ambiente de la escena y despues vuelve. Mientras suena: dura lo que dura el sonido (en un loop, hasta que lo apagues). Se queda: cambia el ambiente hasta la proxima escena. Si hay varios efectos a la vez en una lampara se ve el ultimo, y cuando termina vuelve el anterior (un hechizo encima de un fuego que sigue sonando: despues del hechizo vuelve el fuego).'));
    const av = avisoLucesApagadas(A); if (av) caja.append(av);
    return caja;
  }
  // En el editor de la escena: el ambiente de cada lampara
  function lucesEscena(A, esc) {
    const LZ = MD.LucesDnd;
    const caja = h('div', { class: 'tarjeta' }, h('div', { class: 'fila' }, MD.IUI.svg('luz', 'ic-luz'), h('h3', { style: 'margin:0' }, 'Luz de ambiente de la escena')));
    LZ.LAMPARAS.forEach((lp) => {
      const id = (esc.luz || {})[lp.id] || '';
      caja.append(h('label', null, LZ.nombreLampara(lp.id)), h('div', { class: 'fila' }, muestraLook(LZ.look(id)), h('div', { class: 'crece' }, selLook(A, id, (v) => {
        esc.luz = esc.luz || {};
        if (v) esc.luz[lp.id] = v; else delete esc.luz[lp.id];
        if (!Object.keys(esc.luz).length) delete esc.luz;
        A.cambio(false); A.render();
      }, '(no la cambia)')), id ? h('button', { type: 'button', onclick: () => { const l = LZ.look(id); if (l) LZ.probarLook(l, lp.id); } }, 'Probar') : null));
    });
    caja.append(h('p', { class: 'suave', style: 'margin:8px 0 0' }, 'Se pone sola al entrar a la escena (desde la app o con el selector del Macrodeck).'));
    const av = avisoLucesApagadas(A); if (av) caja.append(av);
    return caja;
  }
  // En la Mesa: estado y botones rapidos
  function lucesMesa(A) {
    const LZ = MD.LucesDnd;
    if (!LZ || !LZ.aj.activo) return null;
    const estado = h('span', { class: 'crece suave', id: 'lucesEstado' });
    const pintar = () => { const e = document.getElementById('lucesEstado'); if (!e) return; e.textContent = LZ.estado === 'conectado' ? 'Luces: conectado' + (LZ.conectadas ? ' (' + LZ.conectadas.conectadas + '/' + LZ.conectadas.luces + ')' : '') : (LZ.estado === 'sin conexion' ? 'Luces: sin conexion — ' + LZ.ultimoError : 'Luces: sin probar'); };
    LZ.pintores.mesa = pintar; setTimeout(pintar, 0);
    return h('div', { class: 'tarjeta' },
      h('div', { class: 'fila' }, MD.IUI.svg('luz', 'ic-luz'), estado),
      h('div', { class: 'fila', style: 'margin-top:8px' },
        h('button', { type: 'button', onclick: () => LZ.alEscena(A.cfg.escenas[A.activa]) }, 'Ambiente de la escena'),
        h('button', { type: 'button', onclick: () => LZ.pararMomentos() }, 'Cortar efectos'),
        h('button', { type: 'button', onclick: () => LZ.enviar([{ grupo: 'dnd', look: { efecto: 'apagado' }, capa: 'ambiente' }]) }, 'Apagar luces')));
  }
  // Herramientas: ajustes de este celu + biblioteca de looks
  function tarjetaLuces(A) {
    const LZ = MD.LucesDnd, cfg = A.cfg;
    cfg.looks = cfg.looks || [];
    const res = h('p', { class: 'suave', id: 'lucesPrueba', style: 'margin:6px 0 0' }, A._lucesMsg || '');
    const cuerpo = h('div', null,
      h('p', { class: 'suave', style: 'margin-top:0' }, 'Las 2 lamparas de D&D las maneja la app "Macrodeck Luces" (el servidor de luces) que corre en este mismo celu. Esta app le pide los efectos; el servidor los anima.'),
      h('label', { class: 'chk', style: 'margin-top:0' }, h('input', { type: 'checkbox', checked: LZ.aj.activo, onchange: (e) => { LZ.aj.activo = e.target.checked; LZ.guardarAjustes(); A.render(); } }), ' Usar las luces en este celu'),
      h('label', null, 'Direccion del servidor de luces'),
      h('input', { type: 'text', value: LZ.aj.servidor, oninput: (e) => { LZ.aj.servidor = e.target.value.trim().replace(/\/+$/, ''); LZ.guardarAjustes(); } }),
      h('p', { class: 'suave', style: 'margin:4px 0 0' }, 'En el dummy (las dos apps en el mismo celu): http://127.0.0.1:8765. Desde otro celu: la IP del dummy.'),
      h('div', { class: 'fila', style: 'margin-top:8px' },
        h('button', { type: 'button', onclick: async () => { A._lucesMsg = 'Probando…'; res.textContent = A._lucesMsg; A._lucesMsg = await LZ.probarConexion(); res.textContent = A._lucesMsg; } }, 'Probar conexion'),
        h('button', { type: 'button', onclick: () => LZ.pararTodo() }, 'Parar todos los efectos')),
      res);
    // biblioteca
    const lib = h('div', { class: 'looks' });
    const editar = A._lookEd ? cfg.looks.find(l => l.id === A._lookEd) : null;
    const fila = (l, propio) => h('div', { class: 'look-fila' + (editar === l ? ' sel' : '') }, muestraLook(l),
      h('span', { class: 'crece' }, h('strong', null, l.nombre), h('small', { class: 'suave' }, ' ' + ((LZ.EFECTOS.find(e => e[0] === l.efecto) || [])[1] || l.efecto) + (l.efecto === 'apagado' ? '' : ' · ' + l.brillo + '%'))),
      h('button', { type: 'button', title: 'Probar 3 s en las dos lamparas', onclick: () => LZ.probarLook(l) }, '▶'),
      propio ? h('button', { type: 'button', onclick: () => { A._lookEd = A._lookEd === l.id ? null : l.id; A.render(); } }, A._lookEd === l.id ? 'Cerrar' : 'Editar')
             : h('button', { type: 'button', title: 'Hacer una copia editable', onclick: () => { const c = LZ.normLook(Object.assign({}, l, { id: MD.Config.nuevoId('l'), nombre: (l.nombre + ' 2').slice(0, 24) })); cfg.looks.push(c); A._lookEd = c.id; A.cambio(false); A.render(); } }, 'Duplicar'));
    lib.append(h('h3', { style: 'margin:14px 0 6px' }, 'Mis looks'));
    if (!cfg.looks.length) lib.append(h('p', { class: 'suave', style: 'margin:0 0 6px' }, 'Todavia no hiciste ninguno. Crea uno nuevo o duplica uno de fabrica.'));
    cfg.looks.forEach((l) => { lib.append(fila(l, true)); if (editar === l) lib.append(editorLook(A, l)); });
    lib.append(h('div', { class: 'fila', style: 'margin:6px 0 4px' }, h('button', { class: 'primario', type: 'button', onclick: () => { const c = LZ.normLook({ nombre: 'Nuevo look', efecto: 'fuego', color: '#ff6a00', brillo: 80, velocidad: 1 }); cfg.looks.push(c); A._lookEd = c.id; A.cambio(false); A.render(); } }, '+ Nuevo look')));
    lib.append(h('h3', { style: 'margin:14px 0 6px' }, 'De fabrica'));
    LZ.FABRICA.forEach(l => lib.append(fila(l, false)));
    cuerpo.append(lib);
    return cuerpo;
  }
  // v1.3-dev18: barra "Guardar" de los editores. Muestra el estado del guardado y, con 'mapa', manda ya los cambios al Macrodeck.
  // Si la escena que se esta editando NO es la activa, avisa (la Mesa y el Macrodeck muestran la activa) y ofrece activarla.
  function barraGuardar(A, mapa, avisoEscena) {
    const estado = h('span', { class: 'js-guardado suave' }, A.textoGuardado ? A.textoGuardado() : '');
    const btn = h('button', { class: 'primario', type: 'button', onclick: async () => { btn.disabled = true; try { await A.guardarBoton(mapa); } catch (e) {} btn.disabled = false; } }, 'Guardar');
    const fila = h('div', { class: 'barra-guardar' }, btn, estado);
    if (avisoEscena && A.edEsc !== A.activa) {
      fila.append(h('button', { type: 'button', onclick: async () => { try { await A.guardarBoton(true); } catch (e) {} A.activar(A.edEsc); A.render(); } }, 'Guardar y activar esta escena'));
      fila.append(h('div', { class: 'suave nota-guardar' }, 'Esta no es la escena activa (la activa es "' + ((A.cfg.escenas[A.activa] || {}).nombre || '') + '"). La Mesa y el Macrodeck muestran la activa: estos cambios se ven al activar esta escena.'));
    }
    return fila;
  }
  function editorLook(A, l) {
    const LZ = MD.LucesDnd;
    const cam = (campo, conv, render) => (e) => { l[campo] = conv ? conv(e.target.value) : e.target.value; A.cambio(false); if (render) A.render(); };
    const etB = h('span', null, l.brillo + '%'), etV = h('span', null, '×' + l.velocidad), etI = h('span', null, LZ.nombreNivel(l.efecto, l.intensidad));
    let seguro = false;
    return h('div', { class: 'tarjeta', style: 'background:var(--panel2);margin:6px 0 10px' },
      h('label', { style: 'margin-top:0' }, 'Nombre'), h('input', { type: 'text', maxlength: 24, value: l.nombre, oninput: cam('nombre') }),
      h('label', null, 'Efecto'), h('select', { onchange: cam('efecto', null, true) }, LZ.EFECTOS.map(e => h('option', { value: e[0], selected: e[0] === l.efecto }, e[1]))),
      h('p', { class: 'suave', style: 'margin:4px 0 0' }, (LZ.EFECTOS.find(e => e[0] === l.efecto) || [])[2] || ''),
      l.efecto === 'apagado' ? null : h('div', { class: 'cols' },
        h('div', null, h('label', null, 'Color'), h('input', { type: 'color', value: l.color, oninput: cam('color') })),
        h('div', null, h('label', null, 'Brillo ', etB), h('input', { type: 'range', min: 1, max: 100, value: l.brillo, oninput: (e) => { l.brillo = Number(e.target.value); etB.textContent = l.brillo + '%'; A.cambio(false); } })),
        ['fijo'].includes(l.efecto) ? null : h('div', null, h('label', null, 'Velocidad ', etV), h('input', { type: 'range', min: 0.25, max: 3, step: 0.25, value: l.velocidad, oninput: (e) => { l.velocidad = Number(e.target.value); etV.textContent = '×' + l.velocidad; A.cambio(false); } })),
        h('div', null, h('label', null, 'Intensidad ', etI), h('input', { type: 'range', min: 1, max: 5, step: 1, value: l.intensidad || 5, oninput: (e) => { l.intensidad = Number(e.target.value); etI.textContent = LZ.nombreNivel(l.efecto, l.intensidad); A.cambio(false); } }))),
      l.efecto === 'apagado' ? null : h('p', { class: 'suave', style: 'margin:4px 0 0' }, 'Intensidad: 5 es a pleno. En la Tormenta va de llovizna con truenos lejanos a temporal; en el resto baja el brillo. La tecla "Intensidad" la cambia en vivo.'),
      h('div', { class: 'fila', style: 'margin-top:10px' },
        h('button', { class: 'primario', type: 'button', onclick: () => LZ.probarLook(l) }, 'Probar 3 s'),
        h('button', { class: 'peligro', type: 'button', onclick: (e) => {
          const usos = usosLook(A, l.id);
          if (!seguro) { seguro = true; e.target.textContent = usos ? 'Se usa en ' + usos + ' lugar(es). ¿Borrar?' : '¿Seguro?'; return; }
          A.cfg.looks = A.cfg.looks.filter(x => x !== l); A._lookEd = null; A.cambio(false); A.render();
        } }, 'Borrar')),
      barraGuardar(A, false, false));
  }
  function usosLook(A, id) {
    let n = 0;
    for (const e of A.cfg.escenas) {
      for (const k in (e.luz || {})) if (e.luz[k] === id) n++;
      for (const t of e.teclas) if (t && t.luces) for (const x of t.luces) if (x.look === id) n++;
    }
    return n;
  }

  // ===================== ESCENAS (editor) =====================
  function vistaEscenas(A, el) {
    const cfg = A.cfg;
    A.edEsc = Math.min(A.edEsc, cfg.escenas.length - 1);
    const esc = cfg.escenas[A.edEsc];
    const bar = h('div', { class: 'escenas' });
    const dm = !!(MD.Drive && MD.Drive.esDM());                    // 1.3-dev21: Frodo (DM) arma en borrador y confirma
    cfg.escenas.forEach((e, i) => bar.append(h('button', { type: 'button', class: i === A.edEsc ? 'on' : '', title: e.estado === 'borrador' ? 'Borrador (solo lo ves vos)' : '', onclick: () => { A.edEsc = i; A.edTecla = null; A.render(); } }, (e.estado === 'borrador' ? '✎ ' : '') + e.nombre)));
    if (cfg.escenas.length < 10) bar.append(h('button', { type: 'button', id: 'btnNuevaEscena', onclick: () => { cfg.escenas.push(MD.Config.escenaNueva('Escena ' + (cfg.escenas.length + 1), dm ? 'borrador' : '')); A.edEsc = cfg.escenas.length - 1; A.edTecla = null; A.cambio(true); A.render(); } }, '+ Escena'));
    el.append(bar);

    const nombre = h('input', { type: 'text', value: esc.nombre, maxlength: 30, oninput: (e) => { esc.nombre = e.target.value; A.cambio(true); } });
    const mover = (d) => { const j = A.edEsc + d; if (j < 0 || j >= cfg.escenas.length) return; [cfg.escenas[A.edEsc], cfg.escenas[j]] = [cfg.escenas[j], cfg.escenas[A.edEsc]]; if (A.activa === A.edEsc) A.activa = j; else if (A.activa === j) A.activa = A.edEsc; A.edEsc = j; A.cambio(true); A.render(); };
    let seguro = false;
    const borrar = h('button', { class: 'peligro', type: 'button', onclick: (e) => {
      if (cfg.escenas.length < 2) return;
      if (!seguro) { seguro = true; e.target.textContent = 'Seguro? toca otra vez'; e.target.classList.add('seguro'); return; }
      cfg.escenas.splice(A.edEsc, 1); A.edEsc = Math.max(0, A.edEsc - 1); A.edTecla = null; if (A.activa >= cfg.escenas.length) A.activa = 0; A.activarSinSonido(); A.cambio(true); A.render();
    } }, 'Borrar escena');
    const dup = h('button', { type: 'button', onclick: () => { if (cfg.escenas.length >= 10) return; const c = JSON.parse(JSON.stringify(esc)); c.id = MD.Config.nuevoId('e'); c.nombre = (esc.nombre + ' (copia)').slice(0, 30); if (dm) c.estado = 'borrador'; cfg.escenas.splice(A.edEsc + 1, 0, c); A.edEsc++; A.cambio(true); A.render(); } }, 'Duplicar');
    // 1.3-dev21: estado de la escena. Borrador = en preparacion (Tom no la ve). Confirmada = ya la ve y la usa Tom al sincronizar con Drive.
    const borrador = esc.estado === 'borrador';
    const estadoFila = dm ? h('div', { class: 'fila', style: 'margin-bottom:10px;align-items:center' },
      h('span', { class: 'crece suave' }, borrador ? '✎ Borrador: Tom todavia no la ve.' : '✓ Confirmada: Tom la ve al sincronizar.'),
      h('button', { type: 'button', class: borrador ? 'primario' : '', id: 'btnConfirmar', onclick: () => { if (borrador) delete esc.estado; else esc.estado = 'borrador'; A.cambio(true); A.render(); } }, borrador ? 'Confirmar escena' : 'Volver a borrador')) : null;
    el.append(h('div', { class: 'tarjeta' },
      estadoFila,
      h('label', { style: 'margin-top:0' }, 'Nombre de la escena (en el selector del Macrodeck se ven ~7 letras)'), nombre,
      h('div', { class: 'fila', style: 'margin-top:10px' }, h('button', { type: 'button', onclick: () => mover(-1) }, '←'), h('button', { type: 'button', onclick: () => mover(1) }, '→'), dup, borrar),
      barraGuardar(A, true, false)));
    if (MD.LucesDnd) el.append(lucesEscena(A, esc));

    const rej = h('div', { class: 'rejilla' });
    esc.teclas.forEach((t, i) => { const c = celda(t, i, { onclick: () => { A.edTecla = i; A.render(); } }); if (i === A.edTecla) c.classList.add('sel'); rej.append(c); });
    el.append(h('div', { class: 'tarjeta' }, h('p', { class: 'suave', style: 'margin-top:0' }, 'Toca una tecla para editarla. Estan en el mismo orden que en el Macrodeck (arriba A1–E1, abajo A2–E2).'), rej));
    el.append(leyenda());

    if (A.edTecla != null) el.append(editorTecla(A, esc, A.edTecla));
  }

  function editorTecla(A, esc, i) {
    const cfg = A.cfg; const t = esc.teclas[i];
    const caja = h('div', { class: 'tarjeta', id: 'editorTecla' });
    caja.append(h('h3', null, 'Tecla ' + NOM[i]));
    if (!t) {
      caja.append(h('p', { class: 'suave' }, 'Esta tecla esta vacia.'));
      const fila = h('div', { class: 'fila' }, h('button', { class: 'primario', type: 'button', id: 'btnCrearTecla', onclick: () => { esc.teclas[i] = MD.Config.teclaNueva({ nombre: 'Nueva' }); A.cambio(true); A.render(); } }, 'Crear tecla'));
      if (A.portapapeles) fila.append(h('button', { type: 'button', onclick: () => { esc.teclas[i] = JSON.parse(JSON.stringify(A.portapapeles)); A.cambio(true); A.render(); } }, 'Pegar "' + (A.portapapeles.nombre || 'tecla') + '"'));
      caja.append(fila); return caja;
    }
    const cam = (campo, render) => (e) => { const v = (e.target.type === 'number' || e.target.type === 'range') ? Number(e.target.value) : e.target.value; t[campo] = v; if (campo === 'tipo' && !MD.Config.admiteDucking(v)) t.ducking = false;
      if (campo === 'tipo' && v === 'intensidad') { if (!t.icono) t.icono = MD.Config.ICONO_INTENSIDAD; if (!t.nombre) t.nombre = 'Intensidad'; }
      A.cambio(true); if (render) A.render(); };
    const av = h('ul', { class: 'avisos' });
    const actAv = () => { av.innerHTML = ''; avisosTecla(A, t).forEach(x => av.append(h('li', null, x))); };

    caja.append(h('label', { style: 'margin-top:0' }, 'Nombre (hasta 18 letras, sin palabras de mas de 7)'),
      h('input', { type: 'text', id: 'inNombre', maxlength: 18, value: t.nombre, oninput: (e) => { t.nombre = e.target.value; A.cambio(true); actAv(); } }));
    caja.append(h('label', null, 'Comportamiento (decide el color del marco en el Macrodeck)'),
      h('select', { id: 'selTipo', onchange: cam('tipo', true) }, MD.Config.TIPOS.map(c => h('option', { value: c.id, selected: c.id === t.tipo }, c.nombre))));
    caja.append(h('p', { class: 'suave' }, tipoDe(t.tipo).ayuda));

    if (!['silenciar', 'fadeout', 'intensidad'].includes(t.tipo)) {
      const introLoop = t.tipo === 'intro_loop';
      const multi = ['azar', 'secuencia', 'intro_loop'].includes(t.tipo);
      caja.append(h('label', null, introLoop ? 'Sonidos (en orden: primero la intro, al final el loop)' : (multi ? 'Sonidos (en orden)' : 'Sonido')));
      if (introLoop) caja.append(h('p', { class: 'suave', style: 'margin-top:0' }, 'Suenan en este orden, uno atras del otro sin cortes, y el ULTIMO se repite hasta que lo apagues. Podes poner mas de una intro.'));
      const lista = h('div', { class: 'lista-s' });
      t.sonidos.forEach((id, k) => {
        const s = cfg.sonidos.find(x => x.id === id);
        const esElLoop = introLoop && k === t.sonidos.length - 1;
        lista.append(h('div', { class: 's' }, introLoop ? h('span', { class: 'etq' + (esElLoop ? ' loop' : '') }, esElLoop ? 'LOOP' : 'INTRO' + (t.sonidos.length > 2 ? ' ' + (k + 1) : '')) : null, h('span', { class: 'crece' }, s ? s.nombre : '(falta)'),
          h('button', { type: 'button', onclick: () => A.previa(id) }, '▶'),
          multi ? h('button', { type: 'button', onclick: () => { if (k > 0) { [t.sonidos[k - 1], t.sonidos[k]] = [t.sonidos[k], t.sonidos[k - 1]]; A.cambio(true); A.render(); } } }, '↑') : null,
          h('button', { class: 'peligro', type: 'button', onclick: () => { t.sonidos.splice(k, 1); A.cambio(true); A.render(); } }, '✕')));
      });
      caja.append(lista);
      {
        // v1.3-dev9: ventana con buscador, categorias y seleccion multiple (selector.js)
        caja.append(h('button', { type: 'button', id: 'btnAgregarSonidos', class: 'primario', disabled: !cfg.sonidos.length, style: 'width:100%',
          onclick: () => {
            const unico = t.tipo === 'una_vez';                    // v1.3-dev10: en una tecla Unica se pueden marcar varios y se convierte en Al azar / En secuencia
            MD.Selector.abrir(A, { multi: multi || unico, convertir: unico, yaEstan: t.sonidos,
              titulo: (multi ? 'Agregar sonidos a ' : (unico ? 'Elegir sonidos para ' : 'Elegir sonido para ')) + (t.nombre || 'la tecla ' + NOM[i]),
              nota: unico ? 'Marca uno para un sonido solo, o varios para que la tecla pase a "Al azar" o "En secuencia".' : (introLoop ? 'Marca primero la intro y despues el loop: quedan en el orden en que los marcas, y el ultimo es el que se repite.' : (multi ? '' : 'Este comportamiento usa un solo sonido. Para varios, cambia el comportamiento a "Al azar" o "Secuencia".')),
              alAceptar: (ids, como) => {
                if (multi) t.sonidos.push(...ids);
                else if (unico) { t.sonidos = ids.slice(); if (ids.length > 1) { t.tipo = como === 'secuencia' ? 'secuencia' : 'azar'; } }
                else t.sonidos = [ids[0]];
                A.cambio(true); A.render();
              } });
          } },
          cfg.sonidos.length ? (multi ? (introLoop ? '+ Agregar intro / loop…' : '+ Agregar sonidos…') : (t.sonidos.length ? 'Cambiar sonido…' : (t.tipo === 'una_vez' ? 'Elegir sonido(s)…' : 'Elegir sonido…'))) : 'Primero importa sonidos (pestana Sonidos o Drive)'));
      }
    }
    if (!['silenciar', 'intensidad'].includes(t.tipo)) {
      const etVol = h('label', null, 'Volumen de la tecla (' + Math.round(t.volumen * 100) + '%)');
      caja.append(h('div', { class: 'cols' },
        h('div', null, etVol, h('input', { type: 'range', min: 0, max: 1.5, step: 0.05, value: t.volumen, oninput: (e) => { t.volumen = +e.target.value; A.cambio(false); etVol.textContent = 'Volumen de la tecla (' + Math.round(t.volumen * 100) + '%)'; } })),
        ['loop', 'intro_loop', 'mantener', 'una_vez', 'azar', 'secuencia'].includes(t.tipo) ? h('div', null, h('label', null, 'Entrada (fundido, segundos)'), h('input', { type: 'number', min: 0, max: 10, step: 0.5, value: t.entrada, oninput: cam('entrada') })) : null,
        ['loop', 'intro_loop', 'mantener', 'fadeout'].includes(t.tipo) ? h('div', null, h('label', null, 'Salida (fundido, segundos)'), h('input', { type: 'number', min: 0, max: 10, step: 0.5, value: t.salida, oninput: cam('salida') })) : null));
    }
    if (MD.Config.admiteDucking(t.tipo)) {
      const nativo = !!(MD.Nativo && MD.Nativo.duck);
      caja.append(h('label', { class: 'chk' },
        h('input', { type: 'checkbox', id: 'chkDucking', checked: !!t.ducking, onchange: (e) => { t.ducking = e.target.checked; A.cambio(true); A.render(); } }),
        ' Ducking: bajar la musica del celu mientras suena este sonido'),
        h('p', { class: 'suave' }, nativo
          ? 'Mientras suena (y 0,7 s despues) Android baja el volumen de YouTube/Spotify y despues lo devuelve solo. El nivel lo decide Android.'
          : 'Se guarda y se ve en el mapa del Macrodeck, pero SOLO baja la musica dentro de la app Android (APK). En el navegador no hace nada.'));
    }
    if (['una_vez', 'azar', 'secuencia', 'mantener'].includes(t.tipo))
      caja.append(h('label', null, 'Si la tocas mientras ya suena'), h('select', { onchange: cam('retoque') }, MD.Config.RETOQUES.map(r => h('option', { value: r.id, selected: r.id === t.retoque }, r.nombre))));
    if (MD.Config.esLoop(t.tipo))
      caja.append(h('label', null, 'Grupo exclusivo (los loops con el mismo grupo se reemplazan entre si con fundido cruzado; ej: "amb")'), h('input', { type: 'text', maxlength: 20, value: t.grupo, oninput: cam('grupo') }));

    if (MD.LucesDnd && !['silenciar', 'intensidad'].includes(t.tipo)) caja.append(lucesTecla(A, t));

    // v1.3-dev11: selector de iconos con CATEGORIAS, BUSCADOR y SUGERENCIAS segun el nombre de la tecla (428 iconos, ver iconos_datos.js)
    const icoBox = h('div', { class: 'tarjeta', style: 'background:var(--panel2);margin-top:14px' });
    const IC = MD.Iconos;
    const actual = t.icono ? IC.entradaDeHex(t.icono) : null;
    const prev = t.icono ? icoCanvas(t.icono) : h('span', { class: 'suave' }, 'sin icono');
    if (t.icono) prev.style.cssText = 'width:72px;height:72px;image-rendering:pixelated;background:#0b0a08;border-radius:6px';
    icoBox.append(h('div', { class: 'fila' }, h('strong', null, 'Icono (24 × 24, un solo color)'), prev, t.icono ? h('button', { type: 'button', onclick: () => { t.icono = ''; A.cambio(true); A.render(); } }, 'Quitar') : null));
    const nuevoHex = t.icono && !actual ? IC.renovar(t.icono) : null;
    icoBox.append(h('div', { class: 'aviso', style: 'margin-top:8px' },
      actual ? [h('strong', null, actual.nombre), ' · ', actual.catNombre]
             : (t.icono ? (nuevoHex ? 'Icono de la biblioteca anterior. ' : 'Icono propio (una imagen tuya o de la biblioteca anterior). ') : 'Toca un icono para elegirlo. Podes buscar por nombre o por categoria.'),
      nuevoHex ? h('button', { type: 'button', style: 'margin-left:8px', onclick: () => { t.icono = nuevoHex; A.cambio(true); A.render(); } }, 'Cambiar por el nuevo') : null));
    const mkBtn = (ic) => h('button', { type: 'button', class: ic.hex === t.icono ? 'on' : '', title: ic.nombre + ' (' + ic.catNombre + ')',
      onclick: () => { A._icoScroll = grid.scrollTop; A._icoFiltro = buscar.value; t.icono = ic.hex; A.cambio(true); A.render(); } }, icoCanvas(ic.hex));
    const grid = h('div', { class: 'icos' });
    const sug = h('div', { class: 'icos sug', style: 'max-height:none;margin-bottom:6px' });
    const sugBox = h('div', { style: 'display:none' }, h('div', { class: 'suave', style: 'font-size:12px;margin-top:6px' }, 'Sugeridos para el nombre de la tecla:'), sug);
    A._icoCat = A._icoCat || '';
    const chips = h('div', { class: 'chips' });
    const pintarGrid = () => {
      const q = buscar.value.trim();
      const res = IC.buscar(q, q ? '' : A._icoCat);   // si escribis algo, busca en TODAS las categorias
      grid.textContent = '';
      res.forEach(ic => grid.append(mkBtn(ic)));
      if (!res.length) grid.append(h('span', { class: 'suave', style: 'grid-column:1/-1;padding:8px' }, 'Nada con ese nombre. Proba en otra palabra (ej: "fuego", "wolf", "puerta") o con "Todos".'));
      cont.textContent = res.length + ' iconos';
      // sugerencias: solo con el buscador vacio y si la tecla tiene nombre
      const ss = !q ? IC.sugerir(t.nombre || '', 8) : [];
      sug.textContent = ''; ss.forEach(ic => sug.append(mkBtn(ic)));
      sugBox.style.display = ss.length ? '' : 'none';
    };
    const pintarChips = () => {
      chips.textContent = '';
      [{ id: '', nombre: 'Todos' }].concat(IC.categorias).forEach(c => chips.append(h('button', { type: 'button', class: 'chip' + (A._icoCat === c.id ? ' on' : ''),
        onclick: () => { A._icoCat = c.id; pintarChips(); pintarGrid(); grid.scrollTop = 0; } }, c.nombre)));
    };
    const cont = h('span', { class: 'suave', style: 'font-size:12px' }, '');
    const buscar = h('input', { type: 'text', placeholder: 'Buscar icono (fuego, lobo, puerta, wolf, door…)', style: 'margin:8px 0 4px', value: A._icoFiltro || '', oninput: pintarGrid });
    icoBox.append(buscar, sugBox, chips, grid, cont);
    pintarChips(); pintarGrid();
    setTimeout(() => { grid.scrollTop = A._icoScroll || 0; }, 0);
    icoBox.append(h('div', { class: 'fila', style: 'margin-top:8px' }, h('button', { type: 'button', onclick: () => A.abrirConversor(i) }, 'Usar mi propia imagen…'),
      h('details', { style: 'flex:1;min-width:140px' }, h('summary', { class: 'suave', style: 'cursor:pointer;font-size:12px' }, 'Creditos de los iconos'), h('p', { class: 'suave', style: 'font-size:11px' }, IC.creditos))));
    caja.append(icoBox);

    caja.append(av); actAv();
    caja.append(h('div', { class: 'fila', style: 'margin-top:10px' },
      h('button', { type: 'button', onclick: () => { A.portapapeles = JSON.parse(JSON.stringify(t)); A.render(); } }, 'Copiar tecla'),
      A.portapapeles ? h('button', { type: 'button', onclick: () => { esc.teclas[i] = JSON.parse(JSON.stringify(A.portapapeles)); A.cambio(true); A.render(); } }, 'Pegar encima') : null,
      h('button', { class: 'peligro', type: 'button', onclick: () => { esc.teclas[i] = null; A.cambio(true); A.render(); } }, 'Vaciar tecla')));
    caja.append(barraGuardar(A, true, true));
    return caja;
  }

  // ===================== SONIDOS =====================
  function vistaSonidos(A, el) {
    const cfg = A.cfg;
    const inp = h('input', { type: 'file', id: 'inSonidos', accept: 'audio/*,.mp3,.wav,.ogg,.m4a,.flac,.opus', multiple: true, hidden: true, onchange: async (e) => { const fs = [...e.target.files]; e.target.value = ''; await A.importarSonidos(fs); } });
    el.append(h('div', { class: 'tarjeta' }, h('h3', null, 'Biblioteca de sonidos'),
      h('p', { class: 'suave' }, 'Importa mp3, wav, ogg o m4a. Quedan guardados en este navegador (no se suben a ningun lado). Para pasarlos a otro celu, usa un pack en Herramientas.'),
      h('div', { class: 'fila' }, h('button', { class: 'primario', type: 'button', onclick: () => inp.click() }, 'Importar sonidos'), inp),
      A.estadoAlmacen ? h('p', { class: 'suave' }, A.estadoAlmacen) : null));
    if (!cfg.sonidos.length) { el.append(h('p', { class: 'suave' }, 'Todavia no hay sonidos. Tambien podes cargar el pack de prueba desde Herramientas.')); return; }
    // v1.3-dev10: la lista va AGRUPADA POR CATEGORIA (la subcarpeta de Drive) y con buscador. Las categorias arrancan cerradas.
    const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    A._sonAbiertas = A._sonAbiertas || new Set();
    const cont = h('div', { id: 'sonLista' });
    const buscar = h('input', { type: 'text', id: 'sonBuscar', placeholder: 'Buscar sonido o categoria…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', style: 'margin-bottom:10px',
      value: A._sonQ || '', oninput: () => { A._sonQ = buscar.value; pintar(); } });
    const fila = (s) => {
      const usos = A.usosDeSonido(s.id);
      let seguro = false;
      return h('div', { class: 's' },
        h('button', { type: 'button', onclick: () => A.previa(s.id) }, '▶'),
        h('div', { class: 'crece' }, h('input', { type: 'text', value: s.nombre, maxlength: 60, oninput: (e) => { s.nombre = e.target.value; A.cambio(false); } }), h('small', null, (s.duracion ? s.duracion + ' s · ' : '') + (usos ? 'usado en ' + usos + ' teclas' : 'sin usar'))),
        h('input', { class: 'peq', type: 'range', min: 0, max: 2, step: 0.05, value: s.volumen, title: 'Volumen base', oninput: (e) => { s.volumen = +e.target.value; A.cambio(false); } }),
        h('button', { class: 'peligro', type: 'button', onclick: async (e) => { if (usos && !seguro) { seguro = true; e.target.textContent = '¿Seguro?'; return; } await A.borrarSonido(s.id); } }, '✕'));
    };
    function pintar() {
      cont.innerHTML = '';
      const q = norm(buscar.value).trim().split(/\s+/).filter(Boolean), buscando = q.length > 0, grupos = MD.Selector.agrupar(cfg.sonidos);
      let total = 0;
      grupos.forEach(([cat, items]) => {
        const vis = buscando ? items.filter(x => q.every(t => norm(cat + ' ' + x.nombre).includes(t))) : items;
        if (!vis.length) return;
        total += vis.length;
        const abierto = buscando || grupos.length === 1 || A._sonAbiertas.has(cat);
        const cab = h('button', { type: 'button', class: 'sel-gcab', style: 'width:100%', onclick: () => { if (A._sonAbiertas.has(cat)) A._sonAbiertas.delete(cat); else A._sonAbiertas.add(cat); pintar(); } },
          (abierto ? '▾ ' : '▸ ') + cat + ' (' + (buscando ? vis.length + ' de ' + items.length : items.length) + ')');
        cont.append(h('div', { class: 'sel-grupo' }, cab, abierto ? h('div', { class: 'lista-s', style: 'margin:8px 0 12px' }, vis.map(fila)) : null));
      });
      if (!total) cont.append(h('p', { class: 'suave' }, 'No hay sonidos que coincidan.'));
    }
    pintar();
    el.append(buscar, cont);
  }


  // v1.3-dev11: tarjeta de ICONOS en Herramientas: renovar los iconos viejos + escena de prueba para ver iconos en la e-Paper
  function tarjetaIconos(A) {
    const IC = MD.Iconos, cfg = A.cfg;
    const viejos = () => { let n = 0; cfg.escenas.forEach(e => e.teclas.forEach(t => { if (t && t.icono && IC.renovar(t.icono)) n++; })); return n; };
    const nViejos = viejos();
    const caja = h('div', null,
      h('p', { class: 'suave', style: 'margin-top:0' }, 'Hay ' + IC.lista.length + ' iconos en ' + IC.categorias.length + ' categorias. Para elegir uno: Escenas > tecla > Icono (con buscador y sugerencias).'));
    caja.append(h('div', { class: 'fila' }, h('button', { type: 'button', disabled: !nViejos, onclick: () => {
        let n = 0; cfg.escenas.forEach(e => e.teclas.forEach(t => { if (t && t.icono) { const nh = IC.renovar(t.icono); if (nh) { t.icono = nh; n++; } } }));
        A.cambio(true); A.render(); }
      }, nViejos ? 'Renovar iconos viejos de mis teclas (' + nViejos + ')' : 'No hay iconos viejos para renovar'),
      h('span', { class: 'suave', style: 'font-size:12px' }, 'Cambia los de la biblioteca anterior (dibujados a mano) por su equivalente nuevo, mas claro.')));
    // escena de prueba: 10 iconos por vez, sin sonidos, para mirarlos en la e-Paper real
    A._icoPrueba = A._icoPrueba || { cat: '', desde: 0 };
    const P = A._icoPrueba;
    const lis = () => IC.buscar('', P.cat);
    const cargar = (desde) => {
      const L = lis(); P.desde = ((desde % L.length) + L.length) % L.length;
      let esc = cfg.escenas.find(e => e.id === 'prueba_iconos');
      if (!esc) { if (cfg.escenas.length >= 10) { A.estadoPack = 'Ya hay 10 escenas: borra una para poder crear la de prueba de iconos.'; A.render(); return; } esc = MD.Config.escenaNueva('Prueba iconos'); esc.id = 'prueba_iconos'; cfg.escenas.push(esc); }
      esc.nombre = 'Prueba iconos';
      esc.teclas = [];
      for (let k = 0; k < 10; k++) { const ic = L[(P.desde + k) % L.length]; esc.teclas.push(MD.Config.teclaNueva({ nombre: ic.nombre.split(' ').map(w => w.slice(0, 7)).join(' ').slice(0, 18), tipo: 'una_vez', sonidos: [], icono: ic.hex })); }
      A.estadoPack = 'Escena "Prueba iconos" cargada con los iconos ' + (P.desde + 1) + ' a ' + (P.desde + 10) + ' de ' + L.length + '. Mirala en la e-Paper del Macrodeck.';
      A.cambio(true); A.render();
    };
    const sel = h('select', { onchange: (e) => { P.cat = e.target.value; P.desde = 0; A.render(); } },
      [{ id: '', nombre: 'Todas las categorias' }].concat(IC.categorias).map(c => h('option', { value: c.id, selected: c.id === P.cat }, c.nombre)));
    caja.append(h('p', { class: 'suave', style: 'margin-top:10px' }, 'Probar iconos en la e-Paper: arma una escena con 10 iconos (sin sonido) para verlos en el Macrodeck real.'),
      h('div', { class: 'fila' }, sel,
        h('button', { type: 'button', onclick: () => cargar(P.desde - 10) }, '← Anteriores 10'),
        h('button', { class: 'primario', type: 'button', onclick: () => cargar(P.desde) }, 'Cargar escena de prueba'),
        h('button', { type: 'button', onclick: () => cargar(P.desde + 10) }, 'Siguientes 10 →')));
    if (A.estadoPack) caja.append(h('p', { class: 'suave', style: 'margin:8px 0 0' }, A.estadoPack));
    return caja;
  }

  // v1.3-dev12: tarjeta de APARIENCIA (temas de color)
  function tarjetaApariencia(A) {
    const T = MD.Tema; if (!T) return null;
    const act = T.actual();
    return h('div', null,
      h('p', { class: 'suave', style: 'margin-top:0' }, 'Los colores de la app. Se guarda en este celu (en cada celu se elige por separado). El mapa de teclas conserva los colores de la e-Paper: amarillo, rojo y blanco.'),
      h('div', { class: 'temas' }, T.TEMAS.map(t => h('button', { type: 'button', class: 'tema-op' + (t.id === act ? ' on' : ''), title: t.desc, onclick: () => { T.aplicar(t.id, true); A.render(); } },
        h('span', { class: 'mu', style: 'background:' + t.muestra[0] }, h('i', { style: 'background:' + t.muestra[1] }), h('i', { style: 'background:' + t.muestra[2] })), t.nombre))));
  }

  // ===================== HERRAMIENTAS =====================
  // v1.3-dev13: en acordeon (una lista corta de secciones; se abre una por vez). Cada cabecera muestra a la derecha un resumen.
  function vistaHerramientas(A, el) {
    const cfg = A.cfg, demo = A.demoCuenta(), T = MD.Tema;
    const temaAct = T ? (T.TEMAS.find(x => x.id === T.actual()) || {}).nombre : '';
    const lista = h('div', { class: 'acordeon' });
    lista.append(acordeon(A, 'campana', 'campana', 'Campana', cfg.nombre, () => h('div', null,
      h('label', { style: 'margin-top:0' }, 'Nombre de la campana'), h('input', { type: 'text', value: cfg.nombre, maxlength: 60, oninput: (e) => { cfg.nombre = e.target.value; A.cambio(false); } }))));
    const dmH = !!(MD.Drive && MD.Drive.esDM());                // 1.3-dev21: Frodo no ve lo que es del equipo (celu, ducking, contenido de prueba)
    if (MD.Nativo && MD.Celu && !dmH) lista.append(acordeon(A, 'celu', 'bateria', 'Celu en la OLED', MD.Celu.s.acceso ? 'con acceso' : 'falta acceso', () => tarjetaCelu(A)));
    if (MD.Nativo && !dmH) lista.append(acordeon(A, 'ducking', 'ducking', 'Ducking', (MD.DUCK_MODOS[A.duckModo] || MD.DUCK_MODOS.normal).nombre, () => tarjetaDucking(A)));
    if (MD.LucesDnd) lista.append(acordeon(A, 'luces', 'luz', 'Luces de D&D', MD.LucesDnd.aj.activo ? ((A.cfg.looks || []).length + MD.LucesDnd.FABRICA.length) + ' looks' : 'apagadas', () => tarjetaLuces(A)));
    if (T) lista.append(acordeon(A, 'apariencia', 'apariencia', 'Apariencia', temaAct, () => tarjetaApariencia(A)));
    lista.append(acordeon(A, 'iconos', 'iconos', 'Iconos', MD.Iconos.lista.length + ' iconos', () => tarjetaIconos(A)));
    if (!dmH) lista.append(acordeon(A, 'prueba', 'prueba', 'Contenido de prueba', (demo.sonidos || demo.escenas) ? 'cargado' : '', () => h('div', null,
      h('p', { class: 'suave', style: 'margin-top:0' }, 'Agrega 2 escenas de ejemplo con sonidos sintetizados (lluvia, fogata, espadas, una antorcha con Intro + Loop…). No toca lo que ya tengas. Despues se pueden borrar de una vez.'),
      h('div', { class: 'fila' },
        h('button', { type: 'button', id: 'btnDemo', onclick: () => A.cargarDemo() }, 'Agregar contenido de prueba'),
        (demo.sonidos || demo.escenas) ? h('button', { class: 'peligro', type: 'button', onclick: async (e) => { if (!A._borrDemo) { A._borrDemo = 1; e.target.textContent = 'Seguro? ' + demo.sonidos + ' sonidos y ' + demo.escenas + ' escenas'; return; } A._borrDemo = 0; await A.borrarDemo(); } },
          'Borrar contenido de prueba (' + demo.sonidos + ' sonidos, ' + demo.escenas + ' escenas)') : null),
      A.estadoPack ? h('p', { class: 'suave', style: 'margin:8px 0 0' }, A.estadoPack) : null)));
    lista.append(acordeon(A, 'conversor', 'conversor', 'Conversor de logo del lobby', '', () => h('div', null,
      h('p', { class: 'suave', style: 'margin-top:0' }, 'Convierte una imagen en un icono de un solo color para la pantalla de inicio del Macrodeck. Elegi la imagen, ajusta el umbral y descarga el archivo .h.'),
      h('button', { type: 'button', onclick: () => A.abrirConversorLogo() }, 'Abrir conversor'))));
    if (MD.Diag) lista.append(acordeon(A, 'diag', 'diag', 'Diagnostico de segundo plano', '', () => {
      const pre = h('pre', { id: 'diagTexto', style: 'font-size:11px;line-height:1.35;white-space:pre-wrap;max-height:260px;overflow:auto;background:var(--bg);padding:8px;border-radius:8px;margin:8px 0' }, MD.Diag.ultimas(40).join('\n') || '(sin datos todavia)');
      const refrescar = () => { pre.textContent = MD.Diag.ultimas(40).join('\n') || '(sin datos todavia)'; pre.scrollTop = pre.scrollHeight; };
      setTimeout(() => { pre.scrollTop = pre.scrollHeight; }, 0);
      return h('div', null,
        h('p', { class: 'suave', style: 'margin-top:0' }, 'Anota con la hora lo que pasa al bloquear el celu: si el JavaScript se duerme, si el audio se suspende o si se corta el Bluetooth. Sirve para encontrar por que deja de sonar con la pantalla apagada.'),
        pre,
        h('div', { class: 'fila' },
          h('button', { type: 'button', onclick: refrescar }, 'Actualizar'),
          h('button', { type: 'button', onclick: async (e) => { try { await navigator.clipboard.writeText(MD.Diag.texto()); e.target.textContent = 'Copiado'; } catch (x) { e.target.textContent = 'No se pudo copiar'; } } }, 'Copiar'),
          h('button', { class: 'peligro', type: 'button', onclick: () => { MD.Diag.borrar(); refrescar(); } }, 'Borrar')));
    }));
    lista.append(acordeon(A, 'almacen', 'almacen', 'Almacenamiento', 'v' + MD.VERSION, () => h('div', null,
      h('p', { class: 'suave', style: 'margin-top:0' }, A.infoAlmacen || ''),
      h('div', { class: 'fila' }, h('button', { type: 'button', onclick: () => A.pedirPersistencia() }, 'Proteger datos'),
        h('button', { class: 'peligro', type: 'button', onclick: async (e) => { if (!A._borr) { A._borr = 1; e.target.textContent = 'Seguro? se borra TODO'; return; } A._borr = 0; await A.borrarTodo(); } }, 'Borrar todo')),
      h('p', { class: 'suave', style: 'margin-bottom:0' }, 'Version de la app: ' + MD.VERSION))));
    el.append(lista);
  }

  MD.UI = { h, icoCanvas, vistaMesa, vistaEscenas, vistaSonidos, vistaHerramientas, NOM };
})(window.MD);
