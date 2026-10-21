// nativo_sim.js - ANDROID DE MENTIRA para probar el APK envoltorio en la compu, sin celu ni Android Studio.
// Solo se activa si la direccion lleva  ?nativo=sim  (por ejemplo http://localhost:8000/?nativo=sim). Si no, no hace NADA.
//
// Inventa el plugin MacrodeckNativo (ver el contrato en nativo.js) y lo conecta a un Macrodeck simulado
// (el mismo de "Probar con el simulador"). Muestra al costado:
//   - una "musica de YouTube" de mentira cuyo volumen baja cuando la app pide ducking,
//   - si el servicio en primer plano esta prendido (la notificacion "Macrodeck conectado"),
//   - un registro de todo lo que la app le pide a Android,
//   - un boton para cortar el Bluetooth y ver si se reconecta solo.
// Los datos pasan por JSON igual que en Capacitor de verdad, asi se detectan errores de formato.
// LIMITES: esto prueba la mitad web. NO prueba Kotlin, ni el foco de audio real de Android, ni el WebView con la pantalla bloqueada.
(function () {
  if (!/[?&]nativo=sim(&|$)/.test(location.search)) return;
  const MD = window.MD = window.MD || {};
  window.__MD_NATIVO_SIM = true;

  const reg = [];                                   // registro de llamadas (tambien sirve para las pruebas automaticas)
  const S = { red: { tipo: 'wifi', ssid: 'Casa', ssidLegible: true, medida: false, permisoUbicacion: true }, servicio: false, duck: false, ble: 'desconectado', yt: 1, exento: false, quiere: false, historialDuck: [], tituloServicio: '',
    celu: { bat: 82, carga: false, vol: 50, suena: false, sesion: false, acceso: false, titulo: '', app: '' } };   // v1.3-dev14: el celu de mentira
  window.__nativoSim = { reg, S, perderBT: (ms) => perderBT(ms), parar: () => emit('parar', {}), quitarExencion: () => { S.exento = false; }, red: (o) => { Object.assign(S.red, o); }, celu: (o) => celuCambiar(o) };
  let sim = null, ui = null;
  const oyentes = { estado: [], trama: [], parar: [], celu: [] };
  const emit = (n, d) => oyentes[n].slice().forEach(f => { try { f(d); } catch (e) { console.error(e); } });
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  const u8 = (b) => Uint8Array.from(atob(b), c => c.charCodeAt(0));
  const esperar = (ms) => new Promise(r => setTimeout(r, ms));
  const json = (a) => (a === undefined ? undefined : JSON.parse(JSON.stringify(a)));   // lo que hace el puente de Capacitor

  function log(txt) {
    reg.push(txt);
    if (ui && ui.log) { const li = document.createElement('li'); li.textContent = new Date().toLocaleTimeString('es-AR') + '  ' + txt; ui.log.prepend(li); while (ui.log.children.length > 16) ui.log.lastChild.remove(); }
  }
  function pintar() {
    if (!ui) return;
    ui.svc.textContent = S.servicio ? 'ENCENDIDO' : 'apagado'; ui.svc.className = S.servicio ? 'ok' : '';
    ui.foco.textContent = S.duck ? 'DUCK (MAY_DUCK)' : 'libre'; ui.foco.className = S.duck ? 'ok' : '';
    ui.ble.textContent = S.ble; ui.ble.className = S.ble === 'conectado' ? 'ok' : (S.ble === 'desconectado' ? '' : 'med');
    ui.bat.textContent = S.exento ? 'excluida' : 'no excluida';
    ui.fill.style.width = Math.round(S.yt * 100) + '%'; ui.pct.textContent = Math.round(S.yt * 100) + '%';
  }
  function estado(e, detalle) { S.ble = e; emit('estado', { estado: e, detalle: detalle || '' }); pintar(); }

  // v1.3-dev14: bateria / volumen / YouTube del celu de mentira. Cambiar algo avisa a la app con el evento 'celu' (como el plugin de verdad).
  function celuCambiar(o) {
    Object.assign(S.celu, o || {});
    if (!S.celu.acceso) { S.celu.suena = false; S.celu.sesion = false; S.celu.titulo = ''; S.celu.app = ''; }
    else if (S.celu.suena) S.celu.sesion = true;
    if (S.celu.suena && !S.celu.titulo) S.celu.titulo = 'Cancion de prueba';
    emit('celu', json(S.celu)); pintarCelu();
  }
  function pintarCelu() {
    if (!ui || !ui.cBat) return;
    ui.cBat.value = S.celu.bat; ui.cBatT.textContent = S.celu.bat + '%'; ui.cCarga.checked = S.celu.carga;
    ui.cVol.value = S.celu.vol; ui.cVolT.textContent = S.celu.vol + '%';
    ui.cAcc.checked = S.celu.acceso; ui.cSuena.checked = S.celu.suena; ui.cSuena.disabled = !S.celu.acceso;
    if (document.activeElement !== ui.cTit) ui.cTit.value = S.celu.titulo;
  }

  async function perderBT(ms) {
    if (S.ble !== 'conectado') return;
    log('Bluetooth: se corta el enlace (simulado)');
    sim.desconectar(); estado('desconectado', 'Se perdio la conexion');
    await esperar(ms == null ? 3000 : ms);
    if (!S.quiere) return;                          // mientras tanto se pidio cortar a proposito
    log('Servicio: reintenta conectar solo'); estado('conectando'); await esperar(300);
    if (!S.quiere) return;
    await sim.conectar(); estado('conectado'); log('Bluetooth: reconectado');
  }

  const puente = (f) => async (a) => f(json(a));
  const plugin = {
    addListener: async (n, cb) => { oyentes[n].push(cb); return { remove: async () => { const i = oyentes[n].indexOf(cb); if (i >= 0) oyentes[n].splice(i, 1); } }; },
    conectar: puente(async (o) => {
      if (!o || !o.servicio) throw new Error('falta el servicio');
      log('BLE: conectar(' + o.servicio.slice(0, 8) + '…)'); S.quiere = true;
      estado('buscando'); await esperar(400); estado('conectando'); await esperar(300);
      await sim.conectar(); estado('conectado'); log('BLE: conectado al Macrodeck simulado');
    }),
    desconectar: puente(async () => { S.quiere = false; log('BLE: desconectar()'); sim.desconectar(); estado('desconectado'); }),
    escribir: puente(async (o) => { if (!o || typeof o.b64 !== 'string') throw new Error('escribir pide {b64}'); const f = u8(o.b64); if (f.length > 20) throw new Error('trama de mas de 20 bytes'); if (S.ble === 'conectado') sim.send(f); }),
    duck: puente(async (o) => {
      S.duck = !!o.on; S.historialDuck.push(S.duck); S.yt = S.duck ? 0.3 : 1;
      log(S.duck ? 'Audio: requestAudioFocus(GAIN_TRANSIENT_MAY_DUCK) -> YouTube baja' : 'Audio: abandonAudioFocus() -> YouTube sube'); pintar();
    }),
    servicio: puente(async (o) => {
      S.servicio = !!o.on; S.tituloServicio = o.on ? (o.titulo || '') : '';
      log(S.servicio ? 'Servicio en primer plano ON: "' + (o.titulo || '') + '" + wake lock' : 'Servicio en primer plano OFF'); pintar();
    }),
    redActual: puente(async () => json(S.red)),
    pedirUbicacion: puente(async () => { S.red.permisoUbicacion = true; if (S.red.tipo === 'wifi' && S.red.nombreReal) { S.red.ssid = S.red.nombreReal; S.red.ssidLegible = true; } log('Permiso de ubicacion: concedido (simulado)'); return json(S.red); }),
    bateria: puente(async () => ({ exento: S.exento })),
    pedirExencionBateria: puente(async () => { S.exento = true; log('Bateria: app excluida del ahorro (aceptado)'); pintar(); }),
    celuEstado: puente(async () => json(S.celu)),
    volumenCelu: puente(async (o) => { const v = Math.max(0, Math.min(100, o.pct | 0)); log('Audio: setStreamVolume(MUSIC) -> ' + v + '%'); S.celu.vol = v; pintarCelu(); }),
    pedirAccesoMedios: puente(async () => { log('Ajustes de Android: se abre "Acceso a notificaciones" (en el simulador se da con la casilla de abajo)'); })
  };
  window.Capacitor = { isNativePlatform: () => true, Plugins: { MacrodeckNativo: plugin } };

  function construir() {
    document.body.classList.add('nsim');
    const st = document.createElement('style');
    st.textContent = `
      body.nsim{display:flex;height:100vh;overflow:hidden}
      body.nsim #app{flex:1;min-width:0;height:100%;margin:0}
      #androidSim{flex:none;width:min(46vw,540px);height:100%;overflow:auto;padding:12px;background:#0d1117;color:#d7dde4;border-left:3px solid #3ddc84;font:13px/1.4 system-ui,sans-serif}
      #androidSim h2{margin:0 0 8px;font-size:15px;color:#3ddc84}
      #androidSim .chips{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
      #androidSim .chip{background:#161b22;border-radius:8px;padding:6px 8px}
      #androidSim .chip small{display:block;color:#8b949e}
      #androidSim .chip b{font-weight:600}
      #androidSim .ok{color:#3ddc84}#androidSim .med{color:#e3b341}
      #androidSim .yt{background:#161b22;border-radius:8px;padding:8px;margin-bottom:10px}
      #androidSim .barra{height:12px;background:#30363d;border-radius:6px;overflow:hidden;margin-top:6px}
      #androidSim .barra i{display:block;height:100%;background:#ff4d4d;transition:width .25s}
      #androidSim button{background:#21262d;color:#d7dde4;border:1px solid #444c56;border-radius:8px;padding:6px 10px;margin:0 6px 8px 0}
      #androidSim ol{margin:0 0 12px;padding:0;list-style:none;font:11px/1.5 ui-monospace,monospace;color:#8b949e;max-height:190px;overflow:auto}
      #androidSim .simbox{background:#fff1;border-radius:8px;padding:8px}
      @media (max-width:900px){body.nsim{flex-direction:column}#androidSim{width:auto;height:48vh;border-left:0;border-top:3px solid #3ddc84}}`;
    document.head.appendChild(st);
    const p = document.createElement('aside'); p.id = 'androidSim';
    p.innerHTML = `<h2>Android simulado · Moto G60s</h2>
      <div class="chips">
        <div class="chip"><small>Servicio en primer plano</small><b id="nsSvc"></b></div>
        <div class="chip"><small>Foco de audio</small><b id="nsFoco"></b></div>
        <div class="chip"><small>Bluetooth</small><b id="nsBle"></b></div>
        <div class="chip"><small>Ahorro de bateria</small><b id="nsBat"></b></div>
      </div>
      <div class="yt"><div>▶ YouTube Premium (de mentira) — volumen <b id="nsPct"></b></div><div class="barra"><i id="nsFill"></i></div>
        <small style="color:#8b949e">Android decide el nivel real del ducking; aca se muestra al 30 % solo de ejemplo.</small></div>
      <div class="yt"><div><b>Celu (v1.3-dev14)</b> — lo que ve la OLED</div>
        <div>Bateria <input type="range" id="nsBatR" min="0" max="100"> <b id="nsBatT"></b> <label><input type="checkbox" id="nsCarga"> cargando</label></div>
        <div>Volumen de musica <input type="range" id="nsVolR" min="0" max="100"> <b id="nsVolT"></b></div>
        <div><label><input type="checkbox" id="nsAcc"> Acceso a notificaciones dado</label> · <label><input type="checkbox" id="nsSuena"> YouTube suena</label></div>
        <div>Titulo <input type="text" id="nsTit" maxlength="60" style="width:70%"></div></div>
      <button type="button" id="nsPerder">Cortar Bluetooth (reconecta solo)</button>
      <button type="button" id="nsBateria">Excluir de bateria</button>
      <button type="button" id="nsParar">Notificacion: Parar todo</button>
      <ol id="nsLog"></ol>
      <div class="simbox" id="nsSim"></div>`;
    document.body.appendChild(p);
    ui = { svc: p.querySelector('#nsSvc'), foco: p.querySelector('#nsFoco'), ble: p.querySelector('#nsBle'), bat: p.querySelector('#nsBat'), pct: p.querySelector('#nsPct'), fill: p.querySelector('#nsFill'), log: p.querySelector('#nsLog'),
      cBat: p.querySelector('#nsBatR'), cBatT: p.querySelector('#nsBatT'), cCarga: p.querySelector('#nsCarga'), cVol: p.querySelector('#nsVolR'), cVolT: p.querySelector('#nsVolT'),
      cAcc: p.querySelector('#nsAcc'), cSuena: p.querySelector('#nsSuena'), cTit: p.querySelector('#nsTit') };
    ui.cBat.oninput = () => celuCambiar({ bat: +ui.cBat.value });
    ui.cCarga.onchange = () => celuCambiar({ carga: ui.cCarga.checked });
    ui.cVol.oninput = () => celuCambiar({ vol: +ui.cVol.value });
    ui.cAcc.onchange = () => celuCambiar({ acceso: ui.cAcc.checked });
    ui.cSuena.onchange = () => celuCambiar({ suena: ui.cSuena.checked, sesion: true });
    ui.cTit.oninput = () => celuCambiar({ titulo: ui.cTit.value, app: 'com.google.android.youtube' });
    p.querySelector('#nsPerder').onclick = () => perderBT(3000);
    p.querySelector('#nsBateria').onclick = () => plugin.pedirExencionBateria();
    p.querySelector('#nsParar').onclick = () => { log('Notificacion: se toco "Parar todo"'); emit('parar', {}); };
    sim = new MD.Simulador(p.querySelector('#nsSim'));
    sim.onFrame = (f) => emit('trama', { b64: b64(f) });     // lo que manda el Macrodeck sube a la app por el puente
    sim.onEstado = () => {}; sim.onConectado = () => {};
    window.__nativoSim.sim = sim;
    log('Android simulado listo (plugin MacrodeckNativo)');
    pintar(); pintarCelu();
  }
  document.addEventListener('DOMContentLoaded', construir);
})();
