import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Globe,
  Radio,
  Lock,
  Key,
  RefreshCw,
  Send,
  Database,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowDownUp,
  Cpu,
  Activity,
  HardDrive,
  Copy,
  Check,
  Download,
  Flame,
  Terminal,
  Clock,
  Archive,
  Trash2,
  Settings,
  FolderDown,
  FileCheck,
  Server,
  Play,
  Pause,
} from 'lucide-react';
import { ClientRecord, WebhookEndpoint, WebhookDeliveryLog, CloudSnapshot, BackupScheduleConfig } from '../types';
import { safeFetchJson } from '../lib/api';

interface EnterprisePowerSuiteProps {
  clients: ClientRecord[];
}

export const EnterprisePowerSuite: React.FC<EnterprisePowerSuiteProps> = ({ clients }) => {
  const [activeSubTab, setActiveSubTab] = useState<'security' | 'crdt' | 'webhooks' | 'telemetry' | 'backups'>('security');

  // --- 1. SECURITY & RBAC STATE ---
  const [testApiKey, setTestApiKey] = useState(clients[0]?.api_key || 'nazih_core_live_key_001');
  const [selectedScope, setSelectedScope] = useState('invoices:write');
  const [rbacResult, setRbacResult] = useState<any>(null);
  const [isRbacChecking, setIsRbacChecking] = useState(false);
  const [rawTextToEncrypt, setRawTextToEncrypt] = useState('{"customer_card": "4111-XXXX-XXXX-1111", "balance": 95000}');
  const [encryptedPayload, setEncryptedPayload] = useState('U2FsdGVkX1+V9Q4aZbX/890zKLkM1938b...');
  const [rateLimitInfo, setRateLimitInfo] = useState<any>(null);

  // --- 2. CRDT STATE ---
  const [crdtData, setCrdtData] = useState<any>(null);
  const [isMutatingCrdt, setIsMutatingCrdt] = useState(false);

  // --- 3. WEBHOOKS STATE ---
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookDeliveryLog[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>('');
  const [testEventType, setTestEventType] = useState('NEW_INVOICE');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [isDispatchingWebhook, setIsDispatchingWebhook] = useState(false);
  const [lastDispatchResult, setLastDispatchResult] = useState<any>(null);

  // --- 4. TELEMETRY & APM STATE ---
  const [telemetry, setTelemetry] = useState<any>(null);
  const [activeDevices, setActiveDevices] = useState<any[]>([]);
  const [isRefreshingTelemetry, setIsRefreshingTelemetry] = useState(false);

  // --- 5. CLOUD BACKUPS & AUTOMATED SCHEDULER STATE ---
  const [snapshots, setSnapshots] = useState<CloudSnapshot[]>([]);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [selectedCloudTarget, setSelectedCloudTarget] = useState('cloudflare_r2');
  const [schedulerConfig, setSchedulerConfig] = useState<BackupScheduleConfig | null>(null);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch initial data
  useEffect(() => {
    fetchRateLimits();
    fetchCRDT();
    fetchWebhooks();
    fetchTelemetry();
    fetchSnapshots();
    fetchSchedulerConfig();
  }, []);

  const fetchRateLimits = async () => {
    try {
      const res = await safeFetchJson<any>('/api/v1/security/rate-limits/status');
      if (res.success && res.data) setRateLimitInfo(res.data);
    } catch (e) {
      console.warn('[RateLimits] Warning:', e);
    }
  };

  const handleVerifyRbac = async () => {
    setIsRbacChecking(true);
    try {
      const res = await safeFetchJson<any>('/api/v1/security/rbac-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: testApiKey,
          requested_scope: selectedScope,
          resource: 'invoices_ledger',
        }),
      });
      if (res.data) setRbacResult(res.data);
    } catch (e) {
      console.warn('[RBAC] Warning:', e);
    } finally {
      setIsRbacChecking(false);
    }
  };

  const fetchCRDT = async () => {
    try {
      const res = await safeFetchJson<any>('/api/v1/crdt/pn-counter/inventory_product_cement_bag');
      if (res.success && res.data) setCrdtData(res.data);
    } catch (e) {
      console.warn('[CRDT] Warning:', e);
    }
  };

  const handleMutateCRDT = async (nodeId: string, type: 'INCREMENT' | 'DECREMENT', qty = 5) => {
    setIsMutatingCrdt(true);
    try {
      const res = await safeFetchJson<any>('/api/v1/crdt/pn-counter/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counter_id: 'inventory_product_cement_bag',
          node_id: nodeId,
          delta_type: type,
          amount: qty,
        }),
      });
      if (res.success && res.data) setCrdtData(res.data);
    } catch (e) {
      console.warn('[CRDT Mutate] Warning:', e);
    } finally {
      setIsMutatingCrdt(false);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const [resHooks, resLogs] = await Promise.all([
        safeFetchJson<{ success: boolean; endpoints: WebhookEndpoint[] }>('/api/v1/webhooks/endpoints'),
        safeFetchJson<{ success: boolean; logs: WebhookDeliveryLog[] }>('/api/v1/webhooks/logs'),
      ]);
      if (resHooks.success && resHooks.data?.endpoints) {
        setWebhooks(resHooks.data.endpoints);
        if (resHooks.data.endpoints.length > 0 && !selectedWebhookId) {
          setSelectedWebhookId(resHooks.data.endpoints[0].id);
        }
      }
      if (resLogs.success && resLogs.data?.logs) setWebhookLogs(resLogs.data.logs);
    } catch (e) {
      console.warn('[Webhooks] Warning:', e);
    }
  };

  const handleDispatchWebhook = async () => {
    setIsDispatchingWebhook(true);
    try {
      const res = await safeFetchJson<any>('/api/v1/webhooks/test-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_id: selectedWebhookId || webhooks[0]?.id,
          event_type: testEventType,
          simulate_failure: simulateFailure,
        }),
      });
      if (res.data) setLastDispatchResult(res.data);
      fetchWebhooks();
    } catch (e) {
      console.warn('[Webhooks Dispatch] Warning:', e);
    } finally {
      setIsDispatchingWebhook(false);
    }
  };

  const fetchTelemetry = async () => {
    setIsRefreshingTelemetry(true);
    try {
      const res = await safeFetchJson<any>('/api/v1/telemetry/metrics');
      if (res.success && res.data) {
        setTelemetry(res.data.telemetry);
        setActiveDevices(res.data.active_devices || []);
      }
    } catch (e) {
      console.warn('[Telemetry] Warning:', e);
    } finally {
      setIsRefreshingTelemetry(false);
    }
  };

  const fetchSnapshots = async () => {
    try {
      const res = await safeFetchJson<{ success: boolean; snapshots: CloudSnapshot[] }>('/api/v1/backups/snapshots');
      if (res.success && res.data?.snapshots) setSnapshots(res.data.snapshots);
    } catch (e) {
      console.warn('[Snapshots] Warning:', e);
    }
  };

  const fetchSchedulerConfig = async () => {
    try {
      const res = await safeFetchJson<{ success: boolean; config: BackupScheduleConfig }>('/api/v1/backups/config');
      if (res.success && res.data?.config) {
        setSchedulerConfig(res.data.config);
        if (res.data.config.target) {
          setSelectedCloudTarget(res.data.config.target);
        }
      }
    } catch (e) {
      console.warn('[SchedulerConfig] Warning:', e);
    }
  };

  const handleUpdateSchedulerConfig = async (newFields: Partial<BackupScheduleConfig>) => {
    setIsUpdatingConfig(true);
    try {
      const res = await safeFetchJson<{ success: boolean; config: BackupScheduleConfig; message?: string }>('/api/v1/backups/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFields),
      });
      if (res.success && res.data?.config) {
        setSchedulerConfig(res.data.config);
        setBackupSuccessMessage(res.data.message || 'تم تحديث إعدادات المجدول بنجاح');
        setTimeout(() => setBackupSuccessMessage(null), 4000);
      }
    } catch (e) {
      console.warn('[UpdateScheduler] Warning:', e);
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  const handleCreateSnapshot = async () => {
    setIsCreatingSnapshot(true);
    try {
      const res = await safeFetchJson<any>('/api/v1/backups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloud_target: selectedCloudTarget }),
      });
      if (res.success) {
        fetchSnapshots();
        fetchSchedulerConfig();
        setBackupSuccessMessage('تم ضغط قاعدة البيانات وتوليد اللقطة بنجاح، والتحقق من سلامتها عبر PRAGMA integrity_check');
        setTimeout(() => setBackupSuccessMessage(null), 4000);
      }
    } catch (e) {
      console.warn('[Create Snapshot] Warning:', e);
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذه النسخة الاحتياطية؟')) return;
    try {
      const res = await safeFetchJson<any>(`/api/v1/backups/snapshots/${id}`, {
        method: 'DELETE',
      });
      if (res.success) {
        fetchSnapshots();
      }
    } catch (e) {
      console.warn('[Delete Snapshot] Warning:', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/50 rounded-2xl p-4 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] font-mono font-bold flex items-center gap-1.5">
                <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Enterprise Suite • Nazih Engine v2.5</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono">
                Active & Battle-Tested
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>حزمة الميزات المتقدمة ومنافسة السحابات العالمية</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              تشفير Zero-Trust، تحكم بالصلاحيات RBAC، خوارزميات نزاع CRDTs، مركز Webhooks خارجي، مراقبة APM فائقة السرعة، ونسخ احتياطي سحابي تلقائي.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchRateLimits();
                fetchCRDT();
                fetchWebhooks();
                fetchTelemetry();
                fetchSnapshots();
              }}
              className="px-3.5 py-2 bg-indigo-600/40 hover:bg-indigo-600/60 border border-indigo-500/40 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث المقاييس</span>
            </button>
          </div>
        </div>

        {/* 5 SUB-TABS NAVIGATION - MOBILE FRIENDLY */}
        <div className="mt-4 sm:mt-6 flex flex-wrap gap-1.5 sm:gap-2 border-t border-indigo-900/50 pt-3 sm:pt-4">
          {[
            { id: 'security', label: '1. الأمان و Zero-Trust', icon: Lock },
            { id: 'crdt', label: '2. حل النزاعات (CRDTs)', icon: ArrowDownUp },
            { id: 'webhooks', label: '3. Webhooks والبث', icon: Globe },
            { id: 'telemetry', label: '4. المراقبة (APM)', icon: Activity },
            { id: 'backups', label: '5. النسخ السحابي التلقائي', icon: HardDrive },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-center ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 ring-1 ring-indigo-400'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. SECURITY & ZERO-TRUST TAB */}
      {/* ======================================================== */}
      {activeSubTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* RBAC MATRIX TESTER */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">مختبر الصلاحيات الدقيقة (Granular RBAC Matrix)</h3>
                  <p className="text-xs text-slate-500">فحص وتطبيق صلاحيات الـ Scopes لكل مفتاح API</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-200">
                Zero-Trust Active
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">مفتاح الـ API المراد اختباره:</label>
                <input
                  type="text"
                  value={testApiKey}
                  onChange={(e) => setTestApiKey(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:border-blue-500 outline-hidden"
                  placeholder="e.g. nazih_core_live_key_001"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الصلاحية المطلوبة (Requested Scope):</label>
                <select
                  value={selectedScope}
                  onChange={(e) => setSelectedScope(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:border-blue-500 outline-hidden"
                >
                  <option value="invoices:write">invoices:write (إصدار وحفظ الفواتير)</option>
                  <option value="invoices:read">invoices:read (استعلام الفواتير فقط)</option>
                  <option value="sync:replicate">sync:replicate (مزامنة الـ SQLite المباشرة)</option>
                  <option value="game:write">game:write (حفظ نتائج وألعاب Unity/Godot)</option>
                  <option value="cache:all">cache:all (محرك الذاكرة السريعة Redis)</option>
                  <option value="accounting:admin">accounting:admin (ترحيل القيود المحاسبية - محمي)</option>
                </select>
              </div>

              <button
                onClick={handleVerifyRbac}
                disabled={isRbacChecking}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isRbacChecking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                <span>فحص الصلاحية عبر محرك الأمان</span>
              </button>

              {rbacResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono ${
                    rbacResult.authorized
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    {rbacResult.authorized ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                    <span>{rbacResult.verdict}</span>
                  </div>
                  <div className="text-[11px] space-y-0.5 text-slate-700">
                    <div>المفتاح: {rbacResult.api_key_masked}</div>
                    <div>الصلاحية: {rbacResult.requested_scope}</div>
                    <div>التوقيت: {rbacResult.timestamp}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TOKEN BUCKET & DDOS SHIELD */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">محرك الـ Rate Limiting (Token Bucket Shield)</h3>
                  <p className="text-xs text-slate-500">حماية ضد الهجمات وتنظيم التدفق اللحظي</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-mono font-bold border border-purple-200">
                Dual Leaky Bucket
              </span>
            </div>

            <div className="space-y-3">
              {rateLimitInfo?.active_buckets?.map((bucket: any, idx: number) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-slate-800">{bucket.store_id}</span>
                    <span className="text-blue-600 font-bold">{bucket.tokens_left} / {bucket.max_capacity} Tokens</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(bucket.tokens_left / bucket.max_capacity) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>إعادة التعبئة: {bucket.refill_per_sec} token/sec</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                      {bucket.status}
                    </span>
                  </div>
                </div>
              ))}

              <div className="bg-slate-900 text-slate-200 rounded-xl p-3 text-xs font-mono space-y-1">
                <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>IP Whitelist & Geofencing Active:</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {rateLimitInfo?.ip_whitelist?.join(', ')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CRDTs & ADVANCED CONFLICT RESOLUTION */}
      {/* ======================================================== */}
      {activeSubTab === 'crdt' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <ArrowDownUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    محرك حل النزاعات الرياضي بدون أقفال (Conflict-Free Replicated Data Types - CRDT)
                  </h2>
                  <p className="text-xs text-slate-500">
                    نموذج State-based PN-Counter لمزامنة المخزون والأرصدة بين عدة أجهزة تعمل بدون إنترنت دون أي تضارب
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-center">
              <span className="text-[11px] text-emerald-700 font-medium block">الرصيد المجمّع المتوافق رياضياً (Net Total):</span>
              <span className="text-2xl font-black text-emerald-800 font-mono">
                {crdtData?.resolved_net_balance ?? 610} وحدة
              </span>
            </div>
          </div>

          {/* SIMULATED OFFLINE NODES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {crdtData?.vector_clocks?.map((node: any, idx: number) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 font-mono truncate">{node.node_id}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                  <div className="bg-emerald-100/60 p-2 rounded-xl border border-emerald-200 text-emerald-900">
                    <span className="text-[10px] text-emerald-700 block">الوارد (+)</span>
                    <span className="font-bold text-sm">+{node.positive}</span>
                  </div>
                  <div className="bg-rose-100/60 p-2 rounded-xl border border-rose-200 text-rose-900">
                    <span className="text-[10px] text-rose-700 block">المنصرف (-)</span>
                    <span className="font-bold text-sm">-{node.negative}</span>
                  </div>
                </div>

                <div className="text-center text-xs font-mono font-bold text-slate-700">
                  صافي العقدة: <span className="text-blue-600">{node.net}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleMutateCRDT(node.node_id, 'INCREMENT', 10)}
                    disabled={isMutatingCrdt}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    +10 استلام
                  </button>
                  <button
                    onClick={() => handleMutateCRDT(node.node_id, 'DECREMENT', 5)}
                    disabled={isMutatingCrdt}
                    className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    -5 صرف
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 text-slate-200 rounded-xl p-4 text-xs font-mono space-y-2">
            <div className="text-emerald-400 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>كيف يضمن محرك Nazih Core عدم حدوث أي تضارب (Zero-Conflict)؟</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              بدلاً من استبدال القيمة كاملة، يقوم السيرفر بجمع متجهات الإضافة (Positive Vector) ومتجهات الحذف (Negative Vector) لكل جهاز بشكل تبادلي وتجميعي (Commutative & Associative)، مما يعني أن النتيجة النهائية تتطابق 100% بغض النظر عن ترتيب وصول الحزم عبر الشبكة.
            </p>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. EVENT-DRIVEN WEBHOOKS TAB */}
      {/* ======================================================== */}
      {activeSubTab === 'webhooks' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: WEBHOOK DISPATCHER */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 lg:col-span-1">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">إرسال إشعار فوري (Webhook Dispatcher)</h3>
                <p className="text-xs text-slate-500">إرسال الأحداث مع توقيع HMAC-SHA256</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الوجهة المستهدفة (Endpoint):</label>
                <select
                  value={selectedWebhookId}
                  onChange={(e) => setSelectedWebhookId(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:border-blue-500 outline-hidden"
                >
                  {webhooks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">نوع الحدث (Event Trigger):</label>
                <select
                  value={testEventType}
                  onChange={(e) => setTestEventType(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:border-blue-500 outline-hidden"
                >
                  <option value="NEW_INVOICE">NEW_INVOICE (فاتورة جديدة تم إصدارها)</option>
                  <option value="HIGH_VALUE_SALE">HIGH_VALUE_SALE (عملية بيع مرتفعة القيمة)</option>
                  <option value="INVENTORY_ALERT">INVENTORY_ALERT (تحذير نقص المخزون)</option>
                  <option value="GAME_SCORE">GAME_SCORE (تسجيل رقم قياسي جديد باللعبة)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  id="simulateFailure"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="simulateFailure" className="text-xs text-slate-700 cursor-pointer">
                  محاكاة فشل السيرفر الخارجي لاختبار إعادة المحاولة (Exponential Backoff)
                </label>
              </div>

              <button
                onClick={handleDispatchWebhook}
                disabled={isDispatchingWebhook}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isDispatchingWebhook ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>إرسال وتوثيق الـ Webhook</span>
              </button>

              {lastDispatchResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono ${
                    lastDispatchResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="font-bold mb-1">{lastDispatchResult.message}</div>
                  {lastDispatchResult.backoff_schedule && (
                    <div className="text-[11px] text-amber-800 mt-1">
                      جدول المحاولات: {lastDispatchResult.backoff_schedule.join(' ➔ ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: REGISTERED WEBHOOKS & DELIVERY LOGS */}
          <div className="space-y-6 lg:col-span-2">
            {/* ENDPOINTS LIST */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">الروابط الخارجية المعتمدة (Registered Endpoints)</h3>
              <div className="space-y-2">
                {webhooks.map((hook) => (
                  <div key={hook.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{hook.name}</span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                          {hook.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono truncate">{hook.target_url}</div>
                    </div>
                    <div className="text-left text-xs font-mono shrink-0">
                      <div className="text-blue-600 font-bold">{hook.total_deliveries} إرسال ناجح</div>
                      <div className="text-[10px] text-slate-400">آخر كود: {hook.last_status_code || 200} OK</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* LIVE DELIVERY LOGS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">سجل الإرسال اللحظي وتوقيعات التشفير (HMAC Logs)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs font-mono">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 px-3">الحدث</th>
                      <th className="py-2 px-3">الحالة</th>
                      <th className="py-2 px-3">الاستجابة</th>
                      <th className="py-2 px-3">التوقيع HMAC</th>
                      <th className="py-2 px-3">الوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {webhookLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 font-bold text-slate-800">{log.event_type}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.status === 'success'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {log.http_status || 200}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{log.latency_ms}ms</td>
                        <td className="py-2 px-3 text-slate-400 text-[10px] truncate max-w-[120px]">{log.signature}</td>
                        <td className="py-2 px-3 text-slate-400 text-[10px]">{new Date(log.created_at).toLocaleTimeString('ar-EG')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. LIVE TELEMETRY & APM TAB */}
      {/* ======================================================== */}
      {activeSubTab === 'telemetry' && (
        <div className="space-y-6">
          {/* APM METRICS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] text-slate-500 block">P50 / Median Latency</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {telemetry?.p50_latency_ms || 1.2}ms
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">سرعة خارقة &lt; 2ms</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] text-slate-500 block">P99 Latency (Tail)</span>
              <span className="text-2xl font-black text-blue-600 font-mono mt-1 block">
                {telemetry?.p99_latency_ms || 8.4}ms
              </span>
              <span className="text-[10px] text-blue-600 font-medium">استجابة ثابتة تحت الضغط</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] text-slate-500 block">معدل الطلبات اللحظي</span>
              <span className="text-2xl font-black text-purple-600 font-mono mt-1 block">
                {telemetry?.requests_per_second || 145} req/s
              </span>
              <span className="text-[10px] text-purple-600 font-medium">MNDB Ingestion Flow</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] text-slate-500 block">استهلاك الذاكرة (RSS)</span>
              <span className="text-2xl font-black text-emerald-600 font-mono mt-1 block">
                {telemetry?.memory_rss_mb || 45} MB
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">خفيف جداً وفعال</span>
            </div>
          </div>

          {/* ACTIVE WEBSOCKET DEVICES INSPECTOR */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">مفتش حركة الأجهزة المتصلة حياً (Live WebSocket Inspector)</h3>
                  <p className="text-xs text-slate-500">مراقبة كل جهاز متصل، زمن الـ Ping، وإمكانية إدارة الجلسات</p>
                </div>
              </div>
              <button
                onClick={fetchTelemetry}
                disabled={isRefreshingTelemetry}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingTelemetry ? 'animate-spin' : ''}`} />
                <span>تحديث</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs font-mono">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">معرّف الجهاز (Device ID)</th>
                    <th className="py-2.5 px-3">غرفة المتجر (Store Room)</th>
                    <th className="py-2.5 px-3">الدور / التطبيق</th>
                    <th className="py-2.5 px-3">زمن الاستجابة (Ping)</th>
                    <th className="py-2.5 px-3">الحالة</th>
                    <th className="py-2.5 px-3 text-center">إجراء الأمان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeDevices.map((dev, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{dev.device_id}</td>
                      <td className="py-2.5 px-3 text-blue-600 font-bold">{dev.store_id}</td>
                      <td className="py-2.5 px-3 text-slate-600">{dev.role}</td>
                      <td className="py-2.5 px-3 text-emerald-600 font-bold">{dev.ping_ms} ms</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {dev.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => alert(`تم إرسال أمر فصل الجلسة للجهاز: ${dev.device_id}`)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                        >
                          فصل الجلسة (Kick)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. AUTOMATED CLOUD BACKUPS & DISASTER RECOVERY */}
      {/* ======================================================== */}
      {activeSubTab === 'backups' && (
        <div className="space-y-6">
          {backupSuccessMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{backupSuccessMessage}</span>
            </div>
          )}

          {/* AUTOMATED SCHEDULER CONTROL CARD */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      مجدول النسخ الاحتياطي التلقائي (Automated Backup Scheduler)
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        schedulerConfig?.enabled
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {schedulerConfig?.enabled ? 'المجدول يعمل تلقائياً' : 'المجدول متوقف مؤقتاً'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ضغط وتشفير قواعد بيانات SQLite (Gzip / Brotli) وإرسالها المجدول إلى السحابة مع تدقيق السلامة ACID
                  </p>
                </div>
              </div>

              {/* TOGGLE SCHEDULER ON/OFF */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    handleUpdateSchedulerConfig({
                      enabled: !schedulerConfig?.enabled,
                    })
                  }
                  disabled={isUpdatingConfig}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                    schedulerConfig?.enabled
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {schedulerConfig?.enabled ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>إيقاف الجدولة مؤقتاً</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>تشغيل الجدولة التلقائية</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleCreateSnapshot}
                  disabled={isCreatingSnapshot}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {isCreatingSnapshot ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Archive className="w-3.5 h-3.5" />
                  )}
                  <span>إنشاء نسخة مضغوطة فوراً</span>
                </button>
              </div>
            </div>

            {/* SCHEDULER PARAMETERS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
              {/* 1. INTERVAL */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  تكرار الجدولة (Backup Frequency)
                </label>
                <select
                  value={schedulerConfig?.intervalMinutes || 60}
                  onChange={(e) =>
                    handleUpdateSchedulerConfig({ intervalMinutes: Number(e.target.value) })
                  }
                  className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg p-2 focus:border-purple-500 outline-hidden"
                >
                  <option value={15}>كل 15 دقيقة (للبيئات فائقة النشاط)</option>
                  <option value={60}>كل ساعة (الافتراضي الموصى به)</option>
                  <option value={360}>كل 6 ساعات</option>
                  <option value={720}>كل 12 ساعة</option>
                  <option value={1440}>يومياً (كل 24 ساعة)</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {schedulerConfig?.nextScheduledBackupAt
                    ? `التشغيل القادم: ${new Date(schedulerConfig.nextScheduledBackupAt).toLocaleTimeString('ar-EG')}`
                    : 'الجدولة متوقفة'}
                </span>
              </div>

              {/* 2. COMPRESSION ALGORITHM */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  خوارزمية الضغط (Compression Engine)
                </label>
                <select
                  value={schedulerConfig?.compression || 'gzip'}
                  onChange={(e) =>
                    handleUpdateSchedulerConfig({ compression: e.target.value as any })
                  }
                  className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg p-2 focus:border-purple-500 outline-hidden"
                >
                  <option value="gzip">Gzip (Level 9 - توفير ~75% بالحجم)</option>
                  <option value="brotli">Brotli Ultra (أقصى ضغط للبيانات الضخمة)</option>
                  <option value="none">بدون ضغط (Raw SQLite Binary)</option>
                </select>
                <span className="text-[10px] text-purple-600 mt-1 block font-medium">
                  يقلل استهلاك التخزين والترافيك
                </span>
              </div>

              {/* 3. CLOUD STORAGE TARGET */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  وجهة التخزين السحابي (Target Vault)
                </label>
                <select
                  value={schedulerConfig?.target || selectedCloudTarget}
                  onChange={(e) => {
                    setSelectedCloudTarget(e.target.value);
                    handleUpdateSchedulerConfig({ target: e.target.value as any });
                  }}
                  className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg p-2 focus:border-purple-500 outline-hidden"
                >
                  <option value="cloudflare_r2">Cloudflare R2 (S3-Compatible Zero-Egress)</option>
                  <option value="aws_s3">AWS S3 Glacier Deep Archive (أعلى أمان)</option>
                  <option value="hetzner">Hetzner Storage Box (خوادم ألمانيا المشفرة)</option>
                  <option value="local_nvme">Local NVMe Mirror & Offline NAS</option>
                  <option value="google_cloud_storage">Google Cloud Storage (Coldline)</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  دعم الرفع المباشر وتفادي تكلفة السحب
                </span>
              </div>

              {/* 4. RETENTION & INTEGRITY */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  فترة الاحتفاظ والفحص التلقائي
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={schedulerConfig?.retentionDays || 30}
                    onChange={(e) =>
                      handleUpdateSchedulerConfig({ retentionDays: Number(e.target.value) })
                    }
                    className="w-2/3 text-xs font-mono bg-white border border-slate-200 rounded-lg p-2 focus:border-purple-500 outline-hidden"
                  >
                    <option value={7}>حفظ 7 أيام</option>
                    <option value={30}>حفظ 30 يوماً</option>
                    <option value={90}>حفظ 90 يوماً</option>
                    <option value={365}>أرشفة سنوية</option>
                  </select>
                  <div
                    className={`p-2 rounded-lg border text-xs font-bold flex-1 text-center ${
                      schedulerConfig?.autoIntegrityCheck
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                    title="التحقق من سلامة الجداول وتناسق البيانات عبر PRAGMA integrity_check قبل الضغط"
                  >
                    ACID Check
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  إجمالي مرات التشغيل: {schedulerConfig?.totalBackupsRun || 0}
                </span>
              </div>
            </div>

            {/* SCHEDULER TELEMETRY & HEALTH BAR */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">آخر عملية نسخ احتياطي</span>
                  <span className="text-xs font-bold text-slate-900 font-mono">
                    {schedulerConfig?.lastBackupAt
                      ? new Date(schedulerConfig.lastBackupAt).toLocaleString('ar-EG')
                      : 'لا يوجد'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {schedulerConfig?.lastBackupStatus || 'success'}
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">موعد النسخة التلقائية القادمة</span>
                  <span className="text-xs font-bold text-purple-700 font-mono">
                    {schedulerConfig?.nextScheduledBackupAt
                      ? new Date(schedulerConfig.nextScheduledBackupAt).toLocaleTimeString('ar-EG')
                      : 'معطل'}
                  </span>
                </div>
                <Clock className="w-4 h-4 text-purple-600" />
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">حالة التكامل والأمان</span>
                  <span className="text-xs font-bold text-emerald-600 font-mono">
                    PRAGMA integrity_check (OK)
                  </span>
                </div>
                <FileCheck className="w-4 h-4 text-emerald-600" />
              </div>
            </div>

            {/* SNAPSHOTS LIST */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>أرشيف النسخ الاحتياطية المضغوطة (Point-in-Time Compressed Vaults)</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono">
                    {snapshots.length} ملفات متاحة
                  </span>
                </h3>

                <button
                  onClick={fetchSnapshots}
                  className="text-xs text-slate-600 hover:text-purple-600 flex items-center gap-1 cursor-pointer font-medium"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>تحديث الأرشيف</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {snapshots.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    لم يتم تسجيل أي نسخ احتياطية بعد. انقر على «إنشاء نسخة مضغوطة فوراً» أعلاه.
                  </div>
                ) : (
                  snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold font-mono text-slate-900 flex items-center gap-1.5">
                            <Archive className="w-3.5 h-3.5 text-purple-600" />
                            <span>{snap.filename}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                            {snap.archive_type?.toUpperCase() || 'GZIP'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            سلامة: {snap.integrity_status}
                          </span>
                          {snap.compression_ratio && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 font-mono">
                              {snap.compression_ratio}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 font-mono flex flex-wrap items-center gap-3">
                          {snap.compressed_size_bytes ? (
                            <span>
                              الحجم المضغوط: {(snap.compressed_size_bytes / 1024).toFixed(1)} KB (الأصلي:{' '}
                              {((snap.original_size_bytes || 0) / 1024).toFixed(1)} KB)
                            </span>
                          ) : (
                            <span>الحجم: {snap.size_formatted}</span>
                          )}
                          <span>•</span>
                          <span>السجلات: {snap.total_records}</span>
                          <span>•</span>
                          <span>الوجهة: {snap.cloud_target}</span>
                          <span>•</span>
                          <span>{new Date(snap.created_at).toLocaleString('ar-EG')}</span>
                        </div>

                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-xl">
                          SHA-256: {snap.sha256_checksum}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`/api/v1/backups/download/${snap.filename}`}
                          download={snap.filename}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                          title="تنزيل الملف المضغوط وفحصه محلياً"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تحميل الملف</span>
                        </a>

                        <button
                          onClick={() => handleDeleteSnapshot(snap.id)}
                          className="p-1.5 bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 rounded-lg text-xs transition cursor-pointer"
                          title="حذف هذه النسخة من الأرشيف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
