import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Play,
  Pause,
  Database,
  Archive,
  Sparkles,
  ShieldCheck,
  Clock,
  Search,
  CheckCircle,
  AlertTriangle,
  HardDrive,
} from 'lucide-react';
import { ClientRecord, SystemStats, ApiLog } from '../types';

interface AdminDashboardProps {
  clients: ClientRecord[];
  onRefreshClients: () => void;
  systemStats: SystemStats | null;
  onRefreshStats: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  clients,
  onRefreshClients,
  systemStats,
  onRefreshStats,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [archiveDays, setArchiveDays] = useState<number>(30);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Form State for new Client
  const [formStoreId, setFormStoreId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPlan, setFormPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [formDaysValid, setFormDaysValid] = useState<number>(30);
  const [formRateLimit, setFormRateLimit] = useState<number>(200);

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs?limit=10');
      if (!res.ok) {
        console.warn(`[Logs] API status ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data && data.success) {
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Error loading logs', e);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    showToast('تم نسخ مفتاح الربط (API Key) إلى الحافظة!');
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStoreId || !formName || !formEmail) {
      showToast('يرجى ملء جميع الحقول المطلوبة', true);
      return;
    }

    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: formStoreId.trim(),
          name: formName.trim(),
          owner_email: formEmail.trim(),
          plan: formPlan,
          days_valid: formDaysValid,
          rate_limit: formRateLimit,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`تم تسجيل المتجر "${data.client.name}" وإصدار مفتاح الربط بنجاح!`);
        setIsModalOpen(false);
        setFormStoreId('');
        setFormName('');
        setFormEmail('');
        onRefreshClients();
        onRefreshStats();
      } else {
        showToast(data.error || 'فشل في إنشاء المتجر', true);
      }
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء الإنشاء', true);
    }
  };

  const extendSubscription = async (id: string, days: number) => {
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ add_days: days, status: 'active' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`تم تمديد الاشتراك بنجاح (+${days} يوم)!`);
        onRefreshClients();
        onRefreshStats();
      }
    } catch (e) {
      showToast('خطأ في تمديد الاشتراك', true);
    }
  };

  const toggleClientStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`تم تحديث حالة المتجر إلى ${newStatus === 'active' ? 'نشط' : 'موقوف'}`);
        onRefreshClients();
        onRefreshStats();
      }
    } catch (e) {
      showToast('فشل في تحديث حالة المتجر', true);
    }
  };

  const regenerateKey = async (id: string) => {
    if (!confirm('هل أنت متأكد من إعادة توليد المفتاح؟ سيتعين تحديث أنظمة الكاشير المرتبطة بهذا المتجر.'))
      return;
    try {
      const res = await fetch(`/api/admin/clients/${id}/regenerate-key`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('تم إنشاء وتوليد مفتاح ربط جديد بنجاح!');
        onRefreshClients();
      }
    } catch (e) {
      showToast('فشل في إعادة توليد المفتاح', true);
    }
  };

  const deleteClient = async (id: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا المتجر وإلغاء صلاحية مفتاحه؟')) return;
    try {
      const res = await fetch(`/api/admin/clients/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('تم حذف المتجر بنجاح.');
        onRefreshClients();
        onRefreshStats();
      }
    } catch (e) {
      showToast('فشل في حذف المتجر', true);
    }
  };

  const triggerArchive = async () => {
    try {
      const res = await fetch('/api/admin/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days_threshold: archiveDays }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'تمت أرشفة الفواتير القديمة بنجاح');
        onRefreshStats();
      }
    } catch (e) {
      showToast('فشل في الأرشفة', true);
    }
  };

  const runVacuum = async () => {
    try {
      const res = await fetch('/api/admin/vacuum', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('تم تنفيذ أمر SQLite VACUUM وضغط الملف بنجاح!');
        onRefreshStats();
      }
    } catch (e) {
      showToast('فشل في ضغط وتفريغ قاعدة البيانات', true);
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.store_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.owner_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dbStats = systemStats?.database;

  return (
    <div className="space-y-6">
      
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-3 text-xs font-semibold border ${
            toastMessage.isError
              ? 'bg-white border-rose-300 text-rose-700 shadow-rose-500/10'
              : 'bg-white border-blue-300 text-blue-800 shadow-blue-500/10'
          }`}
        >
          {toastMessage.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          ) : (
            <CheckCircle className="w-4 h-4 text-blue-600" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>العملاء والمتاجر المسجلة</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-sans">{clients.length}</span>
            <span className="text-xs text-blue-600 font-medium font-sans">
              {clients.filter((c) => c.status === 'active').length} نشط
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>حجم ملف قاعدة البيانات (SQLite)</span>
            <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-sans">{dbStats?.file_size_formatted || '0 KB'}</span>
            <button
              onClick={runVacuum}
              className="text-xs px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 transition font-medium cursor-pointer"
            >
              ضغط وتفريغ (VACUUM)
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>النشطة مقابل المؤرشفة</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-sans">
              {dbStats?.active_invoices_count || 0}{' '}
              <span className="text-xs font-normal text-slate-500">/ {dbStats?.archived_invoices_count || 0}</span>
            </span>
            <span className="text-xs text-emerald-600 font-medium">تقسيم جداول</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>مدة تشغيل الخادم</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-sans">
              {systemStats?.server?.uptime_seconds ? `${Math.floor(systemStats.server.uptime_seconds / 60)} دقيقة` : 'متصل'}
            </span>
            <span className="text-xs text-purple-600 font-sans font-medium">Node {systemStats?.server?.node_version || '20+'}</span>
          </div>
        </div>
      </div>

      {/* CLIENTS & API KEYS TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 sm:px-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">متاجر العملاء ومفاتيح الربط المشفرة (API Keys)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              إصدار مفاتيح موثوقة (`sk_live_...`)، وإدارة باقات الاشتراك، وصلاحيات مزامنة الفواتير.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                id="client-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث في المتاجر والعملاء..."
                className="bg-slate-50 border border-slate-300 text-xs text-slate-900 rounded-xl pr-8 pl-3 py-2 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 w-48 sm:w-64 shadow-2xs"
              />
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
            </div>

            <button
              id="open-create-client-btn"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-xs active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة متجر جديد</span>
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">المتجر / العميل</th>
                <th className="px-6 py-3.5">مفتاح الربط (x-api-key)</th>
                <th className="px-6 py-3.5">الباقة</th>
                <th className="px-6 py-3.5">الحالة</th>
                <th className="px-6 py-3.5">انتهاء الاشتراك</th>
                <th className="px-6 py-3.5 text-left">الفواتير / الإيراد</th>
                <th className="px-6 py-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    لا توجد متاجر تطابق البحث.
                  </td>
                </tr>
              ) : (
                filteredClients.map((c) => {
                  const now = new Date();
                  const expiry = new Date(c.subscription_expires_at);
                  const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isExpired = daysRemaining <= 0 || c.status === 'expired';
                  const isWarning = daysRemaining <= 7 && !isExpired;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>{c.store_id}</span>
                          <span className="text-slate-300">•</span>
                          <span>{c.owner_email}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 font-mono text-xs">
                        <div className="flex items-center justify-between gap-2 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 max-w-xs">
                          <span className="truncate text-slate-700 select-all font-mono" dir="ltr">{c.api_key}</span>
                          <button
                            onClick={() => handleCopyKey(c.api_key, c.id)}
                            className="text-slate-400 hover:text-slate-700 transition cursor-pointer"
                            title="نسخ المفتاح"
                          >
                            {copiedKeyId === c.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                            c.plan === 'enterprise'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : c.plan === 'pro'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {c.plan === 'enterprise' ? 'شركات' : c.plan === 'pro' ? 'احترافي' : 'أساسي'}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {c.status === 'active' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            نشط
                          </span>
                        )}
                        {c.status === 'suspended' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            موقوف
                          </span>
                        )}
                        {c.status === 'trial' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            تجريبي
                          </span>
                        )}
                        {isExpired && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                            منتهي
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs font-sans">
                        <div
                          className={`font-bold ${
                            isExpired ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-800'
                          }`}
                        >
                          {c.subscription_expires_at.split('T')[0]}
                        </div>
                        <div
                          className={`text-[11px] ${
                            isExpired ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-500'
                          }`}
                        >
                          {isExpired
                            ? `انتهى منذ ${Math.abs(daysRemaining)} يوم`
                            : `متبقي ${daysRemaining} يوم`}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-left font-sans text-xs">
                        <div className="text-slate-900 font-bold">{c.total_invoices_ingested.toLocaleString()} فاتورة</div>
                        <div className="text-emerald-600 font-semibold">
                          ${c.total_revenue_ingested.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => extendSubscription(c.id, 30)}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-200 transition text-xs font-medium cursor-pointer"
                            title="تمديد الاشتراك 30 يوماً"
                          >
                            +30 يوم
                          </button>
                          <button
                            onClick={() =>
                              toggleClientStatus(c.id, c.status === 'active' ? 'suspended' : 'active')
                            }
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${
                              c.status === 'active'
                                ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-600 hover:text-white'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white'
                            }`}
                            title={c.status === 'active' ? 'إيقاف المتجر' : 'تفعيل المتجر'}
                          >
                            {c.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => regenerateKey(c.id)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                            title="إعادة توليد المفتاح"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteClient(c.id)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-600 text-slate-700 hover:text-white border border-slate-200 transition cursor-pointer"
                            title="حذف المتجر"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* LOWER ROW: AUTO-ARCHIVE & AUDIT LOGS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* DB RETENTION & VACUUM */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Archive className="w-4 h-4 text-blue-600" />
              <span>الأرشفة الذكية وضغط البيانات</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">SQLite WAL</span>
          </div>

          <div className="space-y-3 text-xs text-slate-700">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">الفواتير النشطة (Hot):</span>
              <span className="font-sans text-slate-900 font-bold">{dbStats?.active_invoices_count || 0}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">الفواتير المؤرشفة (Cold):</span>
              <span className="font-sans text-slate-700 font-bold">{dbStats?.archived_invoices_count || 0}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">الأصناف المفهرسة:</span>
              <span className="font-sans text-slate-900 font-bold">{dbStats?.total_items_count || 0}</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <label className="block text-xs font-semibold text-slate-700">أرشفة الفواتير الأقدم من:</label>
            <div className="flex gap-2">
              <select
                id="archive-days-select"
                value={archiveDays}
                onChange={(e) => setArchiveDays(parseInt(e.target.value))}
                className="bg-white border border-slate-300 rounded-xl text-xs text-slate-900 px-3 py-2 flex-1 focus:outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
              >
                <option value="30">30 يوماً (قياسي)</option>
                <option value="60">60 يوماً</option>
                <option value="90">90 يوماً</option>
                <option value="1">يوم واحد (تجربة وتنظيف)</option>
              </select>
              <button
                onClick={triggerArchive}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                أرشف الآن
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              نقل الصفوف من جدول الفواتير النشطة إلى جدول الأرشيف فورياً في معاملة ذرية.
            </p>
          </div>

          <button
            onClick={runVacuum}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 border border-slate-300 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-cyan-600" />
            <span>تنفيذ VACUUM واستعادة المساحة التخزينية</span>
          </button>
        </div>

        {/* API AUDIT LOGS */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>سجل مصادقة المفاتيح وزمن الاستجابة (Latency)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تسجيل حي لطلبات الربط القادمة من نقاط البيع وسرعة معالجتها.
              </p>
            </div>
            <button onClick={fetchLogs} className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer">
              تحديث
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-700">
              <thead className="text-slate-500 border-b border-slate-200 pb-2">
                <tr>
                  <th className="py-2">الوقت</th>
                  <th className="py-2">رمز المتجر</th>
                  <th className="py-2">البروتوكول والمسار</th>
                  <th className="py-2">رمز الحالة</th>
                  <th className="py-2 text-left">زمن الاستجابة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 font-sans">
                      لا توجد سجلات مصادقة مسجلة حتى الآن.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isOk = log.status_code >= 200 && log.status_code < 300;
                    return (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2 text-slate-500 font-sans">{new Date(log.created_at).toLocaleTimeString('ar-EG')}</td>
                        <td className="py-2 font-medium text-slate-900 font-sans">{log.store_id}</td>
                        <td className="py-2 text-slate-700" dir="ltr">
                          {log.method} {log.endpoint}
                        </td>
                        <td className="py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isOk
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {log.status_code}
                          </span>
                        </td>
                        <td className="py-2 text-left text-slate-500 font-sans">{log.latency_ms}ms</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* CREATE CLIENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-right">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <span>إضافة وتجهيز متجر عميل جديد</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  رمز المتجر الفريد (Store ID)
                </label>
                <input
                  type="text"
                  required
                  id="modal-new-store-id"
                  value={formStoreId}
                  onChange={(e) => setFormStoreId(e.target.value.toUpperCase())}
                  placeholder="مثال: STORE-CAIRO-08"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 uppercase focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">اسم المتجر / النشاط التجاري</label>
                <input
                  type="text"
                  required
                  id="modal-new-store-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: سوبر ماركت النخيل"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">البريد الإلكتروني للمالك</label>
                <input
                  type="email"
                  required
                  id="modal-new-owner-email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="owner@store.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">باقة الاشتراك</label>
                  <select
                    id="modal-new-plan"
                    value={formPlan}
                    onChange={(e: any) => setFormPlan(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="pro">احترافي ($49/شهرياً)</option>
                    <option value="starter">أساسي ($19/شهرياً)</option>
                    <option value="enterprise">شركات ($149/شهرياً)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">المدة الأولية</label>
                  <select
                    id="modal-new-days"
                    value={formDaysValid}
                    onChange={(e) => setFormDaysValid(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="30">30 يوماً (شهر)</option>
                    <option value="90">90 يوماً (ربع سنوي)</option>
                    <option value="365">365 يوماً (سنة)</option>
                    <option value="7">7 أيام (تجريبي)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">حد الطلبات (طلب/دقيقة)</label>
                <input
                  type="number"
                  id="modal-new-ratelimit"
                  value={formRateLimit}
                  onChange={(e) => setFormRateLimit(parseInt(e.target.value))}
                  min="10"
                  max="5000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  id="modal-submit-create-client-btn"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>توليد المفتاح والتسجيل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
