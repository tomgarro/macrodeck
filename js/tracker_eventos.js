// tracker_eventos.js - Initiative Tracker: la lista de "movimientos" (eventos) y que suena / que luz se prende con cada uno.
//
// Cada movimiento del Arduino tiene un ID de 2 letras (ver el sketch). Para cada uno se puede elegir:
//   - SONIDO: de fabrica (la seleccion de Frodo, que se guarda en la app y NUNCA se pisa), silencio, o uno o varios de la biblioteca (al azar, sin repetir).
//   - LUZ: un look de las lamparas de D&D (el mismo catalogo de la pestana Luces), cuantos segundos y en cual lampara.
//   - POR PERSONAJE: lo mismo, pero solo cuando el evento es de una clase (ej.: otro sonido cuando le toca a Nabi).
// Se guarda SOLO lo que se cambia ("cambios"); lo de fabrica vive en este archivo. Asi "Restaurar" es borrar el cambio y nunca se pierde nada.
//
// Para sumar un evento nuevo en el futuro: agregarlo a EVENTOS (y al sketch). Todo lo demas (pantalla, monitor, estadisticas) lo toma solo.
window.MD = window.MD || {};
(function (MD) {
  const Trk = MD.Trk || (MD.Trk = {});

  // sonidos de fabrica = los 8 mp3 de Frodo (app-dnd/tracker/sfx/<nombre>.mp3)
  Trk.SFX_FABRICA = ['cfgMove1', 'cmbMove1', 'cmbMove2', 'cmbMove3', 'kill1', 'roundchange1', 'roundchange2', 'roundchange3'];
  Trk.SFX_NOMBRES = { cfgMove1: 'Configuración', cmbMove1: 'Turno 1', cmbMove2: 'Turno 2', cmbMove3: 'Turno 3', kill1: 'Muerte', roundchange1: 'Ronda 1', roundchange2: 'Ronda 2', roundchange3: 'Ronda 3' };

  const C = 'Cantidad', P = 'Personajes', T = 'Turnos', E = 'Estados', I = 'Insertar y deshacer', S = 'Sistema';
  // clase: true = el evento trae el personaje (t), asi que se puede elegir otro sonido/luz segun quien sea
  // sf = sonidos de fabrica · sug = luz sugerida (no se aplica sola: boton "Luces sugeridas")
  Trk.EVENTOS = [
    { id: 'QU', g: C, n: 'Subir la cantidad', d: 'Al sumar un combatiente (también al dar la vuelta de 12 a 1)', sf: ['cfgMove1'] },
    { id: 'QD', g: C, n: 'Bajar la cantidad', d: 'Al restar un combatiente (también al dar la vuelta de 1 a 12)', sf: ['cfgMove1'] },
    { id: 'QO', g: C, n: 'Cantidad confirmada', d: 'Mantenés el centro 2 s: pasa a elegir los personajes', sug: { look: 'lf_hechizo', seg: 2 } },
    { id: 'CN', g: P, n: 'Personaje siguiente', d: 'Al cambiar de personaje para el lugar que se está armando', clase: true, sf: ['cfgMove1'] },
    { id: 'CP', g: P, n: 'Personaje anterior', d: 'Lo mismo, hacia el otro lado', clase: true, sf: ['cfgMove1'] },
    { id: 'CS', g: P, n: 'Personaje confirmado', d: 'Un toque corto en el centro: queda elegido y pasa al lugar que sigue', clase: true },
    { id: 'CG', g: P, n: 'Empieza el combate', d: 'Se eligió el último personaje', sug: { look: 'lf_combate', seg: 4 } },
    { id: 'TN', g: T, n: 'Turno siguiente', d: 'Botón izquierdo', clase: true, sf: ['cmbMove1', 'cmbMove2', 'cmbMove3'] },
    { id: 'TP', g: T, n: 'Turno anterior', d: 'Botón derecho', clase: true, sf: ['cmbMove1', 'cmbMove2', 'cmbMove3'] },
    { id: 'RN', g: T, n: 'Ronda nueva', d: 'Se da la vuelta completa hacia adelante', clase: true, sf: ['roundchange1', 'roundchange2', 'roundchange3'], sug: { look: 'lf_relampago', seg: 2 } },
    { id: 'RP', g: T, n: 'Ronda anterior', d: 'Se da la vuelta completa hacia atrás', clase: true, sf: ['roundchange1', 'roundchange2', 'roundchange3'] },
    { id: 'SC', g: E, n: 'Concentración', d: 'Toque corto en el centro: pasa a concentración (rosa)', clase: true, sug: { look: 'lf_hechizo', seg: 2 } },
    { id: 'SJ', g: E, n: 'Comodín', d: 'Segundo toque: comodín (verde lima)', clase: true, sug: { look: 'lf_veneno', seg: 2 } },
    { id: 'SN', g: E, n: 'Vuelve a normal', d: 'Tercer toque, o un toque sobre alguien caído', clase: true },
    { id: 'SI', g: E, n: 'Cae inconsciente', d: 'Centro mantenido 2 s sobre un personaje (no enemigo)', clase: true, sug: { look: 'lf_alarma', seg: 2 } },
    { id: 'KL', g: E, n: 'Muere', d: 'Centro mantenido 2 s sobre un enemigo (4 s sobre un invitado). Suena apenas empieza el destello', clase: true, sf: ['kill1'], sug: { look: 'lf_rugido', seg: 2.5 } },
    { id: 'IN', g: I, n: 'Se inserta alguien', d: 'Centro + izquierdo: aparece un lugar nuevo después del turno actual', clase: true },
    { id: 'IT', g: I, n: 'Cambia el tipo del insertado', d: 'Mientras se elige quién es el que se inserta', clase: true, sf: ['cfgMove1'] },
    { id: 'IO', g: I, n: 'Insertado confirmado', d: 'Un toque en el centro: queda en el orden', clase: true },
    { id: 'UN', g: I, n: 'Deshacer', d: 'Centro + derecho: vuelve un paso atrás (hasta 5)' },
    { id: 'NO', g: I, n: 'No se puede', d: 'Insertar con 12 lugares llenos, o deshacer sin nada que deshacer' },
    { id: 'VI', g: S, n: 'Victoria', d: 'Cae el último enemigo', sug: { look: 'lf_curacion', seg: 6 } },
    { id: 'TK', g: S, n: 'Caída total (TPK)', d: 'Caen todos los del grupo: vuelve a empezar', sug: { look: 'lf_alarma', seg: 5 } },
    { id: 'RS', g: S, n: 'Reinicio de 3 botones', d: 'Los tres botones juntos 3 s: vuelve a la cantidad', sug: { look: 'lf_apagar', seg: 2 } },
    { id: 'ID', g: S, n: 'Turno inactivo', d: 'Nadie toca el tracker hace 3 minutos (la ficha parpadea rápido)', clase: true },
  ];
  Trk.EV = {}; Trk.EVENTOS.forEach((e) => { Trk.EV[e.id] = e; });
  Trk.GRUPOS = [C, P, T, E, I, S];

  // ---------- configuracion (solo cambios) ----------
  // entrada = { s?: ['f:cmbMove1' | 's:<idDeLaBiblioteca>', ...] ([] = silencio), vol?: 0..1, l?: { look, seg, lamp:'dnd'|'dnd-1'|'dnd-2' } | null (= sin luz) }
  // "undefined" en s o l = no se tocó: vale lo de más abajo (clase -> evento -> fábrica).
  Trk.cfgNueva = function () { return { v: 1, vol: 1, duck: true, luces: true, auto: true, baud: 115200, ev: {}, cl: {}, taller: null, luzTurno: { on: false, seg: 4, lamp: 'dnd', efecto: 'respirar', brillo: 80 } }; };
  // Taller de colores (3.0): lo que Frodo eligio para el tracker. mask = personajes que se pueden elegir (bits E D R N X L I a b c d; el enemigo siempre), brillo 5..100, col = color por letra, nom = nombre de los invitados a-d.
  Trk.tallerNormalizar = function (t) {
    if (!t || typeof t !== 'object') return null;
    const n = (v, d, a, z) => { v = Number(v); return isFinite(v) ? Math.min(z, Math.max(a, Math.round(v))) : d; };
    const o = { mask: (n(t.mask, Trk.MASCARA_FABRICA, 0, 2047) | 1), brillo: n(t.brillo, Trk.BRILLO_FABRICA, 5, 100), col: {}, nom: {} };
    for (const k of Trk.LETRAS_TODAS) {
      const c = t.col && t.col[k]; o.col[k] = Array.isArray(c) && c.length === 3 ? c.map((v) => n(v, 0, 0, 255)) : Trk.TIPOS[k].c.slice();
    }
    for (const k of 'abcd') { const s = t.nom && typeof t.nom[k] === 'string' ? t.nom[k].replace(/[^\x20-\x7e]/g, '').trim().slice(0, 9) : ''; if (s) o.nom[k] = s; }
    return o;
  };
  Trk.cfgNormalizar = function (c) {
    const b = Trk.cfgNueva(); if (!c || typeof c !== 'object') return b;
    const n = (v, d, a, z) => { v = Number(v); return isFinite(v) ? Math.min(z, Math.max(a, v)) : d; };
    b.vol = n(c.vol, 1, 0, 1); b.duck = c.duck !== false; b.luces = c.luces !== false; b.auto = c.auto !== false;
    b.baud = [9600, 19200, 38400, 57600, 115200].indexOf(c.baud) >= 0 ? c.baud : 115200;
    b.taller = Trk.tallerNormalizar(c.taller);
    if (c.luzTurno && typeof c.luzTurno === 'object') {
      const z = c.luzTurno;
      b.luzTurno = { on: z.on === true, seg: n(z.seg, 4, 1, 30), lamp: ['dnd', 'dnd-1', 'dnd-2'].indexOf(z.lamp) >= 0 ? z.lamp : 'dnd', efecto: ['fijo', 'respirar', 'magia'].indexOf(z.efecto) >= 0 ? z.efecto : 'respirar', brillo: n(z.brillo, 80, 10, 100) };
    }
    const ent = (x) => {
      const o = {}; if (!x || typeof x !== 'object') return o;
      if (Array.isArray(x.s)) o.s = x.s.filter((r) => typeof r === 'string' && /^[fs]:.+/.test(r)).slice(0, 12);
      if (x.vol != null) o.vol = n(x.vol, 1, 0, 1);
      if (x.l === null) o.l = null; else if (x.l && typeof x.l === 'object' && typeof x.l.look === 'string') o.l = { look: x.l.look, seg: n(x.l.seg, 3, 0.5, 30), lamp: ['dnd', 'dnd-1', 'dnd-2'].indexOf(x.l.lamp) >= 0 ? x.l.lamp : 'dnd' };
      return o;
    };
    for (const id of Object.keys(c.ev || {})) if (Trk.EV[id]) { const o = ent(c.ev[id]); if (Object.keys(o).length) b.ev[id] = o; }
    for (const t of Object.keys(c.cl || {})) if (Trk.TIPOS[t]) for (const id of Object.keys(c.cl[t] || {})) if (Trk.EV[id] && Trk.EV[id].clase) { const o = ent(c.cl[t][id]); if (Object.keys(o).length) (b.cl[t] = b.cl[t] || {})[id] = o; }
    return b;
  };
  // Lo que vale para un evento (y, si trae personaje, para esa clase). origen: de donde sale cada cosa ('clase' | 'evento' | 'fabrica').
  Trk.resolver = function (cfg, id, t) {
    const ev = Trk.EV[id], e = (cfg.ev || {})[id] || {}, k = (t && cfg.cl && cfg.cl[t] && cfg.cl[t][id]) || {};
    const r = { s: (ev.sf || []).map((f) => 'f:' + f), vol: 1, l: null, orig: { s: 'fabrica', l: 'fabrica', vol: 'fabrica' } };
    if (e.s) { r.s = e.s; r.orig.s = 'evento'; } if (k.s) { r.s = k.s; r.orig.s = 'clase'; }
    if (e.vol != null) { r.vol = e.vol; r.orig.vol = 'evento'; } if (k.vol != null) { r.vol = k.vol; r.orig.vol = 'clase'; }
    if (e.l !== undefined) { r.l = e.l; r.orig.l = 'evento'; } if (k.l !== undefined) { r.l = k.l; r.orig.l = 'clase'; }
    return r;
  };
  // ¿el evento (o esa clase) tiene algo cambiado?
  Trk.cambiado = function (cfg, id, t) { const o = t ? ((cfg.cl || {})[t] || {})[id] : (cfg.ev || {})[id]; return !!o && Object.keys(o).length > 0; };
  Trk.cambiosDe = function (cfg, id) { let n = Trk.cambiado(cfg, id) ? 1 : 0; for (const t of Object.keys(cfg.cl || {})) if (cfg.cl[t][id] && Object.keys(cfg.cl[t][id]).length) n++; return n; };
  // Posicion del personaje dentro de los argumentos del evento (para el sonido por clase)
  Trk.claseDe = function (id, a) { if (!Trk.EV[id] || !Trk.EV[id].clase) return null; for (const x of a) if (x && x.length === 1 && Trk.TIPOS[x]) return x; return null; };

  // ---------- estadisticas de la sesion ----------
  Trk.statsNueva = function () { return { t0: 0, eventos: 0, turnos: 0, rondas: 1, muertes: 0, caidos: 0, mov: 0, porClase: {}, ult: 0 }; };
  Trk.statsContar = function (s, id, a, ahora) {
    s.eventos++; s.ult = ahora;
    if (id === 'CG') { s.t0 = ahora; s.turnos = 0; s.rondas = 1; s.muertes = 0; s.caidos = 0; s.mov = 0; }
    if (id === 'TN' || id === 'TP') { s.turnos++; s.mov++; }
    if (id === 'RN') { s.turnos++; s.mov++; s.rondas = Math.max(s.rondas, +a[0] || s.rondas); }
    if (id === 'RP') s.mov++;
    if (id === 'SC' || id === 'SJ' || id === 'SN' || id === 'UN') s.mov++;
    if (id === 'KL') { s.muertes++; s.mov++; }
    if (id === 'SI') { s.caidos++; s.mov++; }
    if (id === 'TK' || id === 'RS') s.t0 = 0;
    const t = Trk.claseDe(id, a); if (t && (id === 'TN' || id === 'RN')) s.porClase[t] = (s.porClase[t] || 0) + 1;
  };
})(window.MD);
