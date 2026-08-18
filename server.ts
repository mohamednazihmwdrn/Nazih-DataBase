import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { dbInstance } from './server/db';
import { realtimeHub } from './server/realtime';
import { apiRouter } from './server/routes';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  // 1. Initialize SQLite Database
  console.log('[Database] Initializing SQLite file-persisted engine...');
  await dbInstance.init();
  console.log('[Database] SQLite initialized successfully.');

  // 2. Initialize Realtime WebSocket Server on the same HTTP server
  realtimeHub.init(server);

  // 3. Global Middlewares
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Serve Public Directory (Raw HTML/JS Dashboards)
  const publicDir = path.join(process.cwd(), 'public');
  app.use(express.static(publicDir));

  // Healthcheck endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      system: 'StorePulse Self-Hosted SaaS Engine',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // 5. Mount API Routes
  app.use('/api', apiRouter);

  // Catch-all 404 for API routes so they always return JSON
  app.use('/api', (req, res) => {
    res.status(404).json({
      success: false,
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // 6. Vite middleware for React Frontend in development / Static in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 StorePulse SaaS Engine running on http://0.0.0.0:${PORT}`);
    console.log(`📡 WebSocket Stream: ws://localhost:${PORT}/ws`);
    console.log(`📊 Pure HTML Manager Dashboard: http://localhost:${PORT}/manager.html`);
    console.log(`🔑 Pure HTML Admin Dashboard:   http://localhost:${PORT}/admin.html`);
    console.log(`🛒 Pure HTML POS & API Tester:  http://localhost:${PORT}/pos-tester.html`);
    console.log(`📚 Deployment & VPS Guide:      http://localhost:${PORT}/deployment.html`);
    console.log(`====================================================`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Server Startup Error:', err);
  process.exit(1);
});
