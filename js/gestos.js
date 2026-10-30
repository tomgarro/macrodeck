// gestos.js - 2.0-dev11: GESTOS de las teclas Ambiente y Musica (las que prenden un audio o una lista).
//   1 toque  = play / pausa (con fundido; la pausa guarda el lugar)
//   2 toques = siguiente tema / elemento de la lista (si no hay siguiente, no hace nada)
//   3 toques = tema anterior
//   MANTENER = la perilla del Macrodeck pasa a ser el volumen DE ESA TECLA (0 a 150 %, queda guardado en la escena). Al soltar, la perilla vuelve
//              a ser el volumen general; hasta que la perilla "agarra" el volumen general (queda cerca o lo cruza) no lo mueve, asi no pega un salto.
// La accion de un toque se hace al SOLTAR la tecla (si no, mantener para subir el volumen tambien pausaria). Para que el doble toque se sienta
// rapido, el primer toque actua en seguida con un fundido corto; si llega el segundo, se DESHACE el primero y el "siguiente" espera un momento
// por si viene un tercer toque.
window.MD = window.MD || {};
(function (MD) {
  const MANTENER_MS = 450;        // apretada tanto tiempo = modo volumen
  const VENTANA_MS = 330;         // maximo entre un toque y el siguiente para que cuenten como doble / triple
  const FUNDIDO = 0.18;           // segundos del fundido de un toque (play / pausa)
  const AVISO_MS = 1800;          // cuanto dura el cartel en la OLED
  const VOL_MAX = 1.5;            // la perilla abarca 0 a 150 % (como el Mezclador)
  const TOL = 12;                 // "agarre" de la perilla, sobre 0..255 (unos 5 %)
  // El idioma de los LEDs de las teclas (modos del protocolo 'l': 0 apagado, 1 fijo, 2 respira, 3 destello, 4 doble destello, 5 tenue)
  const LED = { sonando: 2, pausa: 5, siguiente: 3, anterior: 4, nada: 4, volumen: 1 };

  const est = new Map();          // tecla -> { desde, hold, mantenido, taps, ultima, pend, p }
  const G = { vol: -1, obj: 0, agarrado: false, lado: 0, movio: false, ultP: -1, pendMaster: false, ladoM: 0, aviso: null };
  const ahora = () => performance.now();
  const Amb = () => MD.Ambientes;
  const de = (i) => { let s = est.get(i); if (!s) { s = { desde: 0, hold: null, mantenido: false, taps: 0, ultima: -1e9, pend: null, p: null }; est.set(i, s); } return s; };

  function aviso(i, texto, ms) { G.aviso = { i, texto, hasta: ahora() + (ms || AVISO_MS) }; }
  function destello(m, i, modo) { const e = m.estadoTecla[i]; if (!e) return; e.flashHasta = ahora() + 450; e.flashModo = modo; }

  function entrarVol(m, i, t) {
    G.vol = i; G.movio = false;
    G.obj = Math.round(Math.min(1, (t.volumen == null ? 1 : t.volumen) / VOL_MAX) * 255);
    G.agarrado = G.ultP >= 0 && Math.abs(G.ultP - G.obj) <= TOL;
    G.lado = G.ultP >= 0 ? (G.ultP > G.obj ? 1 : -1) : 0;
    m.onCambio();
  }
  function salirVol(m, i) {
    const huboCambio = G.movio;
    G.vol = -1; G.agarrado = false;
    if (huboCambio) {                                  // la perilla quedo lejos del volumen general: tiene que volver a "agarrarlo"
      G.pendMaster = true;
      const obj = Math.round(m.volGeneral * 255);
      G.ladoM = G.ultP >= 0 ? (G.ultP > obj ? 1 : -1) : 0;
      aviso(i, 'SAVED', 1200);
    }
    m.onCambio();
  }

  // La perilla (0..255). Devuelve true si este modulo se QUEDA con el valor (no se toca el volumen general).
  function perilla(m, A, v) {
    G.ultP = v;
    if (G.vol >= 0) {
      const i = G.vol, t = m.teclas[i];
      if (!t) { G.vol = -1; return false; }
      if (!G.agarrado) {
        const lado = v > G.obj ? 1 : -1;
        if (Math.abs(v - G.obj) <= TOL || (G.lado && lado !== G.lado)) G.agarrado = true;
        else { G.lado = lado; return true; }
      }
      G.movio = true;
      const vol = Math.round(v / 255 * VOL_MAX * 100) / 100;
      m.fijarVolTecla(i, vol);
      if (A && A.cambio) A.cambio(false);
      return true;
    }
    if (G.pendMaster) {
      const obj = Math.round(m.volGeneral * 255), lado = v > obj ? 1 : -1;
      if (Math.abs(v - obj) <= TOL || (G.ladoM && lado !== G.ladoM)) { G.pendMaster = false; return false; }
      G.ladoM = lado; return true;
    }
    return false;
  }

  async function siguiente(m, i, t) {
    const ok = Amb().siguiente(i, t);
    destello(m, i, ok ? LED.siguiente : LED.nada);
    aviso(i, ok ? 'NEXT' : 'NO NEXT');
  }
  async function anterior(m, i, t) {
    const ok = Amb().anterior(i, t);
    destello(m, i, ok ? LED.anterior : LED.nada);
    aviso(i, ok ? 'PREV' : 'NO PREV');
  }

  function tocar(m, i, t, e, s) {
    const n = ahora();
    if (n - s.ultima > VENTANA_MS) { s.taps = 0; }
    s.ultima = n; s.taps++;
    if (s.taps === 1) {
      s.p = Amb().toggle(m, i, t, e, FUNDIDO).then((r) => { if (r) aviso(i, r.accion === 'play' ? 'PLAY' : (r.accion === 'pausa' ? 'PAUSE' : 'RESUME')); return r; }).catch(() => null);
    } else if (s.taps === 2) {
      const p = s.p;
      p.then((r) => { if (r && r.deshacer) r.deshacer(); });          // el primer toque (pausa o seguir) se deshace
      clearTimeout(s.pend);
      s.pend = setTimeout(async () => { s.pend = null; s.taps = 0; await p; siguiente(m, i, t); }, VENTANA_MS);
    } else {
      clearTimeout(s.pend); s.pend = null; s.taps = 0;
      anterior(m, i, t);
    }
  }

  const Gestos = {
    MANTENER_MS, VENTANA_MS, LED,
    // La llama el motor en cada apretada / soltada de una tecla Ambiente o Musica
    tecla(m, i, t, e, abajo) {
      const s = de(i);
      if (abajo) {
        s.desde = ahora(); s.mantenido = false; clearTimeout(s.hold);
        s.hold = setTimeout(() => { s.hold = null; s.mantenido = true; entrarVol(m, i, t); }, MANTENER_MS);
        return;
      }
      clearTimeout(s.hold); s.hold = null;
      if (s.mantenido) { s.mantenido = false; salirVol(m, i); return; }
      if (!s.desde) return;                                 // una soltada sin apretada (por ejemplo la tecla con la que se entro)
      s.desde = 0;
      tocar(m, i, t, e, s);
    },
    perilla,
    enVol(i) { return G.vol === i; },
    // Cuatro renglones de 10 letras para la OLED, o null si no hay nada que decir
    oled(m) {
      const n = ahora();
      if (G.vol >= 0) {
        const t = m.teclas[G.vol]; if (!t) return null;
        const v = Math.min(VOL_MAX, Math.max(0, t.volumen == null ? 1 : t.volumen)), celdas = Math.round(v / VOL_MAX * 8);
        const barra = '[' + '#'.repeat(celdas) + '-'.repeat(8 - celdas) + ']';
        return [t.nombre || 'KEY', 'VOLUME', barra, G.agarrado ? Math.round(v * 100) + '%' : 'TURN KNOB'];
      }
      if (G.aviso && n < G.aviso.hasta) {
        const t = m.teclas[G.aviso.i]; if (!t) return null;
        const titulo = (Amb() && Amb().titulo(G.aviso.i, t)) || '';
        return [t.nombre || 'KEY', titulo.slice(0, 10), titulo.slice(10, 20), G.aviso.texto];
      }
      return null;
    },
    // Al cambiar de escena o perder la conexion: todo vuelve a empezar
    reset() {
      est.forEach((s) => { clearTimeout(s.hold); clearTimeout(s.pend); });
      est.clear(); G.vol = -1; G.agarrado = false; G.pendMaster = false; G.aviso = null;
    },
  };
  MD.Gestos = Gestos;
})(window.MD);
