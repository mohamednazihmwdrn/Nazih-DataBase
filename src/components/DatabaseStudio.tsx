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
} from 'lucide-react';
import { SystemStats } from '../types';

interface DatabaseStudioProps {
  systemStats: SystemStats | null;
  onRefreshStats: () => void;
}

export const DatabaseStudio: React.FC<DatabaseStudioProps> = ({
  systemStats,
  onRefreshStats,
}) => {
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
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/admin/tables');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTables(data.tables || []);
        }
      }
    } catch (e) {
      console.error('Failed to load tables schema', e);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) return;
    setIsExecuting(true);
    try {
      const res = await fetch('/api/admin/sql-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sqlQuery }),
      });
      const data = await res.json();
      setQueryResult(data);
      if (!data.success) {
        showToast(data.error || 'خطأ في تنفيذ استعلام SQL', true);
      }
    } catch (err: any) {
      showToast(err.message || 'فشل الاتصال بالسيرفر', true);
    } finally {
      setIsExecuting(false);
    }
  };

  const sampleQueries = [
    {
      title: 'إجمالي مبيعات كل متجر',
      query:
        'SELECT store_id, COUNT(*) as orders_count, SUM(total_amount) as total_revenue FROM active_invoices GROUP BY store_id;',
    },
    {
      title: 'أكثر الأصناف مبيعاً عبر كافة المتاجر',
      query:
        'SELECT item_name, category, SUM(quantity) as total_qty, SUM(total_price) as total_revenue FROM invoice_items GROUP BY item_name ORDER BY total_revenue DESC LIMIT 10;',
    },
    {
      title: 'آخر 10 فواتير مسجلة في النظام',
      query:
        'SELECT id, store_id, invoice_number, customer_name, total_amount, payment_method, created_at FROM active_invoices ORDER BY created_at DESC LIMIT 10;',
    },
    {
      title: 'سجل العملاء وحالة التراخيص ومعدلات الطلب',
      query:
        'SELECT store_id, name, plan, status, rate_limit_per_minute, total_invoices_ingested, total_revenue_ingested FROM clients ORDER BY total_revenue_ingested DESC;',
    },
  ];

  return (
    <div className="space-y-6">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 border animate-in slide-in-from-bottom-5 ${
            toastMessage.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {toastMessage.isError ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Database className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              محرك البيانات واستوديو استعلامات SQL (Database Studio)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            محرك SQLite مضمن فائق السرعة بمعايير ACID، بدون تكاليف سحابية باهظة، وبلا توقف أو تعقيدات إدارة السيرفرات.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchTables();
              onRefreshStats();
            }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تحديث المؤشرات</span>
          </button>
        </div>
      </div>

      {/* DATABASE SPECS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>محرك التخزين</span>
            <HardDrive className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-sm font-bold text-slate-900 font-mono">SQLite (WAL Mode)</span>
          <span className="text-[10px] text-emerald-600 block mt-1">Single-File Zero Config</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>حجم قاعدة البيانات</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-lg font-bold text-slate-900 font-mono">
            {systemStats?.database?.file_size_formatted || '0.12 MB'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">تخزين محلي مباشر</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>استهلاك الذاكرة (RAM)</span>
            <Cpu className="w-4 h-4 text-purple-600" />
          </div>
          <span className="text-lg font-bold text-purple-700 font-mono">
            {systemStats?.server?.memory_rss_mb || 42} MB
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">خفيف جداً مقارنة بالسحابة</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>إجمالي المعاملات المحفوظة</span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-lg font-bold text-slate-900 font-mono">
            {(systemStats?.database?.active_invoices_count || 0) +
              (systemStats?.database?.archived_invoices_count || 0)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">معاملات ذرية مكتملة</span>
        </div>
      </div>

      {/* SQL QUERY RUNNER */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>محرر استعلامات SQL التفاعلي (SQL Interactive Runner)</span>
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            يدعم جمل SELECT, GROUP BY, JOIN, PRAGMA
          </span>
        </div>

        {/* SAMPLE QUERY BUTTONS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-slate-500 shrink-0">استعلامات جاهزة:</span>
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

        {/* SQL INPUT */}
        <div className="relative">
          <textarea
            rows={4}
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            className="w-full p-4 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 leading-relaxed select-all"
            dir="ltr"
            placeholder="اكتب استعلام SQL هنا..."
          />
        </div>

        {/* EXECUTE BUTTON */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleExecuteSql}
            disabled={isExecuting}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md shadow-blue-600/20 active:scale-98"
          >
            {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            <span>تنفيذ الاستعلام الآن (Run SQL)</span>
          </button>

          {queryResult && (
            <div className="text-xs font-mono text-slate-500 flex items-center gap-3">
              <span>عدد الصفوف: {queryResult.row_count}</span>
              <span>زمن الاستجابة: {queryResult.execution_time_ms}ms</span>
            </div>
          )}
        </div>

        {/* QUERY RESULT TABLE */}
        {queryResult && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            {queryResult.error ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
                ❌ {queryResult.error}
              </div>
            ) : queryResult.rows && queryResult.rows.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto max-h-72">
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
                تم تنفيذ الاستعلام بنجاح. لا توجد صفوف مطابقة.
              </div>
            )}
          </div>
        )}
      </div>

      {/* TABLE SCHEMAS DIRECTORY */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">هيكل وجداول قاعدة البيانات (Database Schema)</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{tables.length} جداول نشطة</span>
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
  );
};
