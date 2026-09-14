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

export interface SystemStats {
  database: {
    file_size_bytes: number;
    file_size_formatted: string;
    active_invoices_count: number;
    archived_invoices_count: number;
    total_items_count: number;
    clients_count: number;
    active_clients_count: number;
    total_revenue: number;
    cost_centers_count?: number;
    journal_entries_count?: number;
    sync_operations_count?: number;
    db_engine: string;
  };
  server: {
    uptime_seconds: number;
    memory_rss_mb: number;
    memory_heap_used_mb: number;
    connected_dashboards: number;
    node_version: string;
  };
}

export interface ApiLog {
  id: string;
  store_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  latency_ms: number;
  ip_address: string;
  created_at: string;
}

// --- OFFLINE-FIRST & SYNC TYPES ---
export interface SyncMutation {
  operation_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'REVERSE';
  table: 'invoices' | 'journal_entries' | 'cost_centers' | string;
  data: any;
  client_timestamp?: number | string;
}

export interface SyncBatchPayload {
  store_id: string;
  device_id?: string;
  mutations: SyncMutation[];
}

export interface SyncOperationResult {
  operation_id: string;
  status: 'synced' | 'conflict_resolved' | 'already_processed' | 'rejected';
  record_id: string;
  action: string;
  table: string;
  server_timestamp: string;
  message?: string;
}

export interface SyncBatchResponse {
  success: boolean;
  store_id: string;
  processed_count: number;
  synced_operations: SyncOperationResult[];
  server_time: string;
  error?: string;
}

// --- ACCOUNTING & CONSTRUCTION COST CENTERS ---
export interface CostCenter {
  id: string;
  store_id: string;
  code: string;
  name: string;
  category: string;
  manager_name?: string;
  budget: number;
  spent_amount: number;
  revenue_amount: number;
  status: 'active' | 'completed' | 'on_hold';
  created_at: string;
  updated_at: string;
}

export interface JournalEntryLine {
  id: string;
  entry_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  cost_center_id?: string;
  line_memo?: string;
}

export interface JournalEntry {
  id: string;
  store_id: string;
  entry_number: string;
  date: string;
  reference_type: 'invoice' | 'payment' | 'expense' | 'reversal' | 'contractor_progress' | 'manual';
  reference_id?: string;
  cost_center_id?: string;
  cost_center_name?: string;
  description: string;
  total_debit: number;
  total_credit: number;
  is_reversed: number;
  reversal_entry_id?: string;
  is_immutable: number;
  created_at: string;
  lines?: JournalEntryLine[];
}

// --- ENTERPRISE SUITE TYPES (SECURITY, CRDT, WEBHOOKS, TELEMETRY, BACKUP) ---
export interface WebhookEndpoint {
  id: string;
  store_id: string;
  name: string;
  target_url: string;
  event_types: ('NEW_INVOICE' | 'SYNC_MUTATION' | 'GAME_SCORE' | 'HIGH_VALUE_SALE' | 'INVENTORY_ALERT')[];
  status: 'active' | 'paused' | 'failed';
  secret_key: string;
  total_deliveries: number;
  last_status_code?: number;
  last_delivered_at?: string;
  created_at: string;
}

export interface WebhookDeliveryLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload_preview: string;
  status: 'success' | 'retry_queued' | 'failed';
  http_status?: number;
  latency_ms: number;
  retry_count: number;
  signature: string;
  created_at: string;
}

export interface TelemetryMetric {
  p50_latency_ms: number;
  p90_latency_ms: number;
  p99_latency_ms: number;
  avg_latency_ms: number;
  requests_per_second: number;
  active_ws_connections: number;
  memory_rss_mb: number;
  memory_heap_used_mb: number;
  timestamp: string;
}

export interface BackupScheduleConfig {
  enabled: boolean;
  intervalMinutes: number;
  compression: 'gzip' | 'brotli' | 'none';
  target: 'aws_s3' | 'cloudflare_r2' | 'hetzner' | 'local_nvme' | 'google_cloud_storage';
  retentionDays: number;
  autoIntegrityCheck: boolean;
  lastBackupAt?: string;
  nextScheduledBackupAt?: string;
  totalBackupsRun: number;
  lastBackupStatus?: 'success' | 'failed' | 'running';
  lastBackupError?: string;
}

export interface CloudSnapshot {
  id: string;
  filename: string;
  archive_type?: string;
  original_size_bytes?: number;
  compressed_size_bytes?: number;
  compression_ratio?: string;
  size_formatted?: string;
  size_bytes?: number;
  total_records: number;
  sha256_checksum: string;
  integrity_status: 'ok' | 'repaired' | 'failed';
  cloud_target: string;
  created_at: string;
  uploaded_url?: string;
}

export interface CRDTPNCounterNode {
  node_id: string;
  positive: number;
  negative: number;
  last_updated: number;
}

// --- SAAS DATABASE SERVER & DATA ENGINE TYPES ---
export interface EngineWalLog {
  id: number;
  tenant_id: string;
  operation_type: string;
  target_table: string;
  record_id?: string;
  before_state?: string;
  after_state?: string;
  source_ip: string;
  status: string;
  created_at: string;
}

export interface EngineQueryStat {
  query: string;
  executionTimeMs: number;
  rowCount: number;
  timestamp: string;
  isSlow: boolean;
  tenantId?: string;
  error?: string;
}

export interface DynamicColumnDef {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'DATETIME' | 'BOOLEAN';
  primaryKey?: boolean;
  notNull?: boolean;
  unique?: boolean;
  defaultValue?: any;
  checkConstraint?: string;
}

export interface TenantExportManifest {
  format_version: '2.0.0';
  engine: string;
  export_date: string;
  checksum_sha256: string;
  tenant_info: {
    store_id: string;
    name: string;
    owner_email: string;
    plan: string;
    created_at: string;
    schema_version: number;
  };
  metrics: {
    total_invoices: number;
    total_invoice_items: number;
    total_cost_centers: number;
    total_journal_entries: number;
    total_journal_lines: number;
    total_custom_tables: number;
  };
  schema_definitions: Array<{
    table_name: string;
    create_sql: string;
  }>;
  data: {
    company: any;
    invoices: any[];
    invoice_items: any[];
    cost_centers: any[];
    journal_entries: any[];
    journal_entry_lines: any[];
    custom_tables_data: Record<string, any[]>;
  };
}

export interface ImportValidationReport {
  isValid: boolean;
  format_version?: string;
  store_id?: string;
  company_name?: string;
  record_counts: Record<string, number>;
  warnings: string[];
  errors: string[];
  dryRunPassed: boolean;
}


