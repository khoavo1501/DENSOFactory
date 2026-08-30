// Reconnecting WebSocket client for /ws/devices?device_id=...
// Uses exponential backoff (1s -> 30s cap).

export type WsStatus = "idle" | "connecting" | "open" | "closed" | "error";

export type WsHandler = (msg: unknown) => void;
export type WsStatusHandler = (s: WsStatus) => void;

export class ReconnectingWs {
  private url: string;
  private ws: WebSocket | null = null;
  private handlers = new Set<WsHandler>();
  private statusHandlers = new Set<WsStatusHandler>();
  private status: WsStatus = "idle";
  private backoff = 1.0;
  private reconnectTimer: number | null = null;
  private intentionallyClosed = false;

  constructor(deviceId: string | "*") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;
    this.url = `${proto}://${host}/ws/devices?device_id=${encodeURIComponent(deviceId)}`;
  }

  start() {
    this.intentionallyClosed = false;
    this.connect();
  }

  stop() {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("closed");
  }

  onMessage(h: WsHandler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  onStatus(h: WsStatusHandler) {
    this.statusHandlers.add(h);
    h(this.status);
    return () => this.statusHandlers.delete(h);
  }

  private setStatus(s: WsStatus) {
    if (this.status === s) return;
    this.status = s;
    this.statusHandlers.forEach((h) => h(s));
  }

  private connect() {
    this.setStatus("connecting");
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      console.error("WS construct error", e);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.backoff = 1.0;
      this.setStatus("open");
    };

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        this.handlers.forEach((h) => h(data));
      } catch (e) {
        console.warn("WS message parse failed", e);
      }
    };

    this.ws.onerror = () => {
      this.setStatus("error");
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.intentionallyClosed) {
        this.setStatus("closed");
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.backoff = Math.min(this.backoff * 2, 30.0);
      this.connect();
    }, this.backoff * 1000);
  }
}
