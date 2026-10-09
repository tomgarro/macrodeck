// protocolo.js - El "idioma" entre la app y el Macrodeck (igual que dnd_protocolo.h en el ESP32).
// Todas las tramas miden 20 bytes o menos. Ver dnd_protocolo.h para la explicacion.
window.MD = window.MD || {};
(function (MD) {
  const SERVICIO = '6d616372-6f64-6563-6b00-000000000001';
  const RX = '6d616372-6f64-6563-6b00-000000000002';   // la app escribe aca
  const TX = '6d616372-6f64-6563-6b00-000000000003';   // el Macrodeck avisa aca (notify)

  // Solo letras ASCII visibles (el Macrodeck no tiene tildes ni enie en sus fuentes)
  function ascii(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?');
  }
  function bytesTexto(s, max) {
    const t = ascii(s).slice(0, max);
    return Array.from(t).map(c => c.charCodeAt(0));
  }
  const u8 = a => Uint8Array.from(a);

  const GLIFO = { una_vez: 0, loop: 1, azar: 2, mantener: 3, secuencia: 4, silenciar: 5, fadeout: 6, dado: 7 };
  const CAT = { ambiente: 0, combate: 1, efecto: 2, accion: 3 };

  const enc = {
    hola: () => u8([0x57, 1]),
    leds: (modos) => u8([0x6c].concat(Array.from({ length: 10 }, (_, i) => (modos[i] | 0) & 7))),
    oled: (fila, texto) => u8([0x6f, fila].concat(bytesTexto(texto, 10))),
    teclaA: (i, cat, glifo, hayIcono) => u8([0x61, i, cat, glifo, hayIcono ? 1 : 0]),
    teclaB: (i, nombre) => u8([0x62, i].concat(bytesTexto(nombre, 18))),
    teclaI: (i, desde, datos) => u8([0x69, i, desde].concat(Array.from(datos))),
    mapaFin: (firma) => u8([0x6d, firma & 255, (firma >>> 8) & 255, (firma >>> 16) & 255, (firma >>> 24) & 255]),
    escena: (i, total, nombre) => u8([0x73, i, total].concat(bytesTexto(nombre, 16))),
    escenaActual: (i) => u8([0x63, i]),
    dado: (valor, caras) => u8([0x64, valor, caras]),
  };

  // Del Macrodeck a la app
  function dec(f) {
    if (!f || !f.length) return null;
    switch (f[0]) {
      case 0x4b: return { t: 'tecla', i: f[1], abajo: !!f[2] };
      case 0x50: return { t: 'perilla', v: f[1] };
      case 0x53: return { t: 'escena', i: f[1] };
      case 0x48: return { t: 'home' };
      case 0x57: return { t: 'hola', ver: f[1] };
      case 0x52: return { t: 'reenviar' };
    }
    return null;
  }

  // FNV-1a de 32 bits (la firma del mapa: si no cambia, el Macrodeck no redibuja la e-Paper)
  function fnv(bytes) {
    let h = 0x811c9dc5;
    for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }

  // 'teclas': arreglo de 10 objetos {nombre, cat, tipo, icono (Uint8Array 72 o null)} o null (tecla vacia)
  function datosTecla(t) {
    if (!t) return { cat: 3, glifo: 0, nombre: '', icono: null };
    return {
      cat: CAT[t.categoria] != null ? CAT[t.categoria] : 3,
      glifo: GLIFO[t.tipo] || 0,
      nombre: t.nombre || '',
      icono: t.icono && t.icono.length === 72 ? t.icono : null,
    };
  }
  function firmaMapa(teclas) {
    const b = [];
    for (let i = 0; i < 10; i++) {
      const d = datosTecla(teclas[i]);
      b.push(i, d.cat, d.glifo, d.icono ? 1 : 0);
      bytesTexto(d.nombre, 18).forEach(x => b.push(x)); b.push(0);
      if (d.icono) d.icono.forEach(x => b.push(x));
    }
    return fnv(b);
  }
  // Todas las tramas para dibujar un mapa (las 10 teclas) + el fin. 'previo' (opcional): las teclas ya enviadas, para saltear las iguales.
  function tramasMapa(teclas) {
    const out = [];
    for (let i = 0; i < 10; i++) {
      const d = datosTecla(teclas[i]);
      out.push(enc.teclaA(i, d.cat, d.glifo, !!d.icono));
      out.push(enc.teclaB(i, d.nombre));
      if (d.icono) for (let off = 0; off < 72; off += 16) out.push(enc.teclaI(i, off, d.icono.slice(off, Math.min(72, off + 16))));
    }
    out.push(enc.mapaFin(firmaMapa(teclas)));
    return out;
  }
  function tramasEscenas(nombres, actual) {
    const out = nombres.slice(0, 10).map((n, i) => enc.escena(i, Math.min(10, nombres.length), n));
    out.push(enc.escenaActual(actual | 0));
    return out;
  }

  MD.P = { SERVICIO, RX, TX, ascii, enc, dec, firmaMapa, tramasMapa, tramasEscenas, GLIFO, CAT, datosTecla };
})(window.MD);
