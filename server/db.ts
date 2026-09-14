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
  cost_center_id?: string;
  project_stage?: string;
  advance_deduction?: number;
  warranty_retention?: number;
  withholding_tax?: number;
  net_payable?: number;
  device_id?: string;
  operation_id?: string;
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

      /* --- OFFLINE-FIRST SYNC & IDEMPOTENCY --- */
      CREATE TABLE IF NOT EXISTS sync_operations (
        id TEXT PRIMARY KEY,
        operation_id TEXT UNIQUE NOT NULL,
        store_id TEXT NOT NULL,
        device_id TEXT,
        action TEXT NOT NULL,
        target_table TEXT NOT NULL,
        record_id TEXT NOT NULL,
        client_timestamp INTEGER,
        server_timestamp TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'synced',
        payload TEXT,
        error_message TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sync_op_id ON sync_operations(operation_id);
      CREATE INDEX IF NOT EXISTS idx_sync_store ON sync_operations(store_id);
      CREATE INDEX IF NOT EXISTS idx_sync_created ON sync_operations(server_timestamp);

      /* --- STANDARDIZED POSTGRESQL/MYSQL COMPATIBLE TABLES (Invoices & Sync Log) --- */
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        total_amount REAL NOT NULL,
        client_name TEXT,
        updated_at INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_store ON invoices(store_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_updated ON invoices(updated_at);

      CREATE TABLE IF NOT EXISTS sync_log (
        operation_id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_synclog_device ON sync_log(device_id);

      /* --- CONSTRUCTION & ENTERPRISE COST CENTERS --- */
      CREATE TABLE IF NOT EXISTS cost_centers (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'إنشاءات ومقاولات',
        manager_name TEXT,
        budget REAL DEFAULT 0.0,
        spent_amount REAL DEFAULT 0.0,
        revenue_amount REAL DEFAULT 0.0,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cost_center_store ON cost_centers(store_id);
      CREATE INDEX IF NOT EXISTS idx_cost_center_code ON cost_centers(code);

      /* --- DOUBLE-ENTRY IMMUTABLE GENERAL LEDGER --- */
      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        entry_number TEXT NOT NULL,
        date TEXT NOT NULL,
        reference_type TEXT NOT NULL DEFAULT 'invoice',
        reference_id TEXT,
        cost_center_id TEXT,
        cost_center_name TEXT,
        description TEXT NOT NULL,
        total_debit REAL NOT NULL DEFAULT 0.0,
        total_credit REAL NOT NULL DEFAULT 0.0,
        is_reversed INTEGER NOT NULL DEFAULT 0,
        reversal_entry_id TEXT,
        is_immutable INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_journal_store ON journal_entries(store_id);
      CREATE INDEX IF NOT EXISTS idx_journal_ref ON journal_entries(reference_id);
      CREATE INDEX IF NOT EXISTS idx_journal_created ON journal_entries(created_at);

      CREATE TABLE IF NOT EXISTS journal_entry_lines (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        account_code TEXT NOT NULL,
        account_name TEXT NOT NULL,
        debit REAL NOT NULL DEFAULT 0.0,
        credit REAL NOT NULL DEFAULT 0.0,
        cost_center_id TEXT,
        line_memo TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_jlines_entry ON journal_entry_lines(entry_id);
      CREATE INDEX IF NOT EXISTS idx_jlines_account ON journal_entry_lines(account_code);
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
      this.db.run(`DELETE FROM journal_entry_lines;`);
      this.db.run(`DELETE FROM journal_entries;`);
      this.db.run(`DELETE FROM cost_centers;`);
      this.db.run(`DELETE FROM sync_operations;`);
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

  // =========================================================================
  // --- OFFLINE-FIRST SYNC ENGINE & IDEMPOTENCY RESOLUTION ---
  // =========================================================================

  processSyncBatch(payload: {
    store_id: string;
    device_id?: string;
    mutations: Array<{
      operation_id: string;
      action: 'INSERT' | 'UPDATE' | 'DELETE' | 'REVERSE' | string;
      table: 'invoices' | 'journal_entries' | 'cost_centers' | 'contractor_invoices' | string;
      data: any;
      client_timestamp?: number | string;
    }>;
  }): {
    processed_count: number;
    synced_operations: Array<{
      operation_id: string;
      status: 'synced' | 'conflict_resolved' | 'already_processed' | 'rejected';
      record_id: string;
      action: string;
      table: string;
      server_timestamp: string;
      message?: string;
    }>;
    created_invoices: InvoiceRecord[];
    created_journal_entries: any[];
  } {
    if (!this.db) throw new Error('Database not initialized');

    const storeId = payload.store_id.trim().toUpperCase();
    const deviceId = payload.device_id || 'unnamed-device';
    const serverNow = new Date().toISOString();
    const results: Array<{
      operation_id: string;
      status: 'synced' | 'conflict_resolved' | 'already_processed' | 'rejected';
      record_id: string;
      action: string;
      table: string;
      server_timestamp: string;
      message?: string;
    }> = [];
    const createdInvoices: InvoiceRecord[] = [];
    const createdJournalEntries: any[] = [];

    try {
      this.db.exec('BEGIN TRANSACTION;');

      for (const mutation of payload.mutations || []) {
        const opId = mutation.operation_id?.trim();
        if (!opId) {
          results.push({
            operation_id: 'unknown',
            status: 'rejected',
            record_id: '',
            action: mutation.action || 'UNKNOWN',
            table: mutation.table || 'unknown',
            server_timestamp: serverNow,
            message: 'Missing operation_id for idempotency tracking.',
          });
          continue;
        }

        // 1. IDEMPOTENCY CHECK: Has this operation_id already been executed?
        const checkStmt = this.db.prepare(`SELECT * FROM sync_operations WHERE operation_id = :op_id`);
        checkStmt.bind({ ':op_id': opId });
        if (checkStmt.step()) {
          const existing = checkStmt.getAsObject();
          checkStmt.free();
          results.push({
            operation_id: opId,
            status: 'already_processed',
            record_id: existing.record_id as string,
            action: existing.action as string,
            table: existing.target_table as string,
            server_timestamp: existing.server_timestamp as string,
            message: 'Idempotency verified: mutation was previously committed, no duplicate created.',
          });
          continue;
        }
        checkStmt.free();

        // 2. PROCESS MUTATION ACCORDING TO TARGET TABLE
        let recordId = '';
        let status: 'synced' | 'conflict_resolved' | 'rejected' = 'synced';
        let detailMsg = 'Successfully synchronized and committed to primary ledger.';

        try {
          if (mutation.table === 'invoices' || mutation.table === 'contractor_invoices') {
            const data = mutation.data || {};
            recordId = data.id || `inv_${uuidv4().substring(0, 8)}`;
            const invNumber = data.invoice_number || `INV-${storeId.substring(0, 5)}-${Date.now().toString().slice(-5)}`;
            const customer = data.customer_name || 'عميل نقدي / جهة المشروع';
            const phone = data.customer_phone || '';
            const paymentMethod = data.payment_method || 'cash';
            const costCenterId = data.cost_center_id || null;
            const projectStage = data.project_stage || null;
            
            // Deductions & Retentions for Contractors / Invoices
            const advanceDeduction = Number(data.advance_deduction) || 0;
            const warrantyRetention = Number(data.warranty_retention) || 0;
            const withholdingTax = Number(data.withholding_tax) || 0;

            let subtotal = 0;
            const itemsList: InvoiceItem[] = [];
            for (const item of data.items || []) {
              const itemId = item.id || `item_${uuidv4().substring(0, 8)}`;
              const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
              const unit = Number(item.unit_price) >= 0 ? Number(item.unit_price) : 0;
              const lineTotal = item.total_price !== undefined ? Number(item.total_price) : Number((qty * unit).toFixed(2));
              subtotal += lineTotal;

              itemsList.push({
                id: itemId,
                invoice_id: recordId,
                store_id: storeId,
                item_name: item.item_name || 'بند توريد / مادة بناء',
                category: item.category || (costCenterId ? 'مستخلصات وإنشاءات' : 'عام'),
                quantity: qty,
                unit_price: unit,
                total_price: lineTotal,
                created_at: serverNow,
              });

              this.db.run(
                `INSERT INTO invoice_items (id, invoice_id, store_id, item_name, category, quantity, unit_price, total_price, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [itemId, recordId, storeId, item.item_name || 'بند توريد', item.category || 'عام', qty, unit, lineTotal, serverNow]
              );
            }

            const tax = Number(data.tax) >= 0 ? Number(data.tax) : 0;
            const discount = Number(data.discount) >= 0 ? Number(data.discount) : 0;
            const totalAmount = Number((subtotal + tax - discount).toFixed(2));
            const netPayable = Number((totalAmount - advanceDeduction - warrantyRetention - withholdingTax).toFixed(2));

            // Insert invoice into active_invoices
            this.db.run(
              `INSERT INTO active_invoices (id, store_id, invoice_number, customer_name, customer_phone, payment_method, subtotal, tax, discount, total_amount, item_count, raw_payload, notes, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                recordId,
                storeId,
                invNumber,
                customer,
                phone,
                paymentMethod,
                subtotal,
                tax,
                discount,
                totalAmount,
                itemsList.length,
                JSON.stringify(data),
                data.notes || '',
                'completed',
                serverNow,
              ]
            );

            // Update client counters
            this.db.run(
              `UPDATE clients SET total_invoices_ingested = total_invoices_ingested + 1, total_revenue_ingested = total_revenue_ingested + ?, updated_at = ? WHERE store_id = ?`,
              [totalAmount, serverNow, storeId]
            );

            // Automatic Double-Entry Accounting Generator (القيود المحاسبية المزدوجة)
            const entryId = `je_${uuidv4().substring(0, 8)}`;
            const entryNumber = `JE-${Date.now().toString().slice(-6)}`;
            const costCenterName = costCenterId ? (this.getCostCenterById(costCenterId)?.name || 'مشروع إنشائي') : undefined;

            this.db.run(
              `INSERT INTO journal_entries (id, store_id, entry_number, date, reference_type, reference_id, cost_center_id, cost_center_name, description, total_debit, total_credit, is_reversed, is_immutable, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
              [
                entryId,
                storeId,
                entryNumber,
                serverNow.split('T')[0],
                costCenterId ? 'contractor_progress' : 'invoice',
                recordId,
                costCenterId,
                costCenterName || null,
                `قيد إثبات استحقاق / فاتورة رقم ${invNumber} - ${customer}`,
                totalAmount,
                totalAmount,
                serverNow,
              ]
            );

            // Double-entry Lines
            // Debit: Receivable / Cash (Net Payable)
            this.db.run(
              `INSERT INTO journal_entry_lines (id, entry_id, account_code, account_name, debit, credit, cost_center_id, line_memo)
               VALUES (?, ?, ?, ?, ?, 0.0, ?, ?)`,
              [
                `jel_${uuidv4().substring(0, 8)}`,
                entryId,
                paymentMethod === 'cash' ? '1101' : '1201',
                paymentMethod === 'cash' ? 'النقدية بالصندوق / البنك' : 'حـ/ المدينون والعملاء المستحقين',
                netPayable > 0 ? netPayable : totalAmount,
                costCenterId,
                `صافي المستحق لفاتورة ${invNumber}`,
              ]
            );

            // If Warranty retention (تأمين أعمال محتجز)
            if (warrantyRetention > 0) {
              this.db.run(
                `INSERT INTO journal_entry_lines (id, entry_id, account_code, account_name, debit, credit, cost_center_id, line_memo)
                 VALUES (?, ?, '1205', 'حـ/ أمانات محتجزة لدى الغير (ضمان أعمال)', ?, 0.0, ?, ?)`,
                [`jel_${uuidv4().substring(0, 8)}`, entryId, warrantyRetention, costCenterId, `تأمين أعمال محتجز 5% لـ ${invNumber}`]
              );
            }

            // Credit: Sales / Project Revenue
            const revenueCredit = Number((subtotal - discount).toFixed(2));
            this.db.run(
              `INSERT INTO journal_entry_lines (id, entry_id, account_code, account_name, debit, credit, cost_center_id, line_memo)
               VALUES (?, ?, ?, ?, 0.0, ?, ?, ?)`,
              [
                `jel_${uuidv4().substring(0, 8)}`,
                entryId,
                costCenterId ? '4102' : '4101',
                costCenterId ? 'إيرادات عقود ومستخلصات مقاولات' : 'إيرادات المبيعات',
                revenueCredit,
                costCenterId,
                `إيراد فاتورة ${invNumber}`,
              ]
            );

            // Credit: Output VAT Tax (إذا وجدت ضريبة)
            if (tax > 0) {
              this.db.run(
                `INSERT INTO journal_entry_lines (id, entry_id, account_code, account_name, debit, credit, cost_center_id, line_memo)
                 VALUES (?, ?, '2105', 'حـ/ ضريبة القيمة المضافة المستحقة (Output VAT)', 0.0, ?, ?, ?)`,
                [`jel_${uuidv4().substring(0, 8)}`, entryId, tax, costCenterId, `ضريبة فاتورة ${invNumber}`]
              );
            }

            // If cost center is attached, update project revenue/spent
            if (costCenterId) {
              this.db.run(
                `UPDATE cost_centers SET revenue_amount = revenue_amount + ?, updated_at = ? WHERE id = ? AND store_id = ?`,
                [totalAmount, serverNow, costCenterId, storeId]
              );
            }

            createdInvoices.push({
              id: recordId,
              store_id: storeId,
              invoice_number: invNumber,
              customer_name: customer,
              customer_phone: phone,
              payment_method: paymentMethod,
              subtotal,
              tax,
              discount,
              total_amount: totalAmount,
              item_count: itemsList.length,
              cost_center_id: costCenterId || undefined,
              project_stage: projectStage || undefined,
              advance_deduction: advanceDeduction,
              warranty_retention: warrantyRetention,
              withholding_tax: withholdingTax,
              net_payable: netPayable,
              device_id: deviceId,
              operation_id: opId,
              status: 'completed',
              created_at: serverNow,
              items: itemsList,
            });

            createdJournalEntries.push({
              id: entryId,
              entry_number: entryNumber,
              description: `قيد فاتورة ${invNumber}`,
              total_debit: totalAmount,
              total_credit: totalAmount,
            });
          } else if (mutation.table === 'cost_centers') {
            const data = mutation.data || {};
            recordId = data.id || `cc_${uuidv4().substring(0, 8)}`;
            const code = data.code || `PRJ-${Date.now().toString().slice(-4)}`;
            const name = data.name || 'مشروع إنشائي جديد';
            const category = data.category || 'إنشاءات ومقاولات';
            const budget = Number(data.budget) || 0.0;

            this.db.run(
              `INSERT INTO cost_centers (id, store_id, code, name, category, manager_name, budget, spent_amount, revenue_amount, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, 0.0, 'active', ?, ?)`,
              [recordId, storeId, code, name, category, data.manager_name || '', budget, serverNow, serverNow]
            );
          } else if (mutation.table === 'journal_entries') {
            const data = mutation.data || {};
            recordId = data.id || `je_${uuidv4().substring(0, 8)}`;
            const entryNumber = data.entry_number || `JE-${Date.now().toString().slice(-6)}`;
            const debit = Number(data.total_debit) || 0.0;
            const credit = Number(data.total_credit) || debit;

            this.db.run(
              `INSERT INTO journal_entries (id, store_id, entry_number, date, reference_type, reference_id, cost_center_id, cost_center_name, description, total_debit, total_credit, is_reversed, is_immutable, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
              [
                recordId,
                storeId,
                entryNumber,
                data.date || serverNow.split('T')[0],
                data.reference_type || 'manual',
                data.reference_id || null,
                data.cost_center_id || null,
                data.cost_center_name || null,
                data.description || 'قيد محاسبي يدوي متزامن',
                debit,
                credit,
                serverNow,
              ]
            );

            for (const line of data.lines || []) {
              this.db.run(
                `INSERT INTO journal_entry_lines (id, entry_id, account_code, account_name, debit, credit, cost_center_id, line_memo)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  line.id || `jel_${uuidv4().substring(0, 8)}`,
                  recordId,
                  line.account_code || '1101',
                  line.account_name || 'حساب عام',
                  Number(line.debit) || 0.0,
                  Number(line.credit) || 0.0,
                  line.cost_center_id || null,
                  line.line_memo || '',
                ]
              );
            }
          }

          // 3. RECORD SYNC OPERATION FOR IDEMPOTENCY
          this.db.run(
            `INSERT INTO sync_operations (id, operation_id, store_id, device_id, action, target_table, record_id, client_timestamp, server_timestamp, status, payload)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              `sync_${uuidv4().substring(0, 8)}`,
              opId,
              storeId,
              deviceId,
              mutation.action || 'INSERT',
              mutation.table || 'invoices',
              recordId,
              mutation.client_timestamp ? Number(mutation.client_timestamp) : Date.now(),
              serverNow,
              status,
              JSON.stringify(mutation.data || {}),
            ]
          );

          results.push({
            operation_id: opId,
            status,
            record_id: recordId,
            action: mutation.action || 'INSERT',
            table: mutation.table || 'invoices',
            server_timestamp: serverNow,
            message: detailMsg,
          });
        } catch (mErr: any) {
          results.push({
            operation_id: opId,
            status: 'rejected',
            record_id: '',
            action: mutation.action || 'INSERT',
            table: mutation.table || 'invoices',
            server_timestamp: serverNow,
            message: mErr.message,
          });
        }
      }

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    this.persistToDisk();

    return {
      processed_count: results.filter((r) => r.status === 'synced' || r.status === 'already_processed').length,
      synced_operations: results,
      created_invoices: createdInvoices,
      created_journal_entries: createdJournalEntries,
    };
  }

  // --- POST /api/v1/sync : STANDARDIZED ATOMIC IDEMPOTENT SYNC ENGINE ---
  processV1Sync(payload: {
    store_id: string;
    device_id: string;
    mutations: Array<{
      operation_id: string;
      action: 'INSERT' | 'UPDATE' | string;
      table: string;
      data: any;
      client_timestamp?: number;
    }>;
  }): {
    success: boolean;
    message: string;
    processed_count: number;
    details: Array<{ operation_id: string; status: 'SUCCESS' | 'SKIPPED_DUPLICATE' | 'REJECTED'; message?: string }>;
    created_invoices: InvoiceRecord[];
  } {
    if (!this.db) throw new Error('Database not initialized');

    const { store_id, device_id, mutations } = payload;
    const results: Array<{ operation_id: string; status: 'SUCCESS' | 'SKIPPED_DUPLICATE' | 'REJECTED'; message?: string }> = [];
    const createdInvoices: InvoiceRecord[] = [];
    const serverNow = new Date().toISOString();

    try {
      // 1. Start Atomic Transaction (BEGIN TRANSACTION / ACID guarantee)
      this.db.exec('BEGIN TRANSACTION;');

      for (const mutation of mutations) {
        const { operation_id, action, table, data = {}, client_timestamp = Date.now() } = mutation;

        if (!operation_id) {
          results.push({ operation_id: 'unknown', status: 'REJECTED', message: 'Missing operation_id' });
          continue;
        }

        // 1. Idempotency Check (فحص منع التكرار)
        const checkStmt = this.db.prepare('SELECT operation_id FROM sync_log WHERE operation_id = :op_id');
        checkStmt.bind({ ':op_id': operation_id });
        const exists = checkStmt.step();
        checkStmt.free();

        if (exists) {
          // Operation was already processed in a previous sync
          results.push({ operation_id, status: 'SKIPPED_DUPLICATE' });
          continue;
        }

        // 2. Handle invoices table (معالجة جدول الفواتير وحل التعارضات)
        if (table === 'invoices') {
          const invId = data.id || `inv_${uuidv4().substring(0, 8)}`;
          const totalAmount = Number(data.total_amount) >= 0 ? Number(data.total_amount) : 0.0;
          const clientName = data.client_name || data.customer_name || 'عميل نقدي';
          const invNumber = data.invoice_number || `INV-${store_id.substring(0, 5)}-${Date.now().toString().slice(-5)}`;

          if (action === 'INSERT') {
            // INSERT with ON CONFLICT DO NOTHING (INSERT OR IGNORE in SQLite)
            this.db.run(
              `INSERT OR IGNORE INTO invoices (id, store_id, total_amount, client_name, updated_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [invId, store_id, totalAmount, clientName, client_timestamp, serverNow]
            );

            // Also dual-write into active_invoices for UI & reporting
            this.db.run(
              `INSERT OR IGNORE INTO active_invoices (id, store_id, invoice_number, customer_name, payment_method, total_amount, subtotal, status, created_at)
               VALUES (?, ?, ?, ?, 'cash', ?, ?, 'completed', ?)`,
              [invId, store_id, invNumber, clientName, totalAmount, totalAmount, serverNow]
            );

            // Update client counters
            this.db.run(
              `UPDATE clients SET total_invoices_ingested = total_invoices_ingested + 1, total_revenue_ingested = total_revenue_ingested + ?, updated_at = ? WHERE store_id = ?`,
              [totalAmount, serverNow, store_id]
            );

            createdInvoices.push({
              id: invId,
              store_id,
              invoice_number: invNumber,
              customer_name: clientName,
              payment_method: 'cash',
              subtotal: totalAmount,
              tax: 0,
              discount: 0,
              total_amount: totalAmount,
              item_count: 1,
              status: 'completed',
              created_at: serverNow,
            });
          } else if (action === 'UPDATE') {
            // Conflict Resolution (Last-Write-Wins: updated_at < client_timestamp)
            this.db.run(
              `UPDATE invoices 
               SET total_amount = ?, client_name = ?, updated_at = ?
               WHERE id = ? AND store_id = ? AND updated_at < ?`,
              [totalAmount, clientName, client_timestamp, invId, store_id, client_timestamp]
            );

            this.db.run(
              `UPDATE active_invoices 
               SET total_amount = ?, customer_name = ?
               WHERE id = ? AND store_id = ?`,
              [totalAmount, clientName, invId, store_id]
            );
          }
        }

        // 3. Register operation in sync_log to prevent duplicate processing
        this.db.run(
          `INSERT OR IGNORE INTO sync_log (operation_id, device_id, synced_at) VALUES (?, ?, ?)`,
          [operation_id, device_id, serverNow]
        );

        // Also record in sync_operations for comprehensive telemetry
        this.db.run(
          `INSERT OR IGNORE INTO sync_operations (id, operation_id, store_id, device_id, action, target_table, record_id, client_timestamp, server_timestamp, status, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
          [
            `sync_${uuidv4().substring(0, 8)}`,
            operation_id,
            store_id,
            device_id,
            action,
            table,
            data.id || operation_id,
            client_timestamp,
            serverNow,
            JSON.stringify(data),
          ]
        );

        results.push({ operation_id, status: 'SUCCESS' });
      }

      // Commit Atomic Transaction
      this.db.exec('COMMIT;');
    } catch (error) {
      // Rollback on any failure
      this.db.exec('ROLLBACK;');
      throw error;
    }

    this.persistToDisk();

    return {
      success: true,
      message: 'تمت المزامنة بنجاح',
      processed_count: results.length,
      details: results,
      created_invoices: createdInvoices,
    };
  }

  // --- QUERY STANDARDIZED INVOICES & SYNC_LOG ---
  getV1Invoices(store_id?: string, limit: number = 50): Array<{
    id: string;
    store_id: string;
    total_amount: number;
    client_name: string;
    updated_at: number;
    created_at: string;
  }> {
    if (!this.db) return [];

    let query = 'SELECT id, store_id, total_amount, client_name, updated_at, created_at FROM invoices WHERE 1=1';
    const bindings: any = {};
    if (store_id && store_id !== 'ALL') {
      query += ' AND store_id = :store_id';
      bindings[':store_id'] = store_id;
    }
    query += ` ORDER BY updated_at DESC LIMIT ${limit}`;

    const stmt = this.db.prepare(query);
    stmt.bind(bindings);

    const rows: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push({
        id: row.id,
        store_id: row.store_id,
        total_amount: Number(row.total_amount) || 0,
        client_name: row.client_name || '',
        updated_at: Number(row.updated_at) || 0,
        created_at: row.created_at,
      });
    }
    stmt.free();
    return rows;
  }

  getSyncLogs(limit: number = 50): Array<{
    operation_id: string;
    device_id: string;
    synced_at: string;
  }> {
    if (!this.db) return [];

    const stmt = this.db.prepare(`SELECT operation_id, device_id, synced_at FROM sync_log ORDER BY synced_at DESC LIMIT ${limit}`);
    const rows: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push({
        operation_id: row.operation_id,
        device_id: row.device_id,
        synced_at: row.synced_at,
      });
    }
    stmt.free();
    return rows;
  }

  // =========================================================================
  // --- ACCOUNTING CORE & COST CENTERS (مراكز التكلفة والقيود المزدوجة) ---
  // =========================================================================

  createCostCenter(data: {
    store_id: string;
    code: string;
    name: string;
    category?: string;
    manager_name?: string;
    budget?: number;
  }) {
    if (!this.db) throw new Error('Database not initialized');
    const id = `cc_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const storeId = data.store_id.trim().toUpperCase();

    this.db.run(
      `INSERT INTO cost_centers (id, store_id, code, name, category, manager_name, budget, spent_amount, revenue_amount, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, 0.0, 'active', ?, ?)`,
      [
        id,
        storeId,
        data.code.trim().toUpperCase(),
        data.name.trim(),
        data.category?.trim() || 'إنشاءات ومقاولات',
        data.manager_name?.trim() || '',
        Number(data.budget) || 0.0,
        now,
        now,
      ]
    );

    this.persistToDisk();
    return this.getCostCenterById(id);
  }

  getAllCostCenters(storeId?: string) {
    if (!this.db) return [];
    let query = `SELECT * FROM cost_centers WHERE 1=1`;
    if (storeId && storeId !== 'ALL') {
      query += ` AND store_id = '${storeId.trim().toUpperCase()}'`;
    }
    query += ` ORDER BY created_at DESC`;

    const res = this.db.exec(query);
    if (!res || res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => {
      const obj: any = {};
      cols.forEach((c, idx) => (obj[c] = v[idx]));
      return obj;
    });
  }

  getCostCenterById(id: string) {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT * FROM cost_centers WHERE id = :id`);
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const res = stmt.getAsObject();
      stmt.free();
      return res;
    }
    stmt.free();
    return null;
  }

  updateCostCenter(id: string, updates: { budget?: number; spent_amount?: number; status?: string; name?: string }) {
    if (!this.db) return null;
    const current = this.getCostCenterById(id);
    if (!current) return null;

    const now = new Date().toISOString();
    const budget = updates.budget !== undefined ? Number(updates.budget) : current.budget;
    const spent = updates.spent_amount !== undefined ? Number(updates.spent_amount) : current.spent_amount;
    const status = updates.status !== undefined ? updates.status : current.status;
    const name = updates.name !== undefined ? updates.name : current.name;

    this.db.run(
      `UPDATE cost_centers SET name = ?, budget = ?, spent_amount = ?, status = ?, updated_at = ? WHERE id = ?`,
      [name, budget, spent, status, now, id]
    );
    this.persistToDisk();
    return this.getCostCenterById(id);
  }

  createJournalEntry(payload: {
    store_id: string;
    entry_number?: string;
    date?: string;
    reference_type?: string;
    reference_id?: string;
    cost_center_id?: string;
    description: string;
    lines: Array<{
      account_code: string;
      account_name: string;
      debit?: number;
      credit?: number;
      cost_center_id?: string;
      line_memo?: string;
    }>;
  }) {
    if (!this.db) throw new Error('Database not initialized');
    const storeId = payload.store_id.trim().toUpperCase();
    const id = `je_${uuidv4().substring(0, 8)}`;
    const entryNumber = payload.entry_number || `JE-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();
    const date = payload.date || now.split('T')[0];

    // Compute total debit & credit to ensure mathematical balance
    let totalDebit = 0;
    let totalCredit = 0;
    for (const l of payload.lines || []) {
      totalDebit += Number(l.debit) || 0;
      totalCredit += Number(l.credit) || 0;
    }

    totalDebit = Number(totalDebit.toFixed(2));
    totalCredit = Number(totalCredit.toFixed(2));

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`خلل في توازن القيد المحاسبي: إجمالي المدين (${totalDebit}) لا يساوي إجمالي الدائن (${totalCredit})`);
    }

    const costCenterName = payload.cost_center_id
      ? (this.getCostCenterById(payload.cost_center_id)?.name as string) || undefined
      : undefined;

    try {
      this.db.exec('BEGIN TRANSACTION;');

      this.db.run(
        `INSERT INTO journal_entries (id, store_id, entry_number, date, reference_type, reference_id, cost_center_id, cost_center_name, description, total_debit, total_credit, is_reversed, is_immutable, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
        [
          id,
          storeId,
          entryNumber,
          date,
          payload.reference_type || 'manual',
          payload.reference_id || null,
          payload.cost_center_id || null,
          costCenterName || null,
          payload.description,
          totalDebit,
          totalCredit,
          now,
        ]
      );

      for (const line of payload.lines || []) {
        this.db.run(
          `INSERT INTO journal_entry_lines (id, entry_id, account_code, account_name, debit, credit, cost_center_id, line_memo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `jel_${uuidv4().substring(0, 8)}`,
            id,
            line.account_code,
            line.account_name,
            Number(line.debit) || 0.0,
            Number(line.credit) || 0.0,
            line.cost_center_id || payload.cost_center_id || null,
            line.line_memo || '',
          ]
        );
      }

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    this.persistToDisk();
    return this.getJournalEntryById(id);
  }

  getJournalEntries(params: { store_id?: string; cost_center_id?: string; limit?: number }) {
    if (!this.db) return [];
    let query = `SELECT * FROM journal_entries WHERE 1=1`;
    if (params.store_id && params.store_id !== 'ALL') {
      query += ` AND store_id = '${params.store_id.trim().toUpperCase()}'`;
    }
    if (params.cost_center_id) {
      query += ` AND cost_center_id = '${params.cost_center_id}'`;
    }
    query += ` ORDER BY created_at DESC`;
    if (params.limit) {
      query += ` LIMIT ${params.limit}`;
    }

    const res = this.db.exec(query);
    if (!res || res.length === 0) return [];
    const cols = res[0].columns;
    const entries = res[0].values.map((v) => {
      const obj: any = {};
      cols.forEach((c, idx) => (obj[c] = v[idx]));
      return obj;
    });

    // Populate lines
    for (const e of entries) {
      const lineRes = this.db.exec(`SELECT * FROM journal_entry_lines WHERE entry_id = '${e.id}'`);
      if (lineRes && lineRes.length > 0) {
        const lCols = lineRes[0].columns;
        e.lines = lineRes[0].values.map((lv) => {
          const lObj: any = {};
          lCols.forEach((lc, lIdx) => (lObj[lc] = lv[lIdx]));
          return lObj;
        });
      } else {
        e.lines = [];
      }
    }

    return entries;
  }

  getJournalEntryById(id: string) {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT * FROM journal_entries WHERE id = :id`);
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const entry: any = stmt.getAsObject();
      stmt.free();

      const lineRes = this.db.exec(`SELECT * FROM journal_entry_lines WHERE entry_id = '${id}'`);
      if (lineRes && lineRes.length > 0) {
        const lCols = lineRes[0].columns;
        entry.lines = lineRes[0].values.map((lv) => {
          const lObj: any = {};
          lCols.forEach((lc, lIdx) => (lObj[lc] = lv[lIdx]));
          return lObj;
        });
      } else {
        entry.lines = [];
      }
      return entry;
    }
    stmt.free();
    return null;
  }

  // Immutable Ledger Reversal Mechanism (قيد التسوية العكسي لحماية التدقيق المالي)
  reverseJournalEntry(entryId: string, reason: string) {
    if (!this.db) throw new Error('Database not initialized');
    const original = this.getJournalEntryById(entryId);
    if (!original) throw new Error('القيد المحاسبي الأصلي غير موجود');
    if (original.is_reversed === 1) throw new Error('هذا القيد تم عكسه وتسويته مسبقاً');

    const reversalId = `je_rev_${uuidv4().substring(0, 8)}`;
    const reversalNumber = `REV-${original.entry_number}`;
    const now = new Date().toISOString();

    try {
      this.db.exec('BEGIN TRANSACTION;');

      // 1. Create inverse entry
      this.db.run(
        `INSERT INTO journal_entries (id, store_id, entry_number, date, reference_type, reference_id, cost_center_id, cost_center_name, description, total_debit, total_credit, is_reversed, reversal_entry_id, is_immutable, created_at)
         VALUES (?, ?, ?, ?, 'reversal', ?, ?, ?, ?, ?, ?, 0, ?, 1, ?)`,
        [
          reversalId,
          original.store_id,
          reversalNumber,
          now.split('T')[0],
          original.id,
          original.cost_center_id,
          original.cost_center_name,
          `قيد عكسي لتسوية وإلغاء القيد رقم (${original.entry_number}) - سبب الإلغاء: ${reason || 'خطأ تسجيلي'}`,
          original.total_credit,
          original.total_debit,
          original.id,
          now,
        ]
      );

      // 2. Invert all debits and credits in lines
      for (const line of original.lines || []) {
        this.db.run(
          `INSERT INTO journal_entry_lines (id, entry_id, account_code, account_name, debit, credit, cost_center_id, line_memo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `jel_${uuidv4().substring(0, 8)}`,
            reversalId,
            line.account_code,
            line.account_name,
            line.credit, // Invert
            line.debit,  // Invert
            line.cost_center_id,
            `عكس حركة: ${line.line_memo || ''}`,
          ]
        );
      }

      // 3. Mark original as reversed
      this.db.run(
        `UPDATE journal_entries SET is_reversed = 1, reversal_entry_id = ? WHERE id = ?`,
        [reversalId, original.id]
      );

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    this.persistToDisk();
    return {
      original_entry: this.getJournalEntryById(original.id),
      reversal_entry: this.getJournalEntryById(reversalId),
    };
  }

  // ميزان المراجعة وتجميع الحسابات (Trial Balance)
  getTrialBalance(storeId?: string) {
    if (!this.db) return [];
    let query = `
      SELECT 
        jel.account_code,
        jel.account_name,
        SUM(jel.debit) as total_debit,
        SUM(jel.credit) as total_credit,
        (SUM(jel.debit) - SUM(jel.credit)) as net_balance
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.entry_id
      WHERE 1=1
    `;
    if (storeId && storeId !== 'ALL') {
      query += ` AND je.store_id = '${storeId.trim().toUpperCase()}'`;
    }
    query += ` GROUP BY jel.account_code ORDER BY jel.account_code ASC`;

    const res = this.db.exec(query);
    if (!res || res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => {
      const obj: any = {};
      cols.forEach((c, idx) => (obj[c] = v[idx]));
      return obj;
    });
  }

  // Down-Sync Pull Endpoint (سحب التحديثات العكسية للأجهزة التي تعود للاتصال)
  getSyncChangesSince(storeId: string, sinceTimestamp: string | number) {
    if (!this.db) return { invoices: [], cost_centers: [], journal_entries: [], sync_operations: [] };

    let sinceIso = new Date(0).toISOString();
    if (typeof sinceTimestamp === 'number') {
      sinceIso = new Date(sinceTimestamp).toISOString();
    } else if (typeof sinceTimestamp === 'string' && sinceTimestamp) {
      sinceIso = sinceTimestamp;
    }

    const sId = storeId.trim().toUpperCase();

    const fetchTable = (query: string) => {
      const res = this.db!.exec(query);
      if (!res || res.length === 0) return [];
      const cols = res[0].columns;
      return res[0].values.map((v) => {
        const obj: any = {};
        cols.forEach((c, idx) => (obj[c] = v[idx]));
        return obj;
      });
    };

    const invoices = fetchTable(`SELECT * FROM active_invoices WHERE store_id = '${sId}' AND created_at > '${sinceIso}' ORDER BY created_at ASC`);
    const costCenters = fetchTable(`SELECT * FROM cost_centers WHERE store_id = '${sId}' AND updated_at > '${sinceIso}' ORDER BY updated_at ASC`);
    const journalEntries = this.getJournalEntries({ store_id: sId }).filter((j) => j.created_at > sinceIso);
    const syncOps = fetchTable(`SELECT * FROM sync_operations WHERE store_id = '${sId}' AND server_timestamp > '${sinceIso}' ORDER BY server_timestamp ASC`);

    return {
      store_id: sId,
      since_timestamp: sinceIso,
      server_timestamp: new Date().toISOString(),
      invoices,
      cost_centers: costCenters,
      journal_entries: journalEntries,
      sync_operations: syncOps,
    };
  }

  getSyncOperations(storeId?: string, limit: number = 100) {
    if (!this.db) return [];
    let query = `SELECT * FROM sync_operations WHERE 1=1`;
    if (storeId && storeId !== 'ALL') {
      query += ` AND store_id = '${storeId.trim().toUpperCase()}'`;
    }
    query += ` ORDER BY server_timestamp DESC LIMIT ${limit}`;

    const res = this.db.exec(query);
    if (!res || res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => {
      const obj: any = {};
      cols.forEach((c, idx) => (obj[c] = v[idx]));
      return obj;
    });
  }

  getRawDatabase(): Database | null {
    return this.db;
  }

  persistToDiskExplicit() {
    this.persistToDiskNow();
  }
}

export const dbInstance = new StorePulseDatabase();

