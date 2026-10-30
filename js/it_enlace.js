// it_enlace.js - Initiative Tracker (IT) controlado desde el Macrodeck: las teclas C2, D2 y E2.
//
// Como funciona (simple):
//   - Cuando hay un tracker conectado, la app le avisa al Macrodeck (trama 't'). Desde ese momento C2 / D2 / E2 (teclas 7, 8, 9) dejan de ser
//     teclas de sonido y pasan a ser los 3 botones del tracker: izquierda, centro y derecha. El Macrodeck NO las manda como teclas: manda la
//     trama 'T' (boton + apretado/soltado), que la app le pasa al tracker como si fuera su joystick.
//   - Combinaciones: con D2 (centro) mantenida, C1 = izquierda, E1 = derecha y D1 = izquierda + derecha juntas. Asi el tracker conserva
//     TODOS los gestos del joystick de 3 botones (insertar = centro + izquierda, deshacer = centro + derecha, reiniciar = los tres 3 s).
//     A1 y B1 con D2 mantenida quedan reservadas para macros futuras.
//   - En el mapa de la e-Paper esas 3 teclas muestran los controles del tracker (flecha, circulo, flecha) mientras haya tracker.
//   - Quien "es" el tracker se enchufa con MD.IT.usar({ nombre, presente(), boton(lado, abajo) }). Hoy: el simulador del tracker de la pestana
//     Initiative Tracker. (El tracker nuevo con ESP32 se enchufa aca mismo, sin tocar nada mas.)
//   - El firmware (programa_dnd.cpp) y el Macrodeck simulado (simulador.js) hacen LO MISMO con las teclas: si cambia uno, cambia el otro.
window.MD = window.MD || {};
(function (MD) {
  const IT = MD.IT = { A: null, adaptador: null, ult: null };
  const L = 24;
  IT.TECLAS = [7, 8, 9];                 // C2, D2, E2
  IT.LADOS = ['I', 'C', 'D'];            // izquierda, centro, derecha (las mismas letras que usa el simulador del tracker)
  IT.NOMBRES = ['TURNO SIG', 'OK/ESTADO', 'TURNO ANT'];
  IT.esFija = (i) => i === 7 || i === 8 || i === 9;

  // ---------- iconos de 24 x 24 (1 bit, MSB primero, 3 bytes por fila) ----------
  function dibujo(fn) {
    const out = new Uint8Array(72);
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) if (fn(x + 0.5, y + 0.5)) out[y * 3 + (x >> 3)] |= 0x80 >> (x & 7);
    return out;
  }
  const flechaIzq = (x, y) => (x >= 2 && x <= 12 && Math.abs(y - 12) <= (x - 2) * 1.0) || (x > 12 && x <= 22 && Math.abs(y - 12) <= 3);
  const iconos = [
    dibujo(flechaIzq),
    dibujo((x, y) => { const d = Math.hypot(x - 12, y - 12); return (d >= 8 && d <= 11) || d <= 3.6; }),
    dibujo((x, y) => flechaIzq(L - x, y)),
  ];
  IT.iconos = iconos;

  // ---------- presencia ----------
  IT.usar = function (adaptador) { IT.adaptador = adaptador; IT.revisar(true); };
  IT.presente = () => { try { return !!(IT.adaptador && IT.adaptador.presente()); } catch (e) { return false; } };

  // Devuelve una copia del arreglo de 10 teclas (las que se mandan al Macrodeck) con C2/D2/E2 cambiadas por los controles del tracker.
  IT.teclasMapa = function (teclas) {
    if (!IT.presente()) return teclas;
    const out = teclas.slice();
    IT.TECLAS.forEach((k, j) => { out[k] = { nombre: IT.NOMBRES[j], tipo: 'una_vez', ducking: false, icono: iconos[j] }; });
    return out;
  };
  // Los LEDs de esas 3 teclas: prendidas fijas mientras haya tracker (modo 1) -> se nota cuales son
  IT.ajustarLeds = function (leds) {
    if (!IT.presente()) return leds;
    const o = leds.slice(); IT.TECLAS.forEach((k) => { o[k] = 1; }); return o;
  };

  // La app llama a esto cuando algo pudo cambiar (conecto el tracker, se desconecto, conecto el Macrodeck...). Solo manda si cambio (o si 'forzar').
  IT.revisar = function (forzar) {
    const A = IT.A, p = IT.presente();
    if (!forzar && p === IT.ult) return;
    IT.ult = p;
    if (A && A.tr && A.tr.conectado) {
      try { A.tr.send(MD.P.enc.tracker(p)); A.enviarMapa(); A.ultLeds = ''; A.actualizarEstado(true); } catch (e) {}
    }
    if (A && (A.tab === 'mesa' || A.tab === 'escenas') && A.render) { try { A.render(); } catch (e) {} }
  };

  // Llega un boton del Macrodeck (trama 'T'): se lo pasa al tracker
  IT.boton = function (b, abajo) {
    if (!IT.presente() || b < 0 || b > 2) return;
    try { IT.adaptador.boton(IT.LADOS[b], !!abajo); } catch (e) {}
    if (MD.Diag) MD.Diag.anotar('tracker: ' + ['izquierda', 'centro', 'derecha'][b] + (abajo ? ' abajo' : ' arriba'));
  };

  // ---------- arranque (lo llama app.js) ----------
  IT.iniciar = function (A) {
    IT.A = A;
    const Trk = MD.Trk, Sv = Trk && Trk.Servicio;
    if (Sv) {
      // Hoy el "tracker" que se puede controlar es el simulado de la pestana Initiative Tracker (el Arduino real tiene su joystick de verdad).
      IT.usar({ nombre: 'simulador', presente: () => Sv.estado === 'conectado' && Sv.modo === 'sim', boton: (lado, abajo) => Sv.simBoton(lado, abajo) });
      Sv.alCambio((que) => { if (que === 'estado') IT.revisar(); });
    }
  };
})(window.MD);
