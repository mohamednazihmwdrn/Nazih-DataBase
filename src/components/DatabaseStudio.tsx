import React, { useState, useEffect } from 'react';
import {
  Database,
  Play,
  Table,
  CheckCircle,
  AlertTriangle,
  Clock,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  Archive,
  RotateCcw,
  Download,
  Upload,
  ShieldCheck,
  Zap,
  FileCode,
  SlidersHorizontal,
  Server,
  Activity,
  Plus,
  ArrowUpDown,
  Search,
  Check,
  Eye,
  FileText,
} from 'lucide-react';
import {
  SystemStats,
  ClientRecord,
  EngineWalLog,
  EngineQueryStat,
  TenantExportManifest,
  ImportValidationReport,
  DynamicColumnDef,
} from '../types';
import { safeFetchJson } from '../lib/api';
import { useLanguage } from '../lib/i18n';

interface DatabaseStudioProps {
  systemStats: SystemStats | null;
  onRefreshStats: () => void;
  clients?: ClientRecord[];
}

export const DatabaseStudio: React.FC<DatabaseStudioProps> = ({
  systemStats,
  onRefreshStats,
  clients = [],
}) => {
  const { language, t } = useLanguage();

  // Navigation Tabs for Mobile-First Submodules
  const [activeEngineTab, setActiveEngineTab] = useState<
    'runner' | 'portability' | 'schema_ddl' | 'wal_audit' | 'slow_queries'
  >('runner');

  // Selected Tenant for isolation
  const [selectedTenant, setSelectedTenant] = useState<string>('ALL');

  // 1. SQL Query Runner States
  const [tables, setTables] = useState<any[]>([]);
  const [sqlQuery, setSqlQuery] = useState<string>(
    'SELECT store_id, COUNT(*) as orders_count, SUM(total_amount) as total_revenue, AVG(total_amount) as avg_ticket FROM active_invoices GROUP BY store_id;'
  );
  const [queryResult, setQueryResult] = useState<{
    columns: string[];
    rows: any[];
    execution_time_ms: number;
    row_count: number;
    error?: string;
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // 2. WAL and Audit Logs
  const [walLogs, setWalLogs] = useState<EngineWalLog[]>([]);
  const [isLoadingWal, setIsLoadingWal] = useState<boolean>(false);

  // 3. Slow Queries & Stats
  const [queryHistory, setQueryHistory] = useState<EngineQueryStat[]>([]);
  const [slowQueries, setSlowQueries] = useState<EngineQueryStat[]>([]);

  // 4. Portability States (Export & Import)
  const [exportFormat, setExportFormat] = useState<'json' | 'sql'>('json');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [validationReport, setValidationReport] = useState<ImportValidationReport | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // 5. Dynamic DDL Table Creator
  const [newTableName, setNewTableName] = useState<string>('');
  const [newColumns, setNewColumns] = useState<DynamicColumnDef[]>([
    { name: 'id', type: 'TEXT', primaryKey: true, notNull: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'amount', type: 'REAL', defaultValue: '0.0' },
    { name: 'status', type: 'TEXT', defaultValue: "'active'" },
  ]);
  const [isCreatingTable, setIsCreatingTable] = useState<boolean>(false);

  // Notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchTables = async () => {
    try {
      const res = await safeFetchJson<{ success: boolean; tables: any[] }>('/api/admin/tables');
      if (res.success && res.data?.tables) {
        setTables(res.data.tables);
      }
    } catch (e) {
      console.warn('[DatabaseStudio] Warning loading tables:', e);
    }
  };

  const fetchWalLogs = async () => {
    setIsLoadingWal(true);
    try {
      const queryParam = selectedTenant !== 'ALL' ? `?tenant_id=${selectedTenant}` : '';
      const res = await safeFetchJson<{ success: boolean; logs: EngineWalLog[] }>(
        `/api/v1/engine/logs/wal${queryParam}`
      );
      if (res.success && res.data?.logs) {
        setWalLogs(res.data.logs);
      }
    } catch (e) {
      console.warn('[DatabaseStudio] Error loading WAL logs:', e);
    } finally {
      setIsLoadingWal(false);
    }
  };

  const fetchQueryPerformance = async () => {
    try {
      const res = await safeFetchJson<{
        success: boolean;
        slow_queries: EngineQueryStat[];
        recent_queries: EngineQueryStat[];
      }>('/api/v1/engine/stats/queries');
      if (res.success && res.data) {
        setSlowQueries(res.data.slow_queries || []);
        setQueryHistory(res.data.recent_queries || []);
      }
    } catch (e) {
      console.warn('[DatabaseStudio] Error loading query performance:', e);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchWalLogs();
    fetchQueryPerformance();
  }, [selectedTenant]);

  // Execute Dynamic SQL Query
  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) return;
    setIsExecuting(true);
    try {
      const res = await safeFetchJson<any>('/api/v1/engine/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: sqlQuery,
          tenant_id: selectedTenant,
        }),
      });
      if (res.data) {
        setQueryResult(res.data);
        if (res.data.success) {
          fetchTables();
          fetchQueryPerformance();
        } else {
          showToast(res.data.error || 'خطأ في تنفيذ استعلام SQL', true);
        }
      } else {
        showToast(res.error || 'فشل تنفيذ الاستعلام', true);
      }
    } catch (err: any) {
      showToast(err.message || 'فشل الاتصال بالسيرفر', true);
    } finally {
      setIsExecuting(false);
    }
  };

  // Trigger Export
  const handleExportData = () => {
    if (!selectedTenant || selectedTenant === 'ALL') {
      showToast('يرجى اختيار شركة محددة لتصدير بياناتها بالكامل', true);
      return;
    }
    setIsExporting(true);
    const url = `/api/v1/portability/export/${selectedTenant}?format=${exportFormat}`;
    window.location.href = url;
    setTimeout(() => {
      setIsExporting(false);
      showToast(`تم بدء تنزيل حزمة بيانات الشركة (${selectedTenant}) بصيغة ${exportFormat.toUpperCase()}`);
    }, 1200);
  };

  // Validate Import File (Dry-run)
  const handleValidateImport = async () => {
    if (!importJsonText.trim()) {
      showToast('يرجى لصق كود JSON لملف استيراد الشركة', true);
      return;
    }
    try {
      const parsed = JSON.parse(importJsonText);
      const res = await safeFetchJson<{ success: boolean; report: ImportValidationReport }>(
        '/api/v1/portability/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manifest: parsed }),
        }
      );
      if (res.success && res.data?.report) {
        setValidationReport(res.data.report);
        if (res.data.report.isValid) {
          showToast('الملف سليم وتم التحقق من البصمة الرقمية وهيكل الجداول');
        } else {
          showToast('تم العثور على أخطاء في ملف الاستيراد', true);
        }
      }
    } catch (err: any) {
      showToast(`كود JSON غير صالح: ${err.message}`, true);
    }
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (!importJsonText.trim()) return;
    setIsImporting(true);
    try {
      const parsed = JSON.parse(importJsonText);
      const res = await safeFetchJson<any>('/api/v1/portability/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifest: parsed,
          overrideExisting: true,
        }),
      });
      if (res.success && res.data) {
        setImportSuccessMsg(res.data.message);
        showToast(res.data.message);
        fetchTables();
        onRefreshStats();
        setImportJsonText('');
        setValidationReport(null);
      } else {
        showToast(res.error || res.data?.error || 'فشلت عملية الاستيراد', true);
      }
    } catch (err: any) {
      showToast(`خطأ في تنفيذ الاستيراد: ${err.message}`, true);
    } finally {
      setIsImporting(false);
    }
  };

  // Dynamic DDL Table Creation
  const handleCreateDynamicTable = async () => {
    if (!newTableName.trim()) {
      showToast('يرجى إدخال اسم الجدول بالإنجليزية', true);
      return;
    }
    setIsCreatingTable(true);
    try {
      const res = await safeFetchJson<any>('/api/v1/engine/table/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTableName,
          columns: newColumns,
          tenant_id: selectedTenant,
          tenantScoped: true,
        }),
      });
      if (res.success && res.data?.success) {
        showToast(`تم إنشاء الجدول "${newTableName}" بنجاح مع عزل Tenant تلقائي.`);
        setNewTableName('');
        fetchTables();
      } else {
        showToast(res.data?.error || res.error || 'فشل إنشاء الجدول', true);
      }
    } catch (err: any) {
      showToast(err.message || 'خطأ أثناء إنشاء الجدول', true);
    } finally {
      setIsCreatingTable(false);
    }
  };

  const addColumnRow = () => {
    setNewColumns([
      ...newColumns,
      { name: `col_${newColumns.length + 1}`, type: 'TEXT', notNull: false },
    ]);
  };

  const sampleQueries = language === 'ar' ? [
    {
      title: 'إجمالي مبيعات كل شركة',
      query:
        'SELECT store_id, COUNT(*) as orders_count, SUM(total_amount) as total_revenue FROM active_invoices GROUP BY store_id;',
    },
    {
      title: 'أكثر الأصناف مبيعاً عبر كافة الشركات',
      query:
        'SELECT item_name, category, SUM(quantity) as total_qty, SUM(total_price) as total_revenue FROM invoice_items GROUP BY item_name ORDER BY total_revenue DESC LIMIT 10;',
    },
    {
      title: 'فحص ميزان المراجعة المحاسبي (Trial Balance)',
      query:
        'SELECT jel.account_code, jel.account_name, SUM(jel.debit) as debits, SUM(jel.credit) as credits, (SUM(jel.debit) - SUM(jel.credit)) as balance FROM journal_entry_lines jel GROUP BY jel.account_code ORDER BY jel.account_code ASC;',
    },
    {
      title: 'فحص سجل المعاملات الحية (WAL Logs)',
      query:
        'SELECT id, tenant_id, operation_type, target_table, status, created_at FROM _mndb_wal_logs ORDER BY id DESC LIMIT 15;',
    },
  ] : [
    {
      title: 'Total Sales by Store',
      query:
        'SELECT store_id, COUNT(*) as orders_count, SUM(total_amount) as total_revenue FROM active_invoices GROUP BY store_id;',
    },
    {
      title: 'Top Selling Items Across All Stores',
      query:
        'SELECT item_name, category, SUM(quantity) as total_qty, SUM(total_price) as total_revenue FROM invoice_items GROUP BY item_name ORDER BY total_revenue DESC LIMIT 10;',
    },
    {
      title: 'Trial Balance Verification',
      query:
        'SELECT jel.account_code, jel.account_name, SUM(jel.debit) as debits, SUM(jel.credit) as credits, (SUM(jel.debit) - SUM(jel.credit)) as balance FROM journal_entry_lines jel GROUP BY jel.account_code ORDER BY jel.account_code ASC;',
    },
    {
      title: 'Active WAL Logs Audit',
      query:
        'SELECT id, tenant_id, operation_type, target_table, status, created_at FROM _mndb_wal_logs ORDER BY id DESC LIMIT 15;',
    },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER & TENANT ISOLATION SELECTOR */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                <span>{t.dbStudioTitle}</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t.dbStudioSub}
            </p>
          </div>

          {/* TENANT SCOPING SELECTOR */}
          <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 self-start md:self-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs text-slate-300 font-bold whitespace-nowrap">{t.dbStudioTenant}</span>
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="bg-slate-950 text-emerald-400 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">🌐 {t.dbStudioAllTenants}</option>
              {clients.map((c) => (
                <option key={c.store_id} value={c.store_id}>
                  🏢 {c.name} ({c.store_id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ENGINE PERFORMANCE KPI STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">
              {language === 'ar' ? 'حجم قاعدة البيانات' : 'Database File Size'}
            </span>
            <span className="font-bold font-mono text-emerald-400 text-sm">
              {systemStats?.database?.file_size_formatted || '1.8 MB'}
            </span>
          </div>
          <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">
              {language === 'ar' ? 'إجمالي الجداول النشطة' : 'Active SQL Tables'}
            </span>
            <span className="font-bold font-mono text-blue-400 text-sm">
              {tables.length} {language === 'ar' ? 'جداول' : 'tables'}
            </span>
          </div>
          <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">
              {language === 'ar' ? 'حركات WAL المسجلة' : 'WAL Commits'}
            </span>
            <span className="font-bold font-mono text-amber-400 text-sm">{walLogs.length}+</span>
          </div>
          <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">
              {language === 'ar' ? 'الاستعلامات البطيئة' : 'Slow Queries'}
            </span>
            <span className="font-bold font-mono text-purple-400 text-sm">{slowQueries.length}</span>
          </div>
        </div>
      </div>

      {/* TOAST ALERTS */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md animate-fade-in ${
            toastMessage.isError
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          {toastMessage.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* MOBILE-FIRST NAVIGATION BAR - FLEX-WRAP */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pb-1 border-b border-slate-200 text-xs">
        <button
          onClick={() => setActiveEngineTab('runner')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-center ${
            activeEngineTab === 'runner'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current shrink-0" />
          <span>{t.dbStudioTabRunner}</span>
        </button>

        <button
          onClick={() => setActiveEngineTab('portability')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-center ${
            activeEngineTab === 'portability'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>{t.dbStudioTabPortability}</span>
        </button>

        <button
          onClick={() => setActiveEngineTab('schema_ddl')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-center ${
            activeEngineTab === 'schema_ddl'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Table className="w-3.5 h-3.5 shrink-0" />
          <span>{t.dbStudioTabSchema}</span>
        </button>

        <button
          onClick={() => setActiveEngineTab('wal_audit')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-center ${
            activeEngineTab === 'wal_audit'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span>{t.dbStudioTabWal}</span>
        </button>

        <button
          onClick={() => setActiveEngineTab('slow_queries')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-center ${
            activeEngineTab === 'slow_queries'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{t.dbStudioTabSlow}</span>
        </button>
      </div>

      {/* 1. SQL RUNNER TAB */}
      {activeEngineTab === 'runner' && (
        <div className="space-y-4">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{language === 'ar' ? 'محرر استعلامات SQL المتقدم (SQL Interactive Runner)' : 'Advanced SQL Interactive Runner'}</span>
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                <span>{language === 'ar' ? 'يدعم: SELECT, JOIN, GROUP BY, DDL, PRAGMA' : 'Supports: SELECT, JOIN, GROUP BY, DDL, PRAGMA'}</span>
              </div>
            </div>

            {/* PREPARED SAMPLES */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-slate-500 shrink-0">{t.dbStudioSampleQueries}:</span>
              {sampleQueries.map((sq, idx) => (
                <button
                  key={idx}
                  onClick={() => setSqlQuery(sq.query)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium whitespace-nowrap transition cursor-pointer"
                >
                  {sq.title}
                </button>
              ))}
            </div>

            {/* SQL TEXTAREA */}
            <div className="relative">
              <textarea
                rows={5}
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                className="w-full p-4 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 leading-relaxed select-all"
                dir="ltr"
                placeholder={language === 'ar' ? 'اكتب استعلام SQL هنا...' : 'Write SQL query here...'}
              />
            </div>

            {/* ACTION ROW */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={handleExecuteSql}
                disabled={isExecuting}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md shadow-blue-600/20 active:scale-98"
              >
                {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                <span>{isExecuting ? t.dbStudioExecuting : t.dbStudioExecute}</span>
              </button>

              {queryResult && (
                <div className="text-xs font-mono text-slate-500 flex items-center gap-3">
                  <span>{language === 'ar' ? 'عدد الصفوف:' : 'Rows:'} {queryResult.row_count}</span>
                  <span>{language === 'ar' ? 'الزمن:' : 'Latency:'} {queryResult.execution_time_ms}ms</span>
                </div>
              )}
            </div>

            {/* QUERY RESULT TABLE */}
            {queryResult && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                {queryResult.error ? (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
                    ❌ خطأ في التنفيذ: {queryResult.error}
                  </div>
                ) : queryResult.rows && queryResult.rows.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto max-h-80">
                    <table className="w-full text-right text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-600 text-[10px] font-mono uppercase font-bold border-b border-slate-200">
                        <tr>
                          {queryResult.columns.map((col, idx) => (
                            <th key={idx} className="py-2.5 px-3">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {queryResult.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50">
                            {queryResult.columns.map((col, cIdx) => (
                              <td key={cIdx} className="py-2 px-3 text-slate-800">
                                {row[col] !== null && row[col] !== undefined ? String(row[col]) : 'NULL'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-400 text-xs font-sans">
                    تم تنفيذ الاستعلام بنجاح. لا توجد نتائج مطابقة.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* TABLE SCHEMAS DIRECTORY */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">جداول ومخطط قاعدة البيانات (Active Schema)</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">{tables.length} جداول مسجلة</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map((tbl, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 font-mono">{tbl.table_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono font-bold">
                      {tbl.row_count} صفوف
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono divide-y divide-slate-200/60 pt-1">
                    {tbl.columns &&
                      tbl.columns.slice(0, 5).map((c: any, cIdx: number) => (
                        <div key={cIdx} className="py-1 flex items-center justify-between">
                          <span className="text-slate-700">{c.name}</span>
                          <span className="text-[10px] text-slate-400">{c.type}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. TENANT DATA PORTABILITY TAB (ZERO LOCK-IN) */}
      {activeEngineTab === 'portability' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* EXPORT PANEL */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تصدير كامل بيانات الشركة (Export Data)</h3>
                  <p className="text-xs text-slate-500">
                    ضمان حرية البيانات (Zero Lock-in): يمكن للشركة تصدير كافة فواتيرها، قيودها، ومشاريعها بالكامل.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-700 block">اختر الشركة المراد تصدير بياناتها:</label>
                <select
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL" disabled>
                    -- يرجى اختيار متجر / شركة --
                  </option>
                  {clients.map((c) => (
                    <option key={c.store_id} value={c.store_id}>
                      {c.name} ({c.store_id}) - {c.total_invoices_ingested} فاتورة
                    </option>
                  ))}
                </select>

                <label className="text-xs font-bold text-slate-700 block pt-2">صيغة التصدير المستهدفة:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExportFormat('json')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                      exportFormat === 'json'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900'
                        : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <FileCode className="w-4 h-4 text-indigo-600" />
                    <span>حزمة JSON القياسية (v2.0)</span>
                    <span className="text-[10px] text-slate-500 font-normal">بصمة SHA-256 + بيانات كاملة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('sql')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                      exportFormat === 'sql'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900'
                        : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span>ملف تفريغ SQL Dump</span>
                    <span className="text-[10px] text-slate-500 font-normal">متوافق مع PostgreSQL وSQLite</span>
                  </button>
                </div>

                <button
                  onClick={handleExportData}
                  disabled={isExporting || selectedTenant === 'ALL'}
                  className="w-full mt-3 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>توليد وتنزيل حزمة البيانات الآن</span>
                </button>
              </div>
            </div>

            {/* IMPORT PANEL */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">استيراد ونقل شركة (Import Company Data)</h3>
                  <p className="text-xs text-slate-500">
                    استيراد حزمة بيانات لشركة من سيرفر آخر مع فحص مسبق (Dry Run) ومطابقة البصمة المشفرة.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 block">الصق محتوى ملف JSON للشركة المستوردة:</label>
                <textarea
                  rows={4}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="الصق كود JSON الخاص بملف التصدير هنا..."
                  dir="ltr"
                  className="w-full p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl border border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleValidateImport}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-600" />
                    <span>فحص سلامة الملف (Dry Run)</span>
                  </button>

                  <button
                    onClick={handleExecuteImport}
                    disabled={isImporting || !importJsonText.trim()}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>تأكيد الاستيراد الفعلي</span>
                  </button>
                </div>

                {/* DRY-RUN VALIDATION REPORT CARD */}
                {validationReport && (
                  <div
                    className={`p-4 rounded-xl border text-xs space-y-2 ${
                      validationReport.isValid
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50/70 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        {validationReport.isValid ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                        تقرير الفحص المسبق: {validationReport.isValid ? 'جاهز للاستيراد' : 'يحتوي على أخطاء'}
                      </span>
                      <span className="font-mono text-[11px]">{validationReport.format_version}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                      <div>معرف الشركة: {validationReport.store_id}</div>
                      <div>اسم المنشأة: {validationReport.company_name}</div>
                      <div>الفواتير: {validationReport.record_counts.invoices}</div>
                      <div>القيود: {validationReport.record_counts.journal_entries}</div>
                    </div>

                    {validationReport.warnings.length > 0 && (
                      <div className="text-[11px] text-amber-800 bg-amber-100/60 p-2 rounded-lg">
                        ⚠️ {validationReport.warnings.join(' | ')}
                      </div>
                    )}

                    {validationReport.errors.length > 0 && (
                      <div className="text-[11px] text-rose-800 bg-rose-100/60 p-2 rounded-lg">
                        ❌ {validationReport.errors.join(' | ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. DDL DYNAMIC SCHEMA CREATOR */}
      {activeEngineTab === 'schema_ddl' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">منشئ الجداول المخصصة (Dynamic DDL Engine)</h3>
              <p className="text-xs text-slate-500">
                إنشاء جداول مخصصة فورية مع إضافة عمود tenant_id تلقائياً وفهرسته لضمان العزل الآمن بين التطبيقات.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">اسم الجدول الجديد (بالإنجليزية):</label>
              <input
                type="text"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="مثال: warehouse_inventory أو project_contracts"
                className="w-full sm:w-96 p-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-purple-500"
                dir="ltr"
              />
            </div>

            {/* COLUMNS BUILDER */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">أعمدة الجدول (Columns Definition):</span>
                <button
                  type="button"
                  onClick={addColumnRow}
                  className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة عمود</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-right text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">اسم العمود (Field)</th>
                      <th className="py-2 px-3">النوع (Type)</th>
                      <th className="py-2 px-3">مفتاح رئيسي (PK)</th>
                      <th className="py-2 px-3">غير فارغ (Not Null)</th>
                      <th className="py-2 px-3">قيمة افتراضية (Default)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {newColumns.map((col, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={col.name}
                            onChange={(e) => {
                              const updated = [...newColumns];
                              updated[idx].name = e.target.value;
                              setNewColumns(updated);
                            }}
                            className="p-1 rounded border border-slate-200 text-xs font-mono w-full"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={col.type}
                            onChange={(e) => {
                              const updated = [...newColumns];
                              updated[idx].type = e.target.value as any;
                              setNewColumns(updated);
                            }}
                            className="p-1 rounded border border-slate-200 text-xs font-mono"
                          >
                            <option value="TEXT">TEXT</option>
                            <option value="INTEGER">INTEGER</option>
                            <option value="REAL">REAL</option>
                            <option value="DATETIME">DATETIME</option>
                            <option value="BOOLEAN">BOOLEAN</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={col.primaryKey || false}
                            onChange={(e) => {
                              const updated = [...newColumns];
                              updated[idx].primaryKey = e.target.checked;
                              setNewColumns(updated);
                            }}
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={col.notNull || false}
                            onChange={(e) => {
                              const updated = [...newColumns];
                              updated[idx].notNull = e.target.checked;
                              setNewColumns(updated);
                            }}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={col.defaultValue || ''}
                            onChange={(e) => {
                              const updated = [...newColumns];
                              updated[idx].defaultValue = e.target.value;
                              setNewColumns(updated);
                            }}
                            placeholder="اختياري"
                            className="p-1 rounded border border-slate-200 text-xs font-mono w-28"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={handleCreateDynamicTable}
              disabled={isCreatingTable}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md shadow-purple-600/20"
            >
              {isCreatingTable ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Table className="w-4 h-4" />}
              <span>تثبيت وإنشاء الجدول الآن في قاعدة البيانات</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. WAL ATOMIC AUDIT LOGS */}
      {activeEngineTab === 'wal_audit' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">سجل المعاملات والعمليات الذرية (Write-Ahead Log)</h3>
                <p className="text-xs text-slate-500">
                  تسجيل حي لكافة عمليات التعديل، الإنشاء، الحذف، والعمليات الذرية لحماية تكامل البيانات ومنع التكرار.
                </p>
              </div>
            </div>
            <button
              onClick={fetchWalLogs}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWal ? 'animate-spin' : ''}`} />
              <span>تحديث السجل</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto max-h-96">
            <table className="w-full text-right text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold font-mono uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">الشركة (Tenant)</th>
                  <th className="py-2.5 px-3">نوع العملية</th>
                  <th className="py-2.5 px-3">الجدول المستهدف</th>
                  <th className="py-2.5 px-3">الحالة</th>
                  <th className="py-2.5 px-3">عنوان IP</th>
                  <th className="py-2.5 px-3">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {walLogs.length > 0 ? (
                  walLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-400">#{log.id}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{log.tenant_id}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {log.operation_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{log.target_table}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'SUCCESS' || log.status === 'COMMITTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">{log.source_ip}</td>
                      <td className="py-2 px-3 text-slate-400 text-[10px]">{log.created_at}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400 font-sans text-xs">
                      لا توجد حركات مسجلة حالياً في سجل WAL.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. SLOW QUERIES MONITOR */}
      {activeEngineTab === 'slow_queries' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">مراقبة أداء الاستعلامات والعمليات البطيئة</h3>
                <p className="text-xs text-slate-500">
                  رصد الاستعلامات التي تستغرق أكثر من 200ms للتحسين المستمر للأداء ومنع اختناق السيرفر.
                </p>
              </div>
            </div>
            <button
              onClick={fetchQueryPerformance}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث الأداء</span>
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>الاستعلامات البطيئة المرصودة ({slowQueries.length})</span>
            </h4>

            {slowQueries.length > 0 ? (
              <div className="space-y-2">
                {slowQueries.map((q, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between text-rose-800 font-bold">
                      <span>زمن الاستجابة: {q.executionTimeMs}ms</span>
                      <span className="text-[10px] text-slate-500">{q.timestamp}</span>
                    </div>
                    <p className="text-slate-800 bg-white/80 p-2 rounded border border-rose-100 overflow-x-auto">
                      {q.query}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>ممتاز! كافة الاستعلامات تنفذ بأقل من 200ms وبأداء فائق السرعة.</span>
              </div>
            )}

            <h4 className="text-xs font-bold text-slate-800 pt-3">سجل آخر الاستعلامات المنفذة مؤخراً:</h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto max-h-64">
              <table className="w-full text-right text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold font-mono border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">الاستعلام</th>
                    <th className="py-2 px-3">الزمن</th>
                    <th className="py-2 px-3">الصفوف</th>
                    <th className="py-2 px-3">الحالة</th>
                    <th className="py-2 px-3">الوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {queryHistory.slice(0, 15).map((qh, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-800 max-w-xs truncate" title={qh.query}>
                        {qh.query}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{qh.executionTimeMs}ms</td>
                      <td className="py-2 px-3 text-slate-600">{qh.rowCount}</td>
                      <td className="py-2 px-3">
                        {qh.error ? (
                          <span className="text-rose-600 font-bold">خطأ</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">ناجح</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-[10px]">{qh.timestamp.split('T')[1]?.slice(0, 8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
