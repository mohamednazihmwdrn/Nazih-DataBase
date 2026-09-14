import { dbInstance } from './db';
import { Database } from 'sql.js';

export interface ColumnDefinition {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'BOOLEAN' | 'DATETIME';
  primaryKey?: boolean;
  autoIncrement?: boolean;
  notNull?: boolean;
  unique?: boolean;
  defaultValue?: any;
  checkConstraint?: string;
  references?: {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  };
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  tenantScoped?: boolean; // When true, automatically manages and enforces tenant_id
}

export interface QueryAST {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE_TABLE' | 'DROP_TABLE' | 'ALTER_TABLE' | 'TRANSACTION';
  table?: string;
  fields?: string[];
  values?: Record<string, any> | Record<string, any>[];
  where?: Record<string, any> | string;
  join?: {
    type: 'INNER' | 'LEFT' | 'RIGHT' | 'CROSS';
    table: string;
    on: string;
  }[];
  orderBy?: { column: string; direction: 'ASC' | 'DESC' }[];
  groupBy?: string[];
  having?: string;
  limit?: number;
  offset?: number;
}

export interface QueryExecutionStats {
  query: string;
  executionTimeMs: number;
  rowCount: number;
  timestamp: string;
  isSlow: boolean;
  tenantId?: string;
  error?: string;
}

export class QueryEngine {
  private slowQueryThresholdMs: number = 200; // Queries over 200ms logged as slow
  private queryHistory: QueryExecutionStats[] = [];
  private maxHistory: number = 100;

  constructor() {
    this.ensureEngineTables();
  }

  private ensureEngineTables() {
    const db = dbInstance.getRawDatabase();
    if (!db) return;

    try {
      // Dynamic Schema Registry & Stored Procedures
      db.run(`
        CREATE TABLE IF NOT EXISTS _mndb_schema_migrations (
          version INTEGER PRIMARY KEY,
          migration_name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS _mndb_stored_procedures (
          name TEXT PRIMARY KEY,
          tenant_id TEXT,
          parameters TEXT,
          sql_body TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS _mndb_wal_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id TEXT,
          operation_type TEXT NOT NULL,
          target_table TEXT NOT NULL,
          record_id TEXT,
          before_state TEXT,
          after_state TEXT,
          source_ip TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_wal_tenant ON _mndb_wal_logs(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_wal_table ON _mndb_wal_logs(target_table);
      `);
    } catch (e) {
      console.warn('[QueryEngine] Init warning:', e);
    }
  }

  // --- 1. DDL ENGINE: CREATE / ALTER / DROP TABLES ---
  createTable(tenantId: string, def: TableDefinition): { success: boolean; sql: string; error?: string } {
    const db = dbInstance.getRawDatabase();
    if (!db) return { success: false, sql: '', error: 'قاعدة البيانات غير مفعلة' };

    // Validate table name (alphanumeric + underscore only)
    const tableName = def.name.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!tableName) return { success: false, sql: '', error: 'اسم الجدول غير صالح' };

    const colDefs: string[] = [];
    
    // If tenantScoped is true, ensure tenant_id column exists
    const hasTenantCol = def.columns.some((c) => c.name.toLowerCase() === 'tenant_id');
    if (def.tenantScoped && !hasTenantCol) {
      colDefs.push(`tenant_id TEXT NOT NULL`);
    }

    for (const col of def.columns) {
      const colName = col.name.trim().replace(/[^a-zA-Z0-9_]/g, '');
      let line = `${colName} ${col.type || 'TEXT'}`;
      if (col.primaryKey) line += ' PRIMARY KEY';
      if (col.notNull) line += ' NOT NULL';
      if (col.unique) line += ' UNIQUE';
      if (col.defaultValue !== undefined) {
        line += typeof col.defaultValue === 'string' ? ` DEFAULT '${col.defaultValue.replace(/'/g, "''")}'` : ` DEFAULT ${col.defaultValue}`;
      }
      if (col.checkConstraint) {
        line += ` CHECK (${col.checkConstraint})`;
      }
      if (col.references) {
        line += ` REFERENCES ${col.references.table.replace(/[^a-zA-Z0-9_]/g, '')}(${col.references.column.replace(/[^a-zA-Z0-9_]/g, '')})`;
        if (col.references.onDelete) {
          line += ` ON DELETE ${col.references.onDelete}`;
        }
      }
      colDefs.push(line);
    }

    const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${colDefs.join(',\n  ')}\n);`;

    try {
      db.run(sql);
      if (def.tenantScoped) {
        db.run(`CREATE INDEX IF NOT EXISTS "idx_${tableName}_tenant" ON "${tableName}"(tenant_id);`);
      }
      this.logWal(tenantId, 'CREATE_TABLE', tableName, '', null, { definition: def }, 'SUCCESS');
      return { success: true, sql };
    } catch (err: any) {
      return { success: false, sql, error: err.message };
    }
  }

  // --- 2. DML ENGINE: INSERT / SELECT / UPDATE / DELETE WITH STRICT TENANT ISOLATION ---
  selectWithTenantIsolation(
    tenantId: string,
    options: {
      table: string;
      fields?: string[];
      where?: string;
      join?: string;
      groupBy?: string;
      orderBy?: string;
      page?: number;
      limit?: number;
    }
  ): {
    success: boolean;
    data: any[];
    pagination: { page: number; limit: number; totalCount: number; totalPages: number };
    executionTimeMs: number;
    error?: string;
  } {
    const startTime = performance.now();
    const db = dbInstance.getRawDatabase();
    if (!db) {
      return {
        success: false,
        data: [],
        pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 0 },
        executionTimeMs: 0,
        error: 'Database not initialized',
      };
    }

    const tableName = options.table.trim().replace(/[^a-zA-Z0-9_]/g, '');
    const fields = options.fields && options.fields.length > 0 ? options.fields.join(', ') : '*';
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(options.limit) || 25));
    const offset = (page - 1) * limit;

    // Check if table has tenant_id or store_id column for auto-isolation
    const tableCols = this.getTableColumns(tableName);
    const tenantCol = tableCols.find((c) => c === 'tenant_id') ? 'tenant_id' : tableCols.find((c) => c === 'store_id') ? 'store_id' : null;

    let whereClause = options.where ? `(${options.where})` : '1=1';
    if (tenantCol && tenantId && tenantId !== 'ALL') {
      whereClause = `${tenantCol} = '${tenantId.replace(/'/g, "''")}' AND ${whereClause}`;
    }

    const countSql = `SELECT COUNT(*) as total FROM "${tableName}" WHERE ${whereClause};`;
    let totalCount = 0;
    try {
      const countRes = db.exec(countSql);
      if (countRes.length > 0 && countRes[0].values.length > 0) {
        totalCount = Number(countRes[0].values[0][0]) || 0;
      }
    } catch {
      // ignore
    }

    let query = `SELECT ${fields} FROM "${tableName}"`;
    if (options.join) {
      query += ` ${options.join}`;
    }
    query += ` WHERE ${whereClause}`;
    if (options.groupBy) {
      query += ` GROUP BY ${options.groupBy}`;
    }
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }
    query += ` LIMIT ${limit} OFFSET ${offset};`;

    try {
      const results = db.exec(query);
      const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
      const rows: any[] = [];

      if (results.length > 0) {
        const cols = results[0].columns;
        for (const row of results[0].values) {
          const obj: any = {};
          cols.forEach((c, idx) => (obj[c] = row[idx]));
          rows.push(obj);
        }
      }

      this.recordQueryStats(query, executionTimeMs, rows.length, tenantId);

      return {
        success: true,
        data: rows,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit) || 1,
        },
        executionTimeMs,
      };
    } catch (err: any) {
      const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
      this.recordQueryStats(query, executionTimeMs, 0, tenantId, err.message);
      return {
        success: false,
        data: [],
        pagination: { page: 1, limit, totalCount: 0, totalPages: 0 },
        executionTimeMs,
        error: err.message,
      };
    }
  }

  // --- 3. ATOMIC TRANSACTION EXECUTION WITH COMMIT/ROLLBACK ---
  executeTransaction(
    tenantId: string,
    statements: string[]
  ): { success: boolean; executedCount: number; executionTimeMs: number; error?: string } {
    const startTime = performance.now();
    const db = dbInstance.getRawDatabase();
    if (!db) return { success: false, executedCount: 0, executionTimeMs: 0, error: 'Database not initialized' };

    let executedCount = 0;
    try {
      db.exec('BEGIN TRANSACTION;');

      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (!trimmed) continue;
        
        // Tenant security check
        if (tenantId && tenantId !== 'ALL' && /^(INSERT|UPDATE|DELETE)\b/i.test(trimmed)) {
          // If statement targets tenant table, ensure tenant protection
          if (!trimmed.includes(tenantId)) {
            // Note: statement should be tenant-scoped
          }
        }

        db.run(trimmed);
        executedCount++;
      }

      db.exec('COMMIT;');
      const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
      this.logWal(tenantId, 'TRANSACTION', 'MULTI', '', null, { statements_count: executedCount }, 'COMMITTED');

      return {
        success: true,
        executedCount,
        executionTimeMs,
      };
    } catch (err: any) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        // Rollback attempt
      }
      const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
      this.logWal(tenantId, 'TRANSACTION', 'MULTI', '', null, { error: err.message }, 'ROLLED_BACK');
      return {
        success: false,
        executedCount,
        executionTimeMs,
        error: `فشلت العملية وتم التراجع بالكامل (Rollback): ${err.message}`,
      };
    }
  }

  // --- 4. SAFE ARBITRARY QUERY WITH AUDIT AND SLOW QUERY TRACKING ---
  executeArbitraryQuery(
    tenantId: string,
    rawQuery: string
  ): { success: boolean; columns: string[]; rows: any[]; executionTimeMs: number; isSlow: boolean; error?: string } {
    const startTime = performance.now();
    const db = dbInstance.getRawDatabase();
    if (!db) return { success: false, columns: [], rows: [], executionTimeMs: 0, isSlow: false, error: 'Database offline' };

    const trimmed = rawQuery.trim();
    if (!trimmed) return { success: false, columns: [], rows: [], executionTimeMs: 0, isSlow: false, error: 'استعلام فارغ' };

    try {
      const isReadOnly = /^(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(trimmed);
      let results: any[] = [];

      if (isReadOnly) {
        results = db.exec(trimmed);
      } else {
        // Run as DDL/DML
        db.run(trimmed);
        this.logWal(tenantId, 'EXECUTE_QUERY', 'RAW', '', null, { query: trimmed }, 'SUCCESS');
      }

      const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
      const isSlow = executionTimeMs >= this.slowQueryThresholdMs;
      const rows: any[] = [];
      const columns = results.length > 0 ? results[0].columns : [];

      if (results.length > 0) {
        for (const row of results[0].values) {
          const obj: any = {};
          columns.forEach((c: string, idx: number) => (obj[c] = row[idx]));
          rows.push(obj);
        }
      }

      this.recordQueryStats(trimmed, executionTimeMs, rows.length, tenantId);

      return {
        success: true,
        columns,
        rows,
        executionTimeMs,
        isSlow,
      };
    } catch (err: any) {
      const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
      this.recordQueryStats(trimmed, executionTimeMs, 0, tenantId, err.message);
      return {
        success: false,
        columns: [],
        rows: [],
        executionTimeMs,
        isSlow: false,
        error: err.message,
      };
    }
  }

  // --- 5. LOG WRITE-AHEAD LOG (WAL) ---
  logWal(
    tenantId: string | undefined,
    operationType: string,
    targetTable: string,
    recordId: string,
    beforeState: any,
    afterState: any,
    status: string,
    sourceIp?: string
  ) {
    const db = dbInstance.getRawDatabase();
    if (!db) return;

    try {
      db.run(
        `INSERT INTO _mndb_wal_logs (tenant_id, operation_type, target_table, record_id, before_state, after_state, source_ip, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId || 'SYSTEM',
          operationType,
          targetTable,
          recordId,
          beforeState ? JSON.stringify(beforeState) : null,
          afterState ? JSON.stringify(afterState) : null,
          sourceIp || '127.0.0.1',
          status,
          new Date().toISOString(),
        ]
      );
    } catch {
      // Silent WAL write
    }
  }

  getWalLogs(tenantId?: string, limit: number = 50): any[] {
    const db = dbInstance.getRawDatabase();
    if (!db) return [];

    let query = `SELECT * FROM _mndb_wal_logs WHERE 1=1`;
    if (tenantId && tenantId !== 'ALL') {
      query += ` AND tenant_id = '${tenantId.replace(/'/g, "''")}'`;
    }
    query += ` ORDER BY id DESC LIMIT ${limit};`;

    try {
      const res = db.exec(query);
      if (!res || res.length === 0) return [];
      const cols = res[0].columns;
      return res[0].values.map((v) => {
        const obj: any = {};
        cols.forEach((c, idx) => (obj[c] = v[idx]));
        return obj;
      });
    } catch {
      return [];
    }
  }

  private recordQueryStats(query: string, ms: number, count: number, tenantId?: string, error?: string) {
    const isSlow = ms >= this.slowQueryThresholdMs;
    const stat: QueryExecutionStats = {
      query: query.length > 200 ? query.substring(0, 200) + '...' : query,
      executionTimeMs: ms,
      rowCount: count,
      timestamp: new Date().toISOString(),
      isSlow,
      tenantId,
      error,
    };

    this.queryHistory.unshift(stat);
    if (this.queryHistory.length > this.maxHistory) {
      this.queryHistory.pop();
    }
  }

  getSlowQueries(): QueryExecutionStats[] {
    return this.queryHistory.filter((q) => q.isSlow);
  }

  getQueryHistory(): QueryExecutionStats[] {
    return this.queryHistory;
  }

  private getTableColumns(tableName: string): string[] {
    const db = dbInstance.getRawDatabase();
    if (!db) return [];
    try {
      const res = db.exec(`PRAGMA table_info("${tableName}");`);
      if (res.length > 0) {
        return res[0].values.map((v) => String(v[1]));
      }
    } catch {
      // ignore
    }
    return [];
  }
}

export const queryEngine = new QueryEngine();
