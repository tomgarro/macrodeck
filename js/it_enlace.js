// it_enlace.js - Initiative Tracker (IT) controlado desde el Macrodeck: las teclas C2, D2 y E2 (y B2 = volumen de sus sonidos, desde 2.0-dev26).
//
// 2.0-dev26: VOLUMEN DEL TRACKER. Con un tracker conectado, B2 (tecla 6) deja de ser una tecla de sonido: MIENTRAS esta apretada, la perilla del Macrodeck
//   es el volumen de los sonidos del tracker (0 a 100 %, de fabrica 100 %, queda guardado en ese celu). Al soltar B2 la perilla vuelve a ser el volumen general.
//   - "Agarre": si la perilla esta lejos del volumen actual, no lo mueve hasta que lo alcanza o lo cruza (asi no pega un salto). Pasa lo mismo al soltar B2.
//   - El valor se ve en: la OLED del Macrodeck (mientras B2 esta apretada y ~1,8 s despues del ultimo cambio), la OLED del tracker (orden VOL) y un cartel
//     en la app. Todo sale de UN solo lugar: MD.Trk.Servicio.fijarVol() (tracker_serie.js), que tambien usa el deslizador de Ajustes del tracker.
//   - No hace falta tocar el firmware del Macrodeck: B2 le llega a la app como una tecla comun y la perilla como siempre.
//
// Como funciona (simple):
//   - Cuando hay un tracker conectado, la app le avisa al Macrodeck (trama 't'). Desde ese momento C2 / D2 / E2 (teclas 7, 8, 9) dejan de ser
//     teclas de sonido y pasan a ser los 3 botones del tracker: izquierda, centro y derecha. El Macrodeck NO las manda como teclas: manda la
//     trama 'T' (boton + apretado/soltado), que la app le pasa al tracker como si fuera su joystick.
//   - Combinaciones: con D2 (centro) mantenida, C1 = izquierda, E1 = derecha y D1 = izquierda + derecha juntas. Asi el tracker conserva
//     TODOS los gestos del joystick de 3 botones (insertar = centro + izquierda, deshacer = centro + derecha, reiniciar = los tres 3 s).
//     A1 y B1 con D2 mantenida quedan reservadas para macros futuras.
//   - En el mapa de la e-Paper esas 3 teclas muestran los controles del tracker (flecha, circulo, flecha) mientras haya tracker.
//   - Quien "es" el tracker se enchufa con MD.IT.usar({ nombre, presente(), boton(lado, abajo) }). Son TRES casos (2.0-dev13):
//       sim : el tracker simulado de la app. Los botones llegan como trama 'T' y se los pasa a Sv.simBoton.
//       usb : el tracker ESP32 real por cable (USB-OTG o Web Serial). Los botones llegan como 'T' y salen por el cable como la orden "B,I,1".
//       md  : el tracker ESP32 real por la RADIO del Macrodeck (ESP-NOW). El Macrodeck manda los botones por la radio el mismo (no manda 'T'); la app solo
//             recibe las lineas del tracker ('L') y avisa de su presencia ('N'). Si la app necesita mandarle algo, lo hace con 'u'.
//   - El firmware (programa_dnd.cpp) y el Macrodeck simulado (simulador.js) hacen LO MISMO con las teclas: si cambia uno, cambia el otro.
window.MD = window.MD || {};
(function (MD) {
  const IT = MD.IT = { A: null, adaptador: null, ult: null };
  const L = 24;
  IT.TECLAS = [7, 8, 9];                 // C2, D2, E2
  IT.LADOS = ['I', 'C', 'D'];            // izquierda, centro, derecha (las mismas letras que usa el simulador del tracker)
  IT.NOMBRES = ['TURNO SIG', 'OK/ESTADO', 'TURNO ANT'];
  IT.TECLA_VOL = 6;                      // B2: volumen de los sonidos del tracker (con B2 apretada, la perilla)
  IT.esFija = (i) => i === 6 || i === 7 || i === 8 || i === 9;

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
  // parlante de 24 x 24 para B2: cuerpo, cono que se ensancha y dos ondas a la derecha
  const iconoVol = dibujo((x, y) => {
    if (x >= 2 && x <= 7 && y >= 9 && y <= 15) return true;
    if (x > 7 && x <= 14 && Math.abs(y - 12) <= 3 + (x - 7) * 0.9) return true;
    const d = Math.hypot(x - 14, y - 12);
    return x > 15 && ((d >= 5.5 && d <= 7.2) || (d >= 8.8 && d <= 10.2)) && Math.abs(y - 12) <= d * 0.8;
  });
  IT.iconoVol = iconoVol;

  // ---------- presencia ----------
  IT.usar = function (adaptador) { IT.adaptador = adaptador; IT.revisar(true); };
  IT.presente = () => { try { return !!(IT.adaptador && IT.adaptador.presente()); } catch (e) { return false; } };

  // Devuelve una copia del arreglo de 10 teclas (las que se mandan al Macrodeck) con C2/D2/E2 cambiadas por los controles del tracker.
  IT.teclasMapa = function (teclas) {
    if (!IT.presente()) return teclas;
    const out = teclas.slice();
    IT.TECLAS.forEach((k, j) => { out[k] = { nombre: IT.NOMBRES[j], tipo: 'una_vez', ducking: false, icono: iconos[j] }; });
    out[IT.TECLA_VOL] = { nombre: 'VOLUMEN', tipo: 'una_vez', ducking: false, icono: iconoVol };       // 2.0-dev26: B2
    return out;
  };
  // Los LEDs de esas 3 teclas (y B2): prendidas fijas mientras haya tracker (modo 1) -> se nota cuales son. B2 respira mientras se la mantiene (modo 2).
  IT.ajustarLeds = function (leds) {
    if (!IT.presente()) return leds;
    const o = leds.slice(); IT.TECLAS.forEach((k) => { o[k] = 1; }); o[IT.TECLA_VOL] = V.abajo ? 2 : 1; return o;
  };

  // ---------- 2.0-dev26: B2 + perilla = volumen de los sonidos del tracker ----------
  const TOL = 12;                         // "agarre" de la perilla, sobre 0..255 (unos 5 %), igual que en gestos.js
  const MS_OLED = 1800;                   // cuanto queda el volumen en la OLED del Macrodeck despues del ultimo cambio
  const V = { abajo: false, agarrado: false, obj: 0, lado: 0, movio: false, ultP: -1, pendMaster: false, ladoM: 0, hasta: 0, tOled: 0 };
  const servicio = () => (MD.Trk && MD.Trk.Servicio) || null;
  const ahora = () => performance.now();
  // La llama app.js en cada apretada / soltada de una tecla. Devuelve true si B2 se la queda el tracker (no se manda al motor de sonidos).
  IT.teclaVol = function (i, abajo) {
    if (i !== IT.TECLA_VOL) return false;
    const S = servicio();
    if (!abajo) {                                       // la soltada se la queda SOLO si la apretada fue del volumen (si no, el motor tiene que verla)
      if (!V.abajo) return false;
      V.abajo = false; V.hasta = ahora() + MS_OLED;
      if (V.movio && IT.A && IT.A.motor) {              // la perilla quedo lejos del volumen general: tiene que volver a "agarrarlo" para no pegar un salto
        const obj = Math.round(IT.A.motor.volGeneral * 255);
        V.pendMaster = true; V.ladoM = V.ultP >= 0 ? (V.ultP > obj ? 1 : -1) : 0;
      }
      if (S) S.fijarVol(S.cfg.vol, { mostrar: true });   // deja el ultimo valor a la vista y se lo reenvia al tracker (por si se perdio un paquete)
      else IT.volCambio();
      return true;
    }
    if (!S || !IT.presente()) return false;             // sin tracker, B2 es una tecla comun
    V.abajo = true; V.movio = false;
    V.obj = Math.round(S.cfg.vol * 255);
    V.agarrado = V.ultP >= 0 && Math.abs(V.ultP - V.obj) <= TOL;
    V.lado = V.ultP >= 0 ? (V.ultP > V.obj ? 1 : -1) : 0;
    S.fijarVol(S.cfg.vol, { mostrar: true });           // al apretar ya se ve el volumen de ahora (OLED del Macrodeck, OLED del tracker y cartel)
    return true;
  };
  // La perilla (0..255). Devuelve true si este modulo se QUEDA con el valor (no se toca el volumen general).
  IT.perilla = function (v) {
    V.ultP = v;
    const S = servicio();
    if (V.abajo) {
      if (!S || !IT.presente()) { V.abajo = false; return false; }      // el tracker se fue con B2 apretada: se suelta sola
      if (!V.agarrado) {
        const lado = v > V.obj ? 1 : -1;
        if (Math.abs(v - V.obj) <= TOL || (V.lado && lado !== V.lado)) V.agarrado = true;
        else { V.lado = lado; return true; }            // todavia no lo alcanzo: la OLED dice "TURN KNOB"
      }
      V.movio = true;
      S.fijarVol(v / 255);
      return true;
    }
    if (V.pendMaster && IT.A && IT.A.motor) {
      const obj = Math.round(IT.A.motor.volGeneral * 255), lado = v > obj ? 1 : -1;
      if (Math.abs(v - obj) <= TOL || (V.ladoM && lado !== V.ladoM)) { V.pendMaster = false; return false; }
      V.ladoM = lado; return true;
    }
    return false;
  };
  // Cuatro renglones de 10 letras para la OLED del Macrodeck, o null si no hay nada que mostrar
  IT.oled = function () {
    const S = servicio(); if (!S) return null;
    if (!V.abajo && !(IT.presente() && ahora() < V.hasta)) return null;
    const v = Math.round(S.cfg.vol * 100), celdas = Math.round(v / 100 * 8);
    return ['TRACKER', 'VOLUME', '[' + '#'.repeat(celdas) + '-'.repeat(8 - celdas) + ']', (V.abajo && !V.agarrado) ? 'TURN KNOB' : v + '%'];
  };
  // El volumen cambio (por la perilla o por el deslizador de la app): la OLED del Macrodeck lo muestra un rato y despues vuelve a lo de siempre
  IT.volCambio = function () {
    V.hasta = ahora() + MS_OLED;
    const A = IT.A; if (!A || !A.actualizarEstado) return;
    try { A.actualizarEstado(false); } catch (e) {}
    clearTimeout(V.tOled); V.tOled = setTimeout(() => { try { A.actualizarEstado(false); } catch (e) {} }, MS_OLED + 80);
  };
  IT.reiniciarVol = function () { V.abajo = false; V.pendMaster = false; V.movio = false; V.hasta = 0; };       // al perder la conexion con el Macrodeck

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

  // ---------- tracker real por la radio del Macrodeck (tramas 'L' y 'N') ----------
  IT.alLinea = function (d) { const Sv = MD.Trk && MD.Trk.Servicio; if (Sv) Sv.mdLinea(d.fin, d.txt); };
  IT.alEnergia = function (d) { const Sv = MD.Trk && MD.Trk.Servicio; if (Sv && Sv.macBateria) Sv.macBateria(d); };      // 2.0-dev14: bateria del Macrodeck
  IT.alPresente = function (p) {
    const Sv = MD.Trk && MD.Trk.Servicio; if (!Sv) return;
    if (MD.Diag) MD.Diag.anotar('tracker por radio: ' + (p ? 'presente' : 'fuera de alcance'));
    Sv.mdPresencia(p);
  };

  // ---------- arranque (lo llama app.js) ----------
  IT.iniciar = function (A) {
    IT.A = A;
    const Trk = MD.Trk, Sv = Trk && Trk.Servicio;
    if (Sv) {
      // Hoy el "tracker" que se puede controlar es el simulado de la pestana Initiative Tracker (el Arduino real tiene su joystick de verdad).
      // El tracker "es" lo que este conectado en el servicio: el simulado, el real por cable (si su firmware es el 3.x, que entiende los botones por serie) o el real por la radio.
      IT.usar({
        nombre: 'tracker',
        presente: () => Sv.estado === 'conectado' && (Sv.modo === 'sim' || Sv.modo === 'md' || Sv.firmwareNuevo()),
        boton: (lado, abajo) => { if (Sv.modo !== 'md') Sv.boton(lado, abajo); },       // por la radio los botones los manda el Macrodeck solo
      });
      Sv.alCambio((que) => { if (que === 'estado' || que === 'hola') IT.revisar(); });
    }
  };
})(window.MD);
