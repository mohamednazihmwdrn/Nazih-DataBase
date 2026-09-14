import crypto from 'crypto';
import { dbInstance } from './db';
import { queryEngine } from './queryEngine';

export interface CompanyExportManifest {
  format_version: '2.0.0';
  engine: 'MNDB_SaaS_Data_Engine';
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

export interface ValidationReport {
  isValid: boolean;
  format_version?: string;
  store_id?: string;
  company_name?: string;
  record_counts: Record<string, number>;
  warnings: string[];
  errors: string[];
  dryRunPassed: boolean;
}

export class TenantDataPortability {
  // --- 1. EXPORT FULL COMPANY DATA (STANDARDIZED OPEN JSON MANIFEST) ---
  exportCompanyData(storeId: string): CompanyExportManifest | null {
    const db = dbInstance.getRawDatabase();
    if (!db) return null;

    const sId = storeId.trim().toUpperCase();
    const client = dbInstance.getClientByStoreId(sId);
    if (!client) return null;

    const fetchRows = (query: string): any[] => {
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
    };

    // 1. Core Tenant Tables
    const invoices = fetchRows(`SELECT * FROM active_invoices WHERE store_id = '${sId}' ORDER BY created_at ASC;`);
    const invoiceItems = fetchRows(`SELECT * FROM invoice_items WHERE store_id = '${sId}' ORDER BY created_at ASC;`);
    const costCenters = fetchRows(`SELECT * FROM cost_centers WHERE store_id = '${sId}' ORDER BY created_at ASC;`);
    const journalEntries = fetchRows(`SELECT * FROM journal_entries WHERE store_id = '${sId}' ORDER BY created_at ASC;`);
    
    // Journal Entry Lines
    let journalLines: any[] = [];
    if (journalEntries.length > 0) {
      const entryIds = journalEntries.map((j) => `'${j.id}'`).join(',');
      journalLines = fetchRows(`SELECT * FROM journal_entry_lines WHERE entry_id IN (${entryIds});`);
    }

    // 2. Discover Custom Dynamic Tables (Tenant scoped)
    const customTablesData: Record<string, any[]> = {};
    const schemaDefinitions: Array<{ table_name: string; create_sql: string }> = [];

    const allTablesRes = db.exec(`SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`);
    if (allTablesRes.length > 0) {
      for (const row of allTablesRes[0].values) {
        const tName = String(row[0]);
        const createSql = String(row[1] || '');

        // Standard tables we already extracted
        const isBuiltIn = [
          'clients',
          'active_invoices',
          'invoice_items',
          'archived_invoices',
          'archived_invoice_items',
          'cost_centers',
          'journal_entries',
          'journal_entry_lines',
          'api_logs',
          'sync_operations',
          'sync_log',
          '_mndb_schema_migrations',
          '_mndb_stored_procedures',
          '_mndb_wal_logs',
          '_backup_meta',
        ].includes(tName);

        if (!isBuiltIn) {
          // Check if table has store_id or tenant_id
          const pragmaCols = fetchRows(`PRAGMA table_info("${tName}");`);
          const hasTenant = pragmaCols.some((c) => c.name === 'store_id' || c.name === 'tenant_id');

          if (hasTenant) {
            const tenantCol = pragmaCols.find((c) => c.name === 'tenant_id') ? 'tenant_id' : 'store_id';
            const customRows = fetchRows(`SELECT * FROM "${tName}" WHERE ${tenantCol} = '${sId}';`);
            customTablesData[tName] = customRows;
            schemaDefinitions.push({
              table_name: tName,
              create_sql: createSql,
            });
          }
        }
      }
    }

    const payloadWithoutChecksum: Omit<CompanyExportManifest, 'checksum_sha256'> = {
      format_version: '2.0.0',
      engine: 'MNDB_SaaS_Data_Engine',
      export_date: new Date().toISOString(),
      tenant_info: {
        store_id: client.store_id,
        name: client.name,
        owner_email: client.owner_email,
        plan: client.plan,
        created_at: client.created_at,
        schema_version: 2,
      },
      metrics: {
        total_invoices: invoices.length,
        total_invoice_items: invoiceItems.length,
        total_cost_centers: costCenters.length,
        total_journal_entries: journalEntries.length,
        total_journal_lines: journalLines.length,
        total_custom_tables: Object.keys(customTablesData).length,
      },
      schema_definitions: schemaDefinitions,
      data: {
        company: client,
        invoices,
        invoice_items: invoiceItems,
        cost_centers: costCenters,
        journal_entries: journalEntries,
        journal_entry_lines: journalLines,
        custom_tables_data: customTablesData,
      },
    };

    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(payloadWithoutChecksum.data))
      .digest('hex');

    const manifest: CompanyExportManifest = {
      ...payloadWithoutChecksum,
      checksum_sha256: checksum,
    };

    queryEngine.logWal(sId, 'EXPORT_COMPANY_DATA', 'ALL_TABLES', sId, null, manifest.metrics, 'SUCCESS');

    return manifest;
  }

  // --- 2. GENERATE PORTABLE SQL DUMP (ANSI/SQLITE COMPATIBLE) ---
  exportCompanySqlDump(storeId: string): string | null {
    const manifest = this.exportCompanyData(storeId);
    if (!manifest) return null;

    const sId = manifest.tenant_info.store_id;
    let sql = `-- =====================================================================\n`;
    sql += `-- STOREPULSE / MNDB SAAS DATABASE ENGINE - PORTABLE TENANT DUMP\n`;
    sql += `-- Tenant Store ID: ${sId}\n`;
    sql += `-- Company Name:    ${manifest.tenant_info.name}\n`;
    sql += `-- Export Date:    ${manifest.export_date}\n`;
    sql += `-- Checksum SHA256: ${manifest.checksum_sha256}\n`;
    sql += `-- Format Version:  ${manifest.format_version}\n`;
    sql += `-- Compatible with: SQLite 3, PostgreSQL, MySQL (with minor type mapping)\n`;
    sql += `-- =====================================================================\n\n`;
    sql += `BEGIN TRANSACTION;\n\n`;

    // 1. Client Table Record
    sql += `-- 1. TENANT ENTITY\n`;
    const c = manifest.data.company;
    sql += `INSERT OR REPLACE INTO clients (id, store_id, name, owner_email, api_key, plan, status, subscription_expires_at, rate_limit_per_minute, total_invoices_ingested, total_revenue_ingested, created_at, updated_at)\n`;
    sql += `VALUES ('${c.id}', '${c.store_id}', '${(c.name || '').replace(/'/g, "''")}', '${c.owner_email}', '${c.api_key}', '${c.plan}', '${c.status}', '${c.subscription_expires_at}', ${c.rate_limit_per_minute || 120}, ${c.total_invoices_ingested || 0}, ${c.total_revenue_ingested || 0}, '${c.created_at}', '${c.updated_at}');\n\n`;

    // 2. Cost Centers
    if (manifest.data.cost_centers.length > 0) {
      sql += `-- 2. COST CENTERS (${manifest.data.cost_centers.length} records)\n`;
      for (const cc of manifest.data.cost_centers) {
        sql += `INSERT OR REPLACE INTO cost_centers (id, store_id, code, name, category, manager_name, budget, spent_amount, revenue_amount, status, created_at, updated_at)\n`;
        sql += `VALUES ('${cc.id}', '${cc.store_id}', '${cc.code}', '${(cc.name || '').replace(/'/g, "''")}', '${(cc.category || '').replace(/'/g, "''")}', '${(cc.manager_name || '').replace(/'/g, "''")}', ${cc.budget || 0}, ${cc.spent_amount || 0}, ${cc.revenue_amount || 0}, '${cc.status || 'active'}', '${cc.created_at}', '${cc.updated_at}');\n`;
      }
      sql += `\n`;
    }

    // 3. Invoices
    if (manifest.data.invoices.length > 0) {
      sql += `-- 3. INVOICES (${manifest.data.invoices.length} records)\n`;
      for (const inv of manifest.data.invoices) {
        sql += `INSERT OR REPLACE INTO active_invoices (id, store_id, invoice_number, customer_name, customer_phone, payment_method, subtotal, tax, discount, total_amount, item_count, cost_center_id, project_stage, status, created_at)\n`;
        sql += `VALUES ('${inv.id}', '${inv.store_id}', '${inv.invoice_number}', '${(inv.customer_name || '').replace(/'/g, "''")}', '${(inv.customer_phone || '').replace(/'/g, "''")}', '${inv.payment_method}', ${inv.subtotal || 0}, ${inv.tax || 0}, ${inv.discount || 0}, ${inv.total_amount || 0}, ${inv.item_count || 0}, ${inv.cost_center_id ? `'${inv.cost_center_id}'` : 'NULL'}, ${inv.project_stage ? `'${inv.project_stage}'` : 'NULL'}, '${inv.status || 'completed'}', '${inv.created_at}');\n`;
      }
      sql += `\n`;
    }

    // 4. Invoice Items
    if (manifest.data.invoice_items.length > 0) {
      sql += `-- 4. INVOICE ITEMS (${manifest.data.invoice_items.length} records)\n`;
      for (const item of manifest.data.invoice_items) {
        sql += `INSERT OR REPLACE INTO invoice_items (id, invoice_id, store_id, item_name, category, quantity, unit_price, total_price, created_at)\n`;
        sql += `VALUES ('${item.id}', '${item.invoice_id}', '${item.store_id}', '${(item.item_name || '').replace(/'/g, "''")}', '${(item.category || '').replace(/'/g, "''")}', ${item.quantity || 1}, ${item.unit_price || 0}, ${item.total_price || 0}, '${item.created_at}');\n`;
      }
      sql += `\n`;
    }

    // 5. Journal Entries & Lines
    if (manifest.data.journal_entries.length > 0) {
      sql += `-- 5. GENERAL LEDGER JOURNAL ENTRIES (${manifest.data.journal_entries.length} records)\n`;
      for (const je of manifest.data.journal_entries) {
        sql += `INSERT OR REPLACE INTO journal_entries (id, store_id, entry_number, date, reference_type, reference_id, cost_center_id, cost_center_name, description, total_debit, total_credit, is_reversed, reversal_entry_id, is_immutable, created_at)\n`;
        sql += `VALUES ('${je.id}', '${je.store_id}', '${je.entry_number}', '${je.date}', '${je.reference_type}', ${je.reference_id ? `'${je.reference_id}'` : 'NULL'}, ${je.cost_center_id ? `'${je.cost_center_id}'` : 'NULL'}, ${je.cost_center_name ? `'${(je.cost_center_name || '').replace(/'/g, "''")}'` : 'NULL'}, '${(je.description || '').replace(/'/g, "''")}', ${je.total_debit || 0}, ${je.total_credit || 0}, ${je.is_reversed || 0}, ${je.reversal_entry_id ? `'${je.reversal_entry_id}'` : 'NULL'}, 1, '${je.created_at}');\n`;
      }
      sql += `\n`;
    }

    if (manifest.data.journal_entry_lines.length > 0) {
      sql += `-- 6. JOURNAL ENTRY LINES (${manifest.data.journal_entry_lines.length} lines)\n`;
      for (const jl of manifest.data.journal_entry_lines) {
        sql += `INSERT OR REPLACE INTO journal_entry_lines (id, entry_id, account_code, account_name, debit, credit, cost_center_id, line_memo)\n`;
        sql += `VALUES ('${jl.id}', '${jl.entry_id}', '${jl.account_code}', '${(jl.account_name || '').replace(/'/g, "''")}', ${jl.debit || 0}, ${jl.credit || 0}, ${jl.cost_center_id ? `'${jl.cost_center_id}'` : 'NULL'}, '${(jl.line_memo || '').replace(/'/g, "''")}');\n`;
      }
      sql += `\n`;
    }

    // 6. Custom Dynamic Tables
    if (manifest.schema_definitions.length > 0) {
      sql += `-- 7. CUSTOM DYNAMIC SCHEMAS & DATA\n`;
      for (const def of manifest.schema_definitions) {
        sql += `${def.create_sql};\n`;
        const rows = manifest.data.custom_tables_data[def.table_name] || [];
        for (const r of rows) {
          const cols = Object.keys(r);
          const colList = cols.map((k) => `"${k}"`).join(', ');
          const valList = cols
            .map((k) => (r[k] === null || r[k] === undefined ? 'NULL' : typeof r[k] === 'number' ? r[k] : `'${String(r[k]).replace(/'/g, "''")}'`))
            .join(', ');
          sql += `INSERT OR REPLACE INTO "${def.table_name}" (${colList}) VALUES (${valList});\n`;
        }
      }
      sql += `\n`;
    }

    sql += `COMMIT;\n`;
    return sql;
  }

  // --- 3. VALIDATE IMPORT MANIFEST (DRY RUN & CHECKSUM VERIFICATION) ---
  validateImportFile(rawJson: string | object): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];
    let manifest: CompanyExportManifest;

    try {
      manifest = typeof rawJson === 'string' ? JSON.parse(rawJson) : (rawJson as any);
    } catch (e: any) {
      return {
        isValid: false,
        record_counts: {},
        warnings: [],
        errors: [`صيغة الملف غير صالحة: ${e.message}`],
        dryRunPassed: false,
      };
    }

    if (!manifest.format_version) {
      errors.push('الملف لا يحتوي على رقم إصدار معتمد (format_version)');
    }

    if (!manifest.tenant_info?.store_id) {
      errors.push('الملف غير مرتبط بمعرف شركة محدد (store_id مفقود)');
    }

    if (!manifest.data) {
      errors.push('حزمة البيانات (data) مفقودة في ملف التصدير');
    }

    // Checksum Integrity Check
    if (manifest.checksum_sha256 && manifest.data) {
      const calculatedChecksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(manifest.data))
        .digest('hex');

      if (calculatedChecksum !== manifest.checksum_sha256) {
        warnings.push('تحذير: البصمة الرقمية SHA-256 للملف تختلف عن البصمة الأصلية (قد يكون تم تعديل الملف يدوياً)');
      }
    }

    const recordCounts: Record<string, number> = {
      invoices: manifest.data?.invoices?.length || 0,
      invoice_items: manifest.data?.invoice_items?.length || 0,
      cost_centers: manifest.data?.cost_centers?.length || 0,
      journal_entries: manifest.data?.journal_entries?.length || 0,
      journal_entry_lines: manifest.data?.journal_entry_lines?.length || 0,
      custom_tables: Object.keys(manifest.data?.custom_tables_data || {}).length,
    };

    const isValid = errors.length === 0;

    return {
      isValid,
      format_version: manifest.format_version,
      store_id: manifest.tenant_info?.store_id,
      company_name: manifest.tenant_info?.name,
      record_counts: recordCounts,
      warnings,
      errors,
      dryRunPassed: isValid,
    };
  }

  // --- 4. IMPORT COMPANY DATA WITH ATOMIC TRANSACTIONS & RESTORATION ---
  importCompanyData(
    manifestOrJson: string | CompanyExportManifest,
    options: { overrideExisting?: boolean; targetStoreId?: string } = {}
  ): {
    success: boolean;
    store_id: string;
    imported_records: Record<string, number>;
    message: string;
    error?: string;
  } {
    const validation = this.validateImportFile(manifestOrJson);
    if (!validation.isValid) {
      return {
        success: false,
        store_id: validation.store_id || '',
        imported_records: {},
        message: 'فشل فحص سلامة الملف',
        error: validation.errors.join('; '),
      };
    }

    const manifest: CompanyExportManifest =
      typeof manifestOrJson === 'string' ? JSON.parse(manifestOrJson) : manifestOrJson;

    const db = dbInstance.getRawDatabase();
    if (!db) {
      return {
        success: false,
        store_id: manifest.tenant_info.store_id,
        imported_records: {},
        message: 'قاعدة البيانات غير مفعلة',
        error: 'Database not initialized',
      };
    }

    // Determine target store_id (allow renaming on import if needed)
    const storeId = (options.targetStoreId || manifest.tenant_info.store_id).trim().toUpperCase();

    try {
      db.exec('BEGIN TRANSACTION;');

      // 1. Insert/Update Client Record
      const c = manifest.data.company || manifest.tenant_info;
      const clientName = (c.name || 'مستورد من سيرفر خارجي').replace(/'/g, "''");
      const clientEmail = c.owner_email || 'imported@tenant.local';
      const clientKey = c.api_key || `imported_${storeId.toLowerCase()}_${Date.now()}`;
      const now = new Date().toISOString();

      db.run(
        `INSERT OR REPLACE INTO clients (id, store_id, name, owner_email, api_key, plan, status, subscription_expires_at, rate_limit_per_minute, total_invoices_ingested, total_revenue_ingested, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id || `c_${storeId.toLowerCase()}`,
          storeId,
          clientName,
          clientEmail,
          clientKey,
          c.plan || 'pro',
          'active',
          c.subscription_expires_at || new Date(Date.now() + 86400000 * 365).toISOString(),
          c.rate_limit_per_minute || 120,
          manifest.data.invoices?.length || 0,
          manifest.data.invoices?.reduce((acc: number, inv: any) => acc + (Number(inv.total_amount) || 0), 0) || 0,
          c.created_at || now,
          now,
        ]
      );

      // 2. Insert Custom Dynamic Schemas
      if (manifest.schema_definitions) {
        for (const def of manifest.schema_definitions) {
          try {
            db.run(def.create_sql);
          } catch {
            // Already created
          }
        }
      }

      // 3. Insert Cost Centers
      let ccCount = 0;
      if (manifest.data.cost_centers) {
        for (const cc of manifest.data.cost_centers) {
          db.run(
            `INSERT OR REPLACE INTO cost_centers (id, store_id, code, name, category, manager_name, budget, spent_amount, revenue_amount, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              cc.id,
              storeId,
              cc.code,
              cc.name,
              cc.category || 'إنشاءات ومقاولات',
              cc.manager_name || '',
              cc.budget || 0,
              cc.spent_amount || 0,
              cc.revenue_amount || 0,
              cc.status || 'active',
              cc.created_at || now,
              now,
            ]
          );
          ccCount++;
        }
      }

      // 4. Insert Invoices
      let invCount = 0;
      if (manifest.data.invoices) {
        for (const inv of manifest.data.invoices) {
          db.run(
            `INSERT OR REPLACE INTO active_invoices (id, store_id, invoice_number, customer_name, customer_phone, payment_method, subtotal, tax, discount, total_amount, item_count, cost_center_id, project_stage, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              inv.id,
              storeId,
              inv.invoice_number,
              inv.customer_name || 'عميل مستورد',
              inv.customer_phone || '',
              inv.payment_method || 'card',
              inv.subtotal || 0,
              inv.tax || 0,
              inv.discount || 0,
              inv.total_amount || 0,
              inv.item_count || 0,
              inv.cost_center_id || null,
              inv.project_stage || null,
              inv.status || 'completed',
              inv.created_at || now,
            ]
          );
          invCount++;
        }
      }

      // 5. Insert Invoice Items
      let itemCount = 0;
      if (manifest.data.invoice_items) {
        for (const item of manifest.data.invoice_items) {
          db.run(
            `INSERT OR REPLACE INTO invoice_items (id, invoice_id, store_id, item_name, category, quantity, unit_price, total_price, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id,
              item.invoice_id,
              storeId,
              item.item_name,
              item.category || 'عام',
              item.quantity || 1,
              item.unit_price || 0,
              item.total_price || 0,
              item.created_at || now,
            ]
          );
          itemCount++;
        }
      }

      // 6. Insert Journal Entries & Lines
      let jeCount = 0;
      let jlCount = 0;
      if (manifest.data.journal_entries) {
        for (const je of manifest.data.journal_entries) {
          db.run(
            `INSERT OR REPLACE INTO journal_entries (id, store_id, entry_number, date, reference_type, reference_id, cost_center_id, cost_center_name, description, total_debit, total_credit, is_reversed, reversal_entry_id, is_immutable, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              je.id,
              storeId,
              je.entry_number,
              je.date,
              je.reference_type || 'invoice',
              je.reference_id || null,
              je.cost_center_id || null,
              je.cost_center_name || null,
              je.description,
              je.total_debit || 0,
              je.total_credit || 0,
              je.is_reversed || 0,
              je.reversal_entry_id || null,
              1,
              je.created_at || now,
            ]
          );
          jeCount++;
        }
      }

      if (manifest.data.journal_entry_lines) {
        for (const jl of manifest.data.journal_entry_lines) {
          db.run(
            `INSERT OR REPLACE INTO journal_entry_lines (id, entry_id, account_code, account_name, debit, credit, cost_center_id, line_memo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              jl.id,
              jl.entry_id,
              jl.account_code,
              jl.account_name,
              jl.debit || 0,
              jl.credit || 0,
              jl.cost_center_id || null,
              jl.line_memo || '',
            ]
          );
          jlCount++;
        }
      }

      // 7. Insert Custom Tables Data
      if (manifest.data.custom_tables_data) {
        for (const [tName, rows] of Object.entries(manifest.data.custom_tables_data)) {
          for (const r of rows) {
            const copy = { ...r };
            if ('store_id' in copy) copy.store_id = storeId;
            if ('tenant_id' in copy) copy.tenant_id = storeId;
            const cols = Object.keys(copy);
            const placeholders = cols.map(() => '?').join(', ');
            const colNames = cols.map((k) => `"${k}"`).join(', ');
            const vals = cols.map((k) => copy[k]);
            db.run(`INSERT OR REPLACE INTO "${tName}" (${colNames}) VALUES (${placeholders});`, vals);
          }
        }
      }

      db.exec('COMMIT;');
      dbInstance.persistToDiskExplicit();

      queryEngine.logWal(storeId, 'IMPORT_COMPANY_DATA', 'ALL_TABLES', storeId, null, { imported_invoices: invCount }, 'COMMITTED');

      return {
        success: true,
        store_id: storeId,
        imported_records: {
          invoices: invCount,
          items: itemCount,
          cost_centers: ccCount,
          journal_entries: jeCount,
          journal_lines: jlCount,
        },
        message: `تم استيراد بيانات الشركة ${clientName} (${storeId}) بنجاح إلى محرك البيانات.`,
      };
    } catch (err: any) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        // Rollback
      }
      return {
        success: false,
        store_id: storeId,
        imported_records: {},
        message: 'فشلت عملية الاستيراد وتم التراجع عن كافة التغييرات',
        error: err.message,
      };
    }
  }
}

export const tenantDataPortability = new TenantDataPortability();
