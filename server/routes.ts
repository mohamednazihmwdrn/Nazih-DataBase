import { Router, Request, Response, NextFunction } from 'express';
import { dbInstance, ClientRecord } from './db';
import { realtimeHub } from './realtime';

export const apiRouter = Router();

// Extend Request type to hold client
export interface AuthenticatedRequest extends Request {
  client?: ClientRecord;
}

// --- SUBSCRIPTION & API KEY AUTHENTICATION MIDDLEWARE ---
export function requireApiKeyAndActiveSubscription(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();
  const apiKeyHeader =
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
    req.query.api_key;

  if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
    const latency = Date.now() - startTime;
    dbInstance.logApiRequest({
      endpoint: req.path,
      method: req.method,
      status_code: 401,
      latency_ms: latency,
      ip_address: req.ip,
    });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing API Key in header "x-api-key" or Bearer token',
      code: 'MISSING_API_KEY',
    });
  }

  const client = dbInstance.getClientByApiKey(apiKeyHeader);

  if (!client) {
    const latency = Date.now() - startTime;
    dbInstance.logApiRequest({
      endpoint: req.path,
      method: req.method,
      status_code: 401,
      latency_ms: latency,
      ip_address: req.ip,
    });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid API Key',
      code: 'INVALID_API_KEY',
    });
  }

  // Check Subscription Status
  if (client.status === 'suspended') {
    const latency = Date.now() - startTime;
    dbInstance.logApiRequest({
      store_id: client.store_id,
      endpoint: req.path,
      method: req.method,
      status_code: 403,
      latency_ms: latency,
      ip_address: req.ip,
    });
    return res.status(403).json({
      success: false,
      error: `Subscription Suspended: Store "${client.name}" has been suspended by the administrator.`,
      code: 'SUBSCRIPTION_SUSPENDED',
      store_id: client.store_id,
      status: client.status,
    });
  }

  // Check Expiry Date
  const expiryDate = new Date(client.subscription_expires_at);
  const now = new Date();

  if (expiryDate.getTime() < now.getTime() || client.status === 'expired') {
    const latency = Date.now() - startTime;
    dbInstance.logApiRequest({
      store_id: client.store_id,
      endpoint: req.path,
      method: req.method,
      status_code: 403,
      latency_ms: latency,
      ip_address: req.ip,
    });
    return res.status(403).json({
      success: false,
      error: `Subscription Expired: Subscription for "${client.name}" ended on ${client.subscription_expires_at.split('T')[0]}. Please renew to resume invoice ingestion.`,
      code: 'SUBSCRIPTION_EXPIRED',
      store_id: client.store_id,
      plan: client.plan,
      expired_at: client.subscription_expires_at,
    });
  }

  // Attach verified client
  req.client = client;
  next();
}

// --- OPTIMIZED INVOICE INGESTION ENDPOINT ---
// POST /api/invoices
apiRouter.post('/invoices', requireApiKeyAndActiveSubscription, (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();
  const client = req.client!;
  const body = req.body;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Invalid payload: JSON object expected',
    });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid invoice payload: "items" must be a non-empty array of items',
    });
  }

  try {
    const storeId = body.store_id || client.store_id;

    // Execute single-transaction write
    const result = dbInstance.ingestInvoiceSingleTransaction({
      store_id: storeId,
      invoice_number: body.invoice_number,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      payment_method: body.payment_method || 'card',
      items: body.items,
      tax: body.tax,
      discount: body.discount,
      notes: body.notes,
      timestamp: body.timestamp,
    });

    const latency = Date.now() - startTime;

    // Log request
    dbInstance.logApiRequest({
      store_id: storeId,
      endpoint: '/api/invoices',
      method: 'POST',
      status_code: 201,
      latency_ms: latency,
      ip_address: req.ip,
    });

    // Instant Realtime Broadcast to connected Manager Dashboards via WebSockets/SSE
    realtimeHub.broadcast('NEW_INVOICE', {
      invoice: result.invoice,
      items: result.items,
      store: {
        id: client.store_id,
        name: client.name,
        plan: client.plan,
      },
      stats: {
        total_invoices_ingested: client.total_invoices_ingested + 1,
        total_revenue_ingested: client.total_revenue_ingested + result.invoice.total_amount,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Invoice ingested and committed in single atomic transaction',
      invoice_id: result.invoice.id,
      invoice_number: result.invoice.invoice_number,
      store_id: storeId,
      total_amount: result.invoice.total_amount,
      item_count: result.items.length,
      created_at: result.invoice.created_at,
      processing_time_ms: Number(latency.toFixed(2)),
    });
  } catch (err: any) {
    console.error('Invoice ingestion error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to write invoice to database',
      details: err.message,
    });
  }
});

// --- MANAGER & ANALYTICS ENDPOINTS ---

// GET /api/invoices - Paginated invoice feed
apiRouter.get('/invoices', (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const statusFilter = (req.query.status as any) || 'active';
  const storeId = (req.query.store_id as string) || undefined;
  const search = (req.query.search as string) || undefined;
  const startDate = (req.query.start_date as string) || undefined;
  const endDate = (req.query.end_date as string) || undefined;

  const result = dbInstance.getPaginatedInvoices({
    page,
    limit,
    status_filter: statusFilter,
    store_id: storeId,
    search,
    start_date: startDate,
    end_date: endDate,
  });

  return res.json({
    success: true,
    ...result,
  });
});

// GET /api/invoices/:id - Single invoice lookup
apiRouter.get('/invoices/:id', (req: Request, res: Response) => {
  const invoice = dbInstance.getInvoiceById(req.params.id);
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }
  return res.json({ success: true, invoice });
});

// GET /api/analytics/items-aggregation - Group by item_name across stores
apiRouter.get('/analytics/items-aggregation', (req: Request, res: Response) => {
  const storeId = req.query.store_id as string;
  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;
  const search = req.query.search as string;
  const limit = parseInt(req.query.limit as string) || 50;
  const sortBy = (req.query.sort_by as any) || 'revenue';

  const aggregated = dbInstance.getItemsAggregation({
    store_id: storeId,
    start_date: startDate,
    end_date: endDate,
    search,
    limit,
    sort_by: sortBy,
  });

  return res.json({
    success: true,
    count: aggregated.length,
    items: aggregated,
  });
});

// GET /api/analytics/summary - High-level KPIs
apiRouter.get('/analytics/summary', (req: Request, res: Response) => {
  const stats = dbInstance.getDatabaseStats();
  const clients = dbInstance.getAllClients();
  const recentInvoices = dbInstance.getPaginatedInvoices({ page: 1, limit: 10 }).invoices;
  const topItems = dbInstance.getItemsAggregation({ limit: 5 });

  // Calculate today's sales
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = dbInstance.getPaginatedInvoices({
    page: 1,
    limit: 100,
    start_date: `${todayStr}T00:00:00.000Z`,
  });

  const todayRevenue = todayInvoices.invoices.reduce((acc, curr) => acc + curr.total_amount, 0);

  return res.json({
    success: true,
    summary: {
      total_revenue: stats.total_revenue,
      today_revenue: Number(todayRevenue.toFixed(2)),
      active_invoices_count: stats.active_invoices_count,
      archived_invoices_count: stats.archived_invoices_count,
      total_items_sold: stats.total_items_count,
      active_stores_count: stats.active_clients_count,
      total_stores_count: stats.clients_count,
      connected_dashboards: realtimeHub.getActiveClientsCount(),
      top_items: topItems,
      recent_invoices: recentInvoices,
      stores_overview: clients.map((c) => ({
        id: c.id,
        store_id: c.store_id,
        name: c.name,
        plan: c.plan,
        status: c.status,
        expires_at: c.subscription_expires_at,
        total_invoices: c.total_invoices_ingested,
        total_revenue: c.total_revenue_ingested,
      })),
    },
  });
});

// GET /api/realtime/stream - SSE Stream
apiRouter.get('/realtime/stream', (req: Request, res: Response) => {
  realtimeHub.addSseClient(res, req.ip);
});

// --- SAAS ADMIN & SUBSCRIPTION MANAGEMENT ENDPOINTS ---

// GET /api/admin/clients - List all client stores
apiRouter.get('/admin/clients', (req: Request, res: Response) => {
  const clients = dbInstance.getAllClients();
  return res.json({ success: true, clients });
});

// POST /api/admin/clients - Create a new store client with unique API Key
apiRouter.post('/admin/clients', (req: Request, res: Response) => {
  const { store_id, name, owner_email, plan, status, days_valid, rate_limit } = req.body;

  if (!store_id || !name || !owner_email) {
    return res.status(400).json({
      success: false,
      error: 'store_id, name, and owner_email are required',
    });
  }

  // Check duplicate store_id
  const existing = dbInstance.getClientByStoreId(store_id);
  if (existing) {
    return res.status(409).json({
      success: false,
      error: `Store ID "${store_id}" already exists. Please choose a unique Store ID.`,
    });
  }

  try {
    const created = dbInstance.createClient({
      store_id,
      name,
      owner_email,
      plan: plan || 'pro',
      status: status || 'active',
      days_valid: days_valid ? parseInt(days_valid) : 30,
      rate_limit: rate_limit ? parseInt(rate_limit) : 200,
    });

    return res.status(201).json({
      success: true,
      message: 'Client and API Key created successfully',
      client: created,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/admin/clients/:id - Update client / extend subscription
apiRouter.put('/admin/clients/:id', (req: Request, res: Response) => {
  const { name, owner_email, plan, status, subscription_expires_at, add_days, rate_limit_per_minute } = req.body;

  const updated = dbInstance.updateClient(req.params.id, {
    name,
    owner_email,
    plan,
    status,
    subscription_expires_at,
    add_days: add_days ? parseInt(add_days) : undefined,
    rate_limit_per_minute: rate_limit_per_minute ? parseInt(rate_limit_per_minute) : undefined,
  });

  if (!updated) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }

  return res.json({
    success: true,
    message: 'Client updated successfully',
    client: updated,
  });
});

// POST /api/admin/clients/:id/regenerate-key - Issue a new API key
apiRouter.post('/admin/clients/:id/regenerate-key', (req: Request, res: Response) => {
  const newKey = dbInstance.regenerateApiKey(req.params.id);
  if (!newKey) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }
  return res.json({
    success: true,
    message: 'API Key regenerated successfully',
    new_api_key: newKey,
  });
});

// DELETE /api/admin/clients/:id - Revoke & Delete client
apiRouter.delete('/admin/clients/:id', (req: Request, res: Response) => {
  const ok = dbInstance.deleteClient(req.params.id);
  if (!ok) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }
  return res.json({ success: true, message: 'Client and API key revoked and removed' });
});

// POST /api/admin/archive - Trigger Auto-Archiving
apiRouter.post('/admin/archive', (req: Request, res: Response) => {
  const daysThreshold = parseInt(req.body.days_threshold) || 30;
  try {
    const result = dbInstance.archiveOldInvoices(daysThreshold);
    return res.json({
      success: true,
      message: `Archived ${result.archived_count} invoices older than ${daysThreshold} days.`,
      result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/vacuum - Reclaim SQLite Storage
apiRouter.post('/admin/vacuum', (req: Request, res: Response) => {
  try {
    const result = dbInstance.vacuumDatabase();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/system-stats and /api/admin/stats - Detailed Storage & System Metrics
const getSystemStatsHandler = (req: Request, res: Response) => {
  const stats = dbInstance.getDatabaseStats();
  const mem = process.memoryUsage();

  return res.json({
    success: true,
    database: stats,
    server: {
      uptime_seconds: Math.floor(process.uptime()),
      memory_rss_mb: Number((mem.rss / (1024 * 1024)).toFixed(2)),
      memory_heap_used_mb: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
      connected_dashboards: realtimeHub.getActiveClientsCount(),
      node_version: process.version,
    },
  });
};

apiRouter.get('/admin/system-stats', getSystemStatsHandler);
apiRouter.get('/admin/stats', getSystemStatsHandler);

// GET /api/admin/logs - Recent API Request Logs
apiRouter.get('/admin/logs', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 30;
  const logs = dbInstance.getRecentLogs(limit);
  return res.json({ success: true, logs });
});

// GET /api/admin/tables - Database Schema and Table list
apiRouter.get('/admin/tables', (req: Request, res: Response) => {
  const tables = dbInstance.getTableSchemaInfo();
  return res.json({ success: true, tables });
});

// POST /api/admin/sql-query - Safe SQL Execution Runner
apiRouter.post('/api/admin/sql-query', (req: Request, res: Response) => {
  const query = req.body.query;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ success: false, error: 'استعلام SQL مطلوب' });
  }
  const result = dbInstance.executeSafeSqlQuery(query);
  return res.json(result);
});

apiRouter.post('/admin/sql-query', (req: Request, res: Response) => {
  const query = req.body.query;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ success: false, error: 'استعلام SQL مطلوب' });
  }
  const result = dbInstance.executeSafeSqlQuery(query);
  return res.json(result);
});

// GET /api/admin/export/:store_id - Full Standalone Client Data Export
apiRouter.get('/admin/export/:store_id', (req: Request, res: Response) => {
  const storeId = req.params.store_id;
  const exportData = dbInstance.getStoreExportData(storeId);
  if (!exportData) {
    return res.status(404).json({ success: false, error: `المتجر "${storeId}" غير موجود` });
  }

  const format = req.query.format as string;
  if (format === 'csv') {
    // Generate CSV of active invoices
    const headers = 'id,store_id,invoice_number,customer_name,payment_method,total_amount,item_count,created_at\n';
    const rows = exportData.active_invoices
      .map(
        (inv: any) =>
          `"${inv.id}","${inv.store_id}","${inv.invoice_number}","${inv.customer_name || ''}","${inv.payment_method}",${inv.total_amount},${inv.item_count},"${inv.created_at}"`
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=client_${storeId}_invoices.csv`);
    return res.send(headers + rows);
  }

  if (format === 'sql') {
    // Generate SQL Insert Dump
    let sqlDump = `-- StorePulse Client SQL Dump for store: ${storeId}\n-- Exported At: ${exportData.exported_at}\n\n`;
    sqlDump += `CREATE TABLE IF NOT EXISTS client_${storeId}_invoices (\n  id TEXT PRIMARY KEY,\n  invoice_number TEXT,\n  customer_name TEXT,\n  total_amount REAL,\n  payment_method TEXT,\n  created_at TEXT\n);\n\n`;
    exportData.active_invoices.forEach((inv: any) => {
      sqlDump += `INSERT INTO client_${storeId}_invoices (id, invoice_number, customer_name, total_amount, payment_method, created_at) VALUES ('${inv.id}', '${inv.invoice_number}', '${(inv.customer_name || '').replace(/'/g, "''")}', ${inv.total_amount}, '${inv.payment_method}', '${inv.created_at}');\n`;
    });
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename=client_${storeId}_dump.sql`);
    return res.send(sqlDump);
  }

  return res.json({ success: true, ...exportData });
});

// GET /api/client/portal/:store_id - Full Client Specific Portal Bundle
apiRouter.get('/client/portal/:store_id', (req: Request, res: Response) => {
  const storeId = req.params.store_id;
  const client = dbInstance.getClientByStoreId(storeId);
  if (!client) {
    return res.status(404).json({ success: false, error: 'المتجر غير موجود' });
  }

  const invoicesResult = dbInstance.getPaginatedInvoices({
    store_id: storeId,
    page: 1,
    limit: 25,
    status_filter: 'all',
  });

  const topItems = dbInstance.getItemsAggregation({
    store_id: storeId,
    limit: 10,
    sort_by: 'revenue',
  });

  return res.json({
    success: true,
    client,
    invoices: invoicesResult.invoices,
    pagination: {
      total_count: invoicesResult.total_count,
      total_pages: invoicesResult.total_pages,
      page: invoicesResult.page,
      limit: invoicesResult.limit,
    },
    top_items: topItems,
  });
});

// --- SANDBOX & SIMULATION HELPERS ---

// POST /api/sandbox/simulate-invoice - Helper for UI testing
apiRouter.post('/sandbox/simulate-invoice', (req: Request, res: Response) => {
  const clients = dbInstance.getAllClients().filter((c) => c.status === 'active');
  if (clients.length === 0) {
    return res.status(400).json({ success: false, error: 'No active clients available' });
  }

  const client = req.body.store_id
    ? clients.find((c) => c.store_id === req.body.store_id) || clients[0]
    : clients[Math.floor(Math.random() * clients.length)];

  const sampleItemsList = [
    { item_name: 'Iced Caramel Macchiato', category: 'Beverages', unit_price: 5.25 },
    { item_name: 'Toasted Almond Croissant', category: 'Bakery', unit_price: 4.10 },
    { item_name: 'Double Cheeseburger Deluxe', category: 'Food', unit_price: 12.50 },
    { item_name: 'Super Green Smoothie', category: 'Beverages', unit_price: 6.95 },
    { item_name: 'Artisan Espresso Beans 250g', category: 'Retail', unit_price: 16.00 },
  ];

  const picked = sampleItemsList[Math.floor(Math.random() * sampleItemsList.length)];
  const qty = 1 + Math.floor(Math.random() * 3);

  const result = dbInstance.ingestInvoiceSingleTransaction({
    store_id: client.store_id,
    customer_name: `Simulator Customer #${Math.floor(Math.random() * 900 + 100)}`,
    payment_method: ['card', 'cash', 'qr'][Math.floor(Math.random() * 3)],
    items: [
      {
        item_name: picked.item_name,
        category: picked.category,
        quantity: qty,
        unit_price: picked.unit_price,
        total_price: Number((qty * picked.unit_price).toFixed(2)),
      },
    ],
    tax: Number((qty * picked.unit_price * 0.08).toFixed(2)),
    notes: 'Simulated live event via sandbox trigger',
  });

  realtimeHub.broadcast('NEW_INVOICE', {
    invoice: result.invoice,
    items: result.items,
    store: {
      id: client.store_id,
      name: client.name,
      plan: client.plan,
    },
    stats: {
      total_invoices_ingested: client.total_invoices_ingested + 1,
      total_revenue_ingested: client.total_revenue_ingested + result.invoice.total_amount,
    },
  });

  return res.json({
    success: true,
    message: `Simulated invoice created for ${client.name}`,
    invoice: result.invoice,
  });
});

// POST /api/admin/reset-data - Wipe all demo records for clean real production start
apiRouter.post('/admin/reset-data', (req: Request, res: Response) => {
  const success = dbInstance.wipeAllData();
  if (success) {
    return res.json({
      success: true,
      message: 'تم حذف كافة البيانات الوهمية بنجاح. قاعدة بيانات Nazih Core الآن نظيفة 100% وجاهزة لاستقبال العملاء الحقيقيين.',
    });
  } else {
    return res.status(500).json({ success: false, error: 'فشل في مسح البيانات' });
  }
});

