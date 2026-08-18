import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Response } from 'express';

interface ConnectedClient {
  id: string;
  ws?: WebSocket;
  sseRes?: Response;
  connectedAt: Date;
  ip?: string;
  type: 'ws' | 'sse';
}

class RealtimeHub {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();

  init(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = `ws_${Math.random().toString(36).substring(2, 9)}`;
      const ip = req.socket.remoteAddress || '127.0.0.1';

      const clientObj: ConnectedClient = {
        id: clientId,
        ws,
        connectedAt: new Date(),
        ip,
        type: 'ws',
      };

      this.clients.set(clientId, clientObj);
      console.log(`[WebSocket] Client connected: ${clientId} (${this.clients.size} active)`);

      // Send initial handshake
      ws.send(
        JSON.stringify({
          type: 'CONNECTED',
          clientId,
          timestamp: new Date().toISOString(),
          message: 'Connected to StorePulse Realtime Stream',
        })
      );

      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
          }
        } catch (e) {
          // Ignore invalid frames
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`[WebSocket] Client disconnected: ${clientId} (${this.clients.size} remaining)`);
      });

      ws.on('error', (err) => {
        console.error(`[WebSocket] Error on ${clientId}:`, err);
        this.clients.delete(clientId);
      });
    });

    console.log('[Realtime] WebSocket server initialized on /ws');
  }

  // Support for SSE (Server-Sent Events)
  addSseClient(res: Response, ip?: string): string {
    const clientId = `sse_${Math.random().toString(36).substring(2, 9)}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const clientObj: ConnectedClient = {
      id: clientId,
      sseRes: res,
      connectedAt: new Date(),
      ip,
      type: 'sse',
    };

    this.clients.set(clientId, clientObj);
    console.log(`[SSE] Client connected: ${clientId} (${this.clients.size} active)`);

    // Initial event
    res.write(
      `data: ${JSON.stringify({
        type: 'CONNECTED',
        clientId,
        timestamp: new Date().toISOString(),
        message: 'Connected to StorePulse SSE Stream',
      })}\n\n`
    );

    res.on('close', () => {
      this.clients.delete(clientId);
      console.log(`[SSE] Client disconnected: ${clientId} (${this.clients.size} remaining)`);
    });

    return clientId;
  }

  broadcast(type: string, payload: any) {
    const eventString = JSON.stringify({
      type,
      payload,
      timestamp: new Date().toISOString(),
    });

    let activeCount = 0;
    this.clients.forEach((client) => {
      if (client.type === 'ws' && client.ws && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(eventString);
        activeCount++;
      } else if (client.type === 'sse' && client.sseRes) {
        client.sseRes.write(`data: ${eventString}\n\n`);
        activeCount++;
      }
    });

    return activeCount;
  }

  getActiveClientsCount(): number {
    return this.clients.size;
  }
}

export const realtimeHub = new RealtimeHub();
