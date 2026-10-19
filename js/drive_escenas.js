// drive_escenas.js - Junta ("fusiona") las escenas de este celu con las de Drive sin que Tom y Frodo se pisen.
// Funcion pura (no toca la pantalla ni internet): por eso se puede probar sola.
//  - base   = las escenas tal como estaban la ultima vez que este celu sincronizo (o null si nunca)
//  - local  = las escenas de este celu ahora
//  - remote = las escenas que hay en Drive ahora
// Regla por escena (se compara por id): si solo cambio de un lado, gana ese lado; si cambio de los dos lados y
// quedaron distintas, es un conflicto y hay que elegir ('mia' o 'drive') en el parametro 'elec'.
window.MD = window.MD || {};
(function (MD) {
  function estable(x) {
    if (Array.isArray(x)) return '[' + x.map(estable).join(',') + ']';
    // v1.3: 'categoria' (eliminada) y 'ducking: false' (el valor por defecto) no cuentan: asi una app vieja y una nueva no se ven como "cambiadas".
    if (x && typeof x === 'object') return '{' + Object.keys(x).filter(k => k !== 'categoria' && !(k === 'ducking' && !x[k])).sort().map(k => JSON.stringify(k) + ':' + estable(x[k])).join(',') + '}';
    return JSON.stringify(x === undefined ? null : x);
  }
  const vacia = (e) => Array.isArray(e.teclas) && !e.teclas.some(Boolean);   // (los looks no tienen teclas: nunca cuentan como vacios)
  const mapa = (lista) => new Map((lista || []).filter(e => e && e.id).map(e => [e.id, e]));

  // 'max' = cuantos elementos como mucho (escenas: 10). 'elec' puede ser un objeto {id: 'mia'|'drive'} o una funcion (id) => 'mia'|'drive'|undefined.
  function fusionar(base, local, remote, elec, max) {
    const eleg = typeof elec === 'function' ? elec : (id) => (elec || {})[id];
    max = max || 10;
    const B = mapa(base), L = mapa(local), R = mapa(remote);
    const res = { traidas: 0, subidas: 0, borradas: 0, iguales: 0 }, conflictos = [], out = [];
    const ids = [];
    (remote || []).forEach(e => { if (e && e.id && !ids.includes(e.id)) ids.push(e.id); });
    (local || []).forEach(e => { if (e && e.id && !ids.includes(e.id)) ids.push(e.id); });
    for (const id of ids) {
      const b = B.get(id), l = L.get(id), r = R.get(id);
      const fb = b && estable(b), fl = l && estable(l), fr = r && estable(r);
      if (l && r) {
        if (fl === fr) { res.iguales++; out.push(l); continue; }
        if (b && fl === fb) { res.traidas++; out.push(r); continue; }
        if (b && fr === fb) { res.subidas++; out.push(l); continue; }
        if (eleg(id) === 'mia') { res.subidas++; out.push(l); continue; }
        if (eleg(id) === 'drive') { res.traidas++; out.push(r); continue; }
        conflictos.push(id); out.push(l); continue;
      }
      if (l && !r) {
        if (!b && vacia(l) && (remote || []).length) continue;          // la escena vacia que trae una app recien instalada no se sube
        if (b && fl === fb) { res.borradas++; continue; }                 // alguien la borro en Drive y aca no se toco
        res.subidas++; out.push(l); continue;
      }
      if (!l && r) {
        if (b && fr === fb) { res.borradas++; continue; }                 // la borre aca y en Drive no se toco
        res.traidas++; out.push(r); continue;
      }
    }
    return { escenas: out.slice(0, max), conflictos, resumen: res, igual: estable(out.slice(0, max)) === estable(remote || []) };
  }
  MD.DriveEsc = { fusionar, estable };
})(window.MD);
