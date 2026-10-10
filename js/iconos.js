// iconos.js - Biblioteca de iconos de 24 x 24 puntos (1 color) para el mapa de la e-Paper + conversor de imagenes.
// Cada icono es una funcion que dibuja con trazos simples en un canvas de 24 x 24; despues se pasa a 1 bit.
// Son dibujos propios (no hay iconos de terceros ni logos de marcas).
window.MD = window.MD || {};
(function (MD) {
  const L = 24;
  const lib = {};
  function def(id, nombre, f) { lib[id] = { id, nombre, f }; }

  function linea(c, pts, w) { c.lineWidth = w || 2.2; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); }
  function poli(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); }
  function circ(c, x, y, r, lleno, w) { c.lineWidth = w || 2; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); lleno ? c.fill() : c.stroke(); }

  def('espada', 'Espada', c => { linea(c, [5, 19, 19, 5], 2.6); linea(c, [6, 12, 12, 18], 2.4); linea(c, [3.5, 20.5, 6.5, 17.5], 3); poli(c, [19, 5, 21, 3, 21, 7]); });
  def('espadas', 'Combate', c => { linea(c, [4, 20, 20, 4], 2.4); linea(c, [20, 20, 4, 4], 2.4); linea(c, [3, 14, 10, 21], 1.8); linea(c, [21, 14, 14, 21], 1.8); });
  def('escudo', 'Escudo', c => { poli(c, [4, 3, 20, 3, 20, 12, 12, 22, 4, 12]); c.globalCompositeOperation = 'destination-out'; linea(c, [12, 7, 12, 17], 2); linea(c, [8, 10, 16, 10], 2); c.globalCompositeOperation = 'source-over'; });
  def('calavera', 'Calavera', c => { circ(c, 12, 10, 8, true); c.fillRect(8, 15, 8, 7); c.globalCompositeOperation = 'destination-out'; circ(c, 8.5, 10, 2.2, true); circ(c, 15.5, 10, 2.2, true); poli(c, [12, 13, 10.6, 16, 13.4, 16]); c.fillRect(10, 18, 1.2, 4); c.fillRect(12.8, 18, 1.2, 4); c.globalCompositeOperation = 'source-over'; });
  def('fuego', 'Fuego', c => { c.beginPath(); c.moveTo(12, 2); c.bezierCurveTo(14, 7, 20, 9, 19, 16); c.bezierCurveTo(18.5, 20.5, 15, 22.5, 12, 22.5); c.bezierCurveTo(8, 22.5, 5, 19.5, 5, 15.5); c.bezierCurveTo(5, 12, 7, 11, 8, 8); c.bezierCurveTo(9.5, 10, 10, 11, 10.5, 12); c.bezierCurveTo(11.5, 8, 11, 5, 12, 2); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.moveTo(12, 21); c.bezierCurveTo(9, 21, 8.5, 18, 10, 16); c.bezierCurveTo(11, 17, 12, 17, 12.5, 15); c.bezierCurveTo(15, 17, 15.5, 21, 12, 21); c.fill(); c.globalCompositeOperation = 'source-over'; });
  def('lluvia', 'Lluvia', c => { c.beginPath(); c.arc(8, 10, 4.5, Math.PI * 0.5, Math.PI * 1.5); c.arc(13, 7.5, 5, Math.PI * 1.1, Math.PI * 1.95); c.arc(17.5, 11, 3.5, Math.PI * 1.5, Math.PI * 0.5); c.closePath(); c.fill(); [[7, 16, 5, 21], [12, 16, 10, 21], [17, 16, 15, 21]].forEach(p => linea(c, [p[0], p[1], p[2], p[3]], 1.8)); });
  def('trueno', 'Rayo', c => { poli(c, [14, 1, 5, 13.5, 11, 13.5, 8.5, 23, 19, 9.5, 12.5, 9.5, 16, 1]); });
  def('viento', 'Viento', c => { [[3, 8, 15, 8], [3, 13, 19, 13], [3, 18, 12, 18]].forEach(p => linea(c, p, 2)); c.lineWidth = 2; c.beginPath(); c.arc(15, 6, 2.6, Math.PI * 0.7, Math.PI * 2.1); c.stroke(); c.beginPath(); c.arc(19.5, 15.5, 2.6, Math.PI * 1.4, Math.PI * 3.1); c.stroke(); });
  def('puerta', 'Puerta', c => { c.fillRect(5, 2, 14, 20); c.globalCompositeOperation = 'destination-out'; c.fillRect(8, 5, 8, 6); c.fillRect(8, 13, 8, 6); circ(c, 14.5, 12, 0.9, true); c.globalCompositeOperation = 'source-over'; });
  def('antorcha', 'Antorcha', c => { linea(c, [8, 22, 14, 11], 3); c.beginPath(); c.moveTo(14, 2); c.bezierCurveTo(18, 6, 19, 8, 17, 11); c.bezierCurveTo(15.5, 13, 11.5, 12, 11, 9); c.bezierCurveTo(10.5, 7, 13, 5.5, 14, 2); c.fill(); });
  def('pocion', 'Pocion', c => { c.fillRect(10, 2, 4, 5); c.beginPath(); c.moveTo(10, 7); c.lineTo(5, 18); c.quadraticCurveTo(4, 22, 8, 22); c.lineTo(16, 22); c.quadraticCurveTo(20, 22, 19, 18); c.lineTo(14, 7); c.closePath(); c.fill(); c.globalCompositeOperation = 'destination-out'; c.fillRect(7, 15, 10, 1.6); circ(c, 11, 18.5, 1, true); c.globalCompositeOperation = 'source-over'; });
  def('moneda', 'Moneda', c => { circ(c, 12, 12, 9.5, true); c.globalCompositeOperation = 'destination-out'; circ(c, 12, 12, 6.5, false, 1.6); linea(c, [12, 8, 12, 16], 2); c.globalCompositeOperation = 'source-over'; });
  def('llave', 'Llave', c => { circ(c, 7, 8, 5, false, 3); linea(c, [10.5, 11.5, 21, 22], 2.8); linea(c, [17, 18, 20, 15], 2.4); linea(c, [14, 15, 16.5, 12.5], 2.4); });
  def('jarra', 'Taberna', c => { c.fillRect(4, 6, 12, 16); c.lineWidth = 3; c.beginPath(); c.arc(17, 13, 4, -Math.PI / 2, Math.PI / 2); c.stroke(); c.globalCompositeOperation = 'destination-out'; c.fillRect(6.5, 10, 2, 9); c.fillRect(11, 10, 2, 9); c.globalCompositeOperation = 'source-over'; circ(c, 6, 5, 2.8, true); circ(c, 10, 4, 3.2, true); circ(c, 14, 5, 2.8, true); });
  def('nota', 'Musica', c => { circ(c, 7.5, 18, 3.8, true); circ(c, 17, 16, 3.8, true); linea(c, [11.3, 18, 11.3, 4], 2.2); linea(c, [20.8, 16, 20.8, 2.5], 2.2); poli(c, [11.3, 4, 20.8, 2, 20.8, 6.5, 11.3, 8.5]); });
  def('campana', 'Campana', c => { c.beginPath(); c.moveTo(12, 3); c.bezierCurveTo(6, 4, 6, 10, 5, 15); c.lineTo(3.5, 18); c.lineTo(20.5, 18); c.lineTo(19, 15); c.bezierCurveTo(18, 10, 18, 4, 12, 3); c.fill(); circ(c, 12, 20.5, 2, true); });
  def('huella', 'Huella', c => { circ(c, 12, 16, 4.6, true); circ(c, 5.5, 10, 2.3, true); circ(c, 9.5, 5.5, 2.3, true); circ(c, 14.5, 5.5, 2.3, true); circ(c, 18.5, 10, 2.3, true); });
  def('corazon', 'Corazon', c => { c.beginPath(); c.moveTo(12, 21); c.bezierCurveTo(2, 14, 2, 6, 7.5, 5); c.bezierCurveTo(10, 4.6, 11.5, 6, 12, 8); c.bezierCurveTo(12.5, 6, 14, 4.6, 16.5, 5); c.bezierCurveTo(22, 6, 22, 14, 12, 21); c.fill(); });
  def('cuerno', 'Cuerno', c => { c.beginPath(); c.moveTo(3, 8); c.bezierCurveTo(10, 8, 18, 10, 21, 20); c.bezierCurveTo(14, 20, 6, 16, 3, 8); c.fill(); linea(c, [2, 6, 5, 9], 2); });
  def('pergamino', 'Pergamino', c => { c.fillRect(5, 4, 14, 16); circ(c, 5, 4, 2.4, true); circ(c, 19, 20, 2.4, true); c.globalCompositeOperation = 'destination-out'; [8, 11.5, 15].forEach(y => c.fillRect(8, y, 8, 1.4)); c.globalCompositeOperation = 'source-over'; });
  def('dado20', 'Dado d20', c => { c.lineWidth = 2; c.lineJoin = 'round'; c.beginPath(); [[12,1.5],[21.5,7],[21.5,17],[12,22.5],[2.5,17],[2.5,7]].forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1])); c.closePath(); c.stroke(); poli(c, [12, 7.5, 17.2, 15.5, 6.8, 15.5]); });
  def('ojo', 'Ojo', c => { c.beginPath(); c.moveTo(1.5, 12); c.quadraticCurveTo(12, 1, 22.5, 12); c.quadraticCurveTo(12, 23, 1.5, 12); c.fill(); c.globalCompositeOperation = 'destination-out'; circ(c, 12, 12, 4.5, true); c.globalCompositeOperation = 'source-over'; circ(c, 12, 12, 2.2, true); });
  def('fantasma', 'Fantasma', c => { c.beginPath(); c.moveTo(4, 22); c.lineTo(4, 11); c.arc(12, 11, 8, Math.PI, 0); c.lineTo(20, 22); c.lineTo(17, 19); c.lineTo(14.5, 22); c.lineTo(12, 19); c.lineTo(9.5, 22); c.lineTo(7, 19); c.closePath(); c.fill(); c.globalCompositeOperation = 'destination-out'; circ(c, 9, 10.5, 1.8, true); circ(c, 15, 10.5, 1.8, true); c.globalCompositeOperation = 'source-over'; });
  def('arco', 'Arco', c => { c.lineWidth = 2.4; c.beginPath(); c.arc(3, 12, 14, -Math.PI * 0.42, Math.PI * 0.42); c.stroke(); linea(c, [15.5, 4.5, 15.5, 19.5], 1); linea(c, [5, 12, 21, 12], 1.8); poli(c, [22, 12, 17.5, 9.5, 17.5, 14.5]); });
  def('hacha', 'Hacha', c => { linea(c, [6, 21, 17, 6], 2.6); c.beginPath(); c.moveTo(12, 4); c.bezierCurveTo(18, 1, 23, 5, 21, 11); c.lineTo(15, 9); c.closePath(); c.fill(); });
  def('martillo', 'Martillo', c => { linea(c, [5, 21, 15, 9], 2.8); c.save(); c.translate(15, 8); c.rotate(-0.9); c.fillRect(-4, -4, 12, 8); c.restore(); });
  def('estrella', 'Estrella', c => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.8 : 10.5; p.push(12 + r * Math.cos(a), 12.5 + r * Math.sin(a)); } poli(c, p); });
  def('luna', 'Luna', c => { c.beginPath(); c.arc(12, 12, 9.5, 0.7, Math.PI * 2 - 0.7); c.arc(15.5, 9.5, 8, Math.PI * 2 - 1.2, 1.2, true); c.fill(); });
  def('sol', 'Sol', c => { circ(c, 12, 12, 5, true); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; linea(c, [12 + 8 * Math.cos(a), 12 + 8 * Math.sin(a), 12 + 11 * Math.cos(a), 12 + 11 * Math.sin(a)], 2); } });
  def('castillo', 'Castillo', c => { c.fillRect(3, 9, 18, 13); [3, 8.5, 14, 19].forEach(x => c.fillRect(x - 0.5, 4, 3.2, 6)); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.moveTo(9.5, 22); c.lineTo(9.5, 16); c.arc(12, 16, 2.5, Math.PI, 0); c.lineTo(14.5, 22); c.fill(); c.globalCompositeOperation = 'source-over'; });
  def('arbol', 'Bosque', c => { poli(c, [12, 2, 19, 11, 15, 11, 20, 17, 4, 17, 9, 11, 5, 11]); c.fillRect(10.5, 17, 3, 5); });
  def('gota', 'Agua', c => { c.beginPath(); c.moveTo(12, 2); c.bezierCurveTo(14, 8, 19, 12, 19, 16); c.bezierCurveTo(19, 20, 16, 22, 12, 22); c.bezierCurveTo(8, 22, 5, 20, 5, 16); c.bezierCurveTo(5, 12, 10, 8, 12, 2); c.fill(); });
  def('caldero', 'Caldero', c => { c.beginPath(); c.moveTo(3, 9); c.lineTo(21, 9); c.bezierCurveTo(21, 17, 18, 21, 12, 21); c.bezierCurveTo(6, 21, 3, 17, 3, 9); c.fill(); c.fillRect(2, 8, 20, 2.2); linea(c, [6, 22, 5, 23.5], 2); linea(c, [18, 22, 19, 23.5], 2); circ(c, 9, 4.5, 1.8, false, 1.4); circ(c, 14.5, 3.5, 1.4, false, 1.4); });
  def('magia', 'Hechizo', c => { const p = []; for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + i * Math.PI / 8, r = i % 2 ? 4 : 11; p.push(12 + r * Math.cos(a), 12 + r * Math.sin(a)); } poli(c, p); c.globalCompositeOperation = 'destination-out'; circ(c, 12, 12, 2.4, true); c.globalCompositeOperation = 'source-over'; });
  def('corona', 'Corona', c => { poli(c, [3, 19, 2.5, 7, 8, 12, 12, 4, 16, 12, 21.5, 7, 21, 19]); });
  def('hueso', 'Hueso', c => { linea(c, [7, 17, 17, 7], 3.4); circ(c, 5.2, 15.2, 2.4, true); circ(c, 8.8, 18.8, 2.4, true); circ(c, 15.2, 5.2, 2.4, true); circ(c, 18.8, 8.8, 2.4, true); });
  def('murcielago', 'Murcielago', c => { c.beginPath(); c.moveTo(12, 8); c.lineTo(14, 5); c.lineTo(15, 8); c.bezierCurveTo(18, 6, 21, 8, 23, 12); c.bezierCurveTo(20, 11, 19, 13, 17.5, 17); c.bezierCurveTo(16, 14, 14, 15, 12, 20); c.bezierCurveTo(10, 15, 8, 14, 6.5, 17); c.bezierCurveTo(5, 13, 4, 11, 1, 12); c.bezierCurveTo(3, 8, 6, 6, 9, 8); c.lineTo(10, 5); c.closePath(); c.fill(); });
  def('silencio', 'Silencio', c => { poli(c, [3, 9, 8, 9, 13, 4, 13, 20, 8, 15, 3, 15]); linea(c, [16, 8, 22, 16], 2.2); linea(c, [22, 8, 16, 16], 2.2); });
  def('fadeout', 'Fade out', c => { for (let i = 0; i < 6; i++) { c.globalAlpha = 1; c.fillRect(2 + i * 3.6, 12 - (11 - i * 1.7) / 1, 2.6, (11 - i * 1.7) * 2); } });
  def('altavoz', 'Sonido', c => { poli(c, [2, 9, 7, 9, 12, 4, 12, 20, 7, 15, 2, 15]); c.lineWidth = 2; c.beginPath(); c.arc(12, 12, 5, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(12, 12, 9, -0.9, 0.9); c.stroke(); });
  def('dragon', 'Dragon', c => { c.beginPath(); c.moveTo(2, 20); c.bezierCurveTo(6, 10, 10, 4, 22, 3); c.bezierCurveTo(19, 7, 17, 8, 16, 11); c.bezierCurveTo(19, 11, 21, 13, 22, 16); c.bezierCurveTo(17, 14, 13, 16, 10, 22); c.bezierCurveTo(10, 17, 7, 16, 2, 20); c.fill(); c.globalCompositeOperation = 'destination-out'; circ(c, 16.5, 6.5, 1, true); c.globalCompositeOperation = 'source-over'; });


  // ---------- iconos de fantasia / magia ----------
  function chispa(c, x, y, r) { poli(c, [x, y - r, x + r * 0.28, y - r * 0.28, x + r, y, x + r * 0.28, y + r * 0.28, x, y + r, x - r * 0.28, y + r * 0.28, x - r, y, x - r * 0.28, y - r * 0.28]); }
  const quitar = c => { c.globalCompositeOperation = 'destination-out'; };
  const poner = c => { c.globalCompositeOperation = 'source-over'; };
  def('bola_fuego', 'Bola de fuego', c => { poli(c, [1.5, 22.5, 8, 6.5, 14.5, 12.5]); circ(c, 15, 9, 6.5, true); quitar(c); circ(c, 15.5, 9.5, 2.4, true); poner(c); });
  def('hielo', 'Hielo', c => { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a); linea(c, [12, 12, 12 + 10.5 * ca, 12 + 10.5 * sa], 1.8); const bx = 12 + 6.2 * ca, by = 12 + 6.2 * sa; [-0.85, 0.85].forEach(d => linea(c, [bx, by, bx + 3.6 * Math.cos(a + d), by + 3.6 * Math.sin(a + d)], 1.6)); } });
  def('varita', 'Varita magica', c => { linea(c, [3.5, 21, 14.5, 10], 2.6); chispa(c, 18, 6, 5.5); chispa(c, 20.5, 14.5, 2.8); chispa(c, 8, 5.5, 3); });
  def('libro', 'Libro de hechizos', c => { c.fillRect(5, 3, 14, 18); quitar(c); c.fillRect(7.2, 3, 1.2, 18); chispa(c, 13.5, 11, 4.4); c.fillRect(9.5, 18, 8, 1.2); poner(c); });
  def('cristal', 'Cristal', c => { poli(c, [12, 2, 20, 9, 12, 22, 4, 9]); quitar(c); linea(c, [4.5, 9, 19.5, 9], 1.3); linea(c, [12, 9.5, 12, 19], 1.3); poner(c); });
  def('destellos', 'Destellos', c => { chispa(c, 9.5, 14, 8.5); chispa(c, 18.5, 6, 4.6); chispa(c, 19.5, 18.5, 3.2); });
  def('runa', 'Runa', c => { circ(c, 12, 12, 10, false, 2); linea(c, [12, 18.5, 12, 6], 2.2); linea(c, [6.8, 7.2, 12, 13.2, 17.2, 7.2], 2.2); });
  def('pentagrama', 'Invocacion', c => { circ(c, 12, 12, 10.2, false, 1.8); const P = []; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; P.push([12 + 9.4 * Math.cos(a), 12 + 9.4 * Math.sin(a)]); } [0, 2, 4, 1, 3, 0].reduce((p, q) => { linea(c, [P[p][0], P[p][1], P[q][0], P[q][1]], 1.7); return q; }); });
  def('portal', 'Portal', c => { c.lineWidth = 3; c.beginPath(); c.ellipse(12, 12, 6.5, 10.5, 0, 0, Math.PI * 2); c.stroke(); circ(c, 12, 12, 2.6, true); });
  def('curacion', 'Curacion', c => { c.fillRect(9.5, 5, 5, 16); c.fillRect(4, 10.5, 16, 5); chispa(c, 19.5, 4.5, 3.6); });
  def('escudo_magico', 'Escudo magico', c => { poli(c, [4, 3, 20, 3, 20, 12, 12, 22, 4, 12]); quitar(c); chispa(c, 12, 10.5, 5.6); poner(c); });
  def('terremoto', 'Terremoto', c => { poli(c, [1, 12, 6, 10, 9, 14, 13, 9, 17, 13, 23, 11, 23, 22.5, 1, 22.5]); quitar(c); linea(c, [12.5, 14, 10, 17, 13.5, 19, 11, 22.5], 1.5); poner(c); circ(c, 6, 4, 2, true); circ(c, 17.5, 4.8, 2.5, true); circ(c, 11.5, 6.5, 1.5, true); });
  def('ola', 'Ola', c => { c.beginPath(); c.moveTo(1, 22.5); c.lineTo(1, 15); c.bezierCurveTo(5, 5, 11, 5, 12.5, 13); c.bezierCurveTo(14.5, 8, 19.5, 8, 23, 14); c.lineTo(23, 22.5); c.closePath(); c.fill(); quitar(c); linea(c, [3, 19, 8, 17.5, 13, 19.5, 21, 18], 1.3); poner(c); });
  def('niebla', 'Niebla', c => { linea(c, [3, 6, 16, 6], 2.4); linea(c, [7, 11, 21, 11], 2.4); linea(c, [3, 16, 14, 16], 2.4); linea(c, [17, 16, 21, 16], 2.4); linea(c, [6, 21, 17, 21], 2.4); });
  def('tornado', 'Tornado', c => { linea(c, [3, 4, 21, 4], 2.4); linea(c, [5, 8.5, 19, 8.5], 2.4); linea(c, [7, 13, 17, 13], 2.4); linea(c, [9, 17.5, 15, 17.5], 2.4); linea(c, [11, 21.5, 13.5, 21.5], 2.4); });
  def('aura', 'Aura', c => { circ(c, 12, 12, 4.6, true); for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, r0 = 7.6, r1 = k % 2 ? 10 : 11.4; linea(c, [12 + r0 * Math.cos(a), 12 + r0 * Math.sin(a), 12 + r1 * Math.cos(a), 12 + r1 * Math.sin(a)], 1.8); } });
  def('telarana', 'Telarana', c => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; linea(c, [12, 12, 12 + 10.8 * Math.cos(a), 12 + 10.8 * Math.sin(a)], 1.4); } [5, 9.2].forEach(r => { const P = []; for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 4; P.push(12 + r * Math.cos(a), 12 + r * Math.sin(a)); } linea(c, P, 1.5); }); });
  def('bola_cristal', 'Bola de cristal', c => { circ(c, 12, 10, 8.2, true); poli(c, [6, 22, 8.5, 17.5, 15.5, 17.5, 18, 22]); quitar(c); c.lineWidth = 1.7; c.lineCap = 'round'; c.beginPath(); c.arc(12, 10, 5.4, Math.PI * 1.1, Math.PI * 1.5); c.stroke(); poner(c); });
  def('baculo', 'Baculo', c => { linea(c, [5.5, 22, 15, 9.5], 2.7); c.lineWidth = 2; c.beginPath(); c.arc(17, 7, 4.4, 0, Math.PI * 2); c.stroke(); circ(c, 17, 7, 1.7, true); chispa(c, 21.2, 2.6, 2.2); });
  def('tormenta', 'Tormenta', c => { circ(c, 8, 8, 4.4, true); circ(c, 13.5, 6.5, 5.2, true); circ(c, 18, 9.5, 3.8, true); c.fillRect(6, 8, 14, 5); const B = [14.5, 11, 9, 18.5, 12.5, 18.5, 10.5, 23, 17, 15, 13.5, 15, 15.5, 11]; quitar(c); c.lineWidth = 3.4; c.lineJoin = 'round'; c.beginPath(); c.moveTo(B[0], B[1]); for (let i = 2; i < B.length; i += 2) c.lineTo(B[i], B[i + 1]); c.closePath(); c.stroke(); c.fill(); poner(c); poli(c, B); });

  const DESC = {
    espada: 'Un espadazo o desenvainar. Combate cuerpo a cuerpo.', espadas: 'Choque de espadas. Una pelea en marcha o el inicio del combate.',
    escudo: 'Bloquear un golpe, defensa, parada.', calavera: 'Muerte, tension, enemigos peligrosos o musica de combate oscura.',
    fuego: 'Fogata, incendio, llamas o hechizos de fuego.', lluvia: 'Lluvia suave o clima gris. Bueno para loops de ambiente.',
    trueno: 'Rayo o trueno. Tormentas y hechizos electricos.', viento: 'Viento, ventisca, corrientes de aire.',
    puerta: 'Abrir, cerrar o golpear una puerta.', antorcha: 'Luz de una antorcha, mazmorras, cuevas.',
    pocion: 'Beber una pocion, frascos, alquimia.', moneda: 'Monedas, tesoro, compras y recompensas.',
    llave: 'Cerraduras, llaves, cofres que se abren.', jarra: 'Taberna: bullicio, brindis, jarras.',
    nota: 'Musica de fondo, un bardo, cualquier melodia.', campana: 'Campanas, alarmas, templos.',
    huella: 'Pasos, rastros, criaturas que se acercan.', corazon: 'Latidos, curacion, emociones fuertes.',
    cuerno: 'Cuerno de guerra o de aviso. Llamadas y senales.', pergamino: 'Cartas, mapas, lectura de un mensaje.',
    dado20: 'Tirada de dado. Usalo con el tipo "Dado" de la tecla.', ojo: 'Percepcion, vigilancia, alguien mirando.',
    fantasma: 'Espiritus, apariciones, lugares embrujados.', arco: 'Disparo de flecha, arqueros.',
    hacha: 'Golpe de hacha, talar, barbaros.', martillo: 'Martillazos, herreria, golpes pesados.',
    estrella: 'Efecto brillante, logros, destellos de luz.', luna: 'Noche, hombres lobo, escenas nocturnas.',
    sol: 'Dia, calor, luz sagrada.', castillo: 'Fortalezas, ciudades, ambientes de realeza.',
    arbol: 'Bosque, naturaleza, ambiente de exterior.', gota: 'Agua, goteras, cuevas humedas, arroyos.',
    caldero: 'Pociones en preparacion, brujas, cocina magica.', magia: 'Hechizo generico: un destello de energia magica.',
    corona: 'Reyes, nobles, coronaciones, poder.', hueso: 'Esqueletos, no-muertos, criptas.',
    murcielago: 'Cuevas, vampiros, noche tenebrosa.', silencio: 'Corta todo el sonido de la app (otra vez lo devuelve).',
    fadeout: 'Apaga con un fundido todos los loops y sonidos largos.', altavoz: 'Sonido general, anuncios, efectos de voz.',
    dragon: 'Rugidos, criaturas gigantes, jefes finales.',
    bola_fuego: 'Hechizo de bola de fuego: lanzamiento y explosion.', hielo: 'Hechizos de hielo, frio extremo, congelar.',
    varita: 'Lanzar un hechizo con varita, magia de aprendiz.', libro: 'Leer un libro de hechizos, grimorios, estudio arcano.',
    cristal: 'Gemas, cristales magicos, energia arcana.', destellos: 'Chispas de magia, encantamientos, polvo magico.',
    runa: 'Runas, glifos, inscripciones antiguas, magia ritual.', pentagrama: 'Invocaciones, rituales oscuros, circulos magicos.',
    portal: 'Portales, teletransporte, puertas dimensionales.', curacion: 'Hechizos de curacion, bendiciones, restaurar vida.',
    escudo_magico: 'Escudo o barrera magica, proteccion arcana.', terremoto: 'Temblores, derrumbes, hechizos de tierra.',
    ola: 'Olas, mar, hechizos de agua, inundaciones.', niebla: 'Niebla, bruma, ocultarse, escenas misteriosas.',
    tornado: 'Tornados, remolinos, hechizos de viento fuerte.', aura: 'Auras, bendiciones, poder que se acumula.',
    telarana: 'Telaranas, trampas, aranas gigantes, mazmorras.', bola_cristal: 'Adivinacion, videncia, profecias.',
    baculo: 'Baculo de mago, canalizar magia, magos poderosos.', tormenta: 'Tormenta electrica: nubes y rayos.',
  };
  Object.values(lib).forEach(e => { e.desc = DESC[e.id] || ''; });

  const lista = Object.values(lib);

  function lienzo() { const cv = document.createElement('canvas'); cv.width = L; cv.height = L; return cv; }
  // Dibuja el icono de la biblioteca y lo pasa a 1 bit (72 bytes, fila por fila, el bit mas alto = el punto de la izquierda)
  function deBiblioteca(id) {
    const e = lib[id]; if (!e) return null;
    const cv = lienzo(), c = cv.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#000'; c.strokeStyle = '#000'; e.f(c);
    return aBits(c.getImageData(0, 0, L, L), 'alfa', 128, false);
  }
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
  const cacheHex = {};
  function hexDe(id) { if (!cacheHex[id]) { const b = deBiblioteca(id); cacheHex[id] = b ? aHex(b) : ''; } return cacheHex[id]; }
  MD.Iconos = { lista, hexDe, deBiblioteca, deImagen, aHex, deHex, pintar, aBits, L };
})(window.MD);
