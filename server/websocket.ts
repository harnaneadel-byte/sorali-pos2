import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { TerminalDevice } from '../src/types.js';

interface ClientConnection {
  ws: WebSocket;
  terminalId: string;
  terminalName: string;
  role: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'telegram';
  isAlive: boolean;
}

class RealtimeSyncServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientConnection> = new Map();

  public init(server: HTTPServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientIp = req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || '';
      const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
      const isTelegram = /telegram/i.test(userAgent);

      const defaultTerminalId = `term_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const defaultTerminal: ClientConnection = {
        ws,
        terminalId: defaultTerminalId,
        terminalName: isTelegram
          ? 'Telegram Mini App'
          : isMobile
          ? 'Terminal Mobile'
          : 'Poste Principal Desktop',
        role: 'Cashier',
        deviceType: isTelegram ? 'telegram' : isMobile ? 'mobile' : 'desktop',
        isAlive: true,
      };

      this.clients.set(ws, defaultTerminal);
      this.updateTerminalRecord(defaultTerminal);

      // Send initial connection welcome & presence
      ws.send(
        JSON.stringify({
          type: 'connected',
          terminalId: defaultTerminalId,
          timestamp: new Date().toISOString(),
          activeTerminals: Array.from(db.terminals.values()),
        })
      );

      this.broadcastPresence();

      ws.on('message', (messageRaw: string) => {
        try {
          const data = JSON.parse(messageRaw.toString());
          if (data.type === 'ping') {
            const client = this.clients.get(ws);
            if (client) client.isAlive = true;
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            return;
          }

          if (data.type === 'register_terminal') {
            const client = this.clients.get(ws);
            if (client) {
              client.terminalId = data.terminalId || client.terminalId;
              client.terminalName = data.terminalName || client.terminalName;
              client.role = data.role || client.role;
              client.deviceType = data.deviceType || client.deviceType;
              this.updateTerminalRecord(client);
              this.broadcastPresence();
            }
          }

          if (data.type === 'route_change') {
            const client = this.clients.get(ws);
            if (client) {
              const record = db.terminals.get(client.terminalId);
              if (record) {
                record.current_route = data.route;
                record.last_active = new Date().toISOString();
              }
            }
          }
        } catch (e) {
          // Ignore invalid messages
        }
      });

      ws.on('close', () => {
        const client = this.clients.get(ws);
        if (client) {
          db.terminals.delete(client.terminalId);
          this.clients.delete(ws);
          this.broadcastPresence();
        }
      });

      ws.on('error', () => {
        const client = this.clients.get(ws);
        if (client) {
          db.terminals.delete(client.terminalId);
          this.clients.delete(ws);
        }
      });
    });

    // Heartbeat check every 30 seconds
    setInterval(() => {
      this.clients.forEach((client, ws) => {
        if (!client.isAlive) {
          db.terminals.delete(client.terminalId);
          this.clients.delete(ws);
          return ws.terminate();
        }
        client.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  private updateTerminalRecord(client: ClientConnection) {
    const record: TerminalDevice = {
      id: client.terminalId,
      name: client.terminalName,
      role: client.role as any,
      type: client.deviceType,
      is_online: true,
      last_active: new Date().toISOString(),
    };
    db.terminals.set(client.terminalId, record);
  }

  private broadcastPresence() {
    const terminals = Array.from(db.terminals.values());
    this.broadcast('presence:update', { terminals });
  }

  public broadcast(type: string, payload: any, sourceTerminalId?: string) {
    if (!this.wss) return;
    const msg = JSON.stringify({
      type,
      payload,
      sourceTerminalId,
      timestamp: new Date().toISOString(),
    });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }
}

export const realtimeSync = new RealtimeSyncServer();
