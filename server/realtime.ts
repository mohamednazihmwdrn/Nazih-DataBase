import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Response } from 'express';
import { dbInstance } from './db';

interface ConnectedClient {
  id: string;
  ws?: WebSocket;
  sseRes?: Response;
  connectedAt: Date;
  ip?: string;
  type: 'ws' | 'sse';
  storeId?: string;
  deviceId?: string;
  isAlive?: boolean;
  lastPing?: number;
}

class RealtimeHub {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  // Map<store_id, Set<WebSocket>> for direct multi-tenant store room routing
  private storeConnections: Map<string, Set<{ clientId: string; ws: WebSocket; deviceId?: string }>> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private totalPushedEvents: number = 0;

  init(server: HttpServer) {
    // Support websocket connections specifically on /ws endpoint to avoid interfering with Vite HMR
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const pathname = request.url ? request.url.split('?')[0] : '';
      if (pathname === '/ws') {
        this.wss?.handleUpgrade(request, socket, head, (ws) => {
          this.wss?.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = `ws_${Math.random().toString(36).substring(2, 9)}`;
      const ip = req.socket.remoteAddress || '127.0.0.1';

      let clientStoreId: string | null = null;
      let clientDeviceId: string | null = null;

      const clientObj: ConnectedClient = {
        id: clientId,
        ws,
        connectedAt: new Date(),
        ip,
        type: 'ws',
        isAlive: true,
        lastPing: Date.now(),
      };

      this.clients.set(clientId, clientObj);
      console.log(`[WebSocket] Client connected: ${clientId} (${this.clients.size} active)`);

      // Initial connection greeting
      ws.send(
        JSON.stringify({
          type: 'CONNECTED',
          clientId,
          timestamp: new Date().toISOString(),
          protocol: 'Nazih-Delta-Sync-v2',
          message: 'Connected to Nazih Core Realtime WebSocket Stream (Ultra-Low Latency)',
        })
      );

      ws.on('message', (message: string) => {
        try {
          const payload = JSON.parse(message.toString());
          clientObj.lastPing = Date.now();

          // 1. Store & Device Authentication (AUTH) / Room Subscription
          if (payload.type === 'AUTH' || payload.type === 'SUBSCRIBE_STORE') {
            clientStoreId = payload.store_id || 'STORE_DEFAULT';
            clientDeviceId = payload.device_id || `dev_${clientId}`;

            clientObj.storeId = clientStoreId;
            clientObj.deviceId = clientDeviceId;

            if (!this.storeConnections.has(clientStoreId)) {
              this.storeConnections.set(clientStoreId, new Set());
            }

            const storeSet = this.storeConnections.get(clientStoreId)!;
            // Clean any stale entry for same client
            storeSet.forEach((item) => {
              if (item.clientId === clientId) storeSet.delete(item);
            });
            storeSet.add({ clientId, ws, deviceId: clientDeviceId });

            ws.send(
              JSON.stringify({
                type: 'AUTH_OK',
                store_id: clientStoreId,
                device_id: clientDeviceId,
                protocol: 'WebSocket-WAL-Delta',
                message: 'تم الاتصال بالبث المباشر المخصص للمتجر بنجاح',
                timestamp: new Date().toISOString(),
              })
            );
          }

          // 2. Direct Delta Sync over WebSocket (Zero-overhead synchronization)
          else if (payload.type === 'SYNC_DELTA') {
            const startTs = performance.now();
            const storeId = payload.store_id || clientStoreId || 'STORE_001';
            const deviceId = payload.device_id || clientDeviceId || 'ws_pos_device';
            const mutations = payload.mutations || [];

            if (Array.isArray(mutations) && mutations.length > 0) {
              const syncResult = dbInstance.processV1Sync({
                store_id: storeId,
                device_id: deviceId,
                mutations,
              });

              // Send instant ACK back to the sender
              const latency = Number((performance.now() - startTs).toFixed(2));
              ws.send(
                JSON.stringify({
                  type: 'SYNC_ACK',
                  store_id: storeId,
                  device_id: deviceId,
                  processed_count: syncResult.processed_count,
                  details: syncResult.details,
                  latency_ms: latency,
                  timestamp: new Date().toISOString(),
                })
              );

              // Realtime Broadcast to other devices in the store room (Down-Sync)
              this.broadcastToStore(storeId, deviceId, {
                event: 'DELTA_APPLIED',
                device_id: deviceId,
                mutations,
                created_invoices: syncResult.created_invoices,
              }, true);

              // Broadcast new invoices globally to dashboards
              for (const inv of syncResult.created_invoices) {
                this.broadcast('NEW_INVOICE', {
                  invoice: inv,
                  items: inv.items || [],
                  store: { id: storeId, name: storeId },
                  is_realtime_ws: true,
                  device_id: deviceId,
                });
              }
            }
          }

          // 3. Heartbeat Ping / Pong
          else if (payload.type === 'PING') {
            clientObj.isAlive = true;
            ws.send(JSON.stringify({
              type: 'PONG',
              timestamp: new Date().toISOString(),
              server_time: Date.now(),
              active_peers: this.clients.size,
            }));
          }
        } catch (err) {
          console.error('[WebSocket] Error parsing message frame:', err);
        }
      });

      ws.on('pong', () => {
        clientObj.isAlive = true;
        clientObj.lastPing = Date.now();
      });

      ws.on('close', () => {
        this.clients.delete(clientId);

        if (clientStoreId && this.storeConnections.has(clientStoreId)) {
          const storeSet = this.storeConnections.get(clientStoreId)!;
          storeSet.forEach((item) => {
            if (item.clientId === clientId) storeSet.delete(item);
          });
          if (storeSet.size === 0) {
            this.storeConnections.delete(clientStoreId);
          }
        }

        console.log(`[WebSocket] Client disconnected: ${clientId} (${this.clients.size} remaining)`);
      });

      ws.on('error', (err) => {
        console.error(`[WebSocket] Error on ${clientId}:`, err);
        this.clients.delete(clientId);
      });
    });

    // 4. Start Heartbeat Timer to prune dead sockets every 20 seconds
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.type === 'ws' && client.ws) {
          if (client.isAlive === false) {
            console.log(`[WebSocket] Terminating inactive socket: ${clientId}`);
            client.ws.terminate();
            this.clients.delete(clientId);
            return;
          }
          client.isAlive = false;
          try {
            client.ws.ping();
          } catch (e) {
            client.ws.terminate();
            this.clients.delete(clientId);
          }
        }
      });
    }, 20000);

    console.log('[Realtime] Ultra-Low Latency WebSocket Hub initialized with Auto-Heartbeat.');
  }

  // --- Broadcast to all clients belonging to the same store (Real-time Down-Sync) ---
  broadcastToStore(
    storeId: string,
    senderDeviceId: string | undefined,
    eventData: any,
    excludeSender: boolean = false
  ): number {
    const clients = this.storeConnections.get(storeId);
    if (!clients || clients.size === 0) return 0;

    const message = JSON.stringify({
      type: 'REALTIME_UPDATE',
      store_id: storeId,
      sender_device_id: senderDeviceId || 'server',
      payload: eventData,
      timestamp: new Date().toISOString(),
    });

    let sentCount = 0;
    clients.forEach((clientItem) => {
      if (excludeSender && senderDeviceId && clientItem.deviceId === senderDeviceId) {
        return; // Skip the device that originally sent the mutation
      }
      if (clientItem.ws && clientItem.ws.readyState === WebSocket.OPEN) {
        clientItem.ws.send(message);
        sentCount++;
      }
    });

    this.totalPushedEvents += sentCount;
    return sentCount;
  }

  // Support for SSE (Server-Sent Events) with optional store filtering
  addSseClient(res: Response, ip?: string, storeId?: string): string {
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
      storeId,
    };

    this.clients.set(clientId, clientObj);
    console.log(`[SSE] Client connected: ${clientId} (${this.clients.size} active)`);

    // Initial event
    res.write(
      `data: ${JSON.stringify({
        type: 'CONNECTED',
        clientId,
        store_id: storeId || 'ALL',
        protocol: 'Server-Sent-Events-Fallback',
        timestamp: new Date().toISOString(),
        message: 'Connected to StorePulse Realtime SSE Stream',
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
        // If client requested specific store, filter
        if (!client.storeId || client.storeId === 'ALL' || payload?.store?.id === client.storeId || payload?.store_id === client.storeId) {
          client.sseRes.write(`data: ${eventString}\n\n`);
          activeCount++;
        }
      }
    });

    this.totalPushedEvents += activeCount;
    return activeCount;
  }

  getActiveClientsCount(): number {
    return this.clients.size;
  }

  getStoreConnectedDevices(storeId: string): number {
    return this.storeConnections.get(storeId)?.size || 0;
  }

  getStats() {
    return {
      active_connections: this.clients.size,
      active_store_rooms: this.storeConnections.size,
      total_pushed_events: this.totalPushedEvents,
      engine: 'Zero-Cost WebSocket & SSE Multiplexing',
    };
  }
}

export const realtimeHub = new RealtimeHub();
