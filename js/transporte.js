// transporte.js - La conexion por Bluetooth (Web Bluetooth) con el Macrodeck.
// Tiene la misma "forma" que el simulador (send / onFrame / onEstado) asi el resto de la app no sabe con cual habla.
window.MD = window.MD || {};
(function (MD) {
  class BleTransport {
    constructor() {
      this.tipo = 'ble'; this.estado = 'desconectado'; this.dev = null; this.rx = null; this.tx = null;
      this.cola = []; this.escribiendo = false; this.quieroConectado = false; this.reintentos = 0;
      this.onFrame = () => {}; this.onEstado = () => {}; this.onConectado = () => {};
      this._alDesconectar = () => this._perdida();
    }
    static disponible() { return !!(navigator.bluetooth && navigator.bluetooth.requestDevice); }
    _estado(e, detalle) { this.estado = e; this.detalle = detalle || ''; this.onEstado(e, detalle); }

    // Hay que llamarlo desde un toque del usuario (regla de Chrome)
    async conectar() {
      if (!BleTransport.disponible()) throw new Error('Este navegador no tiene Bluetooth web. Usa Chrome en Android o en la compu.');
      this.quieroConectado = true;
      this._estado('buscando');
      try {
        this.dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [MD.P.SERVICIO] }] });
      } catch (e) { this.quieroConectado = false; this._estado('desconectado', e.name === 'NotFoundError' ? 'No elegiste ningun dispositivo' : String(e.message || e)); throw e; }
      this.dev.removeEventListener('gattserverdisconnected', this._alDesconectar);
      this.dev.addEventListener('gattserverdisconnected', this._alDesconectar);
      await this._abrir();
    }
    async _abrir() {
      this._estado('conectando');
      try {
        const srv = await this.dev.gatt.connect();
        const svc = await srv.getPrimaryService(MD.P.SERVICIO);
        this.rx = await svc.getCharacteristic(MD.P.RX);
        this.tx = await svc.getCharacteristic(MD.P.TX);
        this.tx.removeEventListener('characteristicvaluechanged', this._alNotificar);
        this._alNotificar = (ev) => { const v = ev.target.value; this.onFrame(new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice()); };
        this.tx.addEventListener('characteristicvaluechanged', this._alNotificar);
        await this.tx.startNotifications();
        this.reintentos = 0; this.cola = [];
        this._estado('conectado');
        this.onConectado();
      } catch (e) {
        this._estado('desconectado', String(e.message || e));
        this._perdida();
      }
    }
    _perdida() {
      if (this.estado === 'conectado') this._estado('desconectado', 'Se perdio la conexion');
      if (!this.quieroConectado || !this.dev) return;
      // reintenta solo, con pausas cada vez mas largas (hasta 8 s)
      const espera = Math.min(8000, 800 * Math.pow(1.6, this.reintentos++));
      clearTimeout(this._t);
      this._t = setTimeout(() => { if (this.quieroConectado && this.estado !== 'conectado' && this.estado !== 'conectando') this._abrir(); }, espera);
    }
    desconectar() {
      this.quieroConectado = false; clearTimeout(this._t);
      try { if (this.dev && this.dev.gatt.connected) this.dev.gatt.disconnect(); } catch (e) {}
      this._estado('desconectado');
    }
    get conectado() { return this.estado === 'conectado'; }

    // Manda una trama (Uint8Array <= 20 bytes). Se hacen de a una, en orden.
    send(trama) { if (!this.conectado) return; this.cola.push(trama); this._vaciar(); }
    sendVarias(tramas) { tramas.forEach(t => this.send(t)); }
    async _vaciar() {
      if (this.escribiendo) return;
      this.escribiendo = true;
      while (this.cola.length && this.conectado) {
        const t = this.cola.shift();
        try { await (this.rx.writeValueWithoutResponse ? this.rx.writeValueWithoutResponse(t) : this.rx.writeValue(t)); }
        catch (e) {
          // el Bluetooth a veces esta ocupado: se reintenta una vez
          try { await new Promise(r => setTimeout(r, 30)); await this.rx.writeValue(t); } catch (e2) { break; }
        }
        await new Promise(r => setTimeout(r, 6));
      }
      this.escribiendo = false;
    }
  }
  MD.BleTransport = BleTransport;
})(window.MD);
