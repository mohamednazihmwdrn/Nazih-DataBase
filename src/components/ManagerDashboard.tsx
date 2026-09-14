import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Receipt,
  Boxes,
  Store,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Radio,
  Clock,
  Layers,
  ListFilter,
  Sparkles,
  Printer,
  FileDown,
} from 'lucide-react';
import { InvoiceRecord, ItemAggregation, ClientRecord } from '../types';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { safeFetchJson } from '../lib/api';
import { exportSingleInvoiceToPdf, exportBatchInvoicesReportToPdf } from '../lib/pdfExporter';
import { useLanguage } from '../lib/i18n';

interface ManagerDashboardProps {
  clients: ClientRecord[];
  liveInvoices: { invoice: InvoiceRecord; items: any[]; store: any }[];
  onInspectInvoice: (inv: InvoiceRecord) => void;
  onTriggerSimulation: () => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  clients,
  liveInvoices,
  onInspectInvoice,
  onTriggerSimulation,
}) => {
  const { t, language } = useLanguage();
  // Filters & State
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('today');
  const [invoiceType, setInvoiceType] = useState<'active' | 'archived'>('active');

  // Items Aggregation State
  const [aggregatedItems, setAggregatedItems] = useState<ItemAggregation[]>([]);
  const [itemSearch, setItemSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'revenue' | 'quantity' | 'orders' | 'name'>('revenue');
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);

  // Paginated Invoices State
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState<boolean>(false);

  // High-Level KPIs
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [inspectModalInvoice, setInspectModalInvoice] = useState<InvoiceRecord | null>(null);

  // Fetch Aggregated Items
  const fetchAggregatedItems = async () => {
    setIsLoadingItems(true);
    let url = `/api/analytics/items-aggregation?sort_by=${sortBy}&limit=50`;
    if (selectedStore !== 'ALL') url += `&store_id=${encodeURIComponent(selectedStore)}`;
    if (itemSearch.trim()) url += `&search=${encodeURIComponent(itemSearch.trim())}`;

    const rangeDates = getDateRangeValues();
    if (rangeDates.start) url += `&start_date=${encodeURIComponent(rangeDates.start)}`;
    if (rangeDates.end) url += `&end_date=${encodeURIComponent(rangeDates.end)}`;

    try {
      const res = await safeFetchJson<{ success: boolean; items: ItemAggregation[] }>(url);
      if (res.success && res.data?.items) {
        setAggregatedItems(res.data.items);
      }
    } catch (e) {
      console.warn('[Aggregations] Warning loading items:', e);
    } finally {
      setIsLoadingItems(false);
    }
  };

  // Fetch Paginated Invoices
  const fetchInvoices = async () => {
    setIsLoadingInvoices(true);
    let url = `/api/invoices?page=${currentPage}&limit=15&status=${invoiceType}`;
    if (selectedStore !== 'ALL') url += `&store_id=${encodeURIComponent(selectedStore)}`;
    if (invoiceSearch.trim()) url += `&search=${encodeURIComponent(invoiceSearch.trim())}`;

    const rangeDates = getDateRangeValues();
    if (rangeDates.start) url += `&start_date=${encodeURIComponent(rangeDates.start)}`;
    if (rangeDates.end) url += `&end_date=${encodeURIComponent(rangeDates.end)}`;

    try {
      const res = await safeFetchJson<{
        success: boolean;
        invoices: InvoiceRecord[];
        total_pages: number;
        total_count: number;
      }>(url);
      if (res.success && res.data) {
        setInvoices(res.data.invoices || []);
        setTotalPages(res.data.total_pages || 1);
        setTotalRecords(res.data.total_count || 0);
      }
    } catch (e) {
      console.warn('[Invoices] Warning loading invoices:', e);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // Fetch Summary
  const fetchSummary = async () => {
    try {
      const res = await safeFetchJson<{ success: boolean; summary: any }>('/api/analytics/summary');
      if (res.success && res.data?.summary) {
        setSummaryStats(res.data.summary);
      }
    } catch (e) {
      console.warn('[Summary] Warning loading summary:', e);
    }
  };

  const getDateRangeValues = () => {
    const now = new Date();
    if (dateRange === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      return { start, end: now.toISOString() };
    } else if (dateRange === '7d') {
      const start = new Date(now.getTime() - 7 * 86400000).toISOString();
      return { start, end: now.toISOString() };
    } else if (dateRange === '30d') {
      const start = new Date(now.getTime() - 30 * 86400000).toISOString();
      return { start, end: now.toISOString() };
    }
    return { start: undefined, end: undefined };
  };

  useEffect(() => {
    fetchSummary();
    fetchAggregatedItems();
    fetchInvoices();
  }, [selectedStore, dateRange, sortBy, invoiceType, currentPage]);

  // Handle live invoice event
  useEffect(() => {
    if (liveInvoices.length > 0) {
      fetchSummary();
      fetchAggregatedItems();
      if (currentPage === 1 && invoiceType === 'active') {
        fetchInvoices();
      }
    }
  }, [liveInvoices]);

  const totalRevenue = summaryStats?.total_revenue || 0;
  const activeInvoicesCount = summaryStats?.active_invoices_count || 0;
  const archivedInvoicesCount = summaryStats?.archived_invoices_count || 0;
  const totalInvoicesAll = activeInvoicesCount + archivedInvoicesCount;
  const totalItemsSold = summaryStats?.total_items_sold || 0;
  const activeStoresCount = summaryStats?.active_stores_count || 0;

  return (
    <div className="space-y-6">
      {/* PURE CLEAN STATE NOTICE IF 0 CLIENTS */}
      {clients.length === 0 && (
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-6 rounded-2xl border border-blue-800/80 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>سيرفر Nazih Core جاهز ونظيف تماماً 100%</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  Pure Clean DB
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                تم تفريغ كافة البيانات الوهمية والمفاتيح التجريبية. يمكنك الآن تسجيل أول عميل ومتجر حقيقي من تبويب "مولد المفاتيح والتراخيص" للبدء بالعمل الفعلي واستقبال المعاملات.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FILTER & STORE SCOPE TOOLBAR - FULLY MOBILE-FIRST */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">نطاق المتجر:</span>
            <select
              id="manager-store-select"
              value={selectedStore}
              onChange={(e) => {
                setSelectedStore(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-300 text-xs font-medium text-slate-800 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs cursor-pointer flex-1 sm:flex-initial"
            >
              <option value="ALL">{t.allStores}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.store_id}>
                  {c.name} ({c.store_id})
                </option>
              ))}
            </select>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* DATE RANGE TOGGLES */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-medium gap-1 w-full sm:w-auto">
            {(['today', '7d', '30d', 'all'] as const).map((r) => (
              <button
                key={r}
                id={`date-range-${r}`}
                onClick={() => {
                  setDateRange(r);
                  setCurrentPage(1);
                }}
                className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg transition cursor-pointer text-center text-[11px] sm:text-xs ${
                  dateRange === r
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'all' ? t.allTime : r === '7d' ? t.last7Days : r === '30d' ? t.last30Days : t.today}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500 font-sans">
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-xl border border-emerald-200 text-[11px]">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" />
            <span className="font-semibold">{t.realtimeSync}</span>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t.totalRevenue}</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-emerald-600 font-medium">100% ACID</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t.totalInvoices}</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
              {totalInvoicesAll.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-sans">
              {language === 'ar' ? 'المتوسط:' : 'Avg:'} ${totalInvoicesAll > 0 ? (totalRevenue / totalInvoicesAll).toFixed(2) : '0.00'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t.itemsSold}</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
              {totalItemsSold.toLocaleString()}
            </span>
            <span className="text-xs text-amber-600 font-sans font-medium">{language === 'ar' ? 'تسجيل فوري' : 'Live Ingest'}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t.activeStores}</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 tracking-tight font-sans">{activeStoresCount}</span>
            <span className="text-xs text-indigo-600 font-sans">{clients.length} {language === 'ar' ? 'مسجل بالنظام' : 'Registered'}</span>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN GRID: REAL-TIME INGESTION FEED & ITEM AGGREGATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: LIVE INCOMING INVOICES (5 COLS) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
              </span>
              <h3 className="font-bold text-slate-900 text-sm">{t.liveFeed}</h3>
            </div>
            <button
              id="live-stream-sim-btn"
              onClick={onTriggerSimulation}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-200 transition flex items-center gap-1 font-medium cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>{t.simulate}</span>
            </button>
          </div>

          {/* LIVE STREAM ITEMS */}
          <div className="space-y-2.5 max-h-[560px] overflow-y-auto pl-1 flex-1">
            {liveInvoices.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                <Radio className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-slate-500">{t.waitingLive}</p>
                <button
                  onClick={onTriggerSimulation}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition text-xs font-semibold cursor-pointer"
                >
                  {t.sendTest}
                </button>
              </div>
            ) : (
              liveInvoices.map((item, idx) => {
                const inv = item.invoice;
                const clientObj = clients.find((c) => c.store_id === inv.store_id);
                const itemsSummary =
                  item.items && item.items.length > 0
                    ? item.items.map((it: any) => `${it.quantity}× ${it.item_name}`).join('، ')
                    : `${inv.item_count} ${t.items}`;

                return (
                  <div
                    key={inv.id || idx}
                    className="bg-slate-50/80 hover:bg-slate-100 p-3.5 rounded-xl border border-slate-200/80 hover:border-slate-300 transition group cursor-pointer relative"
                    onClick={() => setInspectModalInvoice(inv)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px] font-bold">
                          {inv.invoice_number}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                          {item.store?.name || inv.store_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-600 font-sans">
                          ${inv.total_amount.toFixed(2)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportSingleInvoiceToPdf(inv, clientObj);
                          }}
                          className="p-1 rounded-lg bg-white hover:bg-blue-600 text-slate-500 hover:text-white border border-slate-200 transition shadow-2xs cursor-pointer"
                          title={language === 'ar' ? 'تصدير هذه الفاتورة كـ PDF' : 'Export this invoice as PDF'}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 mt-1 truncate">{itemsSummary}</div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                      <span>
                        {inv.customer_name || t.cashCustomer} •{' '}
                        <span className="text-slate-700 font-medium">
                          {inv.payment_method === 'card' ? t.card : inv.payment_method === 'cash' ? t.cash : inv.payment_method === 'online' ? t.online : inv.payment_method}
                        </span>
                      </span>
                      <span className="font-sans">{new Date(inv.created_at).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US')}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: AGGREGATED ITEMS (GROUP BY item_name) (7 COLS) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 mb-3 gap-2.5">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{t.topSellingItems}</span>
                <code className="text-[10px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-200 font-mono">GROUP BY</code>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                {language === 'ar' ? 'تجميع فوري للكميات والإيرادات والطلبات للمتاجر المحددة.' : 'Real-time aggregated volume, revenue, and order breakdown.'}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <input
                  type="text"
                  id="item-search-input"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAggregatedItems()}
                  placeholder={t.searchPlaceholder}
                  className="bg-slate-50 border border-slate-300 text-xs text-slate-900 rounded-xl pr-8 pl-3 py-1.5 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 w-full sm:w-40 shadow-2xs"
                />
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2 text-slate-400" />
              </div>

              <select
                id="item-sort-select"
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-xs text-slate-900 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-600 shadow-2xs cursor-pointer shrink-0"
              >
                <option value="revenue">{t.topRevenue}</option>
                <option value="quantity">{t.bestSelling}</option>
                <option value="orders">{t.orders}</option>
                <option value="name">{t.name}</option>
              </select>
            </div>
          </div>

          {/* MOBILE CARDS VIEW FOR ITEMS (HIDDEN ON DESKTOP) */}
          <div className="block sm:hidden space-y-2 max-h-[450px] overflow-y-auto">
            {isLoadingItems ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                {t.loading}
              </div>
            ) : aggregatedItems.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                {t.noData}
              </div>
            ) : (
              aggregatedItems.map((it, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs flex items-center justify-between">
                  <div className="min-w-0 flex-1 pl-2">
                    <div className="font-bold text-xs text-slate-900 truncate">{it.item_name}</div>
                    <div className="text-[10px] text-slate-500 font-medium">{it.category || (language === 'ar' ? 'عام' : 'General')} • {it.order_count} {t.orders}</div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-xs font-bold text-emerald-600 font-sans">
                      ${it.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-slate-600 font-sans font-medium">
                      {it.total_quantity.toLocaleString()} {language === 'ar' ? 'وحدة' : 'units'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* AGGREGATED ITEMS TABLE (DESKTOP) */}
          <div className="hidden sm:block overflow-x-auto flex-1 max-h-[560px]">
            <table className="w-full text-right text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200 sticky top-0 backdrop-blur">
                <tr>
                  <th className="py-2.5 px-3">{t.itemName}</th>
                  <th className="py-2.5 px-3 text-left">{t.qtySold}</th>
                  <th className="py-2.5 px-3 text-left">{t.avgPrice}</th>
                  <th className="py-2.5 px-3 text-left">{t.totalRevenue}</th>
                  <th className="py-2.5 px-3 text-left">{t.orders}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {isLoadingItems ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      {t.loading}
                    </td>
                  </tr>
                ) : aggregatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      {t.noData}
                    </td>
                  </tr>
                ) : (
                  aggregatedItems.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{it.item_name}</div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {it.category || (language === 'ar' ? 'عام' : 'General')}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-left font-sans font-bold text-slate-800">
                        {it.total_quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-left font-sans text-slate-600">
                        ${it.avg_unit_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-left font-sans font-bold text-emerald-600">
                        ${it.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-left font-sans text-slate-600">
                        {it.order_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* LOWER SECTION: HISTORIC INVOICE EXPLORER WITH PAGINATION */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 shadow-sm space-y-4">
        {/* SECTION HEADER & CONTROLS - FULLY RESPONSIVE */}
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{t.invoiceExplorer}</span>
            </h3>
            {/* EXPORT BATCH PDF BUTTON */}
            <button
              id="export-batch-pdf-btn"
              onClick={() => {
                const storeObj = clients.find((c) => c.store_id === selectedStore);
                exportBatchInvoicesReportToPdf(invoices, {
                  storeName: selectedStore === 'ALL' ? (language === 'ar' ? 'كافة الفروع والمتاجر الموحدة' : 'All Stores Consolidated') : storeObj?.name || selectedStore,
                  dateRangeLabel: dateRange === 'all' ? t.allTime : dateRange === '7d' ? t.last7Days : dateRange === '30d' ? t.last30Days : t.today,
                });
              }}
              disabled={invoices.length === 0}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 transition text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
              title={language === 'ar' ? 'تصدير جدول الفواتير الحالي كتقرير PDF رسمي' : 'Export current invoice table as PDF report'}
            >
              <FileDown className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs">{t.exportPdf}</span>
            </button>
          </div>

          {/* CONTROLS ROW: TABS & SEARCH INPUT */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* ACTIVE VS ARCHIVED TOGGLE */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs gap-1 w-full sm:w-auto">
              <button
                id="tab-active-invoices"
                onClick={() => {
                  setInvoiceType('active');
                  setCurrentPage(1);
                }}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-medium transition cursor-pointer text-center ${
                  invoiceType === 'active'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.activeInvoices}
              </button>
              <button
                id="tab-archived-invoices"
                onClick={() => {
                  setInvoiceType('archived');
                  setCurrentPage(1);
                }}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-medium transition cursor-pointer text-center ${
                  invoiceType === 'archived'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.archivedInvoices}
              </button>
            </div>

            {/* SEARCH INPUT FIT TO FULL WIDTH ON MOBILE */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                id="invoice-search-input"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchInvoices()}
                placeholder={t.searchPlaceholder}
                className="bg-slate-50 border border-slate-300 text-xs text-slate-900 rounded-xl pr-8 pl-3 py-2 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 w-full shadow-2xs"
              />
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* MOBILE VIEW: RESPONSIVE CARDS (HIDDEN ON DESKTOP) */}
        <div className="block md:hidden space-y-2.5">
          {isLoadingInvoices ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              {t.loading}
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              {t.noData}
            </div>
          ) : (
            invoices.map((inv) => {
              const clientObj = clients.find((c) => c.store_id === inv.store_id);
              return (
                <div
                  key={inv.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-white text-slate-900 border border-slate-200 font-mono text-xs font-bold">
                      {inv.invoice_number}
                    </span>
                    <span className="text-sm font-bold text-emerald-600 font-sans">
                      ${inv.total_amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">{inv.customer_name || t.cashCustomer}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        inv.payment_method === 'card'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {inv.payment_method === 'card' ? t.card : inv.payment_method === 'cash' ? t.cash : inv.payment_method === 'online' ? t.online : inv.payment_method}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span className="font-mono text-[10px]">{inv.store_id} • {inv.item_count} {t.items}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setInspectModalInvoice(inv)}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-200 transition text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                        title={t.preview}
                      >
                        <Eye className="w-3 h-3" />
                        <span>{t.preview}</span>
                      </button>
                      <button
                        onClick={() => exportSingleInvoiceToPdf(inv, clientObj)}
                        className="p-1 rounded-lg bg-white hover:bg-emerald-600 text-slate-600 hover:text-white border border-slate-200 transition text-[11px] cursor-pointer"
                        title={language === 'ar' ? 'تصدير وطباعة PDF' : 'Export & print PDF'}
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP VIEW: STANDARD DATA TABLE (HIDDEN ON MOBILE) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">{t.invoiceNumber}</th>
                <th className="py-3 px-4">{t.storeId}</th>
                <th className="py-3 px-4">{t.customer}</th>
                <th className="py-3 px-4">{t.paymentMethod}</th>
                <th className="py-3 px-4 text-center">{t.items}</th>
                <th className="py-3 px-4 text-left">{t.total}</th>
                <th className="py-3 px-4">{t.dateTime}</th>
                <th className="py-3 px-4 text-center">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingInvoices ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    {t.loading}
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    {t.noData}
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const clientObj = clients.find((c) => c.store_id === inv.store_id);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-medium">
                          {inv.invoice_number}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs font-mono">{inv.store_id}</td>
                      <td className="py-3 px-4 text-slate-800 font-medium">{inv.customer_name || t.cashCustomer}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            inv.payment_method === 'card'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {inv.payment_method === 'card' ? t.card : inv.payment_method === 'cash' ? t.cash : inv.payment_method === 'online' ? t.online : inv.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700 font-sans">{inv.item_count}</td>
                      <td className="py-3 px-4 text-left font-bold text-emerald-600 font-sans">
                        ${inv.total_amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] font-sans">
                        {new Date(inv.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setInspectModalInvoice(inv)}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-200 transition text-xs font-medium flex items-center gap-1 cursor-pointer"
                            title={t.preview}
                          >
                            <Eye className="w-3 h-3" />
                            <span>{t.preview}</span>
                          </button>
                          <button
                            onClick={() => exportSingleInvoiceToPdf(inv, clientObj)}
                            className="p-1 rounded-lg bg-slate-100 hover:bg-emerald-600 text-slate-600 hover:text-white border border-slate-200 transition text-xs cursor-pointer"
                            title={language === 'ar' ? 'تصدير وطباعة PDF مباشرة' : 'Export & print PDF'}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION CONTROLS - RESPONSIVE */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500 gap-2">
          <div className="text-center sm:text-right">
            {t.page} <span className="font-bold text-slate-900 font-sans">{currentPage}</span> {t.of}{' '}
            <span className="font-bold text-slate-900 font-sans">{totalPages}</span> ({t.total} <span className="font-sans">{totalRecords.toLocaleString()}</span> {t.items})
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
            <button
              id="prev-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>{t.previous}</span>
            </button>
            <button
              id="next-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
            >
              <span>{t.next}</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* INSPECT MODAL */}
      <InvoiceDetailModal
        invoice={inspectModalInvoice}
        onClose={() => setInspectModalInvoice(null)}
      />

    </div>
  );
};
