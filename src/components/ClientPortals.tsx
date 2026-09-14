import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  KeyRound,
  Download,
  FileJson,
  FileSpreadsheet,
  Database,
  Copy,
  Check,
  Search,
  ExternalLink,
  Receipt,
  TrendingUp,
  Package,
  Calendar,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Clock,
  Sparkles,
  Printer,
  FileDown,
} from 'lucide-react';
import { ClientRecord, InvoiceRecord, ItemAggregation } from '../types';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { safeFetchJson } from '../lib/api';
import { exportSingleInvoiceToPdf, exportBatchInvoicesReportToPdf } from '../lib/pdfExporter';
import { useLanguage } from '../lib/i18n';

interface ClientPortalsProps {
  clients: ClientRecord[];
  onRefreshClients: () => void;
}

export const ClientPortals: React.FC<ClientPortalsProps> = ({ clients, onRefreshClients }) => {
  const { language, t } = useLanguage();
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    clients.length > 0 ? clients[0].store_id : ''
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [inspectedInvoice, setInspectedInvoice] = useState<InvoiceRecord | null>(null);

  const [portalData, setPortalData] = useState<{
    client: ClientRecord | null;
    invoices: InvoiceRecord[];
    top_items: ItemAggregation[];
    loading: boolean;
  }>({
    client: null,
    invoices: [],
    top_items: [],
    loading: false,
  });

  // Ensure a valid selectedStoreId
  useEffect(() => {
    if ((!selectedStoreId || !clients.some((c) => c.store_id === selectedStoreId)) && clients.length > 0) {
      setSelectedStoreId(clients[0].store_id);
    }
  }, [clients, selectedStoreId]);

  // Fetch Dedicated Store Portal Data
  const fetchPortalData = async (storeId: string) => {
    if (!storeId) return;
    setPortalData((prev) => ({ ...prev, loading: true }));
    try {
      const res = await safeFetchJson<any>(`/api/client/portal/${storeId}`);
      if (res.success && res.data) {
        setPortalData({
          client: res.data.client,
          invoices: res.data.invoices || [],
          top_items: res.data.top_items || [],
          loading: false,
        });
      } else {
        setPortalData((prev) => ({ ...prev, loading: false }));
      }
    } catch (e) {
      console.warn('[ClientPortal] Warning loading portal:', e);
      setPortalData((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (selectedStoreId) {
      fetchPortalData(selectedStoreId);
    }
  }, [selectedStoreId]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const activeClient =
    portalData.client || clients.find((c) => c.store_id === selectedStoreId) || clients[0];

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.store_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.owner_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // App Client Config JSON string
  const clientAppConfig = activeClient
    ? JSON.stringify(
        {
          server_url: window.location.origin,
          store_id: activeClient.store_id,
          store_name: activeClient.name,
          api_key: activeClient.api_key,
          plan: activeClient.plan,
          endpoints: {
            ingest_invoice: `${window.location.origin}/api/invoices`,
            realtime_ws: `${window.location.origin.replace(/^http/, 'ws')}/ws`,
            sse_stream: `${window.location.origin}/api/realtime/stream`,
          },
        },
        null,
        2
      )
    : '';

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {language === 'ar' ? 'بوابات العملاء وملفات التطبيقات المخصصة' : 'Client Portals & Dedicated Store Hubs'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {language === 'ar'
              ? 'لكل عميل صفحة مخصصة متكاملة تحتوي على جميع عملياته، مؤشراته، ومجلد ملفات البيانات الجاهزة للتحميل (JSON / CSV / SQL) للربط الفوري.'
              : 'Each client has an isolated portal with operational metrics, live transaction feed, and downloadable dataset files (JSON / CSV / SQL).'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => fetchPortalData(selectedStoreId)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${portalData.loading ? 'animate-spin' : ''}`} />
            <span>{language === 'ar' ? 'تحديث البيانات' : 'Refresh Portal'}</span>
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: CLIENTS SELECTOR DIRECTORY */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {language === 'ar' ? `قائمة المتاجر المسجلة (${clients.length})` : `Registered Stores (${clients.length})`}
              </h3>
              <span className="text-[10px] text-blue-600 font-semibold">
                {language === 'ar' ? 'اختر متجر للعرض' : 'Select to view'}
              </span>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative">
              <Search className={`w-4 h-4 text-slate-400 absolute top-2.5 ${language === 'ar' ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                placeholder={language === 'ar' ? 'بحث باسم المتجر، المعرف، أو البريد...' : 'Search store name, ID, or email...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition ${
                  language === 'ar' ? 'pl-3 pr-9' : 'pr-3 pl-9'
                }`}
              />
            </div>

            {/* STORES LIST */}
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => {
                  const isSelected = client.store_id === selectedStoreId;
                  return (
                    <button
                      key={client.id}
                      id={`client-card-${client.store_id}`}
                      onClick={() => setSelectedStoreId(client.store_id)}
                      className={`w-full p-3 rounded-xl border transition cursor-pointer group ${
                        language === 'ar' ? 'text-right' : 'text-left'
                      } ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="overflow-hidden">
                          <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600">
                            {client.name}
                          </h4>
                          <span className="font-mono text-[11px] text-slate-500 block truncate">
                            {client.store_id}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            client.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {client.status === 'active'
                            ? (language === 'ar' ? 'نشط' : 'Active')
                            : (language === 'ar' ? 'موقوف' : 'Suspended')}
                        </span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{client.total_invoices_ingested || 0} {language === 'ar' ? 'فاتورة' : 'invoices'}</span>
                        <span className="font-bold text-emerald-700 font-mono">
                          ${(client.total_revenue_ingested || 0).toFixed(2)}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  {language === 'ar' ? 'لا يوجد متجر مطابق للبحث' : 'No matching stores found'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DEDICATED STORE PORTAL & FILES */}
        <div className="lg:col-span-8 space-y-6">
          {activeClient ? (
            <>
              {/* STORE PROFILE BANNER */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">{activeClient.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono font-bold uppercase">
                          {activeClient.plan}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        المعرف: {activeClient.store_id} • البريد: {activeClient.owner_email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                        activeClient.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{activeClient.status === 'active' ? 'الاشتراك سارٍ' : 'الاشتراك موقوف'}</span>
                    </span>
                  </div>
                </div>

                {/* KPI METRICS ROW FOR THIS CLIENT */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">
                      {language === 'ar' ? 'إجمالي مبيعات المتجر' : 'Store Total Revenue'}
                    </span>
                    <span className="text-lg font-bold text-emerald-700 font-mono mt-0.5 block">
                      ${(activeClient.total_revenue_ingested || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">
                      {language === 'ar' ? 'عدد الفواتير المستلمة' : 'Invoices Ingested'}
                    </span>
                    <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                      {activeClient.total_invoices_ingested || 0}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">
                      {language === 'ar' ? 'معدل الطلبات المسموح' : 'Rate Limit'}
                    </span>
                    <span className="text-lg font-bold text-blue-600 font-mono mt-0.5 block">
                      {activeClient.rate_limit_per_minute || 200}/{language === 'ar' ? 'د' : 'min'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">
                      {language === 'ar' ? 'تاريخ انتهاء الترخيص' : 'License Expiry'}
                    </span>
                    <span className="text-xs font-bold text-slate-700 font-mono mt-1 block">
                      {activeClient.subscription_expires_at
                        ? activeClient.subscription_expires_at.split('T')[0]
                        : (language === 'ar' ? 'دائم' : 'Permanent')}
                    </span>
                  </div>
                </div>

                {/* API KEY & APP SECRETS ROW */}
                <div className="bg-slate-900 p-4 rounded-xl text-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{language === 'ar' ? 'مفتاح الربط البرمجي المشفر (API Key):' : 'Encrypted API Key:'}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">x-api-key header</span>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-amber-300 overflow-x-auto justify-between">
                    <span className="truncate select-all">{activeClient.api_key}</span>
                    <button
                      onClick={() => handleCopy(activeClient.api_key, 'api_key')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-[11px] font-sans flex items-center gap-1 transition shrink-0 cursor-pointer"
                    >
                      {copiedText === 'api_key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText === 'api_key' ? (language === 'ar' ? 'تم النسخ' : 'Copied') : (language === 'ar' ? 'نسخ المفتاح' : 'Copy Key')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* DEDICATED APP DATA FILES & EXPORT HUB */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <Download className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {language === 'ar'
                          ? `ملفات التطبيق والبيانات الجاهزة للمتجر (${activeClient.name})`
                          : `Tenant App Data Files & Backups (${activeClient.name})`}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {language === 'ar'
                          ? 'تحميل وتصدير كافة سجلات وفواتير التطبيق كملف مستقل كامل بضغطة زر واحدة.'
                          : 'Download and export all isolated tenant data and ledger logs with a single click.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* PDF BATCH REPORT EXPORT */}
                  <button
                    onClick={() =>
                      exportBatchInvoicesReportToPdf(portalData.invoices, {
                        storeName: `${activeClient.name} (${activeClient.store_id})`,
                        dateRangeLabel: language === 'ar' ? 'كامل سجل المعاملات الحديثة' : 'Full Recent Ledger',
                      })
                    }
                    disabled={portalData.invoices.length === 0}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50/60 hover:border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed transition group flex flex-col justify-between text-start cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <FileDown className="w-6 h-6 text-rose-600" />
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                        PDF Report
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-rose-600">
                        {language === 'ar' ? 'تقرير فواتير PDF رسمي' : 'Official PDF Ledger'}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {language === 'ar' ? 'طباعة كشف حساب وتدقيق الفواتير' : 'Statement of account & invoices'}
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                      <Printer className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</span>
                    </div>
                  </button>

                  {/* JSON EXPORT */}
                  <a
                    href={`/api/admin/export/${activeClient.store_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-300 transition group flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <FileJson className="w-6 h-6 text-blue-600" />
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        JSON Dataset
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600">
                        {language === 'ar' ? 'قاعدة بيانات JSON كاملة' : 'Full JSON Database'}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        client_{activeClient.store_id}_data.json
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-semibold text-blue-600 flex items-center gap-1">
                      <Download className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'تنزيل الملف' : 'Download JSON'}</span>
                    </div>
                  </a>

                  {/* CSV EXPORT */}
                  <a
                    href={`/api/admin/export/${activeClient.store_id}?format=csv`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50/60 hover:border-emerald-300 transition group flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        CSV Spreadsheet
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600">
                        {language === 'ar' ? 'جدول فواتير Excel / CSV' : 'Excel / CSV Spreadsheet'}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        client_{activeClient.store_id}_invoices.csv
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                      <Download className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'تنزيل الجدول' : 'Download CSV'}</span>
                    </div>
                  </a>

                  {/* SQL DUMP EXPORT */}
                  <a
                    href={`/api/admin/export/${activeClient.store_id}?format=sql`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50/60 hover:border-indigo-300 transition group flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Database className="w-6 h-6 text-indigo-600" />
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        SQL Dump
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                        {language === 'ar' ? 'تفريغ أوامر SQL كاملة' : 'Complete SQL Dump'}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        client_{activeClient.store_id}_dump.sql
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-semibold text-indigo-600 flex items-center gap-1">
                      <Download className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'تنزيل ملف SQL' : 'Download SQL'}</span>
                    </div>
                  </a>
                </div>

                {/* CLIENT APP CONFIGURATION JSON */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-700">
                      {language === 'ar' ? 'ملف إعدادات التطبيق المباشر (App Config JSON):' : 'Client Direct App Config JSON:'}
                    </span>
                    <button
                      onClick={() => handleCopy(clientAppConfig, 'config_json')}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedText === 'config_json' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText === 'config_json' ? (language === 'ar' ? 'تم نسخ الإعدادات' : 'Copied JSON') : (language === 'ar' ? 'نسخ ملف JSON' : 'Copy JSON')}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-950 text-slate-200 p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-40 border border-slate-800 select-all" dir="ltr">
                    {clientAppConfig}
                  </pre>
                </div>
              </div>

              {/* RECENT INVOICES FOR THIS STORE - WITH MOBILE CARDS */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-blue-600" />
                    <h3 className="text-base font-bold text-slate-900">
                      {language === 'ar' ? `آخر فواتير المتجر (${portalData.invoices.length})` : `Recent Store Invoices (${portalData.invoices.length})`}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {activeClient.store_id}
                  </span>
                </div>

                {/* MOBILE CARD VIEW (Phone screens, zero horizontal overflow) */}
                <div className="block md:hidden space-y-2.5">
                  {portalData.invoices.length > 0 ? (
                    portalData.invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-blue-600">{inv.invoice_number}</span>
                          <span className="font-mono font-bold text-emerald-700 text-sm">
                            ${inv.total_amount.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span>{inv.customer_name || (language === 'ar' ? 'عميل نقدي' : 'Cash Customer')}</span>
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[10px]">
                            {inv.payment_method}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-slate-500 text-[11px]">
                          <span>
                            {new Date(inv.created_at).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setInspectedInvoice(inv)}
                              className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              {language === 'ar' ? 'فحص' : 'Inspect'}
                            </button>
                            <button
                              onClick={() => exportSingleInvoiceToPdf(inv, activeClient)}
                              className="p-1.5 bg-white border border-slate-200 hover:bg-emerald-50 text-emerald-600 rounded-lg cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      {language === 'ar'
                        ? 'لم يتم إرسال أي فواتير لهذا المتجر بعد.'
                        : 'No invoices have been ingested for this store yet.'}
                    </div>
                  )}
                </div>

                {/* DESKTOP TABLE VIEW */}
                <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-start text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}</th>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'العميل' : 'Customer'}</th>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'طريقة الدفع' : 'Payment'}</th>
                        <th className="py-2.5 px-3 text-center">{language === 'ar' ? 'الأصناف' : 'Items'}</th>
                        <th className="py-2.5 px-3 font-mono">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'التوقيت' : 'Time'}</th>
                        <th className="py-2.5 px-3 text-center">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {portalData.invoices.length > 0 ? (
                        portalData.invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                              {inv.invoice_number}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900">
                              {inv.customer_name || (language === 'ar' ? 'عميل نقدي' : 'Cash Customer')}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] uppercase font-mono">
                                {inv.payment_method}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">{inv.item_count}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                              ${inv.total_amount.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-500">
                              {new Date(inv.created_at).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setInspectedInvoice(inv)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-md text-[10px] font-semibold transition cursor-pointer"
                                  title="Inspect Invoice"
                                >
                                  {language === 'ar' ? 'فحص' : 'Inspect'}
                                </button>
                                <button
                                  onClick={() => exportSingleInvoiceToPdf(inv, activeClient)}
                                  className="p-1 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-600 rounded-md text-[10px] transition cursor-pointer"
                                  title="PDF"
                                >
                                  <Printer className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                            {language === 'ar'
                              ? 'لم يتم إرسال أي فواتير لهذا المتجر بعد. يمكنك استخدام محاكي الكاشير لاختبار الإرسال.'
                              : 'No invoices recorded yet. Use the POS simulator to test live ingestion.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
              <Users className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              <p className="font-bold text-sm">
                {language === 'ar'
                  ? 'يرجى اختيار متجر من القائمة الجانبية لعرض بوابته المخصصة'
                  : 'Please select a store from the directory to view its dedicated portal'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* INVOICE INSPECT MODAL */}
      {inspectedInvoice && (
        <InvoiceDetailModal invoice={inspectedInvoice} onClose={() => setInspectedInvoice(null)} />
      )}
    </div>
  );
};
