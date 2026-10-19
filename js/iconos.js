// iconos.js - Biblioteca de iconos de 24 x 24 puntos (1 color) para el mapa de la e-Paper + conversor de imagenes + busqueda.
// v1.3-dev11: los iconos ya NO se dibujan aca: vienen PRE-RENDERIZADOS en js/iconos_datos.js (generado por herramientas/iconos/generar_iconos.py
// a partir de Material Design Icons (Apache 2.0), siluetas de Game-icons.net (CC BY 3.0) y dibujos propios). Ver MD.IconosDatos.creditos.
window.MD = window.MD || {};
(function (MD) {
  const L = 24;
  const D = MD.IconosDatos || { cats: [], items: [], migra: [], creditos: '' };
  const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const categorias = D.cats.map(c => ({ id: c[0], nombre: c[1] }));
  const nombreCat = {}; categorias.forEach(c => { nombreCat[c.id] = c.nombre; });
  // Cada icono: { id, nombre, cat, catNombre, kw, hex, origen, desc, _q (texto normalizado para buscar), _pal (palabras clave) }
  const lista = D.items.map(r => ({ id: r[0], nombre: r[1], cat: r[2], catNombre: nombreCat[r[2]] || '', kw: r[3], hex: r[4], origen: r[5], desc: nombreCat[r[2]] || '',
    _q: norm(r[1] + ' ' + r[0].replace(/_/g, ' ') + ' ' + r[3]), _pal: new Set(norm(r[3] + ' ' + r[1] + ' ' + r[0].replace(/_/g, ' ')).split(/[^a-z0-9]+/).filter(Boolean)) }));
  const porId = {}; lista.forEach(e => { porId[e.id] = e; });
  const porHex = {}; lista.forEach(e => { if (!porHex[e.hex]) porHex[e.hex] = e; });
  const migra = {}; D.migra.forEach(m => { migra[m[0]] = m[1]; });

  function lienzo() { const cv = document.createElement('canvas'); cv.width = L; cv.height = L; return cv; }
  function aBits(img, modo, umbral, invertir) {
    const out = new Uint8Array(72);
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      const k = (y * L + x) * 4, r = img.data[k], g = img.data[k + 1], b = img.data[k + 2], a = img.data[k + 3];
      let tinta;
      if (modo === 'alfa') tinta = a >= 128;
      else { const lum = (299 * r + 587 * g + 114 * b) / 1000; tinta = lum >= umbral; if (invertir) tinta = !tinta; tinta = tinta && a >= 128; }
      if (tinta) out[y * 3 + (x >> 3)] |= 0x80 >> (x & 7);
    }
    return out;
  }
  // Convierte una imagen cualquiera (HTMLImageElement o canvas) a un icono de 24 x 24 en 1 bit (con difusion simple por umbral)
  function deImagen(img, opciones) {
    const o = Object.assign({ umbral: 128, invertir: false }, opciones);
    const cv = lienzo(), c = cv.getContext('2d', { willReadFrequently: true });
    c.clearRect(0, 0, L, L);
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const s = Math.min(L / w, L / h);
    c.drawImage(img, (L - w * s) / 2, (L - h * s) / 2, w * s, h * s);
    const data = c.getImageData(0, 0, L, L);
    let hayAlfa = false; for (let i = 3; i < data.data.length; i += 4) if (data.data[i] < 250) { hayAlfa = true; break; }
    return hayAlfa ? aBits(data, 'alfa', 128, false) : aBits(data, 'lum', o.umbral, o.invertir);
  }
  function aHex(b) { return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); }
  function deHex(s) { if (!s || s.length !== 144) return null; const o = new Uint8Array(72); for (let i = 0; i < 72; i++) o[i] = parseInt(s.substr(i * 2, 2), 16); return o; }
  // Pinta los bits en un canvas (para las vistas previas)
  function pintar(ctx, bits, x, y, escala, color) {
    ctx.fillStyle = color;
    for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) if (bits[j * 3 + (i >> 3)] & (0x80 >> (i & 7))) ctx.fillRect(x + i * escala, y + j * escala, escala, escala);
  }

  // ---- busqueda y sugerencias ----
  // buscar(texto, cat): todas las palabras tienen que aparecer (en nombre, id o palabras clave, en espanol o ingles). cat = '' (todas) o un id de categoria.
  function buscar(texto, cat) {
    const q = norm(texto).split(/\s+/).filter(Boolean);
    return lista.filter(e => (!cat || e.cat === cat) && q.every(t => e._q.includes(t)));
  }
  // sugerir(texto, n): iconos que mejor encajan con un nombre de tecla o de sonido ("Dirt Walk 3", "Trueno fuerte", "Torch Loop").
  function sugerir(texto, n) {
    const toks = norm(texto).split(/[^a-z0-9]+/).filter(t => t.length >= 3 && !/^\d+$/.test(t));
    if (!toks.length) return [];
    const sing = (t) => t.length > 4 ? t.replace(/(es|s)$/, '') : t;
    const res = [];
    lista.forEach(e => {
      let p = 0;
      toks.forEach(t => {
        const t1 = sing(t);
        if (e._pal.has(t) || e._pal.has(t1)) p += 3;
        else if (t.length >= 4) { for (const w of e._pal) { if (w.length >= 4 && (w.startsWith(t1) || t1.startsWith(w))) { p += 1; break; } } }
      });
      if (p > 0) res.push([p, e]);
    });
    res.sort((a, b) => b[0] - a[0] || a[1].nombre.length - b[1].nombre.length);
    return res.slice(0, n || 8).map(r => r[1]);
  }
  // Un icono guardado con la biblioteca VIEJA (dibujos a mano) -> el equivalente nuevo (o null si no es uno de esos).
  function renovar(hex) { const id = migra[hex]; return id && porId[id] ? porId[id].hex : null; }
  function entradaDeHex(hex) { return porHex[hex] || null; }
  // Compatibilidad: devuelve los bytes (72) del icono por id, o null
  function deBiblioteca(id) { const e = porId[id]; return e ? deHex(e.hex) : null; }
  function hexDe(id) { const e = porId[id]; return e ? e.hex : ''; }
  MD.Iconos = { lista, categorias, porId, hexDe, deBiblioteca, deImagen, aHex, deHex, pintar, aBits, L, buscar, sugerir, renovar, entradaDeHex, norm, creditos: D.creditos };
})(window.MD);
