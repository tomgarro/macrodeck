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
      MD.Config.FUNC_INTENSIDAD ? fila('intensidad', 'gris', 'Gris con barras - Intensidad', 'regula el ultimo loop que prendiste (sonido y luces): cada toque sube un nivel.') : null,
      fila('ambiente', 'amarillo', 'Amarillo con ondas - Ambiente', 'prende un ambiente de Audios (taberna, lluvia...) con fundido; otro toque lo apaga.'),
      fila('musica', 'amarillo', 'Amarillo con notas - Música', 'prende una lista de música de Audios (reemplaza la que suena, con fundido); otro toque la apaga.'),
      fila('musica_sig', 'blanco', 'Blanco con flecha - Siguiente tema', 'salta al siguiente tema de la música.'),
      fila('musica_pausa', 'gris', 'Gris con barras - Pausa de música', 'pausa y sigue la música sin perder el lugar.'),
      fila('luz_toggle', 'amarillo', 'Amarillo con sol/luna - Cambio de luz', 'cada toque pasa al siguiente estado de luz (dia, noche...) sin cambiar de escena.'),
      fila('ducking', 'amarillo', 'Marco doble + parlante con flecha - Ducking', 'mientras suena, baja la musica del celu (solo en la app Android).'));
  }
  function avisosTecla(A, t) {
    const out = [];
    if (!t) return out;
    if ((t.nombre || '').split(/\s+/).some(p => p.length > 7)) out.push('El nombre tiene una palabra de mas de 7 letras: en la pantalla e-Paper se va a cortar.');
    if (!t.nombre) out.push('La tecla no tiene nombre: en el Macrodeck se vera solo el icono.');
    if (['una_vez', 'loop', 'intro_loop', 'mantener', 'azar', 'secuencia'].includes(t.tipo) && t.sonidos.length < 1) out.push('Esta tecla no tiene sonido todavia.');
    if (t.tipo === 'ambiente' && !t.audio) out.push('Esta tecla no tiene ambiente elegido todavia.');
    if (t.tipo === 'musica' && !t.lista) out.push('Esta tecla no tiene lista de musica elegida todavia.');
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

  // 1.3-dev31: Frodo puede tener hasta 60 escenas. Con pocas se ven como botones; con muchas, un selector con buscador (y anterior / siguiente).
  // 'cual' = el indice de la escena elegida, 'alElegir(i)' = que hacer al elegir.
  function barraEscenas(A, cual, alElegir, id) {
    const esc = A.cfg.escenas, dm = !!(MD.Drive && MD.Drive.esDM());
    const nombre = (e) => (e.estado === 'borrador' ? '✎ ' : '') + e.nombre;
    if (esc.length <= 12) {
      const bar = h('div', { class: 'escenas' });
      esc.forEach((e, i) => bar.append(h('button', { type: 'button', class: i === cual ? 'on' : '', title: e.estado === 'borrador' ? 'Borrador (solo lo ves vos)' : '', onclick: () => alElegir(i) }, nombre(e))));
      return bar;
    }
    const vis = A.escenasMacrodeck ? A.escenasMacrodeck() : [];
    const q = (A._escQ && A._escQ[id]) || '';
    const buscar = h('input', { type: 'search', class: 'esc-buscar', placeholder: 'Buscar escena (' + esc.length + ')…', value: q, 'aria-label': 'Buscar escena', autocomplete: 'off',
      oninput: (e) => { (A._escQ = A._escQ || {})[id] = e.target.value; pintar(); } });
    buscar.addEventListener('keydown', (e) => e.stopPropagation());
    const sel = h('select', { class: 'esc-sel', 'aria-label': 'Escena', onchange: (e) => alElegir(Number(e.target.value)) });
    const norm = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    function pintar() {
      const t = norm((A._escQ && A._escQ[id]) || '').trim().split(/\s+/).filter(Boolean);
      const ok = (i) => i === cual || t.every(w => norm(esc[i].nombre).includes(w));
      sel.textContent = '';
      const g1 = h('optgroup', { label: 'En el Macrodeck (' + vis.length + ')' }), g2 = h('optgroup', { label: 'Solo en la app' });
      esc.forEach((e, i) => { if (!ok(i)) return; (vis.includes(i) ? g1 : g2).append(h('option', { value: i, selected: i === cual }, (vis.includes(i) ? NOM[vis.indexOf(i)] + ' · ' : '') + nombre(e))); });
      if (g1.children.length) sel.append(g1); if (g2.children.length) sel.append(g2);
    }
    pintar();
    const ir = (d) => alElegir(Math.max(0, Math.min(esc.length - 1, cual + d)));
    return h('div', { class: 'escenas-muchas' }, buscar, h('div', { class: 'fila' }, h('button', { type: 'button', 'aria-label': 'Escena anterior', onclick: () => ir(-1) }, '◀'), h('div', { class: 'crece' }, sel), h('button', { type: 'button', 'aria-label': 'Escena siguiente', onclick: () => ir(1) }, '▶')));
  }

  // 1.3-dev31: ventana para elegir QUE escenas aparecen en el selector de la OLED del Macrodeck (maximo 10) y en que orden.
  function dialogoMacrodeck(A) {
    const cfg = A.cfg, MAX = MD.Config.MAX_EN_MACRODECK;
    const cont = h('div', { class: 'esc-md' });
    const d = h('dialog', { class: 'esc-md-dlg' }, h('h3', null, 'Escenas en el Macrodeck'),
      h('p', { class: 'suave', style: 'margin-top:0' }, 'El selector del Macrodeck (HOME) tiene lugar para ' + MAX + ' escenas, de A1 a E2. Tildá las que querés ahí; el orden es el de esta lista. Las demás quedan solo en la app.'), cont,
      h('div', { class: 'fila', style: 'margin-top:12px;justify-content:flex-end' }, h('button', { type: 'button', class: 'primario', onclick: () => d.close() }, 'Listo')));
    function pintar() {
      cont.textContent = '';
      const vis = A.escenasMacrodeck(), marcadas = cfg.escenas.filter(e => e.macrodeck !== false).length;
      cont.append(h('p', { class: 'esc-md-cuenta' + (marcadas > MAX ? ' mal' : '') }, 'En el Macrodeck: ' + Math.min(marcadas, MAX) + ' de ' + MAX + (marcadas > MAX ? ' · hay ' + (marcadas - MAX) + ' tildada(s) de mas que NO entran (las ultimas de la lista)' : '')));
      cfg.escenas.forEach((e, i) => {
        const lugar = vis.indexOf(i), tilde = e.macrodeck !== false;
        cont.append(h('div', { class: 'esc-md-fila' + (lugar >= 0 ? ' en' : '') },
          h('input', { type: 'checkbox', checked: tilde, 'aria-label': 'Mostrar ' + e.nombre + ' en el Macrodeck', onchange: (ev) => { if (ev.target.checked) delete e.macrodeck; else e.macrodeck = false; A.cambio(true); pintar(); } }),
          h('span', { class: 'esc-md-lugar' }, lugar >= 0 ? NOM[lugar] : (tilde ? '—' : '')),
          h('span', { class: 'crece esc-md-nom' }, (e.estado === 'borrador' ? '✎ ' : '') + e.nombre + (tilde && lugar < 0 ? ' (no entra)' : '')),
          h('button', { type: 'button', 'aria-label': 'Subir', disabled: i === 0, onclick: () => { [cfg.escenas[i - 1], cfg.escenas[i]] = [cfg.escenas[i], cfg.escenas[i - 1]]; if (A.activa === i) A.activa = i - 1; else if (A.activa === i - 1) A.activa = i; if (A.edEsc === i) A.edEsc = i - 1; else if (A.edEsc === i - 1) A.edEsc = i; A.cambio(true); pintar(); } }, '↑'),
          h('button', { type: 'button', 'aria-label': 'Bajar', disabled: i === cfg.escenas.length - 1, onclick: () => { [cfg.escenas[i + 1], cfg.escenas[i]] = [cfg.escenas[i], cfg.escenas[i + 1]]; if (A.activa === i) A.activa = i + 1; else if (A.activa === i + 1) A.activa = i; if (A.edEsc === i) A.edEsc = i + 1; else if (A.edEsc === i + 1) A.edEsc = i; A.cambio(true); pintar(); } }, '↓')));
      });
    }
    pintar();
    d.addEventListener('close', () => { d.remove(); A.render(); });
    document.body.append(d); d.showModal();
    return d;
  }
  MD.dialogoEscenasMacrodeck = dialogoMacrodeck;

  // ===================== MEZCLADOR DE LA MESA (2.0-dev7, dev9) =====================
  // Plegable y cerrado por defecto. Un fader vertical por tecla con audio (sonido, ambiente o lista de musica): 0 a 150 %, el mismo "Volumen de la tecla" de Escenas.
  // Aparte, los faders de "Fondo": el volumen de la musica y del ambiente de fondo que arrancan con la escena. Todo se guarda en la escena (viaja a Drive):
  // el dummy suena con los mismos niveles que en la Mac de Frodo.
  const VOL_MAX = 1.5;
  function mezclador(A, esc) {
    const C = MD.Config, conFader = (t) => !!t && C.conVolumen(t.tipo);
    const foto = () => ({ t: esc.teclas.map(t => (t ? t.volumen : null)), m: typeof esc.volMusica === 'number' ? esc.volMusica : null, a: typeof esc.volAmbiente === 'number' ? esc.volAmbiente : null });
    let orig = foto();
    const fondoVol = (n, v) => { if (MD.Au && MD.Au.fondoVol) MD.Au.fondoVol(n, v); };
    // Un fader vertical. o = { val(), poner(v), activo, nombre, col, etiqueta, vacia }
    function fader(o) {
      const tope = h('span', { class: 'mz-pc' }), rel = h('div', { class: 'mz-rel' }), cien = h('div', { class: 'mz-cien' });
      const f = h('div', { class: 'mz-fader' + (o.activo ? '' : ' off'), role: 'slider', 'aria-label': 'Volumen de ' + o.nombre }, cien, rel);
      const col = h('div', { class: 'mz-col m' + o.col }, tope, f, h('span', { class: 'mz-nom' }, o.etiqueta));
      const pintar = () => {
        if (!o.activo) { tope.textContent = o.vacia ? '' : '—'; return; }
        const v = o.val();
        tope.textContent = Math.round(v * 100) + '%'; rel.style.height = (v / VOL_MAX * 100) + '%'; cien.style.bottom = (1 / VOL_MAX * 100) + '%';
        f.setAttribute('aria-valuenow', Math.round(v * 100));
      };
      if (o.activo) {
        const poner = (v) => { o.poner(v); A.cambio(false); pintar(); };
        const mover = (e) => {
          const r = f.getBoundingClientRect(); let p = 1 - (e.clientY - r.top) / r.height; p = Math.min(1, Math.max(0, p));
          const v = Math.round(p * VOL_MAX * 20) / 20;
          if (v !== o.val()) poner(v);
        };
        f.addEventListener('pointerdown', (e) => { e.preventDefault(); try { f.setPointerCapture(e.pointerId); } catch (x) {} mover(e); f.onpointermove = mover; });
        const suelta = () => { f.onpointermove = null; };
        f.addEventListener('pointerup', suelta); f.addEventListener('pointercancel', suelta);
        f.addEventListener('dblclick', () => poner(1));                                  // doble toque: volver a 100 %
      }
      pintar();
      return { col, f, pintar };
    }
    const partes = esc.teclas.map((t, i) => {
      const act = conFader(t);
      const F = fader({ val: () => t.volumen, poner: (v) => A.motor.fijarVolTecla(i, v), activo: act, nombre: t ? (t.nombre || NOM[i]) : NOM[i], col: t ? C.colorModo(t.tipo) : 'gris', vacia: !t,
        etiqueta: t ? (act ? (t.nombre || '(sin nombre)') : (t.nombre || '') + ' · sin fader') : NOM[i] + ' vacía' });
      A.mesaFaders[i] = act ? F.f : null;
      return F;
    });
    const rejM = h('div', { class: 'rejilla mz-rej' }, partes.map(p => p.col));
    // Fondo de la escena: la musica (lista) y el ambiente que arrancan solos al entrar a la escena
    const fondos = [];
    if (esc.lista) fondos.push(fader({ val: () => (typeof esc.volMusica === 'number' ? esc.volMusica : 1), poner: (v) => { esc.volMusica = v; fondoVol('musica', v); }, activo: true, nombre: 'la música de fondo', col: 'blanco', etiqueta: 'Fondo: música' }));
    if (esc.ambiente && esc.ambiente.id) fondos.push(fader({ val: () => (typeof esc.volAmbiente === 'number' ? esc.volAmbiente : 1), poner: (v) => { esc.volAmbiente = v; fondoVol('ambiente', v); }, activo: true, nombre: 'el ambiente de fondo', col: 'amarillo', etiqueta: 'Fondo: ambiente' }));
    const repintar = () => { partes.concat(fondos).forEach(p => p.pintar()); };
    const volver = () => {
      orig.t.forEach((v, i) => { if (v != null && conFader(esc.teclas[i])) A.motor.fijarVolTecla(i, v); });
      if (orig.m != null) esc.volMusica = orig.m; else delete esc.volMusica; fondoVol('musica', orig.m != null ? orig.m : 1);
      if (orig.a != null) esc.volAmbiente = orig.a; else delete esc.volAmbiente; fondoVol('ambiente', orig.a != null ? orig.a : 1);
      A.cambio(false); repintar();
    };
    const igualar = () => {
      esc.teclas.forEach((t, i) => { if (conFader(t)) A.motor.fijarVolTecla(i, 1); });
      if (esc.lista) { esc.volMusica = 1; fondoVol('musica', 1); }
      if (esc.ambiente && esc.ambiente.id) { esc.volAmbiente = 1; fondoVol('ambiente', 1); }
      A.cambio(false); repintar();
    };
    return h('details', { class: 'tarjeta leyenda mezclador', id: 'mezclador', open: !!A.mezAbierto, ontoggle: (e) => { A.mezAbierto = e.target.open; if (A.mezAbierto) { orig = foto(); } } },
      h('summary', null, 'Mezclador de la escena'),
      h('div', { class: 'mz-cuerpo' },
        h('p', { class: 'suave', style: 'margin:0 0 10px;font-size:.85rem' }, 'Un fader por tecla con audio (sonido, ambiente o música): se escucha al instante si está sonando. Doble toque = 100 %. Todo se guarda en la escena y viaja al dummy.'),
        rejM,
        fondos.length ? h('div', { class: 'mz-fondo' }, h('p', { class: 'suave', style: 'margin:14px 0 6px;font-size:.8rem' }, 'Fondo de la escena (lo que arranca solo al entrar):'), h('div', { class: 'rejilla mz-rej' }, fondos.map(p => p.col))) : null,
        h('div', { class: 'fila mz-pie' }, h('button', { type: 'button', onclick: volver }, '↺ Volver a como estaba'), h('button', { type: 'button', onclick: igualar }, 'Igualar todas a 100 %'))));
  }

  // ===================== MESA =====================
  function vistaMesa(A, el) {
    const con = h('div', { class: 'tarjeta' });
    const esBle = A.tr && A.tr.tipo === 'ble' && A.tr.estado !== 'desconectado';
    const esSim = A.tr && A.tr.tipo === 'sim' && A.tr.conectado;
    if (esBle || esSim) {
      // 1.3-dev32: conectado -> la tarjeta "Conexion" desaparece (el estado queda en el icono de Bluetooth de la cabecera, con su tilde verde; tocandolo aparece "Desconectar").
      // Solo se ve, y solo si hace falta, el aviso del ahorro de bateria (APK) y el del permiso de notificaciones.
      if (MD.Nativo) { const f = filaBateria(A), cx = h('div', { class: 'tarjeta', hidden: true }, f); MD.Nativo.bateria().then(b => { cx.hidden = !!(b && b.exento); }); el.append(cx); }
      if (MD.Nativo && MD.Celu && !MD.Celu.s.acceso) el.append(h('p', { class: 'aviso', id: 'avisoAccesoMedios' }, 'Para ver en la OLED si suena YouTube falta un permiso: Herramientas > Celu en la OLED.'));
    } else {
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
    }
    el.append(con);
    }

    el.append(barraEscenas(A, A.activa, (i) => A.activar(i), 'mesa'));
    if (MD.Au && MD.Au.ui) el.append(h('button', { type: 'button', class: 'btn-modo-mesa', id: 'btnModoMesa', onclick: () => MD.Au.ui.abrirOv('mesa') }, MD.IUI.svg('mesa'), 'Modo mesa'));    // 1.3-dev35: vista grande para jugar (escena, Ambientes, Música)

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
    A.mesaFaders = []; el.append(mezclador(A, esc));      // 2.0-dev7: plegable, cerrado por defecto

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
    return h('p', { class: 'suave', style: 'margin:4px 0 0' }, 'Las luces estan apagadas en este celu (se guardan igual). Se prenden en la pestana Luces.');
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
  // Tecla "Ambiente (de Audios)": elige un audio de tipo Ambiente del catalogo
  function ambienteTecla(A, t) {
    const Au = MD.Au, ambs = Au ? Au.S.cat.filter(x => x.tipo === 'Ambiente').sort((a, b) => a.titulo.localeCompare(b.titulo, 'es')) : [];
    const sel = h('select', { id: 'selAmbiente', 'aria-label': 'Ambiente', onchange: (e) => { t.audio = e.target.value; const d = Au && Au.dePorId(t.audio); t.audioTitulo = d ? d.titulo : ''; if (d && (!t.nombre || t.nombre === 'Nueva')) t.nombre = d.titulo.split(/\s+/)[0].slice(0, 7); A.cambio(true); A.render(); } },
      h('option', { value: '' }, ambs.length ? '(elegí un ambiente)' : '(todavía no hay ambientes: sincronizá el catálogo en Audios)'),
      ambs.map(x => h('option', { value: x.id, selected: x.id === t.audio }, x.titulo + (Au.bajado(x.id) ? '' : ' (sin bajar)'))),
      t.audio && !ambs.some(x => x.id === t.audio) ? h('option', { value: t.audio, selected: true }, (t.audioTitulo || 'ambiente') + ' (todavía no llegó a este celu)') : null);
    const d = Au && t.audio && Au.dePorId(t.audio);
    return h('div', null, h('label', null, 'Audio de tipo Ambiente (de la pestana Audios)'), sel,
      d ? h('div', { class: 'fila', style: 'margin-top:6px' }, h('button', { type: 'button', onclick: () => Au.carril('ambiente').ambienteTecla(d, t.entrada > 0 ? t.entrada : 3) }, 'Probar'), h('button', { type: 'button', onclick: () => Au.carril('ambiente').apagarSuave(t.salida > 0 ? t.salida : 3) }, 'Parar')) : null,
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!t.sumar, onchange: (e) => { t.sumar = e.target.checked; A.cambio(true); } }), ' Sumar: que suene ENCIMA de los otros ambientes (si no, reemplaza al que suena)'),
      h('p', { class: 'suave' }, 'Un toque lo prende con fundido de entrada; otro toque lo apaga con fundido de salida. Su volumen se regula en Audios (carril Ambientes).'));
  }
  // 2.0-dev8: Tecla "Musica (de una lista)": elige una lista de la pestana Audios (las arma el DM) que suena en el carril de Musica
  function musicaTecla(A, t) {
    const Au = MD.Au, ls = Au ? Au.listas() : [];
    const sel = h('select', { id: 'selListaTecla', 'aria-label': 'Lista de música', onchange: (e) => {
      t.lista = e.target.value; const l = Au && Au.lista(t.lista); t.listaNombre = l ? l.nombre : '';
      if (l && (!t.nombre || t.nombre === 'Nueva' || t.nombre === 'Música')) t.nombre = l.nombre.slice(0, 18);
      A.cambio(true); A.render(); } },
      h('option', { value: '' }, ls.length ? '(elegí una lista)' : '(todavía no hay listas: armalas en Audios > Listas)'),
      ls.map(x => h('option', { value: x.id, selected: x.id === t.lista }, x.nombre + (x.auto ? ' (automática)' : ''))),
      t.lista && !ls.some(x => x.id === t.lista) ? h('option', { value: t.lista, selected: true }, (t.listaNombre || 'lista') + ' (todavía no llegó a este celu)') : null);
    const l = Au && t.lista && Au.lista(t.lista);
    const num = (campo) => (e) => { t[campo] = Number(e.target.value); A.cambio(true); };
    return h('div', null, h('label', null, 'Lista de música (de la pestaña Audios)'), sel,
      l ? h('div', { class: 'fila', style: 'margin-top:6px' }, h('button', { type: 'button', onclick: () => Au.carril('musica').reproducirLista(l, { azar: !!t.azarLista, entrada: t.entrada > 0 ? t.entrada : 3 }) }, 'Probar'),
        h('button', { type: 'button', onclick: () => Au.carril('musica').apagarSuave(2) }, 'Parar')) : null,
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!t.azarLista, onchange: (e) => { t.azarLista = e.target.checked; A.cambio(true); } }), ' En orden al azar'),
      h('div', { class: 'cols' }, h('div', null, h('label', null, 'Entrada (fundido, segundos)'), h('input', { type: 'number', min: 0, max: 10, step: 0.5, value: t.entrada, oninput: num('entrada') })),
        h('div', null, h('label', null, 'Salida (fundido, segundos)'), h('input', { type: 'number', min: 0, max: 10, step: 0.5, value: t.salida, oninput: num('salida') }))),
      h('p', { class: 'suave' }, 'Un toque arranca esta lista y reemplaza la música que suene (con fundido); otro toque la apaga. Se regula con el volumen de Música (Mezclador de la Mesa).'));
  }
  // Tecla "Cambio de luz (toggle)": hasta 4 estados que se van alternando
  function toggleTecla(A, t) {
    const LZ = MD.LucesDnd;
    t.estados = MD.Config.normEstadosToggle(t.estados);
    const caja = h('div', { class: 'tarjeta', style: 'background:var(--panel2);margin-top:10px' }, h('div', { class: 'fila' }, MD.IUI.svg('luz', 'ic-luz'), h('strong', null, 'Estados de la luz (cada toque pasa al siguiente)')));
    t.estados.forEach((es, k) => {
      const fila = h('div', { class: 'luz-fila' }, h('div', { class: 'fila' }, h('b', null, 'Estado ' + (k + 1)),
        h('input', { type: 'text', maxlength: 10, value: es.nombre, 'aria-label': 'Nombre del estado', style: 'max-width:9em', oninput: (e) => { es.nombre = e.target.value.slice(0, 10); A.cambio(false); } }),
        t.estados.length > 2 ? h('button', { class: 'peligro', type: 'button', onclick: () => { t.estados.splice(k, 1); A.cambio(true); A.render(); } }, '✕') : null));
      LZ.LAMPARAS.forEach((lp) => {
        const id = es.luz[lp.id] || '';
        fila.append(h('label', { style: 'margin-top:4px' }, LZ.nombreLampara(lp.id)), h('div', { class: 'fila' }, muestraLook(LZ.look(id)), h('div', { class: 'crece' }, selLook(A, id, (v) => { if (v) es.luz[lp.id] = v; else delete es.luz[lp.id]; A.cambio(false); A.render(); }, '(no la toca)')),
          id ? h('button', { type: 'button', onclick: () => { const l = LZ.look(id); if (l) LZ.probarLook(l, lp.id); } }, 'Probar') : null));
      });
      caja.append(fila);
    });
    if (t.estados.length < 4) caja.append(h('button', { type: 'button', onclick: () => { t.estados.push({ nombre: 'Estado ' + (t.estados.length + 1), luz: {} }); A.cambio(true); A.render(); } }, '+ Agregar estado'));
    caja.append(h('label', null, 'Fundido entre estados (segundos, 0 = cambio directo)'), h('input', { type: 'number', min: 0, max: 60, step: 1, value: t.fundido == null ? 4 : t.fundido, oninput: (e) => { t.fundido = Math.max(0, Math.min(60, Number(e.target.value) || 0)); A.cambio(false); } }),
      h('p', { class: 'suave' }, 'No cambia la escena ni toca los sonidos: solo las luces. Al cambiar de escena vuelve al primer estado. El fundido lento necesita Luces 0.7.6 en el servidor (con la versión anterior cambia directo).'));
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
        MD.Panel ? MD.Panel.botonConectar(false) : null,
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
      h('p', { class: 'suave', style: 'margin-top:0' }, 'Las 2 lamparas de D&D las maneja el servidor de luces, que desde la 2.0 viene ADENTRO de esta misma app (corre aparte, con su notificacion «Macrodeck Luces»). Esta pantalla le pide los efectos; el servidor los anima.'),
      h('label', { class: 'chk', style: 'margin-top:0' }, h('input', { type: 'checkbox', checked: LZ.aj.activo, onchange: (e) => { LZ.aj.activo = e.target.checked; LZ.guardarAjustes(); A.render(); } }), ' Usar las luces en este celu'),
      h('label', null, 'Direccion del servidor de luces'),
      h('input', { type: 'text', value: LZ.aj.servidor, oninput: (e) => { LZ.aj.servidor = e.target.value.trim().replace(/\/+$/, ''); LZ.guardarAjustes(); } }),
      h('p', { class: 'suave', style: 'margin:4px 0 0' }, 'En el dummy (el servidor va adentro de la app): http://127.0.0.1:8765. Desde otro celu: la IP del dummy.'),
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
  // 1.3-dev24: las luces de D&D tienen su propia pestana (antes estaban en Herramientas)
  function vistaLuces(A, el) {
    if (!MD.LucesDnd) { el.append(h('p', { class: 'suave' }, 'Las luces no estan disponibles en esta version.')); return; }
    const LZ = MD.LucesDnd;
    el.append(h('div', { class: 'au-cab' }, h('h2', null, 'Luces de D&D'), h('span', { class: 'au-cuenta suave' }, LZ.aj.activo ? ((A.cfg.looks || []).length + LZ.FABRICA.length) + ' looks' : 'apagadas')));
    // 2.0-dev2: el control individual (brillo, color, temperatura, prender/apagar) queda ARRIBA, plegable; es el mismo del panel de la cabecera
    if (MD.Panel && LZ.aj.activo) el.append(h('div', { class: 'tarjeta pl-arriba' }, MD.Panel.plegable('Control rápido de las lámparas', MD.Panel.controlesLuces(), 'rapido', null, true).el));
    el.append(h('div', { class: 'tarjeta' }, tarjetaLuces(A)));
    el.append(tarjetaReposo(A));
  }
  // 1.3-dev31: DISCO EXTERNO para los audios (Chrome/Edge en la compu)
  // v1.3-dev35: redes donde la app NO descarga (ej. el Wi-Fi "Tom's Phone": usa los datos de otro celu). Solo tiene efecto en el APK.
  function tarjetaRed(A) {
    const R = MD.Red, cfg = R.config(), estado = h('p', { class: 'suave', id: 'redEstado', style: 'margin-top:0' }, 'Mirando la red…'), msg = h('p', { class: 'suave', id: 'redMsg' }, '');
    const caja = h('div', null, estado);
    const recargar = () => A.render();
    R.revisar(true).then((r) => {
      const e = r.red || {};
      if (!e.nativo) { estado.textContent = 'Esto solo funciona en el APK (en la compu no hace falta): ahí la app no sabe a qué Wi-Fi estás.'; return; }
      const donde = e.tipo === 'wifi' ? 'Wi-Fi' + (e.ssidLegible ? ' «' + e.ssid + '»' : ' (no puedo leer el nombre)') + (e.medida ? ' · de uso medido' : '') : (e.tipo === 'datos' ? 'datos móviles' : (e.tipo === 'ninguna' ? 'sin conexión' : 'otra red'));
      estado.textContent = 'Ahora: ' + donde + ' → ' + (r.bloqueada ? '⛔ DESCARGAS PAUSADAS' : '✓ descargas permitidas') + '.';
      if (!e.permisoUbicacion) caja.insertBefore(h('div', { class: 'aviso', style: 'margin:8px 0' }, 'Para leer el nombre del Wi-Fi Android pide el permiso de ubicación (la app no usa tu ubicación para nada más). ',
        h('button', { type: 'button', id: 'btnPermUbic', style: 'margin-top:6px', onclick: async () => { await R.pedirUbicacion(); recargar(); } }, 'Dar permiso de ubicación')), estado.nextSibling);
      if (e.tipo === 'wifi' && e.ssidLegible && !cfg.bloquear.some(n => n.trim().toLowerCase() === e.ssid.trim().toLowerCase()))
        accion.append(h('button', { type: 'button', id: 'btnRedActual', onclick: () => { R.agregar(e.ssid); recargar(); } }, 'Agregar la red actual (' + e.ssid + ')'));
    });
    const lista = h('div', { class: 'lista-s', style: 'margin:8px 0' });
    cfg.bloquear.forEach((n) => lista.append(h('div', { class: 's' }, h('span', { class: 'crece' }, n), h('button', { type: 'button', class: 'peligro', 'aria-label': 'Quitar ' + n, onclick: () => { R.quitar(n); recargar(); } }, '✕'))));
    if (!cfg.bloquear.length) lista.append(h('p', { class: 'suave', style: 'margin:0' }, 'No hay redes en la lista.'));
    const nueva = h('input', { type: 'text', id: 'inRedNueva', placeholder: 'Nombre exacto del Wi-Fi', maxlength: 40 });
    const accion = h('div', { class: 'fila' }, h('button', { type: 'button', id: 'btnRedAgregar', onclick: () => { if (R.agregar(nueva.value)) recargar(); else msg.textContent = 'Escribí un nombre que no esté ya en la lista.'; } }, 'Agregar'));
    caja.append(h('label', null, 'Redes donde NO se descarga nada'), lista, nueva, accion,
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'chkLiviano', checked: cfg.liviano, onchange: (ev) => { R.fijarLiviano(ev.target.checked); recargar(); } }), ' Aun así sincronizar lo liviano (escenas, looks, listas): sirve para recibir una escena con el hotspot de las luces'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'chkSinDatos', checked: cfg.sinDatos, onchange: (ev) => { R.fijarSinDatos(ev.target.checked); recargar(); } }), ' Tampoco descargar con datos móviles'),
      msg, h('p', { class: 'suave' }, 'Con la red en esta lista, las descargas pesadas (audios, sonidos, carátulas) quedan pausadas y avisan por qué; lo liviano (escenas, looks, listas) pasa si dejás tildado el cuadro de arriba. Las luces (que hablan con tu propio celu) siguen igual.'));
    return caja;
  }
  function tarjetaDisco(A) {
    const D = MD.Disco, msg = h('p', { class: 'suave', id: 'discoMsg' }, '');
    const ok = (t) => { msg.textContent = t; };
    const estado = D.activo() ? (D.listo() ? 'Usando el disco «' + D.nombre() + '». Ahí se guardan los audios, los sonidos de las teclas y las carátulas (no ocupan lugar en la compu), y se hace una copia de la configuración (escenas, teclas, looks, favoritos y listas).' : '⚠ El disco «' + D.nombre() + '» no está conectado. ' + (D.error() || '')) : 'Todo se guarda en la memoria del navegador. Si la compu no tiene lugar, elegí un disco externo USB: va a guardar ahí todo lo pesado y una copia de la configuración.';
    const recargar = async () => { try { await A.recargar(); } catch (e) {} A.render(); };
    return h('div', null, h('p', { class: 'suave', style: 'margin-top:0' }, estado),
      h('div', { class: 'fila' },
        h('button', { type: 'button', class: 'primario', id: 'btnElegirDisco', onclick: async () => { try { const n = await D.elegir(); ok('Listo: uso «' + n + '».'); await recargar(); } catch (e) { if (e && e.name !== 'AbortError') ok(e.message || String(e)); } } }, D.activo() ? 'Cambiar de disco…' : 'Elegir disco o carpeta…'),
        D.activo() && !D.listo() ? h('button', { type: 'button', onclick: async () => { const r = await D.reconectar(); ok(r ? 'Disco reconectado.' : 'No se pudo reconectar.'); if (r) await recargar(); else A.render(); } }, 'Reconectar disco') : null),
      D.activo() && D.listo() ? h('div', { class: 'fila', style: 'margin-top:8px' },
        h('button', { type: 'button', id: 'btnMoverDisco', onclick: async (e) => { e.target.disabled = true; try { const n = await D.moverTodo((i, tt) => ok('Moviendo… ' + i + ' de ' + tt)); ok('Listo: pasé al disco ' + n.audios + ' audio(s), ' + n.sonidos + ' sonido(s) y ' + n.caratulas + ' carátula(s), y copié la configuración.'); if (MD.Au) D.alCambiar && D.alCambiar(); } catch (x) { ok(x.message || String(x)); } e.target.disabled = false; } }, 'Mover todo al disco'),
        h('button', { type: 'button', id: 'btnTraerCfg', onclick: async (e) => { e.target.disabled = true; try { const r = await D.restaurarConfig(); ok('Listo: traje ' + r.escenas + ' escena(s) y ' + r.claves + ' ajuste(s) del disco.'); await recargar(); } catch (x) { ok(x.message || String(x)); } e.target.disabled = false; } }, 'Traer la configuración del disco'),
        h('button', { type: 'button', class: 'peligro', onclick: async () => { await D.quitar(); A.render(); } }, 'Dejar de usar el disco')) : null,
      msg,
      h('p', { class: 'suave' }, 'Chrome te pide permiso la primera vez y cada vez que lo abrís de nuevo (tocá «Reconectar disco»). Si el disco no está enchufado, la app avisa y no baja nada a la compu. «Traer la configuración del disco» sirve para una compu nueva: reemplaza la configuración de acá por la copia del disco.'));
  }
  // 1.3-dev31: LUZ DE REPOSO = a que quedan (y a que vuelven al terminar un efecto) las lamparas cuando la escena no define su luz
  function tarjetaReposo(A) {
    const LZ = MD.LucesDnd, C = MD.Config, b = (A.cfg.ajustes.luzBase = C.normLuzBase(A.cfg.ajustes.luzBase));
    const aplicar = () => { A.cambio(false); try { LZ.alCambiarReposo(); } catch (e) {} A.render(); };
    const modos = [['foto', 'Como estaban antes (lo de siempre: vuelven a la luz que tenían)'], ['look', 'A un look que elijo'], ['apagar', 'Apagadas']];
    return h('div', { class: 'tarjeta', id: 'tarjetaReposo' }, h('div', { class: 'fila' }, MD.IUI.svg('luz', 'ic-luz'), h('h3', { style: 'margin:0' }, 'Luz de reposo')),
      h('p', { class: 'suave' }, 'Si una escena no tiene luz propia, ¿a qué quedan las lámparas (y a qué vuelven cuando termina un efecto o apagás un sonido con luz)? Se sincroniza con Drive.'),
      modos.map(([id, txt]) => h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'luzReposo', checked: b.modo === id, onchange: () => { b.modo = id; if (id === 'look' && !b.look) b.look = 'lf_taberna'; aplicar(); } }), ' ' + txt)),
      b.modo === 'look' ? h('div', { class: 'fila', style: 'margin-top:6px' }, muestraLook(LZ.look(b.look)), h('div', { class: 'crece' }, selLook(A, b.look, (v) => { b.look = v || 'lf_taberna'; aplicar(); }, '(elegí un look)'))) : null);
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
  // 2.0-dev8: bloque plegable (cerrado por defecto) para que la pantalla de Escenas no abrume. Recuerda abierto/cerrado mientras la app esta abierta.
  function plegable(A, id, titulo, resumen, icono, ...nodos) {
    A._plegEsc = A._plegEsc || {};
    const abierta = !!A._plegEsc[id];
    const cab = h('button', { type: 'button', class: 'sec-cab', 'aria-expanded': abierta ? 'true' : 'false', 'data-pleg': id },
      h('span', { class: 'sec-ic' }, MD.IUI.svg(icono)), h('span', { class: 'sec-tx' }, h('b', null, titulo), h('small', null, resumen)), MD.IUI.svg('flecha', 'sec-ch'));
    const caja = h('div', { class: 'sec plegable' + (abierta ? ' abierta' : '') }, cab, h('div', { class: 'sec-cuerpo' }, nodos));
    cab.addEventListener('click', () => { const ab = !caja.classList.contains('abierta'); A._plegEsc[id] = ab; caja.classList.toggle('abierta', ab); cab.setAttribute('aria-expanded', ab ? 'true' : 'false'); });
    return caja;
  }
  function vistaEscenas(A, el) {
    const cfg = A.cfg;
    const desk = !!(MD.Maqueta && MD.Maqueta.activa());          // 1.3-dev35: en pantalla ancha, lista de escenas a la izquierda y editor a la derecha
    const izq = desk ? h('div', { class: 'esc-lista' }) : el, der = desk ? h('div', { class: 'esc-ed' }) : el;
    if (desk) el.append(h('div', { class: 'esc-2col' }, izq, der));
    A.edEsc = Math.min(A.edEsc, cfg.escenas.length - 1);
    const esc = cfg.escenas[A.edEsc];
    const dm = !!(MD.Drive && MD.Drive.esDM());                    // 1.3-dev21: Frodo (DM) arma en borrador y confirma
    izq.append(barraEscenas(A, A.edEsc, (i) => { A.edEsc = i; A.edTecla = null; A.render(); }, 'ed'));
    const nuevaEsc = cfg.escenas.length < MD.Config.MAX_ESCENAS ? h('button', { type: 'button', id: 'btnNuevaEscena', onclick: () => { cfg.escenas.push(MD.Config.escenaNueva('Escena ' + (cfg.escenas.length + 1), dm ? 'borrador' : '')); A.edEsc = cfg.escenas.length - 1; A.edTecla = null; A.cambio(true); A.render(); } }, '+ Escena') : null;
    const enMac = A.escenasMacrodeck();
    izq.append(h('div', { class: 'fila esc-acciones' }, nuevaEsc,
      h('button', { type: 'button', id: 'btnEscMacrodeck', onclick: () => dialogoMacrodeck(A) }, 'Escenas en el Macrodeck (' + enMac.length + '/' + MD.Config.MAX_EN_MACRODECK + ')'),
      h('span', { class: 'suave' }, cfg.escenas.length + ' escena(s)')));

    const nombre = h('input', { type: 'text', value: esc.nombre, maxlength: 30, oninput: (e) => { esc.nombre = e.target.value; A.cambio(true); } });
    const mover = (d) => { const j = A.edEsc + d; if (j < 0 || j >= cfg.escenas.length) return; [cfg.escenas[A.edEsc], cfg.escenas[j]] = [cfg.escenas[j], cfg.escenas[A.edEsc]]; if (A.activa === A.edEsc) A.activa = j; else if (A.activa === j) A.activa = A.edEsc; A.edEsc = j; A.cambio(true); A.render(); };
    let seguro = false;
    const borrar = h('button', { class: 'peligro', type: 'button', onclick: (e) => {
      if (cfg.escenas.length < 2) return;
      if (!seguro) { seguro = true; e.target.textContent = 'Seguro? toca otra vez'; e.target.classList.add('seguro'); return; }
      cfg.escenas.splice(A.edEsc, 1); A.edEsc = Math.max(0, A.edEsc - 1); A.edTecla = null; if (A.activa >= cfg.escenas.length) A.activa = 0; A.activarSinSonido(); A.cambio(true); A.render();
    } }, 'Borrar escena');
    const dup = h('button', { type: 'button', onclick: () => { if (cfg.escenas.length >= MD.Config.MAX_ESCENAS) return; const c = JSON.parse(JSON.stringify(esc)); c.id = MD.Config.nuevoId('e'); c.nombre = (esc.nombre + ' (copia)').slice(0, 30); if (dm) c.estado = 'borrador'; cfg.escenas.splice(A.edEsc + 1, 0, c); A.edEsc++; A.cambio(true); A.render(); } }, 'Duplicar');
    // 1.3-dev21: estado de la escena. Borrador = en preparacion (Tom no la ve). Confirmada = ya la ve y la usa Tom al sincronizar con Drive.
    const borrador = esc.estado === 'borrador';
    const estadoFila = dm ? h('div', { class: 'fila', style: 'margin-bottom:10px;align-items:center' },
      h('span', { class: 'crece suave' }, borrador ? '✎ Borrador: Tom todavia no la ve.' : '✓ Confirmada: Tom la ve al sincronizar.'),
      h('button', { type: 'button', class: borrador ? 'primario' : '', id: 'btnConfirmar', onclick: () => { if (borrador) delete esc.estado; else esc.estado = 'borrador'; A.cambio(true); A.render(); } }, borrador ? 'Confirmar escena' : 'Volver a borrador')) : null;
    der.append(h('div', { class: 'tarjeta' },
      estadoFila,
      h('label', { style: 'margin-top:0' }, 'Nombre de la escena (en el selector del Macrodeck se ven ~7 letras)'), nombre,
      barraGuardar(A, true, false)));
    der.append(plegable(A, 'opc', 'Opciones de la escena', 'Macrodeck, orden, duplicar y borrar', 'ajustes', h('div', null,       (() => { const lug = A.lugarMacrodeck(A.edEsc), tilde = esc.macrodeck !== false;
        return h('label', { class: 'chk', style: 'margin-top:10px' }, h('input', { type: 'checkbox', id: 'chkMacrodeck', checked: tilde, onchange: (e) => { if (e.target.checked) delete esc.macrodeck; else esc.macrodeck = false; A.cambio(true); A.render(); } }),
          ' Mostrar en el Macrodeck ', h('span', { class: 'suave' }, lug >= 0 ? '(lugar ' + NOM[lug] + ' del selector)' : (tilde ? '(no entra: ya hay ' + MD.Config.MAX_EN_MACRODECK + ' en el selector)' : '(solo en la app)'))); })(),
      h('div', { class: 'fila', style: 'margin-top:10px' }, h('button', { type: 'button', onclick: () => mover(-1) }, '←'), h('button', { type: 'button', onclick: () => mover(1) }, '→'), dup, borrar)))); 
    if (MD.LucesDnd) { const nl = Object.keys(esc.luz || {}).length; der.append(plegable(A, 'luzEsc', 'Luz de ambiente de la escena', nl ? nl + (nl === 1 ? ' lámpara' : ' lámparas') : 'No cambia las luces', 'luz', lucesEscena(A, esc))); }
    if (MD.Audios && MD.Audios.tarjetaEscena) der.append(plegable(A, 'audEsc', 'Música y ambiente de fondo', [esc.lista ? 'Música: ' + ((MD.Au && MD.Au.lista(esc.lista.id) || {}).nombre || 'lista') : '', esc.ambiente ? 'Ambiente' : ''].filter(Boolean).join(' · ') || 'Sin música ni ambiente de fondo', 'audios', MD.Audios.tarjetaEscena(A, esc)));        // 1.3-dev25 / 2.0-dev8

    const rej = h('div', { class: 'rejilla' });
    esc.teclas.forEach((t, i) => { const c = celda(t, i, { onclick: () => { A.edTecla = i; A.render(); } }); if (i === A.edTecla) c.classList.add('sel'); rej.append(c); });
    der.append(h('div', { class: 'tarjeta' }, h('p', { class: 'suave', style: 'margin-top:0' }, 'Toca una tecla para editarla. Estan en el mismo orden que en el Macrodeck (arriba A1–E1, abajo A2–E2).'), rej));
    der.append(leyenda());

    if (A.edTecla != null) der.append(editorTecla(A, esc, A.edTecla));
  }

  function editorTecla(A, esc, i) {
    const cfg = A.cfg; const t = esc.teclas[i];
    const caja = h('div', { class: 'tarjeta', id: 'editorTecla' });
    caja.append(h('h3', null, 'Tecla ' + NOM[i]));
    if (!t) {
      caja.append(vacio('mesa', 'Esta tecla está vacía', 'Creala y elegí qué suena, cómo se llama y con qué icono se ve en la e-Paper.'));
      const fila = h('div', { class: 'fila' }, h('button', { class: 'primario', type: 'button', id: 'btnCrearTecla', onclick: () => { esc.teclas[i] = MD.Config.teclaNueva({ nombre: 'Nueva' }); A.cambio(true); A.render(); } }, 'Crear tecla'));
      if (A.portapapeles) fila.append(h('button', { type: 'button', onclick: () => { esc.teclas[i] = JSON.parse(JSON.stringify(A.portapapeles)); A.cambio(true); A.render(); } }, 'Pegar "' + (A.portapapeles.nombre || 'tecla') + '"'));
      caja.append(fila); return caja;
    }
    const cam = (campo, render) => (e) => { const v = (e.target.type === 'number' || e.target.type === 'range') ? Number(e.target.value) : e.target.value; t[campo] = v; if (campo === 'tipo' && !MD.Config.admiteDucking(v)) t.ducking = false;
      if (campo === 'tipo' && v === 'ambiente') { if (!(t.entrada > 0)) t.entrada = 3; if (!(t.salida > 0.4)) t.salida = 3; t.grupo = ''; }
      if (campo === 'tipo' && v === 'musica') { if (!(t.entrada > 0)) t.entrada = 3; if (!(t.salida > 0.4)) t.salida = 3; t.grupo = ''; if (!t.nombre || t.nombre === 'Nueva') t.nombre = 'Música'; }
      if (campo === 'tipo' && v === 'musica_sig' && (!t.nombre || t.nombre === 'Nueva')) t.nombre = 'Siguiente';
      if (campo === 'tipo' && v === 'musica_pausa' && (!t.nombre || t.nombre === 'Nueva')) t.nombre = 'Pausa';
      if (campo === 'tipo' && v === 'luz_toggle') { t.estados = MD.Config.normEstadosToggle(t.estados); if (t.fundido == null) t.fundido = 4; if (!t.nombre || t.nombre === 'Nueva') t.nombre = 'Dia/Noche'; }
      if (campo === 'tipo' && v === 'intensidad') { if (!t.icono) t.icono = MD.Config.ICONO_INTENSIDAD; if (!t.nombre) t.nombre = 'Intensidad'; }
      A.cambio(true); if (render) A.render(); };
    // v1.3-dev34: el editor se ordena en una parte basica (siempre visible: vista previa de la e-Paper, nombre y comportamiento) y 4 secciones que se abren y cierran.
    const basico = h('div', { class: 'ed-basico' });
    const previa = h('div', { class: 'ed-previa' });
    const pintarPrevia = () => { previa.textContent = ''; previa.append(h('div', { class: 'ed-previa-t' }, celda(t, i, { disabled: true, 'aria-hidden': 'true', tabindex: '-1' })),
      h('div', { class: 'ed-previa-tx' }, h('b', null, 'Así se ve en el Macrodeck'), h('small', null, 'La tecla es lisa: el dibujo y el nombre se ven en la e-Paper, y la tecla se prende con luz cálida mientras suena.'))); };
    pintarPrevia();
    const seccion = (id, titulo, icono, resumen) => {
      const cuerpo = h('div', { class: 'sec-cuerpo' }), abierta = (A._edSec || 'sonido') === id;
      const cab = h('button', { type: 'button', class: 'sec-cab', 'aria-expanded': abierta ? 'true' : 'false', 'data-sec': id },
        h('span', { class: 'sec-ic' }, MD.IUI.svg(icono)), h('span', { class: 'sec-tx' }, h('b', null, titulo), h('small', null, resumen)), MD.IUI.svg('flecha', 'sec-ch'));
      const caja2 = h('div', { class: 'sec' + (abierta ? ' abierta' : '') }, cab, cuerpo);
      cab.addEventListener('click', () => { const ab = !caja2.classList.contains('abierta'); A._edSec = ab ? id : '-'; caja2.classList.toggle('abierta', ab); cab.setAttribute('aria-expanded', ab ? 'true' : 'false'); });
      return { el: caja2, cuerpo };
    };
    const nSon = (t.sonidos || []).length;
    const resSonido = t.tipo === 'ambiente' ? (t.audio ? 'Ambiente elegido' : 'Sin ambiente todavía') : (t.tipo === 'musica' ? (t.lista ? 'Lista: ' + (t.listaNombre || 'elegida') : 'Sin lista todavía') : (t.tipo === 'musica_sig' || t.tipo === 'musica_pausa') ? 'Controla la música' : (t.tipo === 'luz_toggle' ? 'Cambio de luz' : (nSon ? nSon + (nSon === 1 ? ' sonido' : ' sonidos') : 'Sin sonido todavía')));
    const secSonido = seccion('sonido', 'Sonido', 'sonidos', resSonido);
    const secLuces = seccion('luces', 'Luces', 'luz', (t.luces && t.luces.length) ? t.luces.length + (t.luces.length === 1 ? ' lámpara' : ' lámparas') : 'No toca las lámparas');
    const actIc = t.icono ? MD.Iconos.entradaDeHex(t.icono) : null;
    const secIcono = seccion('icono', 'Icono', 'mesa', actIc ? actIc.nombre : (t.icono ? 'Icono propio' : 'Sin icono'));
    const secAvanz = seccion('avanzado', 'Avanzado', 'ajustes', 'Ducking, retoque y grupo exclusivo');
    let dest = caja;
    caja.append(previa, basico);
    const av = h('ul', { class: 'avisos' });
    const actAv = () => { av.innerHTML = ''; avisosTecla(A, t).forEach(x => av.append(h('li', null, x))); };

    dest = basico;
    dest.append(h('label', { style: 'margin-top:0' }, 'Nombre (hasta 18 letras, sin palabras de mas de 7)'),
      h('input', { type: 'text', id: 'inNombre', maxlength: 18, value: t.nombre, oninput: (e) => { t.nombre = e.target.value; A.cambio(true); actAv(); pintarPrevia(); } }));
    dest.append(h('label', null, 'Comportamiento (decide el color del marco en el Macrodeck)'),
      h('select', { id: 'selTipo', onchange: cam('tipo', true) }, MD.Config.tiposVisibles(t.tipo).map(c => h('option', { value: c.id, selected: c.id === t.tipo }, c.nombre))));
    dest.append(h('p', { class: 'suave' }, tipoDe(t.tipo).ayuda));

    dest = secSonido.cuerpo;
    if (t.tipo === 'ambiente') dest.append(ambienteTecla(A, t));
    if (t.tipo === 'musica') dest.append(musicaTecla(A, t));
    if (t.tipo === 'musica_sig' || t.tipo === 'musica_pausa') dest.append(h('p', { class: 'suave' }, 'Esta tecla no lleva sonido propio: maneja la música que esté sonando (carril de Música).'));
    if (t.tipo === 'luz_toggle') dest.append(toggleTecla(A, t));
    if (!MD.Config.sinSonido(t.tipo)) {
      const introLoop = t.tipo === 'intro_loop';
      const multi = ['azar', 'secuencia', 'intro_loop'].includes(t.tipo);
      dest.append(h('label', null, introLoop ? 'Sonidos (en orden: primero la intro, al final el loop)' : (multi ? 'Sonidos (en orden)' : 'Sonido')));
      if (introLoop) dest.append(h('p', { class: 'suave', style: 'margin-top:0' }, 'Suenan en este orden, uno atras del otro sin cortes, y el ULTIMO se repite hasta que lo apagues. Podes poner mas de una intro.'));
      const lista = h('div', { class: 'lista-s' });
      t.sonidos.forEach((id, k) => {
        const s = cfg.sonidos.find(x => x.id === id);
        const esElLoop = introLoop && k === t.sonidos.length - 1;
        lista.append(h('div', { class: 's' }, introLoop ? h('span', { class: 'etq' + (esElLoop ? ' loop' : '') }, esElLoop ? 'LOOP' : 'INTRO' + (t.sonidos.length > 2 ? ' ' + (k + 1) : '')) : null, h('span', { class: 'crece' }, s ? s.nombre : '(falta)'),
          h('button', { type: 'button', onclick: () => A.previa(id) }, '▶'),
          multi ? h('button', { type: 'button', onclick: () => { if (k > 0) { [t.sonidos[k - 1], t.sonidos[k]] = [t.sonidos[k], t.sonidos[k - 1]]; A.cambio(true); A.render(); } } }, '↑') : null,
          h('button', { class: 'peligro', type: 'button', onclick: () => { t.sonidos.splice(k, 1); A.cambio(true); A.render(); } }, '✕')));
      });
      dest.append(lista);
      {
        // v1.3-dev9: ventana con buscador, categorias y seleccion multiple (selector.js)
        dest.append(h('button', { type: 'button', id: 'btnAgregarSonidos', class: 'primario', disabled: !cfg.sonidos.length, style: 'width:100%',
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
    if (t.tipo === 'ambiente') {
      dest.append(h('div', { class: 'cols' }, h('div', null, h('label', null, 'Entrada (fundido, segundos)'), h('input', { type: 'number', min: 0, max: 10, step: 0.5, value: t.entrada, oninput: cam('entrada') })),
        h('div', null, h('label', null, 'Salida (fundido, segundos)'), h('input', { type: 'number', min: 0, max: 10, step: 0.5, value: t.salida, oninput: cam('salida') }))));
    }
    if (!MD.Config.sinSonido(t.tipo) || t.tipo === 'fadeout') {
      const etVol = h('label', null, 'Volumen de la tecla (' + Math.round(t.volumen * 100) + '%)');
      dest.append(h('div', { class: 'cols' },
        h('div', null, etVol, h('input', { type: 'range', min: 0, max: 1.5, step: 0.05, value: t.volumen, oninput: (e) => { t.volumen = +e.target.value; A.cambio(false); etVol.textContent = 'Volumen de la tecla (' + Math.round(t.volumen * 100) + '%)'; } })),
        ['loop', 'intro_loop', 'mantener', 'una_vez', 'azar', 'secuencia'].includes(t.tipo) ? h('div', null, h('label', null, 'Entrada (fundido, segundos)'), h('input', { type: 'number', min: 0, max: 10, step: 0.5, value: t.entrada, oninput: cam('entrada') })) : null,
        ['loop', 'intro_loop', 'mantener', 'fadeout'].includes(t.tipo) ? h('div', null, h('label', null, 'Salida (fundido, segundos)'), h('input', { type: 'number', min: 0, max: 10, step: 0.5, value: t.salida, oninput: cam('salida') })) : null));
    }
    dest = secAvanz.cuerpo;
    if (MD.Config.admiteDucking(t.tipo)) {
      const nativo = !!(MD.Nativo && MD.Nativo.duck);
      dest.append(h('label', { class: 'chk' },
        h('input', { type: 'checkbox', id: 'chkDucking', checked: !!t.ducking, onchange: (e) => { t.ducking = e.target.checked; A.cambio(true); A.render(); } }),
        ' Ducking: bajar la musica del celu mientras suena este sonido'),
        h('p', { class: 'suave' }, nativo
          ? 'Mientras suena (y 0,7 s despues) Android baja el volumen de YouTube/Spotify y despues lo devuelve solo. El nivel lo decide Android.'
          : 'Se guarda y se ve en el mapa del Macrodeck, pero SOLO baja la musica dentro de la app Android (APK). En el navegador no hace nada.'));
    }
    if (['una_vez', 'azar', 'secuencia', 'mantener'].includes(t.tipo))
      dest.append(h('label', null, 'Si la tocas mientras ya suena'), h('select', { onchange: cam('retoque') }, MD.Config.RETOQUES.map(r => h('option', { value: r.id, selected: r.id === t.retoque }, r.nombre))));
    if (MD.Config.esLoop(t.tipo) && t.tipo !== 'ambiente')
      dest.append(h('label', null, 'Grupo exclusivo (los loops con el mismo grupo se reemplazan entre si con fundido cruzado; ej: "amb")'), h('input', { type: 'text', maxlength: 20, value: t.grupo, oninput: cam('grupo') }));

    dest = secLuces.cuerpo;
    if (MD.LucesDnd && !['silenciar', 'intensidad', 'luz_toggle'].includes(t.tipo)) dest.append(lucesTecla(A, t));

    // v1.3-dev11: selector de iconos con CATEGORIAS, BUSCADOR y SUGERENCIAS segun el nombre de la tecla (428 iconos, ver iconos_datos.js)
    dest = secIcono.cuerpo;
    const icoBox = h('div', { class: 'ico-box' });
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
    dest.append(icoBox);

    [secSonido, secLuces, secIcono, secAvanz].forEach(s => { if (s.cuerpo.childNodes.length) caja.append(s.el); });
    caja.append(av); actAv();
    caja.append(h('div', { class: 'fila', style: 'margin-top:10px' },
      h('button', { type: 'button', onclick: () => { A.portapapeles = JSON.parse(JSON.stringify(t)); A.render(); } }, 'Copiar tecla'),
      A.portapapeles ? h('button', { type: 'button', onclick: () => { esc.teclas[i] = JSON.parse(JSON.stringify(A.portapapeles)); A.cambio(true); A.render(); } }, 'Pegar encima') : null,
      h('button', { class: 'peligro', type: 'button', onclick: () => { esc.teclas[i] = null; A.cambio(true); A.render(); } }, 'Vaciar tecla')));
    caja.append(barraGuardar(A, true, true));
    return caja;
  }

  // ===================== SONIDOS =====================
  // v1.3-dev33: estado vacio con dibujito (icono del catalogo del Macrodeck) y una frase util
  function vacio(icono, titulo, texto, accion) {
    return h('div', { class: 'vacio' }, MD.IUI.svg(icono, 'vacio-ic'), h('b', null, titulo), h('p', { class: 'suave' }, texto), accion || null);
  }
  // v1.3-dev33: pestana "Mas": Sonidos, Drive y Herramientas (las mismas pantallas de antes, un toque mas adentro)
  function vistaMas(A, el) {
    const fila = (ic, titulo, sub, tab, badge) => h('button', { type: 'button', class: 'fila-mas', 'data-mas': tab, onclick: () => { A.tab = tab; A.render(); el.scrollTop = 0; } },
      h('span', { class: 'fm-ic' }, MD.IUI.svg(ic)), h('span', { class: 'fm-tx' }, h('b', null, titulo), h('small', null, sub)),
      badge ? h('b', { class: 'bd fm-bd' }, String(badge)) : null, MD.IUI.svg('adelante', 'fm-ch'));
    const n = (A.cfg.sonidos || []).length;
    el.append(h('h2', { class: 'tit-vista' }, 'Más'),
      h('div', { class: 'lista-mas' },
        fila('sonidos', 'Sonidos', n ? n + ' sonidos en este celu' : 'Tu biblioteca de sonidos', 'sonidos'),
        fila('drive', 'Drive', 'Sincronizar, subir y bajar sonidos y escenas', 'drive', A.drivePend),
        fila('herramientas', 'Herramientas', 'Packs, logos, apariencia, diagnóstico y ayuda', 'herramientas')),
      (MD.Panel && MD.Panel.opcionesPantalla) ? h('div', { class: 'tarjeta', id: 'masPantalla' }, h('h3', { style: 'margin:0 0 8px' }, 'Pantalla'), MD.Panel.opcionesPantalla()) : null);
  }
  function vistaSonidos(A, el) {
    const cfg = A.cfg;
    // 1.3-dev24: se saco "Importar sonidos": los sonidos llegan directo desde Drive (pestana Drive). Aca solo se ven y se ajustan.
    if (!cfg.sonidos.length) { el.append(vacio('sonidos', 'Todavía no hay sonidos en este celu', 'Se bajan desde Drive (Más > Drive).', h('button', { class: 'primario', type: 'button', onclick: () => { A.tab = 'drive'; A.render(); } }, 'Ir a Drive'))); return; }
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
      if (!esc) { if (cfg.escenas.length >= MD.Config.MAX_ESCENAS) { A.estadoPack = 'Ya hay ' + MD.Config.MAX_ESCENAS + ' escenas: borra una para poder crear la de prueba de iconos.'; A.render(); return; } esc = MD.Config.escenaNueva('Prueba iconos'); esc.id = 'prueba_iconos'; cfg.escenas.push(esc); }
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
    if (MD.Red && MD.Nativo) lista.append(acordeon(A, 'red', 'drive', 'Redes sin descargas', MD.Red.config().bloquear.join(', ') || 'ninguna', () => tarjetaRed(A)));
    if (MD.Disco && MD.Disco.disponible()) lista.append(acordeon(A, 'disco', 'almacen', 'Disco externo', MD.Disco.activo() ? (MD.Disco.listo() ? MD.Disco.nombre() : 'desconectado') : 'no usado', () => tarjetaDisco(A)));
    lista.append(acordeon(A, 'almacen', 'almacen', 'Almacenamiento', 'v' + MD.VERSION, () => h('div', null,
      h('p', { class: 'suave', style: 'margin-top:0' }, A.infoAlmacen || ''),
      h('div', { class: 'fila' }, h('button', { type: 'button', onclick: () => A.pedirPersistencia() }, 'Proteger datos'),
        h('button', { class: 'peligro', type: 'button', onclick: async (e) => { if (!A._borr) { A._borr = 1; e.target.textContent = 'Seguro? se borra TODO'; return; } A._borr = 0; await A.borrarTodo(); } }, 'Borrar todo')),
      h('p', { class: 'suave', style: 'margin-bottom:0' }, 'Version de la app: ' + MD.VERSION))));
    el.append(lista);
  }

  MD.UI = { h, icoCanvas, barraEscenas, vacio, vistaMas, vistaMesa, vistaEscenas, vistaSonidos, vistaLuces, vistaHerramientas, NOM };
})(window.MD);
