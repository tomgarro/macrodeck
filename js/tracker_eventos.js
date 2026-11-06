// tracker_eventos.js - Initiative Tracker: la lista de "movimientos" (eventos) y que suena / que luz se prende con cada uno.
//
// Cada movimiento del tracker tiene un ID de 2 letras (ver motor.h del Initiative Tracker 2.0). Para cada uno se puede elegir:
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
    { id: 'CM', g: P, n: 'Se mueve el cursor', d: 'C2 / E2 al armar: pasa a otro lugar (da la vuelta)', clase: true, sf: ['cfgMove1'] },
    { id: 'CN', g: P, n: 'Cambia el personaje', d: 'Toque corto de D2 al armar: el personaje que sigue en el lugar marcado', clase: true, sf: ['cfgMove1'] },
    { id: 'CG', g: P, n: 'Empieza el combate', d: 'D2 mantenida 2 s al armar', sug: { look: 'lf_combate', seg: 4 } },
    { id: 'TN', g: T, n: 'Turno siguiente', d: 'Botón izquierdo', clase: true, sf: ['cmbMove1', 'cmbMove2', 'cmbMove3'] },
    { id: 'TP', g: T, n: 'Turno anterior', d: 'Botón derecho', clase: true, sf: ['cmbMove1', 'cmbMove2', 'cmbMove3'] },
    { id: 'RN', g: T, n: 'Ronda nueva', d: 'Se da la vuelta completa hacia adelante', clase: true, sf: ['roundchange1', 'roundchange2', 'roundchange3'], sug: { look: 'lf_relampago', seg: 2 } },
    { id: 'RP', g: T, n: 'Ronda anterior', d: 'Se da la vuelta completa hacia atrás', clase: true, sf: ['roundchange1', 'roundchange2', 'roundchange3'] },
    { id: 'SC', g: E, n: 'Concentración', d: 'D2 apretada + perilla en Concentración (rosa). Convive con los otros estados', clase: true, sug: { look: 'lf_hechizo', seg: 2 } },
    { id: 'SJ', g: E, n: 'Wild (comodín)', d: 'D2 apretada + perilla en Wild (verde lima). Convive con los otros estados', clase: true, sug: { look: 'lf_veneno', seg: 2 } },
    { id: 'SN', g: E, n: 'Vuelve a normal', d: 'D2 apretada + perilla al mínimo (Normal): saca todos los estados menos el agotamiento', clase: true },
    { id: 'SI', g: E, n: 'Cae inconsciente', d: 'D2 mantenida QUIETA 2 s sobre un personaje (no enemigo)', clase: true, sug: { look: 'lf_alarma', seg: 2 } },
    { id: 'ST', g: E, n: 'Estado nuevo', d: 'D2 apretada + perilla: una condición del PHB (cegado, envenenado, paralizado…). Se suma a los que ya tiene. La luz de abajo es la del estado, se cambia en «Estados»', clase: true },
    { id: 'SX', g: E, n: 'Estado quitado', d: 'Toque corto de D2 (o la lista para sacar), o elegir con la perilla un estado que ya tenía. También cuando despierta un caído', clase: true },
    { id: 'AG', g: E, n: 'Cambia el agotamiento', d: 'D2 apretada + perilla en Agotamiento: sube un nivel (al 7.º vuelve a 0). Con la lista para sacar, baja uno', clase: true },
    { id: 'KL', g: E, n: 'Muere', d: 'D2 mantenida QUIETA 2 s sobre un enemigo (4 s sobre un invitado). Suena apenas empieza el destello', clase: true, sf: ['kill1'], sug: { look: 'lf_rugido', seg: 2.5 } },
    { id: 'IN', g: I, n: 'Se inserta alguien', d: 'D2 + C1: aparece un lugar nuevo después del turno actual', clase: true },
    { id: 'IT', g: I, n: 'Cambia el tipo del insertado', d: 'Mientras se elige quién es el que se inserta', clase: true, sf: ['cfgMove1'] },
    { id: 'IO', g: I, n: 'Insertado confirmado', d: 'Un toque en el centro: queda en el orden', clase: true },
    { id: 'UN', g: I, n: 'Deshacer', d: 'A2 (o D2 + E1): vuelve un paso atrás (hasta 5)' },
    { id: 'NO', g: I, n: 'No se puede', d: 'Insertar con 12 lugares llenos, deshacer sin nada que deshacer, o sacar estados a alguien que no tiene' },
    { id: 'VI', g: S, n: 'Victoria', d: 'Cae el último enemigo', sug: { look: 'lf_curacion', seg: 6 } },
    { id: 'TK', g: S, n: 'Caída total (TPK)', d: 'Caen todos los del grupo: vuelve a empezar', sug: { look: 'lf_alarma', seg: 5 } },
    { id: 'RS', g: S, n: 'Reinicio del combate', d: 'Restart en el menú del tracker (HOME 3 s), o D2 + D1 3 s: vuelve a la cantidad', sug: { look: 'lf_apagar', seg: 2 } },
    { id: 'ID', g: S, n: 'Turno inactivo', d: 'Nadie toca el tracker hace 3 minutos (la ficha parpadea rápido)', clase: true },
  ];
  Trk.EV = {}; Trk.EVENTOS.forEach((e) => { Trk.EV[e.id] = e; });
  Trk.GRUPOS = [C, P, T, E, I, S];

  // ---------- configuracion (solo cambios) ----------
  // entrada = { s?: ['f:cmbMove1' | 's:<idDeLaBiblioteca>', ...] ([] = silencio), vol?: 0..1, l?: { look, seg, lamp:'dnd'|'dnd-1'|'dnd-2' } | null (= sin luz) }
  // "undefined" en s o l = no se tocó: vale lo de más abajo (clase -> evento -> fábrica).
  Trk.cfgNueva = function () { return { v: 1, vol: 1, mute: false, duck: true, luces: true, auto: true, ev: {}, cl: {}, taller: null, luzTurno: { on: false, seg: 4, lamp: 'dnd', efecto: 'respirar', brillo: 80 } }; };
  // Taller de colores (3.0): lo que Frodo eligio para el tracker. mask = personajes que se pueden elegir (bits E D R N X L I a b c d; el enemigo siempre), brillo 5..100, col = color por letra, nom = nombre de cada personaje (D R N X L I a b c d: se puede cambiar para otra campaña), cls = su clase (texto libre).
  Trk.tallerNormalizar = function (t) {
    if (!t || typeof t !== 'object') return null;
    const n = (v, d, a, z) => { v = Number(v); return isFinite(v) ? Math.min(z, Math.max(a, Math.round(v))) : d; };
    const o = { mask: (n(t.mask, Trk.MASCARA_FABRICA, 0, 2047) | 1), brillo: n(t.brillo, Trk.BRILLO_FABRICA, 5, 100), col: {}, nom: {}, cls: {} };
    for (const k of Trk.LETRAS_TODAS) {
      const c = t.col && t.col[k]; o.col[k] = Array.isArray(c) && c.length === 3 ? c.map((v) => n(v, 0, 0, 255)) : Trk.TIPOS[k].c.slice();
    }
    for (const k of 'DRNXLIabcd') {
      const s = t.nom && typeof t.nom[k] === 'string' ? t.nom[k].replace(/[^\x20-\x7e]/g, '').trim().slice(0, 9) : ''; if (s) o.nom[k] = s;
      const c = t.cls && typeof t.cls[k] === 'string' ? t.cls[k].replace(/[^\x20-\x7e\u00c0-\u00ff]/g, '').trim().slice(0, 14) : ''; if (c) o.cls[k] = c;
    }
    const e = t.est, ev = { hab: n(e && e.hab, Trk.EST_MASCARA_FABRICA, 0, 0x3FFFF) | 1 | (1 << 17), col: [] };      // 2.0-dev27: estados del selector
    for (let i = 0; i < 18; i++) { const c = e && e.col && e.col[i]; ev.col.push(Array.isArray(c) && c.length === 3 ? c.map((v) => n(v, 0, 0, 255)) : Trk.COL_EST_FABRICA[i].slice()); }
    o.est = ev;
    return o;
  };
  Trk.cfgNormalizar = function (c) {
    const b = Trk.cfgNueva(); if (!c || typeof c !== 'object') return b;
    const n = (v, d, a, z) => { v = Number(v); return isFinite(v) ? Math.min(z, Math.max(a, v)) : d; };
    b.vol = n(c.vol, 1, 0, 1); b.duck = c.duck !== false; b.luces = c.luces !== false; b.auto = c.auto !== false;
    b.mute = c.mute === true;                                     // 2.0-dev31: B2 un toque = sonidos del tracker en silencio
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
