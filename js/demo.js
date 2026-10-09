// demo.js - Un pack de prueba con sonidos sintetizados (se fabrican en el momento, no hay archivos).
// Sirve para probar la app y el Macrodeck sin haber cargado todavia sonidos reales.
window.MD = window.MD || {};
(function (MD) {
  const SR = 22050;
  let semilla = 12345;
  const rnd = () => { semilla = (semilla * 1664525 + 1013904223) >>> 0; return semilla / 4294967296; };
  const ruido = () => rnd() * 2 - 1;
  function buf(seg) { return new Float32Array(Math.round(seg * SR)); }
  function aWav(f32) {
    const n = f32.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
    const s = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, f32[i])) * 32000, true);
    return new Blob([b], { type: 'audio/wav' });
  }
  function norm(x, pico) { let m = 0; for (const a of x) m = Math.max(m, Math.abs(a)); const k = m ? pico / m : 1; for (let i = 0; i < x.length; i++) x[i] *= k; return x; }
  function lp(x, a) { let y = 0; for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y; } return x; }       // pasa-bajos simple (a: 0..1)
  function hp(x, a) { let y = 0; for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] -= y; } return x; }
  const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t / d);

  const GEN = {
    lluvia() { const x = buf(6); for (let i = 0; i < x.length; i++) x[i] = ruido(); hp(lp(x, 0.55), 0.02); return norm(x, 0.5); },
    viento() { const x = buf(6); for (let i = 0; i < x.length; i++) x[i] = ruido(); lp(x, 0.06); lp(x, 0.2); for (let i = 0; i < x.length; i++) x[i] *= 0.55 + 0.45 * Math.sin(2 * Math.PI * i / SR / 3); return norm(x, 0.55); },
    fuego() { const x = buf(6); for (let i = 0; i < x.length; i++) x[i] = ruido() * 0.3; lp(x, 0.03); for (let i = 0; i < x.length; i++) x[i] *= 0.8; for (let k = 0; k < 70; k++) { const p = Math.floor(rnd() * (x.length - 400)), a = 0.3 + rnd() * 0.7; for (let j = 0; j < 300; j++) x[p + j] += ruido() * a * Math.exp(-j / (20 + rnd() * 30)) * 0.6; } return norm(x, 0.55); },
    taberna() {
      const x = buf(8), notas = [262, 330, 392, 330, 294, 349, 440, 349, 262, 330, 392, 523, 392, 330, 294, 196];
      notas.forEach((f, k) => { const t0 = k * 0.5; for (let j = 0; j < SR * 0.9; j++) { const i = Math.round(t0 * SR) + j; if (i >= x.length) break; const t = j / SR; x[i] += (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t) + 0.15 * Math.sin(6 * Math.PI * f * t)) * Math.exp(-t / 0.35) * 0.35; } });
      for (let k = 0; k < 4; k++) for (let j = 0; j < SR * 2; j++) { const i = k * 2 * SR + j, t = j / SR; x[i % x.length] += Math.sin(2 * Math.PI * (k % 2 ? 98 : 131) * t) * 0.18 * Math.min(1, t * 8) * Math.min(1, (2 - t) * 4); }
      return norm(x, 0.6);
    },
    tension() { const x = buf(8); for (let i = 0; i < x.length; i++) { const t = i / SR, lfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * t / 4); x[i] = (Math.sin(2 * Math.PI * 55 * t) + 0.6 * Math.sin(2 * Math.PI * 55.7 * t) + 0.3 * Math.sin(2 * Math.PI * 82.4 * t)) * lfo + 0.05 * ruido(); } return norm(lp(x, 0.3), 0.6); },
    espada() { const x = buf(0.7); const ps = [1900, 2870, 4310, 5900]; for (let i = 0; i < x.length; i++) { const t = i / SR; let s = 0; ps.forEach((f, k) => { s += Math.sin(2 * Math.PI * f * t) * Math.exp(-t / (0.22 - k * 0.03)); }); x[i] = s * 0.25 + ruido() * Math.exp(-t / 0.02) * 0.6; } return norm(x, 0.7); },
    golpe() { const x = buf(0.45); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; ph += 2 * Math.PI * (45 + 110 * Math.exp(-t / 0.05)) / SR; x[i] = Math.sin(ph) * Math.exp(-t / 0.14) + ruido() * Math.exp(-t / 0.03) * 0.5; } return norm(lp(x, 0.5), 0.85); },
    hechizo() { const x = buf(1.4); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; ph += 2 * Math.PI * (300 + 1400 * t * t) / SR; x[i] = (Math.sin(ph) + 0.5 * Math.sin(ph * 1.5 + Math.sin(t * 40))) * env(t, 0.1, 0.7) + ruido() * 0.05 * t; } return norm(x, 0.6); },
    puerta() { const x = buf(0.8); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; ph += 2 * Math.PI * (190 - 70 * t + 18 * Math.sin(t * 38)) / SR; const saw = (ph / (2 * Math.PI)) % 1; x[i] = (saw * 2 - 1) * Math.min(1, t * 20) * Math.min(1, (0.8 - t) * 6) * 0.6; } return norm(lp(x, 0.2), 0.55); },
    campana() { const x = buf(3.2); const ps = [[392, 1], [784, 0.6], [1058, 0.4], [1572, 0.3], [2093, 0.15]]; for (let i = 0; i < x.length; i++) { const t = i / SR; let s = 0; ps.forEach(([f, a], k) => { s += a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / (1.2 - k * 0.15)); }); x[i] = s; } return norm(x, 0.55); },
    paso(f) { return () => { const x = buf(0.22); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = (ruido() * 0.7 + Math.sin(2 * Math.PI * f * t)) * Math.exp(-t / 0.035); } return norm(lp(x, 0.25), 0.6); }; },
    rugido() { const x = buf(1.6); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; ph += 2 * Math.PI * (70 + 30 * Math.sin(t * 5) - 15 * t) / SR; const saw = ((ph / (2 * Math.PI)) % 1) * 2 - 1; x[i] = (saw + ruido() * 0.5) * env(t, 0.12, 0.9); } return norm(lp(x, 0.18), 0.75); },
    dado() { const x = buf(0.6); for (let k = 0; k < 9; k++) { const p = Math.floor((k * k * 0.006 + 0.01) * SR); for (let j = 0; j < 500 && p + j < x.length; j++) x[p + j] += ruido() * Math.exp(-j / 70) * (0.9 - k * 0.07); } return norm(hp(x, 0.05), 0.6); },
    critico() { const x = buf(1.2); [523, 659, 784, 1047].forEach((f, k) => { for (let j = 0; j < SR * 0.9; j++) { const i = Math.round(k * 0.1 * SR) + j; if (i >= x.length) break; const t = j / SR; x[i] += Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.4) * 0.3; } }); return norm(x, 0.6); },
    pifia() { const x = buf(1); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; ph += 2 * Math.PI * (330 * Math.exp(-t * 1.6)) / SR; x[i] = Math.sin(ph) * env(t, 0.02, 0.5); } return norm(x, 0.6); },
  };
  const LISTA = [
    ['lluvia', 'Lluvia (loop)'], ['viento', 'Viento (loop)'], ['fuego', 'Fogata (loop)'], ['taberna', 'Musica de taberna (loop)'], ['tension', 'Tension (loop)'],
    ['espada', 'Choque de espadas'], ['golpe', 'Golpe'], ['hechizo', 'Hechizo'], ['puerta', 'Puerta que cruje'], ['campana', 'Campana'],
    ['paso1', 'Paso 1'], ['paso2', 'Paso 2'], ['paso3', 'Paso 3'], ['rugido', 'Rugido'], ['dado', 'Dado rodando'], ['critico', 'Critico!'], ['pifia', 'Pifia'],
  ];
  function crear() {
    semilla = 12345;
    const sonidos = [], meta = [], id = {};
    for (const [k, nombre] of LISTA) {
      const f = k === 'paso1' ? GEN.paso(120)() : k === 'paso2' ? GEN.paso(150)() : k === 'paso3' ? GEN.paso(95)() : GEN[k]();
      const sid = 'demo_' + k; id[k] = sid;
      sonidos.push({ id: sid, blob: aWav(f), nombre: sid + '.wav', tipo: 'audio/wav' });
      meta.push({ id: sid, nombre, volumen: 1, duracion: Math.round(f.length / SR * 10) / 10, archivoOriginal: sid + '.wav' });
    }
    const ic = n => MD.Iconos.aHex(MD.Iconos.deBiblioteca(n));
    const T = (o) => MD.Config.teclaNueva(o);
    const taberna = MD.Config.escenaNueva('Taberna');
    taberna.id = 'demo_e1';
    taberna.teclas = [
      T({ nombre: 'Musica', categoria: 'ambiente', tipo: 'loop', sonidos: [id.taberna], grupo: 'amb', entrada: 1.5, salida: 2, icono: ic('nota'), volumen: 0.8 }),
      T({ nombre: 'Fogata', categoria: 'ambiente', tipo: 'loop', sonidos: [id.fuego], entrada: 1, salida: 1.5, icono: ic('fuego'), volumen: 0.6 }),
      T({ nombre: 'Lluvia fuera', categoria: 'ambiente', tipo: 'loop', sonidos: [id.lluvia], entrada: 2, salida: 2, icono: ic('lluvia'), volumen: 0.4 }),
      T({ nombre: 'Puerta', categoria: 'efecto', tipo: 'una_vez', sonidos: [id.puerta], icono: ic('puerta') }),
      T({ nombre: 'Campana', categoria: 'efecto', tipo: 'una_vez', sonidos: [id.campana], icono: ic('campana'), retoque: 'superponer' }),
      T({ nombre: 'Pasos', categoria: 'efecto', tipo: 'azar', sonidos: [id.paso1, id.paso2, id.paso3], icono: ic('huella') }),
      T({ nombre: 'Dado d20', categoria: 'accion', tipo: 'dado', dado: 20, sonidos: [id.dado], dadoCritico: id.critico, dadoPifia: id.pifia, icono: ic('dado20') }),
      T({ nombre: 'Rugido', categoria: 'combate', tipo: 'una_vez', sonidos: [id.rugido], icono: ic('dragon') }),
      T({ nombre: 'Fade out', categoria: 'accion', tipo: 'fadeout', salida: 3, icono: ic('fadeout') }),
      T({ nombre: 'Silencio', categoria: 'accion', tipo: 'silenciar', icono: ic('silencio') }),
    ];
    const combate = MD.Config.escenaNueva('Combate');
    combate.id = 'demo_e2';
    combate.teclas = [
      T({ nombre: 'Tension', categoria: 'combate', tipo: 'loop', sonidos: [id.tension], grupo: 'amb', entrada: 1.5, salida: 2, icono: ic('calavera') }),
      T({ nombre: 'Viento', categoria: 'ambiente', tipo: 'loop', sonidos: [id.viento], entrada: 2, salida: 2, icono: ic('viento'), volumen: 0.6 }),
      T({ nombre: 'Espadazo', categoria: 'combate', tipo: 'una_vez', sonidos: [id.espada], icono: ic('espada'), retoque: 'superponer' }),
      T({ nombre: 'Golpe', categoria: 'combate', tipo: 'una_vez', sonidos: [id.golpe], icono: ic('martillo') }),
      T({ nombre: 'Hechizo', categoria: 'combate', tipo: 'mantener', sonidos: [id.hechizo], salida: 0.5, icono: ic('magia') }),
      T({ nombre: 'Rugido', categoria: 'combate', tipo: 'una_vez', sonidos: [id.rugido], icono: ic('dragon') }),
      T({ nombre: 'Dado d20', categoria: 'accion', tipo: 'dado', dado: 20, sonidos: [id.dado], dadoCritico: id.critico, dadoPifia: id.pifia, icono: ic('dado20') }),
      T({ nombre: 'Pasos', categoria: 'efecto', tipo: 'secuencia', sonidos: [id.paso1, id.paso2, id.paso3], icono: ic('huella') }),
      T({ nombre: 'Fade out', categoria: 'accion', tipo: 'fadeout', salida: 3, icono: ic('fadeout') }),
      T({ nombre: 'Silencio', categoria: 'accion', tipo: 'silenciar', icono: ic('silencio') }),
    ];
    const config = MD.Config.normalizar({ version: 1, nombre: 'Pack de prueba', escenas: [taberna, combate], sonidos: meta, ajustes: { volMax: 0.9 } });
    return { config, sonidos };
  }
  MD.Demo = { crear };
})(window.MD);
