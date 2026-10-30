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

  const GLIFO = { una_vez: 0, loop: 1, azar: 2, mantener: 3, secuencia: 4, silenciar: 5, fadeout: 6, intro_loop: 7, ambiente: 1, musica: 1, musica_sig: 0, musica_pausa: 5, luz_toggle: 1 };

  const enc = {
    hola: () => u8([0x57, 1]),
    leds: (modos) => u8([0x6c].concat(Array.from({ length: 10 }, (_, i) => (modos[i] | 0) & 7))),
    oled: (fila, texto) => u8([0x6f, fila].concat(bytesTexto(texto, 10))),
    teclaA: (i, cat, glifo, flags) => u8([0x61, i, cat, glifo, flags & 255]),   // flags: bit0 = tiene icono, bit1 = ducking (v1.3; 'cat' ya no se usa)
    teclaB: (i, nombre) => u8([0x62, i].concat(bytesTexto(nombre, 18))),
    teclaI: (i, desde, datos) => u8([0x69, i, desde].concat(Array.from(datos))),
    mapaFin: (firma) => u8([0x6d, firma & 255, (firma >>> 8) & 255, (firma >>> 16) & 255, (firma >>> 24) & 255]),
    escena: (i, total, nombre) => u8([0x73, i, total].concat(bytesTexto(nombre, 16))),
    escenaActual: (i) => u8([0x63, i]),
    // v1.3-dev14: estado del celu para la OLED. bat 0..100 (255 = no se sabe); flags: 1 cargando, 2 suena algo, 4 hay sesion de medios, 8 acceso a medios; vol 0..100 (255 = no se sabe)
    celu: (bat, flags, vol) => u8([0x7a, bat & 255, flags & 255, vol & 255]),
    tituloParte: (i, texto) => u8([0x79, i].concat(bytesTexto(texto, 18))),
    // 2.0-dev12: avisa si hay un Initiative Tracker (real o simulado). 1 = C2/D2/E2 pasan a ser sus botones (izquierda, centro, derecha); 0 = vuelven a ser teclas
    tracker: (presente) => u8([0x74, presente ? 1 : 0]),
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
      case 0x51: return { t: 'volCelu', v: Math.min(100, f[1] | 0) };         // v1.3-dev14: la perilla (en modo CEL) pide ese volumen de Android
      case 0x54: return { t: 'trkBoton', b: f[1] | 0, abajo: !!f[2] };         // 2.0-dev12: boton del Tracker apretado/soltado (0 izquierda, 1 centro, 2 derecha)
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
    if (!t) return { cat: 0, glifo: 0, nombre: '', icono: null, ducking: false };
    return {
      cat: 0,                                              // (la categoria se elimino en la app 1.3)
      glifo: GLIFO[t.tipo] || 0,
      nombre: t.nombre || '',
      icono: t.icono && t.icono.length === 72 ? t.icono : null,
      ducking: !!t.ducking && t.tipo !== 'silenciar' && t.tipo !== 'fadeout',
    };
  }
  const banderas = d => (d.icono ? 1 : 0) | (d.ducking ? 2 : 0);
  function firmaMapa(teclas) {
    const b = [];
    for (let i = 0; i < 10; i++) {
      const d = datosTecla(teclas[i]);
      b.push(i, d.cat, d.glifo, banderas(d));
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
      out.push(enc.teclaA(i, d.cat, d.glifo, banderas(d)));
      out.push(enc.teclaB(i, d.nombre));
      if (d.icono) for (let off = 0; off < 72; off += 16) out.push(enc.teclaI(i, off, d.icono.slice(off, Math.min(72, off + 16))));
    }
    out.push(enc.mapaFin(firmaMapa(teclas)));
    return out;
  }
  // El titulo de lo que suena viaja en hasta 3 partes de 18 letras (la parte 0 borra el titulo anterior en el Macrodeck)
  function tramasTitulo(texto) {
    const t = ascii(texto).slice(0, 54), out = [enc.tituloParte(0, t.slice(0, 18))];
    for (let i = 1; i < 3 && t.length > i * 18; i++) out.push(enc.tituloParte(i, t.slice(i * 18, i * 18 + 18)));
    return out;
  }
  function tramasEscenas(nombres, actual) {
    const out = nombres.slice(0, 10).map((n, i) => enc.escena(i, Math.min(10, nombres.length), n));
    out.push(enc.escenaActual(actual | 0));
    return out;
  }

  MD.P = { SERVICIO, RX, TX, ascii, enc, dec, firmaMapa, tramasMapa, tramasEscenas, tramasTitulo, GLIFO, datosTecla };
})(window.MD);
