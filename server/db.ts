import fs from 'fs';
import path from 'path';
import initSqlJs, { Database, QueryExecResult } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';

export interface ClientRecord {
  id: string;
  store_id: string;
  name: string;
  owner_email: string;
  api_key: string;
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'expired' | 'trial';
  subscription_expires_at: string;
  rate_limit_per_minute: number;
  total_invoices_ingested: number;
  total_revenue_ingested: number;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  store_id?: string;
  item_name: string;
  category?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at?: string;
}

export interface InvoiceRecord {
  id: string;
  store_id: string;
  invoice_number: string;
  customer_name?: string;
  customer_phone?: string;
  payment_method: 'cash' | 'card' | 'online' | 'qr' | 'credit' | string;
  subtotal: number;
  tax: number;
  discount: number;
  total_amount: number;
  item_count: number;
  raw_payload?: string;
  notes?: string;
  status: 'completed' | 'refunded' | 'void';
  created_at: string;
  archived_at?: string | null;
  items?: InvoiceItem[];
}

export interface ItemAggregation {
  item_name: string;
  category: string;
  total_quantity: number;
  total_revenue: number;
  avg_unit_price: number;
  order_count: number;
  min_date: string;
  max_date: string;
}

class StorePulseDatabase {
  private db: Database | null = null;
  private dbPath: string;
  private dataDir: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.dbPath = path.join(this.dataDir, 'storepulse.db');
  }

  async init() {
    if (this.db) return this.db;

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();
    this.seedInitialData();
    this.persistToDiskNow();
    return this.db;
  }

  private persistToDisk() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.persistToDiskNow();
    }, 150);
  }

  private persistToDiskNow() {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err) {
      console.error('Failed to persist SQLite DB to disk:', err);
    }
  }

  private createTables() {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        store_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        owner_email TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        plan TEXT NOT NULL DEFAULT 'pro',
        status TEXT NOT NULL DEFAULT 'active',
        subscription_expires_at TEXT NOT NULL,
        rate_limit_per_minute INTEGER DEFAULT 120,
        total_invoices_ingested INTEGER DEFAULT 0,
        total_revenue_ingested REAL DEFAULT 0.0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_clients_api_key ON clients(api_key);
      CREATE INDEX IF NOT EXISTS idx_clients_store_id ON clients(store_id);

      CREATE TABLE IF NOT EXISTS active_invoices (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        payment_method TEXT NOT NULL DEFAULT 'card',
        subtotal REAL NOT NULL DEFAULT 0.0,
        tax REAL NOT NULL DEFAULT 0.0,
        discount REAL NOT NULL DEFAULT 0.0,
        total_amount REAL NOT NULL DEFAULT 0.0,
        item_count INTEGER NOT NULL DEFAULT 0,
        raw_payload TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TEXT NOT NULL,
        archived_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_active_inv_store ON active_invoices(store_id);
      CREATE INDEX IF NOT EXISTS idx_active_inv_created ON active_invoices(created_at);
      CREATE INDEX IF NOT EXISTS idx_active_inv_number ON active_invoices(invoice_number);

      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        quantity REAL NOT NULL DEFAULT 1.0,
        unit_price REAL NOT NULL DEFAULT 0.0,
        total_price REAL NOT NULL DEFAULT 0.0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_items_invoice ON invoice_items(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_items_store ON invoice_items(store_id);
      CREATE INDEX IF NOT EXISTS idx_items_name ON invoice_items(item_name);
      CREATE INDEX IF NOT EXISTS idx_items_created ON invoice_items(created_at);

      CREATE TABLE IF NOT EXISTS archived_invoices (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        payment_method TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL,
        discount REAL NOT NULL,
        total_amount REAL NOT NULL,
        item_count INTEGER NOT NULL,
        raw_payload TEXT,
        notes TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        archived_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_archived_inv_store ON archived_invoices(store_id);
      CREATE INDEX IF NOT EXISTS idx_archived_inv_created ON archived_invoices(created_at);

      CREATE TABLE IF NOT EXISTS archived_invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_archived_items_inv ON archived_invoice_items(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_archived_items_name ON archived_invoice_items(item_name);

      CREATE TABLE IF NOT EXISTS api_logs (
        id TEXT PRIMARY KEY,
        store_id TEXT,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        latency_ms REAL NOT NULL,
        ip_address TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_logs_created ON api_logs(created_at);
    `);
  }

  private seedInitialData() {
    if (!this.db) return;
    // Pure production database initialization - Zero fake/mock data
    console.log('[Nazih Core / MNDB] Database tables verified and ready for real client registration.');
  }

  wipeAllData(): boolean {
    if (!this.db) return false;
    try {
      this.db.run(`DELETE FROM invoice_items;`);
      this.db.run(`DELETE FROM active_invoices;`);
      this.db.run(`DELETE FROM archived_invoice_items;`);
      this.db.run(`DELETE FROM archived_invoices;`);
      this.db.run(`DELETE FROM api_logs;`);
      this.db.run(`DELETE FROM clients;`);
      this.persistToDiskNow();
      console.log('[Nazih Core / MNDB] All database records successfully wiped to clean state.');
      return true;
    } catch (err) {
      console.error('Failed to wipe database:', err);
      return false;
    }
  }

  // --- API KEY AUTHENTICATION & SUBSCRIPTION CHECK ---
  getClientByApiKey(apiKey: string): ClientRecord | null {
    if (!this.db || !apiKey) return null;
    const stmt = this.db.prepare(`SELECT * FROM clients WHERE api_key = :key`);
    stmt.bind({ ':key': apiKey.trim() });
    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as ClientRecord;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  getClientByStoreId(storeId: string): ClientRecord | null {
    if (!this.db || !storeId) return null;
    const stmt = this.db.prepare(`SELECT * FROM clients WHERE store_id = :sid`);
    stmt.bind({ ':sid': storeId.trim() });
    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as ClientRecord;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  getAllClients(): ClientRecord[] {
    if (!this.db) return [];
    const results = this.db.exec(`SELECT * FROM clients ORDER BY created_at DESC`);
    if (!results || results.length === 0) return [];
    const columns = results[0].columns;
    return results[0].values.map((val) => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = val[idx];
      });
      return obj as ClientRecord;
    });
  }

  createClient(data: {
    store_id: string;
    name: string;
    owner_email: string;
    plan?: 'starter' | 'pro' | 'enterprise';
    status?: 'active' | 'suspended' | 'trial';
    days_valid?: number;
    rate_limit?: number;
  }): ClientRecord {
    if (!this.db) throw new Error('Database not initialized');

    const id = `cli_${uuidv4().substring(0, 8)}`;
    const prefix = data.store_id.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 6);
    const randomHex = uuidv4().replace(/-/g, '').substring(0, 16);
    const apiKey = `sk_live_${prefix}_${randomHex}`;
    const now = new Date();
    const days = data.days_valid || 30;
    const expiry = new Date(now.getTime() + days * 86400000).toISOString();
    const plan = data.plan || 'pro';
    const status = data.status || 'active';
    const rateLimit = data.rate_limit || 200;

    this.db.run(
      `INSERT INTO clients (id, store_id, name, owner_email, api_key, plan, status, subscription_expires_at, rate_limit_per_minute, total_invoices_ingested, total_revenue_ingested, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.store_id.trim().toUpperCase(),
        data.name.trim(),
        data.owner_email.trim(),
        apiKey,
        plan,
        status,
        expiry,
        rateLimit,
        0,
        0.0,
        now.toISOString(),
        now.toISOString(),
      ]
    );

    this.persistToDisk();
    return this.getClientByStoreId(data.store_id)!;
  }

  updateClient(id: string, updates: Partial<ClientRecord> & { add_days?: number }): ClientRecord | null {
    if (!this.db) return null;

    const current = this.getAllClients().find((c) => c.id === id);
    if (!current) return null;

    let newExpiry = current.subscription_expires_at;
    if (updates.add_days) {
      const base = new Date(current.subscription_expires_at).getTime() > Date.now()
        ? new Date(current.subscription_expires_at)
        : new Date();
      newExpiry = new Date(base.getTime() + updates.add_days * 86400000).toISOString();
    } else if (updates.subscription_expires_at) {
      newExpiry = updates.subscription_expires_at;
    }

    const name = updates.name !== undefined ? updates.name : current.name;
    const owner_email = updates.owner_email !== undefined ? updates.owner_email : current.owner_email;
    const plan = updates.plan !== undefined ? updates.plan : current.plan;
    const status = updates.status !== undefined ? updates.status : current.status;
    const rate_limit = updates.rate_limit_per_minute !== undefined ? updates.rate_limit_per_minute : current.rate_limit_per_minute;
    const now = new Date().toISOString();

    this.db.run(
      `UPDATE clients SET name = ?, owner_email = ?, plan = ?, status = ?, subscription_expires_at = ?, rate_limit_per_minute = ?, updated_at = ? WHERE id = ?`,
      [name, owner_email, plan, status, newExpiry, rate_limit, now, id]
    );

    this.persistToDisk();
    return this.getAllClients().find((c) => c.id === id) || null;
  }

  regenerateApiKey(clientId: string): string | null {
    if (!this.db) return null;
    const client = this.getAllClients().find((c) => c.id === clientId);
    if (!client) return null;

    const prefix = client.store_id.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 6);
    const newApiKey = `sk_live_${prefix}_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    const now = new Date().toISOString();

    this.db.run(`UPDATE clients SET api_key = ?, updated_at = ? WHERE id = ?`, [newApiKey, now, clientId]);
    this.persistToDisk();
    return newApiKey;
  }

  deleteClient(clientId: string): boolean {
    if (!this.db) return false;
    this.db.run(`DELETE FROM clients WHERE id = ?`, [clientId]);
    this.persistToDisk();
    return true;
  }

  // --- SINGLE TRANSACTION INVOICE INGESTION ---
  ingestInvoiceSingleTransaction(payload: {
    store_id: string;
    invoice_number?: string;
    customer_name?: string;
    customer_phone?: string;
    payment_method?: string;
    items: Array<{
      item_name: string;
      category?: string;
      quantity?: number;
      unit_price?: number;
      total_price?: number;
    }>;
    tax?: number;
    discount?: number;
    notes?: string;
    timestamp?: string;
  }): { invoice: InvoiceRecord; items: InvoiceItem[] } {
    if (!this.db) throw new Error('Database not initialized');

    const now = payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString();
    const invoiceId = `inv_${uuidv4().substring(0, 8)}`;
    const invoiceNumber =
      payload.invoice_number || `INV-${payload.store_id.substring(0, 6)}-${Date.now().toString().slice(-6)}`;

    // Calculate totals safely
    let calculatedSubtotal = 0;
    const parsedItems: InvoiceItem[] = [];

    for (const rawItem of payload.items || []) {
      const name = (rawItem.item_name || 'Standard Item').trim();
      const cat = (rawItem.category || 'General').trim();
      const qty = Number(rawItem.quantity) > 0 ? Number(rawItem.quantity) : 1;
      const unit = Number(rawItem.unit_price) >= 0 ? Number(rawItem.unit_price) : 0;
      const lineTotal = rawItem.total_price !== undefined ? Number(rawItem.total_price) : Number((qty * unit).toFixed(2));

      calculatedSubtotal += lineTotal;

      parsedItems.push({
        id: `item_${uuidv4().substring(0, 8)}`,
        invoice_id: invoiceId,
        store_id: payload.store_id,
        item_name: name,
        category: cat,
        quantity: qty,
        unit_price: unit,
        total_price: lineTotal,
        created_at: now,
      });
    }

    const tax = Number(payload.tax) >= 0 ? Number(payload.tax) : 0;
    const discount = Number(payload.discount) >= 0 ? Number(payload.discount) : 0;
    const totalAmount = Number((calculatedSubtotal + tax - discount).toFixed(2));
    const paymentMethod = payload.payment_method || 'card';

    // ATOMIC TRANSACTION: Ingest Invoice + Items + Update Client Counters
    try {
      this.db.exec('BEGIN TRANSACTION;');

      // 1. Insert Invoice
      this.db.run(
        `INSERT INTO active_invoices (id, store_id, invoice_number, customer_name, customer_phone, payment_method, subtotal, tax, discount, total_amount, item_count, raw_payload, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          payload.store_id,
          invoiceNumber,
          payload.customer_name || 'Walk-in Customer',
          payload.customer_phone || '',
          paymentMethod,
          calculatedSubtotal,
          tax,
          discount,
          totalAmount,
          parsedItems.length,
          JSON.stringify(payload),
          payload.notes || '',
          'completed',
          now,
        ]
      );

      // 2. Batch Insert Items
      for (const it of parsedItems) {
        this.db.run(
          `INSERT INTO invoice_items (id, invoice_id, store_id, item_name, category, quantity, unit_price, total_price, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            it.id,
            it.invoice_id,
            it.store_id,
            it.item_name,
            it.category,
            it.quantity,
            it.unit_price,
            it.total_price,
            it.created_at,
          ]
        );
      }

      // 3. Update Client totals
      this.db.run(
        `UPDATE clients SET total_invoices_ingested = total_invoices_ingested + 1, total_revenue_ingested = total_revenue_ingested + ?, updated_at = ? WHERE store_id = ?`,
        [totalAmount, now, payload.store_id]
      );

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    this.persistToDisk();

    const createdInvoice: InvoiceRecord = {
      id: invoiceId,
      store_id: payload.store_id,
      invoice_number: invoiceNumber,
      customer_name: payload.customer_name || 'Walk-in Customer',
      customer_phone: payload.customer_phone || '',
      payment_method: paymentMethod,
      subtotal: calculatedSubtotal,
      tax,
      discount,
      total_amount: totalAmount,
      item_count: parsedItems.length,
      notes: payload.notes || '',
      status: 'completed',
      created_at: now,
      items: parsedItems,
    };

    return { invoice: createdInvoice, items: parsedItems };
  }

  // --- QUERY & AGGREGATION ENGINE ---
  getItemsAggregation(params: {
    store_id?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    limit?: number;
    sort_by?: 'revenue' | 'quantity' | 'orders' | 'name';
  }): ItemAggregation[] {
    if (!this.db) return [];

    let query = `
      SELECT 
        item_name,
        category,
        SUM(quantity) as total_quantity,
        SUM(total_price) as total_revenue,
        AVG(unit_price) as avg_unit_price,
        COUNT(DISTINCT invoice_id) as order_count,
        MIN(created_at) as min_date,
        MAX(created_at) as max_date
      FROM invoice_items
      WHERE 1=1
    `;

    const bindings: any = {};

    if (params.store_id && params.store_id !== 'ALL') {
      query += ` AND store_id = :store_id`;
      bindings[':store_id'] = params.store_id;
    }

    if (params.start_date) {
      query += ` AND created_at >= :start_date`;
      bindings[':start_date'] = params.start_date;
    }

    if (params.end_date) {
      query += ` AND created_at <= :end_date`;
      bindings[':end_date'] = params.end_date;
    }

    if (params.search) {
      query += ` AND (item_name LIKE :search OR category LIKE :search)`;
      bindings[':search'] = `%${params.search}%`;
    }

    query += ` GROUP BY item_name`;

    switch (params.sort_by) {
      case 'quantity':
        query += ` ORDER BY total_quantity DESC`;
        break;
      case 'orders':
        query += ` ORDER BY order_count DESC`;
        break;
      case 'name':
        query += ` ORDER BY item_name ASC`;
        break;
      case 'revenue':
      default:
        query += ` ORDER BY total_revenue DESC`;
        break;
    }

    const limit = params.limit || 50;
    query += ` LIMIT ${limit}`;

    const stmt = this.db.prepare(query);
    stmt.bind(bindings);

    const items: ItemAggregation[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      items.push({
        item_name: row.item_name as string,
        category: (row.category as string) || 'General',
        total_quantity: Number(row.total_quantity) || 0,
        total_revenue: Number(Number(row.total_revenue).toFixed(2)) || 0,
        avg_unit_price: Number(Number(row.avg_unit_price).toFixed(2)) || 0,
        order_count: Number(row.order_count) || 0,
        min_date: row.min_date as string,
        max_date: row.max_date as string,
      });
    }
    stmt.free();

    return items;
  }

  // --- PAGINATED INVOICE QUERY ---
  getPaginatedInvoices(params: {
    page?: number;
    limit?: number;
    status_filter?: 'active' | 'archived' | 'all';
    store_id?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
  }): { invoices: InvoiceRecord[]; total_count: number; total_pages: number; page: number; limit: number } {
    if (!this.db) {
      return { invoices: [], total_count: 0, total_pages: 0, page: 1, limit: 20 };
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const tableName = params.status_filter === 'archived' ? 'archived_invoices' : 'active_invoices';

    let countQuery = `SELECT COUNT(*) as total FROM ${tableName} WHERE 1=1`;
    let selectQuery = `SELECT * FROM ${tableName} WHERE 1=1`;
    const bindings: any = {};

    if (params.store_id && params.store_id !== 'ALL') {
      countQuery += ` AND store_id = :store_id`;
      selectQuery += ` AND store_id = :store_id`;
      bindings[':store_id'] = params.store_id;
    }

    if (params.search) {
      countQuery += ` AND (invoice_number LIKE :search OR customer_name LIKE :search OR id LIKE :search)`;
      selectQuery += ` AND (invoice_number LIKE :search OR customer_name LIKE :search OR id LIKE :search)`;
      bindings[':search'] = `%${params.search}%`;
    }

    if (params.start_date) {
      countQuery += ` AND created_at >= :start_date`;
      selectQuery += ` AND created_at >= :start_date`;
      bindings[':start_date'] = params.start_date;
    }

    if (params.end_date) {
      countQuery += ` AND created_at <= :end_date`;
      selectQuery += ` AND created_at <= :end_date`;
      bindings[':end_date'] = params.end_date;
    }

    // Count
    const countStmt = this.db.prepare(countQuery);
    countStmt.bind(bindings);
    let totalCount = 0;
    if (countStmt.step()) {
      totalCount = (countStmt.getAsObject().total as number) || 0;
    }
    countStmt.free();

    // Invoices list
    selectQuery += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const selectStmt = this.db.prepare(selectQuery);
    selectStmt.bind(bindings);

    const invoices: InvoiceRecord[] = [];
    while (selectStmt.step()) {
      invoices.push(selectStmt.getAsObject() as unknown as InvoiceRecord);
    }
    selectStmt.free();

    // Attach items for returned invoices
    const itemsTable = params.status_filter === 'archived' ? 'archived_invoice_items' : 'invoice_items';
    for (const inv of invoices) {
      const itemStmt = this.db.prepare(`SELECT * FROM ${itemsTable} WHERE invoice_id = :inv_id`);
      itemStmt.bind({ ':inv_id': inv.id });
      const itemsList: InvoiceItem[] = [];
      while (itemStmt.step()) {
        itemsList.push(itemStmt.getAsObject() as unknown as InvoiceItem);
      }
      itemStmt.free();
      inv.items = itemsList;
    }

    return {
      invoices,
      total_count: totalCount,
      total_pages: Math.ceil(totalCount / limit),
      page,
      limit,
    };
  }

  getInvoiceById(id: string): InvoiceRecord | null {
    if (!this.db) return null;

    let inv: InvoiceRecord | null = null;
    let isArchived = false;

    // Check active first
    let stmt = this.db.prepare(`SELECT * FROM active_invoices WHERE id = :id OR invoice_number = :id`);
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      inv = stmt.getAsObject() as unknown as InvoiceRecord;
    }
    stmt.free();

    if (!inv) {
      // Check archived
      stmt = this.db.prepare(`SELECT * FROM archived_invoices WHERE id = :id OR invoice_number = :id`);
      stmt.bind({ ':id': id });
      if (stmt.step()) {
        inv = stmt.getAsObject() as unknown as InvoiceRecord;
        isArchived = true;
      }
      stmt.free();
    }

    if (!inv) return null;

    const itemsTable = isArchived ? 'archived_invoice_items' : 'invoice_items';
    const itemStmt = this.db.prepare(`SELECT * FROM ${itemsTable} WHERE invoice_id = :inv_id`);
    itemStmt.bind({ ':inv_id': inv.id });
    const itemsList: InvoiceItem[] = [];
    while (itemStmt.step()) {
      itemsList.push(itemStmt.getAsObject() as unknown as InvoiceItem);
    }
    itemStmt.free();
    inv.items = itemsList;

    return inv;
  }

  // --- SMART AUTO-ARCHIVING ENGINE ---
  archiveOldInvoices(daysThreshold: number = 30): { archived_count: number; freed_active_rows: number } {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffDate = new Date(Date.now() - daysThreshold * 86400000).toISOString();
    const now = new Date().toISOString();

    let archivedCount = 0;

    try {
      this.db.exec('BEGIN TRANSACTION;');

      // Find old invoices
      const oldStmt = this.db.prepare(`SELECT * FROM active_invoices WHERE created_at < :cutoff`);
      oldStmt.bind({ ':cutoff': cutoffDate });
      const oldInvoices: InvoiceRecord[] = [];
      while (oldStmt.step()) {
        oldInvoices.push(oldStmt.getAsObject() as unknown as InvoiceRecord);
      }
      oldStmt.free();

      for (const inv of oldInvoices) {
        // Copy to archived_invoices
        this.db.run(
          `INSERT INTO archived_invoices (id, store_id, invoice_number, customer_name, customer_phone, payment_method, subtotal, tax, discount, total_amount, item_count, raw_payload, notes, status, created_at, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            inv.id,
            inv.store_id,
            inv.invoice_number,
            inv.customer_name,
            inv.customer_phone,
            inv.payment_method,
            inv.subtotal,
            inv.tax,
            inv.discount,
            inv.total_amount,
            inv.item_count,
            inv.raw_payload,
            inv.notes,
            inv.status,
            inv.created_at,
            now,
          ]
        );

        // Copy items
        this.db.run(
          `INSERT INTO archived_invoice_items (id, invoice_id, store_id, item_name, category, quantity, unit_price, total_price, created_at)
           SELECT id, invoice_id, store_id, item_name, category, quantity, unit_price, total_price, created_at
           FROM invoice_items WHERE invoice_id = ?`,
          [inv.id]
        );

        // Delete from active tables
        this.db.run(`DELETE FROM invoice_items WHERE invoice_id = ?`, [inv.id]);
        this.db.run(`DELETE FROM active_invoices WHERE id = ?`, [inv.id]);
        archivedCount++;
      }

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    this.persistToDisk();
    return { archived_count: archivedCount, freed_active_rows: archivedCount };
  }

  // --- DATABASE METRICS & VACUUM ---
  getDatabaseStats() {
    if (!this.db) {
      return {
        file_size_bytes: 0,
        file_size_formatted: '0 KB',
        active_invoices_count: 0,
        archived_invoices_count: 0,
        total_items_count: 0,
        clients_count: 0,
        active_clients_count: 0,
        total_revenue: 0,
        db_engine: 'SQLite (sql.js / WASM + WAL file persistence)',
      };
    }

    let fileSize = 0;
    try {
      if (fs.existsSync(this.dbPath)) {
        fileSize = fs.statSync(this.dbPath).size;
      }
    } catch (e) {
      fileSize = 0;
    }

    const getCount = (query: string) => {
      const res = this.db!.exec(query);
      return (res[0]?.values[0]?.[0] as number) || 0;
    };

    const activeInvoices = getCount('SELECT COUNT(*) FROM active_invoices');
    const archivedInvoices = getCount('SELECT COUNT(*) FROM archived_invoices');
    const activeItems = getCount('SELECT COUNT(*) FROM invoice_items');
    const archivedItems = getCount('SELECT COUNT(*) FROM archived_invoice_items');
    const clientsCount = getCount('SELECT COUNT(*) FROM clients');
    const activeClientsCount = getCount("SELECT COUNT(*) FROM clients WHERE status = 'active'");
    const totalRevRes = this.db.exec(
      'SELECT SUM(total_amount) FROM (SELECT total_amount FROM active_invoices UNION ALL SELECT total_amount FROM archived_invoices)'
    );
    const totalRev = Number(totalRevRes[0]?.values[0]?.[0] || 0);

    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return {
      file_size_bytes: fileSize,
      file_size_formatted: formatSize(fileSize),
      active_invoices_count: activeInvoices,
      archived_invoices_count: archivedInvoices,
      total_items_count: activeItems + archivedItems,
      clients_count: clientsCount,
      active_clients_count: activeClientsCount,
      total_revenue: Number(totalRev.toFixed(2)),
      db_engine: 'SQLite (Embedded, Zero-Config, Single-Transaction)',
    };
  }

  vacuumDatabase(): { success: boolean; message: string; stats_before: any; stats_after: any } {
    if (!this.db) throw new Error('Database not initialized');
    const before = this.getDatabaseStats();
    this.db.run('VACUUM;');
    this.persistToDiskNow();
    const after = this.getDatabaseStats();
    return {
      success: true,
      message: 'SQLite database vacuumed and defragmented successfully.',
      stats_before: before,
      stats_after: after,
    };
  }

  logApiRequest(data: {
    store_id?: string;
    endpoint: string;
    method: string;
    status_code: number;
    latency_ms: number;
    ip_address?: string;
  }) {
    if (!this.db) return;
    try {
      this.db.run(
        `INSERT INTO api_logs (id, store_id, endpoint, method, status_code, latency_ms, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `log_${uuidv4().substring(0, 8)}`,
          data.store_id || 'UNKNOWN',
          data.endpoint,
          data.method,
          data.status_code,
          Number(data.latency_ms.toFixed(2)),
          data.ip_address || '127.0.0.1',
          new Date().toISOString(),
        ]
      );
    } catch (e) {
      // Non-blocking log write
    }
  }

  getRecentLogs(limit: number = 25) {
    if (!this.db) return [];
    const res = this.db.exec(`SELECT * FROM api_logs ORDER BY created_at DESC LIMIT ${limit}`);
    if (!res || res.length === 0) return [];
    const columns = res[0].columns;
    return res[0].values.map((val) => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = val[idx];
      });
      return obj;
    });
  }

  executeSafeSqlQuery(query: string): { success: boolean; columns: string[]; rows: any[]; execution_time_ms: number; row_count: number; error?: string } {
    if (!this.db) return { success: false, columns: [], rows: [], execution_time_ms: 0, row_count: 0, error: 'Database not initialized' };
    
    const trimmed = query.trim();
    const isReadOnly = /^(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(trimmed);
    if (!isReadOnly) {
      return {
        success: false,
        columns: [],
        rows: [],
        execution_time_ms: 0,
        row_count: 0,
        error: 'فقط استعلامات القراءة (SELECT, PRAGMA, EXPLAIN, WITH) مسموحة في محرر SQL التفاعلي لحماية سلامة البيانات.',
      };
    }

    const start = performance.now();
    try {
      const results = this.db.exec(trimmed);
      const execution_time_ms = Number((performance.now() - start).toFixed(2));
      
      if (!results || results.length === 0) {
        return {
          success: true,
          columns: [],
          rows: [],
          execution_time_ms,
          row_count: 0,
        };
      }

      const columns = results[0].columns;
      const rows = results[0].values.map((val) => {
        const rowObj: any = {};
        columns.forEach((col, i) => {
          rowObj[col] = val[i];
        });
        return rowObj;
      });

      return {
        success: true,
        columns,
        rows,
        execution_time_ms,
        row_count: rows.length,
      };
    } catch (err: any) {
      return {
        success: false,
        columns: [],
        rows: [],
        execution_time_ms: Number((performance.now() - start).toFixed(2)),
        row_count: 0,
        error: err.message,
      };
    }
  }

  getTableSchemaInfo() {
    if (!this.db) return [];
    try {
      const tablesRes = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
      if (!tablesRes || tablesRes.length === 0) return [];
      
      const tables = tablesRes[0].values.map((v) => v[0] as string);
      return tables.map((tableName) => {
        const countRes = this.db?.exec(`SELECT COUNT(*) FROM "${tableName}";`);
        const rowCount = countRes && countRes[0]?.values[0] ? Number(countRes[0].values[0][0]) : 0;
        const schemaRes = this.db?.exec(`PRAGMA table_info("${tableName}");`);
        const columns = schemaRes && schemaRes[0]
          ? schemaRes[0].values.map((c) => ({
              cid: c[0],
              name: c[1],
              type: c[2],
              notnull: c[3],
              dflt_value: c[4],
              pk: c[5],
            }))
          : [];

        return {
          table_name: tableName,
          row_count: rowCount,
          columns,
        };
      });
    } catch (e) {
      return [];
    }
  }

  getStoreExportData(storeId: string) {
    if (!this.db) return null;
    const client = this.getClientByStoreId(storeId);
    if (!client) return null;

    const invoicesRes = this.db.exec(`SELECT * FROM active_invoices WHERE store_id = '${storeId}' ORDER BY created_at DESC`);
    const archivedRes = this.db.exec(`SELECT * FROM archived_invoices WHERE store_id = '${storeId}' ORDER BY created_at DESC`);
    const itemsRes = this.db.exec(`SELECT * FROM invoice_items WHERE store_id = '${storeId}' ORDER BY created_at DESC`);

    const parseResults = (res: QueryExecResult[]) => {
      if (!res || res.length === 0) return [];
      const cols = res[0].columns;
      return res[0].values.map((v) => {
        const obj: any = {};
        cols.forEach((c, idx) => {
          obj[c] = v[idx];
        });
        return obj;
      });
    };

    const activeInvoices = parseResults(invoicesRes);
    const archivedInvoices = parseResults(archivedRes);
    const items = parseResults(itemsRes);

    return {
      client,
      exported_at: new Date().toISOString(),
      summary: {
        active_invoices_count: activeInvoices.length,
        archived_invoices_count: archivedInvoices.length,
        total_items_count: items.length,
        total_revenue: client.total_revenue_ingested,
      },
      active_invoices: activeInvoices,
      archived_invoices: archivedInvoices,
      invoice_items: items,
    };
  }
}

export const dbInstance = new StorePulseDatabase();
