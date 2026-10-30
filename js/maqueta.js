// maqueta.js - Version de ESCRITORIO: en pantallas anchas, el Macrodeck simulado aparece a la derecha, dibujado sobre la foto del equipo final
// (OLED a la izquierda de las teclas, HOME arriba a la derecha, perilla con el logo TG, teclas con luz calida). Habla con el mismo Simulador de siempre
// (js/simulador.js), asi que muestra lo mismo que la placa real. En el celu no se ve y todo queda como antes.
window.MD = window.MD || {};
(function (MD) {
  const MQ = window.matchMedia ? window.matchMedia('(min-width:1100px)') : { matches: false };
  const FOTO_W = 1047, FOTO_H = 816;
  let hook = false;

  const activa = () => !!MQ.matches;

  // Envuelve las piezas del simulador (pantallas, teclas, HOME) en un "cuerpo" con la foto de fondo. Se puede repetir sin problema.
  function armarCuerpo(raiz) {
    if (raiz.querySelector('.cuerpo')) return;
    const h = (cls) => { const d = document.createElement('div'); d.className = cls; return d; };
    const cuerpo = h('cuerpo');
    const pant = raiz.querySelector('.sim-pantallas'), teclas = raiz.querySelector('.sim-teclas'), home = raiz.querySelector('.sim-home');
    if (!pant || !teclas || !home) return;
    const knob = h('sim-knob'); knob.title = 'Perilla: arrastrala o usa la rueda del mouse';
    knob.innerHTML = '<i class="sim-knob-marca"></i>';
    home.title = 'HOME: abre el selector de escenas';
    raiz.insertBefore(cuerpo, raiz.firstChild);
    cuerpo.append(pant, teclas, home, knob);
    cuerpo.insertAdjacentHTML('beforeend', '<span class="sim-ver" title="Version de la app"></span>');
    cuerpo.querySelector('.sim-ver').textContent = 'v' + (MD.VERSION || '');
    const rango = raiz.querySelector('.sim-perilla');
    const poner = (v) => {
      v = Math.max(0, Math.min(255, Math.round(v)));
      if (+rango.value === v) return;
      rango.value = v; rango.dispatchEvent(new Event('input', { bubbles: true })); marca();
    };
    const marca = () => { knob.style.setProperty('--ang', (-135 + (+rango.value / 255) * 270) + 'deg'); };
    marca();
    // arrastrar en circulo: el angulo del mouse alrededor del centro de la perilla (de -135 a +135 grados, 0 = arriba)
    let arrastrando = false;
    const angulo = (e) => {
      const r = knob.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      let a = Math.atan2(dx, -dy) * 180 / Math.PI;              // 0 = arriba, + hacia la derecha
      return Math.max(-135, Math.min(135, a));
    };
    knob.addEventListener('pointerdown', (e) => { arrastrando = true; knob.setPointerCapture(e.pointerId); poner(((angulo(e) + 135) / 270) * 255); e.preventDefault(); });
    knob.addEventListener('pointermove', (e) => { if (arrastrando) poner(((angulo(e) + 135) / 270) * 255); });
    const fin = () => { arrastrando = false; };
    knob.addEventListener('pointerup', fin); knob.addEventListener('pointercancel', fin);
    knob.addEventListener('wheel', (e) => { e.preventDefault(); poner(+rango.value + (e.deltaY < 0 ? 8 : -8)); }, { passive: false });
    rango.addEventListener('input', marca);
  }

  // Lo llama A.render(): pone o saca el simulador del panel derecho segun el ancho de la ventana.
  function montar(A) {
    const aside = document.getElementById('maqueta');
    if (!aside) return;
    if (!hook) { hook = true; if (MQ.addEventListener) MQ.addEventListener('change', () => { A.render(); }); }
    const desk = activa(), sim = !!(A.sim && A.tr === A.sim);
    // (2.0-dev4) En la pestaña Initiative Tracker, la columna de la derecha muestra el tracker con su joystick EN LUGAR del Macrodeck.
    if (desk && (A.tab === 'tracker' || A.tab === 'it') && MD.Trk && MD.Trk._lado) {
      aside.dataset.est = 'tracker'; aside.replaceChildren(...MD.Trk._lado); A.simRaiz.classList.remove('maqueta'); return;
    }
    A.simRaiz.classList.toggle('maqueta', desk);
    if (!desk) { aside.replaceChildren(); aside.dataset.est = ''; return; }
    const est = sim ? 'sim' : 'vacio';
    if (aside.dataset.est !== est) {
      aside.dataset.est = est;
      if (sim) { aside.replaceChildren(A.simRaiz); }
      else {
        const real = A.tr && A.tr.conectado && A.tr.tipo !== 'sim';
        const boton = document.createElement('button'); boton.type = 'button'; boton.className = 'primario'; boton.id = 'btnSimMaqueta';
        boton.textContent = 'Encender el simulador'; boton.addEventListener('click', () => A.usarSimulador());
        const caja = document.createElement('div'); caja.className = 'maq-vacia';
        const msg = document.createElement('p'); msg.className = 'suave';
        msg.textContent = real ? 'Hay un Macrodeck real conectado. Si queres probar sin el equipo, podes encender el simulador.' : 'Este es el Macrodeck simulado: las mismas pantallas, teclas y perilla que el equipo real.';
        caja.append(msg, boton);
        const foto = document.createElement('div'); foto.className = 'maq-foto'; foto.append(caja);
        aside.replaceChildren(foto);
      }
    }
    if (sim) armarCuerpo(A.simRaiz);
  }

  MD.Maqueta = { montar, activa, FOTO_W, FOTO_H };
})(window.MD);
