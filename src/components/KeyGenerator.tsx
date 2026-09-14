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
import { useLanguage } from '../lib/i18n';

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
  const { language, t } = useLanguage();
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
      showToast(
        language === 'ar'
          ? 'يرجى ملء جميع الحقول الإلزامية (معرف المتجر، الاسم، والبريد)'
          : 'Please fill in all required fields (Store ID, Name, and Email)',
        true
      );
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
        showToast(
          language === 'ar'
            ? `تم إصدار وتفعيل مفتاح الربط للمتجر "${data.client.name}" بنجاح!`
            : `API Key successfully generated and activated for "${data.client.name}"!`
        );
        setStoreId('');
        setName('');
        setEmail('');
        onRefreshClients();
        onRefreshStats();
      } else {
        showToast(data.error || (language === 'ar' ? 'فشل في إنشاء المفتاح' : 'Failed to generate key'), true);
      }
    } catch (err: any) {
      showToast(err.message || (language === 'ar' ? 'خطأ في الاتصال بالسيرفر' : 'Server communication error'), true);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    showToast(language === 'ar' ? 'تم نسخ مفتاح الـ API إلى الحافظة!' : 'API Key copied to clipboard!');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* TOAST ALERT */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 ${language === 'ar' ? 'left-6' : 'right-6'} z-50 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 border animate-in slide-in-from-bottom-5 ${
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
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <KeyRound className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {language === 'ar'
                ? 'مولد المفاتيح والتراخيص المشفرة (API Key Generator)'
                : 'Cryptographic API Key & License Generator'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {language === 'ar'
              ? 'إصدار تراخيص مشفرة مع خوارزمية HMAC-SHA256، تحديد معدل الطلبات لكل دقيقة، وفترة الصلاحية لربط تطبيقات العملاء فورياً وبلا توقف.'
              : 'Issue HMAC-SHA256 encrypted access tokens with rate limits and expiry controls for multi-tenant ingestion.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
            {clients.length} {language === 'ar' ? 'مفاتيح مسجلة' : 'Registered Keys'}
          </span>
        </div>
      </div>

      {/* GENERATOR TWO-COLUMN WORKBENCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* FORM COLUMN */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleCreateNewKey}
            className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{language === 'ar' ? 'إصدار مفتاح جديد لعميل / متجر' : 'Issue New Client / Store Key'}</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">256-bit Entropy Token</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'ar' ? 'معرف المتجر الفريد (Store ID) *' : 'Unique Store ID *'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. store_cairo_01"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  dir="ltr"
                />
                <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                  {language === 'ar' ? 'يستخدمه العميل في ترويسات الطلبات' : 'Used in x-store-id header'}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'ar' ? 'اسم المتجر / العميل *' : 'Store / Client Name *'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'مثال: سوبرماركت البركة' : 'e.g. Baraka Supermarket'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                {language === 'ar' ? 'البريد الإلكتروني للعميل *' : 'Client Email Address *'}
              </label>
              <input
                type="email"
                placeholder="owner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'ar' ? 'خطة الاشتراك' : 'Subscription Plan'}
                </label>
                <select
                  value={plan}
                  onChange={(e: any) => setPlan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                >
                  <option value="starter">{language === 'ar' ? 'Starter (مبتدئ)' : 'Starter'}</option>
                  <option value="pro">{language === 'ar' ? 'Pro (احترافي)' : 'Pro'}</option>
                  <option value="enterprise">{language === 'ar' ? 'Enterprise (مؤسسات)' : 'Enterprise'}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'ar' ? 'فترة الصلاحية' : 'Validity Duration'}
                </label>
                <select
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                >
                  <option value={7}>{language === 'ar' ? '7 أيام (تجريبي)' : '7 Days (Trial)'}</option>
                  <option value={30}>{language === 'ar' ? '30 يوم (شهر)' : '30 Days (1 Month)'}</option>
                  <option value={90}>{language === 'ar' ? '90 يوم (3 أشهر)' : '90 Days (3 Months)'}</option>
                  <option value={365}>{language === 'ar' ? '365 يوم (سنة كاملة)' : '365 Days (1 Year)'}</option>
                  <option value={3650}>{language === 'ar' ? 'دائم (Lifetime)' : 'Permanent (Lifetime)'}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'ar' ? 'حد الطلبات (Rate Limit)' : 'Rate Limit'}
                </label>
                <select
                  value={rateLimit}
                  onChange={(e) => setRateLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                >
                  <option value={60}>60 {language === 'ar' ? 'طلب / د' : 'req/min'}</option>
                  <option value={120}>120 {language === 'ar' ? 'طلب / د' : 'req/min'}</option>
                  <option value={200}>200 {language === 'ar' ? 'طلب / د' : 'req/min'}</option>
                  <option value={500}>500 {language === 'ar' ? 'طلب / د' : 'req/min'}</option>
                  <option value={1000}>1000 {language === 'ar' ? 'طلب / د' : 'req/min'}</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 transition cursor-pointer mt-4"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              <span>
                {language === 'ar' ? 'توليد وإصدار مفتاح الربط المشفر الآن' : 'Generate & Activate Encrypted API Key'}
              </span>
            </button>
          </form>

          {/* LATEST GENERATED KEY REVEAL CARD */}
          {generatedKey && (
            <div className="bg-slate-900 p-5 sm:p-6 rounded-2xl text-slate-100 border border-slate-800 shadow-xl space-y-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {language === 'ar'
                      ? 'المفتاح تم توليده بنجاح وجاهز للاستخدام الفوري:'
                      : 'Key successfully generated and ready for production:'}
                  </span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">sk_live_...</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
                <code className="text-amber-300 font-mono text-xs select-all truncate">{generatedKey}</code>
                <button
                  onClick={() => handleCopy(generatedKey)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                >
                  {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey ? (language === 'ar' ? 'تم النسخ' : 'Copied') : (language === 'ar' ? 'نسخ المفتاح' : 'Copy Key')}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                {language === 'ar'
                  ? '⚠️ انسخ المفتاح وأعطه للعميل ليضعه في ترويسة x-api-key في تطبيقه.'
                  : '⚠️ Copy this secret key and inject it into the client application as x-api-key header.'}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SECURITY RULES & KEY REGISTRY */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>{language === 'ar' ? 'مواصفات الأمان والحماية' : 'Security Architecture'}</span>
            </h3>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 block">
                  {language === 'ar' ? '1. التحقق الذري بالترويسات' : '1. Header-based Atomic Auth'}
                </span>
                <p className="text-slate-500 text-[11px]">
                  {language === 'ar'
                    ? 'يقوم السيرفر بفحص المفتاح في أقل من 0.2ms عبر الفهرس السريع idx_clients_api_key.'
                    : 'The server verifies the API key in under 0.2ms via idx_clients_api_key index.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 block">
                  {language === 'ar' ? '2. إيقاف وتفعيل فوري (Killswitch)' : '2. Real-time Killswitch'}
                </span>
                <p className="text-slate-500 text-[11px]">
                  {language === 'ar'
                    ? 'في حال انتهاء اشتراك العميل أو إيقافه يدوياً، يتم حجب الطلبات فوراً مع إرجاع 403 Forbidden.'
                    : 'Expired or suspended clients immediately receive 403 Forbidden on incoming requests.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 block">
                  {language === 'ar' ? '3. عزل البيانات لكل متجر (Multi-Tenant)' : '3. Strict Multi-Tenant Isolation'}
                </span>
                <p className="text-slate-500 text-[11px]">
                  {language === 'ar'
                    ? 'لا يمكن لأي عميل الوصول أو استعراض فواتير عميل آخر، حيث يتم فلترة البيانات تلقائياً بواسطة المعرف.'
                    : 'No tenant can access another store\'s records. Every transaction is partitioned by store_id.'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{language === 'ar' ? 'إحصائيات التراخيص الموزعة' : 'License Registry Statistics'}</span>
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                <span className="text-[10px] text-emerald-600 block">
                  {language === 'ar' ? 'مفاتيح نشطة' : 'Active Keys'}
                </span>
                <span className="text-base font-bold font-mono">
                  {clients.filter((c) => c.status === 'active').length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 text-rose-800 font-semibold border border-rose-200">
                <span className="text-[10px] text-rose-600 block">
                  {language === 'ar' ? 'مفاتيح موقوفة' : 'Suspended Keys'}
                </span>
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
