// navegacion.js - (2.0-dev2) El boton ATRAS de Android (y el del navegador) navega DENTRO de la app en vez de cerrarla.
//
// Como funciona (simple): la pagina siempre tiene UNA entrada de historial "de mas" (el "centinela"). Cuando se toca Atras, el navegador
// se come ese centinela y avisa (popstate). Entonces la app cierra la capa de arriba (un cuadro, el Modo mesa, el panel, un editor,
// una pestaña de "Mas", y por ultimo vuelve a la Mesa) y vuelve a poner el centinela. Estando en la Mesa sin nada abierto:
// el primer Atras avisa "Tocá otra vez para salir" y el segundo (dentro de 2 segundos) sale de verdad.
window.MD = window.MD || {};
(function (MD) {
  const N = MD.Nav = { A: null };
  const EN_MAS = ['sonidos', 'drive', 'herramientas'];
  let armado = 0, aviso = null, tAviso = 0;
  const enApk = () => !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  const standalone = () => { try { return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches; } catch (e) { return false; } };

  function toast(txt) {
    if (!aviso) { aviso = document.createElement('div'); aviso.className = 'toast-nav'; aviso.setAttribute('role', 'status'); document.body.append(aviso); }
    aviso.textContent = txt; aviso.classList.add('on'); clearTimeout(tAviso);
    tAviso = setTimeout(() => aviso && aviso.classList.remove('on'), 2000);
  }

  // Cierra la capa de mas arriba. Devuelve true si habia algo que cerrar.
  N.cerrarCapa = function () {
    const A = N.A; if (!A) return false;
    const dlg = document.querySelector('dialog[open]');
    if (dlg) { try { dlg.close(); } catch (e) { dlg.remove(); } return true; }
    if (MD.Trk && MD.Trk.cerrarMesa && MD.Trk.cerrarMesa()) return true;        // 2.0-dev4: pantalla de mesa del Initiative Tracker
    if (document.querySelector('.au-ov') && MD.Au && MD.Au.ui) { MD.Au.ui.cerrarOv(); return true; }
    if (MD.Panel && MD.Panel.abierto()) { MD.Panel.cerrar(); return true; }
    if (A.tab === 'escenas' && A.edTecla != null) { A.edTecla = null; A.render(); return true; }
    if (EN_MAS.includes(A.tab)) { A.irATab('mas'); return true; }
    if (A.tab !== 'mesa') { A.irATab('mesa'); return true; }
    return false;
  };

  const poner = () => { try { history.pushState({ md: 1 }, ''); } catch (e) {} };

  // (2.0-dev3) En la APK el boton Atras lo maneja la parte nativa (MainActivity) y le pregunta a esta funcion:
  // 'si' = cerre una capa (no hagas nada mas) / 'no' = no habia nada abierto (la parte nativa avisa "Tocá otra vez para salir").
  N.atrasNativo = function () { clearTimeout(armado); try { return N.cerrarCapa() ? 'si' : 'no'; } catch (e) { return 'no'; } };

  N.iniciar = function (A) {
    N.A = A;
    if (N.listo) return; N.listo = true;
    if (enApk()) return;                        // en la APK no hace falta el centinela: Atras lo atiende MainActivity
    try { history.replaceState({ md: 0 }, ''); } catch (e) {}
    poner();
    window.addEventListener('popstate', () => {
      clearTimeout(armado);
      if (N.cerrarCapa()) { poner(); return; }
      // en la Mesa y sin nada abierto
      if (enApk() || standalone()) {
        toast('Tocá otra vez para salir');
        armado = setTimeout(poner, 2200);          // si no vuelve a tocar Atras, se vuelve a armar el centinela
      } else {
        try { history.back(); } catch (e) {}       // navegador comun: Atras sale de la pagina como siempre
      }
    });
  };
})(window.MD);
