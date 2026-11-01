// huevo.js - Easter egg para el DM. Tocá 7 veces seguidas la versión (debajo del título) y se abre el "Cofre secreto". 2.0-dev23.
window.MD = window.MD || {};
(function (MD) {
  const COMUNES = [
    'Frodo prepara tres finales posibles. Los jugadores inventan un cuarto que nadie vio venir. Como siempre.',
    'El dummy no es un celu: es un caballero de la mesa. Inmóvil, leal y siempre enchufado.',
    'Tirada de Sigilo del dummy: 2. Igual nadie lo ve, porque está detrás de la pila de dados.',
    'Nota del DM: «solo era una taberna tranquila». Últimas palabras famosas.',
    'Forest Birds.wav pesa 56 MB. Es el pajarito más caro de toda la fantasía.',
    'Frodo tiró iniciativa y sacó 3. Los goblins lo respetan igual.',
    'Jugadores: «¿Podemos descansar?». DM: «Primero, un tiempo límite de 30 segundos».',
    'Aviso legal: ningún dragón fue sincronizado durante la realización de esta app. Los timeouts, en cambio, sí.',
    'Hay 704 sonidos en Drive y el DM igual dice «improvisemos un silencio dramático».',
    'El que prepara la sesión durante una semana y los jugadores se van a la otra punta del mapa… ese es el DM.',
  ];
  const CRITICO = ['¡CRÍTICO! Frodo describe la escena con tanta épica que el dummy aplaude solo. Nadie sabe cómo.', '¡20 NATURAL! La taberna entera se calla, el bardo llora y los 704 sonidos suenan en el momento justo.'];
  const PIFIA = ['¡PIFIA! Frodo intentó sincronizar con el Wi-Fi del vecino. El dummy se hizo el dormido. (−1 a la paciencia)', '¡1 NATURAL! El dragón tropieza con su propia cola. El DM decide que «era parte del plan».'];
  const al = (a) => a[Math.floor(Math.random() * a.length)];
  function abrir() {
    if (document.getElementById('dlgHuevo')) return;
    const d = document.createElement('dialog'); d.id = 'dlgHuevo'; d.className = 'esc-md-dlg huevo-dlg';
    d.innerHTML = '<h3>🎲 El cofre secreto del DM</h3><div class="dado">20</div><p class="frase suave"></p><div class="fila" style="margin-top:12px;justify-content:center;flex-wrap:wrap"><button type="button" class="primario" data-x="otra">Tirar de nuevo</button><button type="button" data-x="cerrar">Cerrar</button></div><small class="suave">Hecho con cariño para el DM más paciente de la mesa (y un dummy muy sufrido).</small>';
    const dado = d.querySelector('.dado'), frase = d.querySelector('.frase'), otra = d.querySelector('[data-x=otra]');
    function tirar() {
      otra.disabled = true; dado.className = 'dado'; frase.textContent = '…';
      let n = 0; const iv = setInterval(() => {
        dado.textContent = String(1 + Math.floor(Math.random() * 20));
        if (++n >= 14) {
          clearInterval(iv);
          const r = 1 + Math.floor(Math.random() * 20); dado.textContent = String(r);
          if (r === 20) { dado.classList.add('crit'); frase.textContent = al(CRITICO); }
          else if (r === 1) { dado.classList.add('pifia'); frase.textContent = al(PIFIA); }
          else frase.textContent = al(COMUNES);
          otra.disabled = false;
        }
      }, 70);
    }
    otra.onclick = tirar;
    d.querySelector('[data-x=cerrar]').onclick = () => { d.close(); d.remove(); };
    document.body.append(d); d.showModal(); tirar();
  }
  MD.Huevo = { abrir: abrir };
  let toques = 0, ult = 0;
  document.addEventListener('click', (e) => {
    const v = e.target && e.target.closest ? e.target.closest('#ver') : null;
    if (!v) return;
    const ahora = Date.now(); if (ahora - ult > 2500) toques = 0; ult = ahora;
    if (++toques >= 7) { toques = 0; abrir(); }
  });
})(window.MD);
