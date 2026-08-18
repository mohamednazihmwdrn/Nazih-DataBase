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
