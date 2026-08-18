import React, { useState } from 'react';
import {
  KeyRound,
  Shield,
  Plus,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Sparkles,
  Lock,
  Zap,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { ClientRecord } from '../types';

interface KeyGeneratorProps {
  clients: ClientRecord[];
  onRefreshClients: () => void;
  onRefreshStats: () => void;
}

export const KeyGenerator: React.FC<KeyGeneratorProps> = ({
  clients,
  onRefreshClients,
  onRefreshStats,
}) => {
  // Form State
  const [storeId, setStoreId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [plan, setPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [validityDays, setValidityDays] = useState<number>(30);
  const [rateLimit, setRateLimit] = useState<number>(200);
  const [keyPrefix, setKeyPrefix] = useState<string>('sk_live_');

  // Preview / Generated State
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCreateNewKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !name || !email) {
      showToast('يرجى ملء جميع الحقول الإلزامية (معرف المتجر، الاسم، والبريد)', true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId.trim(),
          name: name.trim(),
          owner_email: email.trim(),
          plan: plan,
          days_valid: validityDays,
          rate_limit: rateLimit,
        }),
      });

      const data = await res.json();
      if (data && data.success) {
        setGeneratedKey(data.client.api_key);
        showToast(`تم إصدار وتفعيل مفتاح الربط للمتجر "${data.client.name}" بنجاح!`);
        setStoreId('');
        setName('');
        setEmail('');
        onRefreshClients();
        onRefreshStats();
      } else {
        showToast(data.error || 'فشل في إنشاء المفتاح', true);
      }
    } catch (err: any) {
      showToast(err.message || 'خطأ في الاتصال بالسيرفر', true);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    showToast('تم نسخ مفتاح الـ API إلى الحافظة!');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* TOAST ALERT */}
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
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <KeyRound className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">مولد المفاتيح والتراخيص المشفرة (API Key Generator)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إصدار تراخيص مشفرة مع خوارزمية HMAC-SHA256، تحديد معدل الطلبات لكل دقيقة، وفترة الصلاحية لربط تطبيقات العملاء فورياً وبلا توقف.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
            {clients.length} مفاتيح مسجلة
          </span>
        </div>
      </div>

      {/* GENERATOR TWO-COLUMN WORKBENCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* FORM COLUMN */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleCreateNewKey}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>إصدار مفتاح جديد لعميل / متجر</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">256-bit Entropy Token</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  معرف المتجر الفريد (Store ID) *
                </label>
                <input
                  type="text"
                  placeholder="مثال: store_cairo_01"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
                <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                  يستخدمه العميل في ترويسات الطلبات
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  اسم المتجر / العميل *
                </label>
                <input
                  type="text"
                  placeholder="مثال: سلسلة مطاعم البركة"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                البريد الإلكتروني للعميل *
              </label>
              <input
                type="email"
                placeholder="owner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">خطة الاشتراك</label>
                <select
                  value={plan}
                  onChange={(e: any) => setPlan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                >
                  <option value="starter">Starter (مبتدئ)</option>
                  <option value="pro">Pro (احترافي)</option>
                  <option value="enterprise">Enterprise (مؤسسات)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">فترة الصلاحية</label>
                <select
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                >
                  <option value={7}>7 أيام (تجريبي)</option>
                  <option value={30}>30 يوم (شهر)</option>
                  <option value={90}>90 يوم (3 أشهر)</option>
                  <option value={365}>365 يوم (سنة كاملة)</option>
                  <option value={3650}>دائم (Lifetime)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">حد الطلبات (Rate Limit)</label>
                <select
                  value={rateLimit}
                  onChange={(e) => setRateLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                >
                  <option value={60}>60 طلب / دقيقة</option>
                  <option value={120}>120 طلب / دقيقة</option>
                  <option value={200}>200 طلب / دقيقة</option>
                  <option value={500}>500 طلب / دقيقة</option>
                  <option value={1000}>1000 طلب / دقيقة</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 transition cursor-pointer mt-4"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              <span>توليد وإصدار مفتاح الربط المشفر الآن</span>
            </button>
          </form>

          {/* LATEST GENERATED KEY REVEAL CARD */}
          {generatedKey && (
            <div className="bg-slate-900 p-6 rounded-2xl text-slate-100 border border-slate-800 shadow-xl space-y-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>المفتاح تم توليده بنجاح وجاهز للاستخدام الفوري:</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">sk_live_...</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                <code className="text-amber-300 font-mono text-xs select-all truncate">{generatedKey}</code>
                <button
                  onClick={() => handleCopy(generatedKey)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                >
                  {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey ? 'تم النسخ' : 'نسخ المفتاح'}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                ⚠️ انسخ المفتاح وأعطه للعميل ليضعه في ترويسة <code className="text-white font-mono">x-api-key</code> في تطبيقه.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SECURITY RULES & KEY REGISTRY */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>مواصفات الأمان والحماية</span>
            </h3>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 block">1. التحقق الذري بالترويسات</span>
                <p className="text-slate-500 text-[11px]">
                  يقوم السيرفر بفحص المفتاح في أقل من 0.2ms عبر الفهرس السريع <code className="font-mono text-blue-600">idx_clients_api_key</code>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 block">2. إيقاف وتفعيل فوري (Real-time Killswitch)</span>
                <p className="text-slate-500 text-[11px]">
                  في حال انتهاء اشتراك العميل أو إيقافه يدوياً، يتم حجب الطلبات فوراً مع إرجاع <code className="font-mono text-rose-600">403 Forbidden</code>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 block">3. عزل البيانات لكل متجر (Multi-Tenant Isolation)</span>
                <p className="text-slate-500 text-[11px]">
                  لا يمكن لأي عميل الوصول أو استعراض فواتير عميل آخر، حيث يتم فلترة البيانات تلقائياً بواسطة المعرف المعتمد.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>إحصائيات التراخيص الموزعة</span>
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                <span className="text-[10px] text-emerald-600 block">مفاتيح نشطة</span>
                <span className="text-base font-bold font-mono">
                  {clients.filter((c) => c.status === 'active').length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 text-rose-800 font-semibold border border-rose-200">
                <span className="text-[10px] text-rose-600 block">مفاتيح موقوفة</span>
                <span className="text-base font-bold font-mono">
                  {clients.filter((c) => c.status !== 'active').length}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
