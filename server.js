// Standalone Zero-Build Server for StorePulse SaaS
// Run directly with: node server.js
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const { initDatabase, getDb } = require('./database');
const { createRoutes } = require('./routes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Realtime WebSocket Manager
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to StorePulse WebSocket Stream' }));
  ws.on('close', () => clients.delete(ws));
});

function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

async function start() {
  await initDatabase();
  app.use('/api', createRoutes(broadcast));

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`StorePulse SaaS Server running on http://localhost:${PORT}`);
  });
}

start();
