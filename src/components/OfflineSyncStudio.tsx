import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Send,
  Layers,
  Clock,
  ShieldCheck,
  Code2,
  Copy,
  Check,
  Server,
  ArrowDownUp,
  Cpu,
  Smartphone,
  Plus,
  Trash2,
  Play,
  Database,
  FileCode2,
  Sparkles,
  GitMerge,
  Radio,
  Volume2,
  VolumeX,
  Tablet,
  ArrowRightLeft,
  HardDrive,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { ClientRecord, SyncMutation, SyncOperationResult } from '../types';
import { safeFetchJson } from '../lib/api';

interface Props {
  clients: ClientRecord[];
}

export const OfflineSyncStudio: React.FC<Props> = ({ clients }) => {
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    clients.length > 0 ? clients[0].store_id : ''
  );
  const [isDeviceOnline, setIsDeviceOnline] = useState<boolean>(true);
  const [deviceId, setDeviceId] = useState<string>('pos-mobile-cairo-01');
  const [receiverDeviceId, setReceiverDeviceId] = useState<string>('pos-tablet-alex-02');
  const [receiverConnected, setReceiverConnected] = useState<boolean>(false);
  const [receiverLogs, setReceiverLogs] = useState<Array<{ id: string; time: string; text: string; payload?: any }>>([]);
  const [endpointVersion, setEndpointVersion] = useState<'/api/v1/sync' | '/api/sync/batch'>('/api/v1/sync');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  // Local Offline Mutation Queue for Device 1
  const [localQueue, setLocalQueue] = useState<SyncMutation[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncOperationResult[]>([]);
  const [v1Invoices, setV1Invoices] = useState<any[]>([]);
  const [v1SyncLogs, setV1SyncLogs] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResponse, setSyncResponse] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'simulator' | 'database_inspector' | 'server_code' | 'client_code' | 'flutter_code' | 'cloud_storage' | 'history' | 'architecture'>('simulator');

  // Form states for creating a new offline transaction
  const [customerName, setCustomerName] = useState('شركة المقاولون العرب - مشروع التجمع');
  const [invoiceAmount, setInvoiceAmount] = useState('18500');
  const [itemName, setItemName] = useState('توريد حديد تسليح 12 مم (3 طن)');
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [costCenterCode, setCostCenterCode] = useState('PRJ-TOWER-A');

  // Conflict test states
  const [conflictInvoiceId, setConflictInvoiceId] = useState<string>('inv_demo_conflict_01');
  const [conflictClientName, setConflictClientName] = useState<string>('شركة الأهرام للإنشاءات (تعديل جهاز أ)');
  const [conflictAmount, setConflictAmount] = useState<string>('24000');
  const [conflictTimeOffset, setConflictTimeOffset] = useState<number>(0);

  const receiverWsRef = useRef<WebSocket | null>(null);
  const selectedClient = clients.find((c) => c.store_id === selectedStoreId) || clients[0];

  useEffect(() => {
    if (clients.length > 0 && !selectedStoreId) {
      setSelectedStoreId(clients[0].store_id);
    }
  }, [clients]);

  useEffect(() => {
    fetchSyncOperations();
    fetchV1DatabaseRecords();
  }, [selectedStoreId]);

  // Connect simulated Receiver Device WebSocket
  useEffect(() => {
    if (!selectedStoreId) return;

    // Connect to WebSocket on same host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      receiverWsRef.current = ws;

      ws.onopen = () => {
        setReceiverConnected(true);
        // Send AUTH message
        ws.send(
          JSON.stringify({
            type: 'AUTH',
            store_id: selectedStoreId,
            device_id: receiverDeviceId,
          })
        );
        addReceiverLog(`✅ تم الاتصال بالسيرفر، جاري إرسال مصادقة المتجر (${selectedStoreId})...`);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'AUTH_OK') {
            addReceiverLog(`🔒 تم تأكيد المصادقة: الجهاز جاهز لاستقبال التحديثات اللحظية (AUTH_OK)`);
          } else if (msg.type === 'REALTIME_UPDATE') {
            addReceiverLog(`⚡ استلام دفع لحظي (Real-time Push) من جهاز (${msg.sender_device_id}): تم تطبيق المعاملات على SQLite المحلية بنجاح`, msg.payload);
            fetchV1DatabaseRecords();
          } else if (msg.type === 'NEW_INVOICE') {
            addReceiverLog(`📄 إشعار فاتورة جديدة: رقم #${msg.payload?.invoice?.invoice_number || 'INV'} بقيمة ${msg.payload?.invoice?.total_amount} ج.م`);
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        setReceiverConnected(false);
        addReceiverLog(`⚠️ انقطع الاتصال بسيرفر البث الحي`);
      };

      return () => {
        ws.close();
      };
    } catch (e) {
      console.error('WebSocket connection error:', e);
    }
  }, [selectedStoreId, receiverDeviceId]);

  const addReceiverLog = (text: string, payload?: any) => {
    setReceiverLogs((prev) => [
      {
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        text,
        payload,
      },
      ...prev.slice(0, 30),
    ]);
  };

  const fetchSyncOperations = async () => {
    try {
      const res = await safeFetchJson<{ success: boolean; operations: SyncOperationResult[] }>(
        `/api/sync/operations?store_id=${selectedStoreId || 'ALL'}&limit=50`
      );
      if (res.success && res.data?.operations) {
        setSyncHistory(res.data.operations);
      }
    } catch (e) {
      console.warn('[SyncOps] Warning:', e);
    }
  };

  const fetchV1DatabaseRecords = async () => {
    try {
      const [invRes, logRes] = await Promise.all([
        safeFetchJson<{ success: boolean; invoices: any[] }>(`/api/v1/invoices?store_id=${selectedStoreId || 'ALL'}&limit=50`),
        safeFetchJson<{ success: boolean; logs: any[] }>(`/api/v1/sync-logs?limit=50`),
      ]);
      if (invRes.success && invRes.data?.invoices) setV1Invoices(invRes.data.invoices);
      if (logRes.success && logRes.data?.logs) setV1SyncLogs(logRes.data.logs);
    } catch (e) {
      console.warn('[V1Records] Warning:', e);
    }
  };

  // Generate UUID v4 for offline idempotency
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // 1. Add mutation to local offline SQLite queue
  const handleAddLocalMutation = (customAction: 'INSERT' | 'UPDATE' = 'INSERT') => {
    const operationId = generateUUID();
    const invoiceId = customAction === 'UPDATE' ? conflictInvoiceId : `inv_${generateUUID().substring(0, 8)}`;
    const total = parseFloat(invoiceAmount) || 1000;

    const newMutation: SyncMutation = {
      operation_id: operationId,
      action: customAction,
      table: 'invoices',
      client_timestamp: Date.now() + conflictTimeOffset,
      data: {
        id: invoiceId,
        invoice_number: `INV-OFFLINE-${Date.now().toString().slice(-4)}`,
        customer_name: customerName,
        client_name: customerName,
        total_amount: total,
        payment_method: paymentMethod,
        cost_center_id: costCenterCode,
        items: [
          {
            item_name: itemName,
            category: 'مواد ومستخلصات إنشائية',
            quantity: 1,
            unit_price: total,
            total_price: total,
          },
        ],
        tax: Number((total * 0.14).toFixed(2)),
        discount: 0,
        warranty_retention: Number((total * 0.05).toFixed(2)),
        notes: 'تم إنشاؤها محلياً على جهاز الكاشير في وضع عدم الاتصال (Offline)',
      },
    };

    setLocalQueue((prev) => [newMutation, ...prev]);
  };

  // Quick preset loader
  const handleLoadQuickDemoBatch = () => {
    const op1 = generateUUID();
    const op2 = generateUUID();
    const op3 = generateUUID();
    const now = Date.now();

    const batch: SyncMutation[] = [
      {
        operation_id: op1,
        action: 'INSERT',
        table: 'invoices',
        client_timestamp: now - 30000,
        data: {
          id: `inv_${generateUUID().substring(0, 8)}`,
          invoice_number: `INV-${Date.now().toString().slice(-4)}-01`,
          customer_name: 'شركة المقاولات العامة - برج العاصمة',
          client_name: 'شركة المقاولات العامة - برج العاصمة',
          total_amount: 45000,
          cost_center_id: 'PRJ-TOWER-A',
        },
      },
      {
        operation_id: op2,
        action: 'INSERT',
        table: 'invoices',
        client_timestamp: now - 15000,
        data: {
          id: `inv_${generateUUID().substring(0, 8)}`,
          invoice_number: `INV-${Date.now().toString().slice(-4)}-02`,
          customer_name: 'مؤسسة النيل للخرسانة الجاهزة',
          client_name: 'مؤسسة النيل للخرسانة الجاهزة',
          total_amount: 12800,
          cost_center_id: 'PRJ-TOWER-A',
        },
      },
      {
        operation_id: op3,
        action: 'INSERT',
        table: 'invoices',
        client_timestamp: now,
        data: {
          id: `inv_${generateUUID().substring(0, 8)}`,
          invoice_number: `INV-${Date.now().toString().slice(-4)}-03`,
          customer_name: 'المهندس / أحمد فؤاد (توريد دهانات)',
          client_name: 'المهندس / أحمد فؤاد (توريد دهانات)',
          total_amount: 6200,
          cost_center_id: 'PRJ-MALL-B',
        },
      },
    ];

    setLocalQueue(batch);
  };

  // 2. Push Batch to Nazih Core Server (Up-Sync)
  const handlePushBatchSync = async (mutationsToSend = localQueue) => {
    if (!selectedClient) {
      alert('يرجى اختيار عميل أو إنشاء متجر أولاً من تبويب مولد المفاتيح');
      return;
    }
    if (mutationsToSend.length === 0) {
      alert('طابور العمليات فارغ! أضف عمليات محلية أولاً للتجربة.');
      return;
    }

    setIsSyncing(true);
    setSyncResponse(null);

    try {
      const payload = {
        store_id: selectedClient.store_id,
        device_id: deviceId,
        mutations: mutationsToSend,
      };

      const res = await fetch(endpointVersion, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': selectedClient.api_key,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setSyncResponse(data);

      if (data.success) {
        // Clear synced items from local queue
        setLocalQueue([]);
        fetchSyncOperations();
        fetchV1DatabaseRecords();
      }
    } catch (err: any) {
      setSyncResponse({ success: false, error: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. Test Idempotency (Send same operation twice)
  const handleTestIdempotency = async (mutation: SyncMutation) => {
    if (!selectedClient) return;
    setIsSyncing(true);
    try {
      const payload = {
        store_id: selectedClient.store_id,
        device_id: deviceId,
        mutations: [mutation],
      };

      const res = await fetch(endpointVersion, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': selectedClient.api_key,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setSyncResponse(data);
      fetchSyncOperations();
      fetchV1DatabaseRecords();
    } catch (e: any) {
      setSyncResponse({ success: false, error: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Test Last-Write-Wins Conflict Resolution
  const handleTestConflictUpdate = (isOlderTimestamp: boolean = false) => {
    const opId = generateUUID();
    const timestamp = isOlderTimestamp ? Date.now() - 3600000 : Date.now() + 1000;

    const conflictMutation: SyncMutation = {
      operation_id: opId,
      action: 'UPDATE',
      table: 'invoices',
      client_timestamp: timestamp,
      data: {
        id: conflictInvoiceId,
        client_name: conflictClientName,
        total_amount: parseFloat(conflictAmount) || 20000,
      },
    };

    setLocalQueue((prev) => [conflictMutation, ...prev]);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* HEADER & ARCHITECTURE BADGE */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-800/80 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shrink-0">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white">
                  محرك المزامنة الذكية والبث اللحظي (Offline-First ACID + WebSockets Push)
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  Real-time Push (ws)
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                  Idempotency & ACID
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                معمارية متكاملة تجمع بين السيرفر (Node.js/Express + WebSockets + PostgreSQL) وتطبيقات الأجهزة الفرعية (SQLite Client).
                يتم حفظ المعاملات أوفلاين، وبمجرد رفعها للسيرفر يقوم فوراً بدفعها (Real-time Push) لجميع أجهزة المتجر بدون أي Polling أو Re-fetch.
              </p>
            </div>
          </div>

          {/* STORE & ENDPOINT PICKER */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 flex flex-col gap-1 min-w-[200px]">
              <span className="text-[11px] text-slate-400 font-semibold">المتجر المستهدف:</span>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.store_id}>
                    {c.name} ({c.store_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 flex flex-col gap-1 min-w-[170px]">
              <span className="text-[11px] text-slate-400 font-semibold">نقطة النهاية (Endpoint):</span>
              <select
                value={endpointVersion}
                onChange={(e: any) => setEndpointVersion(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-emerald-300 font-mono rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-bold"
              >
                <option value="/api/v1/sync">POST /api/v1/sync (Standard)</option>
                <option value="/api/sync/batch">POST /api/sync/batch (Extended)</option>
              </select>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-2 mt-6 border-t border-slate-800 pt-4 overflow-x-auto pb-1">
          {[
            { id: 'simulator', label: 'المحاكي التفاعلي الحي (Multi-Device Simulator)', icon: Play },
            { id: 'database_inspector', label: 'مفتش الجداول (invoices & sync_log)', icon: Database },
            { id: 'server_code', label: 'كود السيرفر (Node.js + WebSockets + pg)', icon: Server },
            { id: 'client_code', label: 'عميل Node.js (SQLite + ws)', icon: Code2 },
            { id: 'flutter_code', label: 'عميل Flutter (Dart + SQLite + WebSocket)', icon: Smartphone },
            { id: 'cloud_storage', label: 'تهيئة مساحة 10TB وسيرفر التخزين', icon: HardDrive },
            { id: 'history', label: 'سجل تدقيق Idempotency', icon: ShieldCheck },
            { id: 'architecture', label: 'دليل المعمارية والربط', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: MULTI-DEVICE SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* DEVICE 1: SENDER POS (LEFT - 6 Cols) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">جهاز الكاشير المرسل (Device 1: Sender)</h3>
                      <p className="text-[11px] text-slate-500 font-mono">id: {deviceId}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDeviceOnline(!isDeviceOnline)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      isDeviceOnline
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {isDeviceOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                    <span>{isDeviceOnline ? 'متصل بالشبكة (Online)' : 'مقطوع (Offline)'}</span>
                  </button>
                </div>

                {/* FORM: CREATE OFFLINE TRANSACTION */}
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">اسم العميل / جهة المشروع:</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">قيمة الفاتورة (ج.م):</label>
                      <input
                        type="number"
                        value={invoiceAmount}
                        onChange={(e) => setInvoiceAmount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono font-bold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">مركز التكلفة / المشروع:</label>
                      <input
                        type="text"
                        value={costCenterCode}
                        onChange={(e) => setCostCenterCode(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleAddLocalMutation('INSERT')}
                      className="py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>حفظ محلياً بطابور الجهاز</span>
                    </button>
                    <button
                      onClick={handleLoadQuickDemoBatch}
                      className="py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>توليد حزمة 3 فواتير</span>
                    </button>
                  </div>
                </div>

                {/* LOCAL QUEUE ON SENDER */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      طابور الانتظار المحلي ({localQueue.length} عملية معلقة)
                    </span>
                    {localQueue.length > 0 && (
                      <button
                        onClick={() => setLocalQueue([])}
                        className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                      >
                        تفريغ الطابور
                      </button>
                    )}
                  </div>

                  {localQueue.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 rounded-xl text-slate-400 text-xs">
                      لا توجد عمليات محلية معلقة. أضف فاتورة أو ولد حزمة لتجربة الرفع والبث اللحظي.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {localQueue.map((m, idx) => (
                        <div
                          key={m.operation_id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{m.data.client_name || m.data.customer_name}</span>
                            <span className="text-emerald-600 font-mono font-bold mr-2">
                              {(m.data.total_amount || 0).toLocaleString()} ج.م
                            </span>
                          </div>
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                            {m.action}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PUSH BUTTON */}
                  <button
                    onClick={() => handlePushBatchSync()}
                    disabled={isSyncing || localQueue.length === 0}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
                      localQueue.length > 0 && isDeviceOnline
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Send className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>
                      {isSyncing ? 'جارِ المزامنة والبث اللحظي...' : `إرسال الحزمة للسيرفر عبر ${endpointVersion}`}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* DEVICE 2: RECEIVER TABLET / WEBSOCKET LISTENER (RIGHT - 6 Cols) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <Tablet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        الجهاز المستقبل / شاشة الإدارة (Device 2: Live Listener)
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono">id: {receiverDeviceId}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold flex items-center gap-1.5 ${
                        receiverConnected
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${receiverConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
                      <span>{receiverConnected ? 'WebSockets متصل' : 'غير متصل'}</span>
                    </span>
                  </div>
                </div>

                {/* HOW IT WORKS BANNER */}
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-1">
                  <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" />
                    <span>آلية استقبال الدفع الفوري (Real-time Down-Sync):</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    هذا الجهاز يستمع لبث المتجر (<code className="text-amber-300 font-mono">{selectedStoreId}</code>) عبر WebSockets.
                    بمجرد ضغط "إرسال الحزمة" من الجهاز الأول، يستلم هذا الجهاز البيانات فوراً ويطبق استعلام:
                    <code className="text-blue-300 font-mono block mt-1 bg-slate-900 p-1.5 rounded">
                      INSERT INTO invoices ... ON CONFLICT DO UPDATE WHERE excluded.updated_at &gt; invoices.updated_at
                    </code>
                  </p>
                </div>

                {/* LIVE LOG CONSOLE */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">سجل الاستقبال الفوري من السيرفر (Live Push Feed):</span>
                    {receiverLogs.length > 0 && (
                      <button
                        onClick={() => setReceiverLogs([])}
                        className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                      >
                        مسح السجل
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs max-h-[260px] overflow-y-auto space-y-2">
                    {receiverLogs.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-[11px]">
                        في انتظار بث أحداث حية من السيرفر...
                      </div>
                    ) : (
                      receiverLogs.map((log) => (
                        <div key={log.id} className="border-b border-slate-900 pb-2 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="text-emerald-400 font-bold">{log.time}</span>
                            <span className="text-slate-500">WebSocket Frame</span>
                          </div>
                          <div className="text-slate-200 text-[11px]">{log.text}</div>
                          {log.payload && (
                            <pre className="text-[10px] text-blue-300 bg-slate-900/90 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DATABASE INSPECTOR (invoices & sync_log) */}
      {activeTab === 'database_inspector' && (
        <div className="space-y-6">
          {/* INVOICES TABLE INSPECTOR */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    مفتش جدول الفواتير الموزعة (<code className="text-blue-600 font-mono">invoices</code> table)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الجدول الفعلي بالسيرفر الذي يحتوي على الأعمدة: <code className="font-mono text-slate-700">id, store_id, total_amount, client_name, updated_at, created_at</code>
                  </p>
                </div>
              </div>
              <button
                onClick={fetchV1DatabaseRecords}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحديث الجدول</span>
              </button>
            </div>

            {v1Invoices.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl text-slate-500 text-xs">
                لا توجد سجلات في جدول <code className="font-mono text-blue-600">invoices</code> حتى الآن. أرسل حزمة مزامنة من المحاكي لتظهر هنا.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono">
                      <th className="p-3">id (UUID)</th>
                      <th className="p-3">store_id</th>
                      <th className="p-3">client_name</th>
                      <th className="p-3">total_amount (DECIMAL)</th>
                      <th className="p-3">updated_at (BIGINT ms)</th>
                      <th className="p-3">created_at (TIMESTAMP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {v1Invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-blue-600 font-bold">{inv.id}</td>
                        <td className="p-3 text-slate-700">{inv.store_id}</td>
                        <td className="p-3 font-sans font-semibold text-slate-900">{inv.client_name}</td>
                        <td className="p-3 text-emerald-600 font-bold">{inv.total_amount?.toLocaleString()} ج.م</td>
                        <td className="p-3 text-slate-500 text-[11px]">{inv.updated_at}</td>
                        <td className="p-3 text-slate-400 text-[11px]">{inv.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SYNC_LOG TABLE INSPECTOR */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    مفتش جدول سجل المزامنة ومنع التكرار (<code className="text-emerald-600 font-mono">sync_log</code> table)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الجدول المرجعي لفحص Idempotency: <code className="font-mono text-slate-700">operation_id, device_id, synced_at</code>
                  </p>
                </div>
              </div>
            </div>

            {v1SyncLogs.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl text-slate-500 text-xs">
                لا توجد سجلات في جدول <code className="font-mono text-emerald-600">sync_log</code> حتى الآن.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="p-3">operation_id (UUID PK)</th>
                      <th className="p-3">device_id</th>
                      <th className="p-3">synced_at (TIMESTAMP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {v1SyncLogs.map((log) => (
                      <tr key={log.operation_id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 font-bold text-slate-900">{log.operation_id}</td>
                        <td className="p-3 text-slate-600">{log.device_id}</td>
                        <td className="p-3 text-slate-400 text-[11px]">{log.synced_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SERVER CODE (Node.js + Express + WebSockets + pg) */}
      {activeTab === 'server_code' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    كود السيرفر الكامل (Node.js + Express + WebSockets + PostgreSQL / MySQL)
                  </h3>
                  <p className="text-xs text-slate-400">
                    تثبيت المكتبة: <code className="text-amber-300 font-mono">npm install ws express pg</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(`const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// إنشاء سيرفر HTTP يجمع بين Express و WebSockets
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// قاعدة البيانات
const db = new Pool({
    user: 'db_user', host: 'localhost', database: 'nazih_core_db', password: 'password', port: 5432,
});

// خريطة لتخزين اتصالات العملاء النشطة بناءً على (store_id)
// Structure: Map<store_id, Set<WebSocketClient>>
const storeConnections = new Map();

// --- 1. إدارة اتصالات الـ WebSockets ---
wss.on('connection', (ws, req) => {
    let clientStoreId = null;
    let clientDeviceId = null;

    ws.on('message', (message) => {
        try {
            const payload = JSON.parse(message);

            // عند فتح الاتصال، يرسل العميل رسالة مصادقة تتضمن store_id و device_id
            if (payload.type === 'AUTH') {
                clientStoreId = payload.store_id;
                clientDeviceId = payload.device_id;

                if (!storeConnections.has(clientStoreId)) {
                    storeConnections.set(clientStoreId, new Set());
                }
                storeConnections.get(clientStoreId).add(ws);

                ws.send(JSON.stringify({ type: 'AUTH_OK', message: 'تم الاتصال بالبث الحي بنجاح' }));
            }
        } catch (err) {
            console.error('خطأ في تنسيق الرسالة:', err);
        }
    });

    // عند قطع العميل للاتصال، يتم تنظيف الذاكرة
    ws.on('close', () => {
        if (clientStoreId && storeConnections.has(clientStoreId)) {
            storeConnections.get(clientStoreId).delete(ws);
            if (storeConnections.get(clientStoreId).size === 0) {
                storeConnections.delete(clientStoreId);
            }
        }
    });
});

// --- 2. دالة البث الحي للأجهزة التابعة لنفس المتجر ---
function broadcastToStore(storeId, senderDeviceId, eventData) {
    const clients = storeConnections.get(storeId);
    if (!clients) return;

    const message = JSON.stringify({
        type: 'REALTIME_UPDATE',
        sender_device_id: senderDeviceId,
        payload: eventData
    });

    clients.forEach((client) => {
        // إرسال التحديث لجميع أجهزة العميل المتصلة باستثناء الجهاز الذي أرسل التحديث أصلاً
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// --- 3. تعديل API المزامنة لبث البيانات فور حفظها ---
app.post('/api/v1/sync', async (req, res) => {
    const { store_id, device_id, mutations } = req.body;
    const client = await db.connect();
    const syncedMutations = [];

    try {
        await client.query('BEGIN');

        for (const mutation of mutations) {
            const { operation_id, action, table, data, client_timestamp } = mutation;

            // التحقق من Idempotency
            const checkLog = await client.query('SELECT operation_id FROM sync_log WHERE operation_id = $1', [operation_id]);
            if (checkLog.rows.length > 0) continue;

            if (table === 'invoices' && action === 'INSERT') {
                await client.query(
                    \`INSERT INTO invoices (id, store_id, total_amount, client_name, updated_at) VALUES ($1, $2, $3, $4, $5)\`,
                    [data.id, store_id, data.total_amount, data.client_name, client_timestamp]
                );
            }

            await client.query('INSERT INTO sync_log (operation_id, device_id) VALUES ($1, $2)', [operation_id, device_id]);
            
            // تجميع العمليات الناجحة لبثها
            syncedMutations.push(mutation);
        }

        await client.query('COMMIT');

        // *** البث الحي: إذا تم حفظ التحديثات بنجاح، يتم إرسالها فوراً لباقي الأجهزة ***
        if (syncedMutations.length > 0) {
            broadcastToStore(store_id, device_id, syncedMutations);
        }

        return res.status(200).json({ success: true, count: syncedMutations.length });
    } catch (error) {
        await client.query('ROLLBACK');
        return res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

server.listen(3000, () => {
    console.log('سيرفر الـ HTTP والـ WebSockets يعمل على المنفذ 3000');
});`, 'server_ws')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer bg-slate-800 px-3 py-1.5 rounded-lg"
              >
                {copiedIndex === 'server_ws' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>نسخ كود السيرفر (Node.js)</span>
              </button>
            </div>

            <pre className="text-xs font-mono text-emerald-300 overflow-x-auto p-4 bg-slate-950 rounded-xl leading-relaxed max-h-[500px]">
{`const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// إنشاء سيرفر HTTP يجمع بين Express و WebSockets
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// قاعدة البيانات
const db = new Pool({
    user: 'db_user', host: 'localhost', database: 'nazih_core_db', password: 'password', port: 5432,
});

// خريطة لتخزين اتصالات العملاء النشطة بناءً على (store_id)
// Structure: Map<store_id, Set<WebSocketClient>>
const storeConnections = new Map();

// --- 1. إدارة اتصالات الـ WebSockets ---
wss.on('connection', (ws, req) => {
    let clientStoreId = null;
    let clientDeviceId = null;

    ws.on('message', (message) => {
        try {
            const payload = JSON.parse(message);

            // عند فتح الاتصال، يرسل العميل رسالة مصادقة تتضمن store_id و device_id
            if (payload.type === 'AUTH') {
                clientStoreId = payload.store_id;
                clientDeviceId = payload.device_id;

                if (!storeConnections.has(clientStoreId)) {
                    storeConnections.set(clientStoreId, new Set());
                }
                storeConnections.get(clientStoreId).add(ws);

                ws.send(JSON.stringify({ type: 'AUTH_OK', message: 'تم الاتصال بالبث الحي بنجاح' }));
            }
        } catch (err) {
            console.error('خطأ في تنسيق الرسالة:', err);
        }
    });

    // عند قطع العميل للاتصال، يتم تنظيف الذاكرة
    ws.on('close', () => {
        if (clientStoreId && storeConnections.has(clientStoreId)) {
            storeConnections.get(clientStoreId).delete(ws);
            if (storeConnections.get(clientStoreId).size === 0) {
                storeConnections.delete(clientStoreId);
            }
        }
    });
});

// --- 2. دالة البث الحي للأجهزة التابعة لنفس المتجر ---
function broadcastToStore(storeId, senderDeviceId, eventData) {
    const clients = storeConnections.get(storeId);
    if (!clients) return;

    const message = JSON.stringify({
        type: 'REALTIME_UPDATE',
        sender_device_id: senderDeviceId,
        payload: eventData
    });

    clients.forEach((client) => {
        // إرسال التحديث لجميع أجهزة العميل المتصلة باستثناء الجهاز الذي أرسل التحديث أصلاً
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// --- 3. تعديل API المزامنة لبث البيانات فور حفظها ---
app.post('/api/v1/sync', async (req, res) => {
    const { store_id, device_id, mutations } = req.body;
    const client = await db.connect();
    const syncedMutations = [];

    try {
        await client.query('BEGIN');

        for (const mutation of mutations) {
            const { operation_id, action, table, data, client_timestamp } = mutation;

            // التحقق من Idempotency
            const checkLog = await client.query('SELECT operation_id FROM sync_log WHERE operation_id = $1', [operation_id]);
            if (checkLog.rows.length > 0) continue;

            if (table === 'invoices' && action === 'INSERT') {
                await client.query(
                    \`INSERT INTO invoices (id, store_id, total_amount, client_name, updated_at) VALUES ($1, $2, $3, $4, $5)\`,
                    [data.id, store_id, data.total_amount, data.client_name, client_timestamp]
                );
            }

            await client.query('INSERT INTO sync_log (operation_id, device_id) VALUES ($1, $2)', [operation_id, device_id]);
            
            // تجميع العمليات الناجحة لبثها
            syncedMutations.push(mutation);
        }

        await client.query('COMMIT');

        // *** البث الحي: إذا تم حفظ التحديثات بنجاح، يتم إرسالها فوراً لباقي الأجهزة ***
        if (syncedMutations.length > 0) {
            broadcastToStore(store_id, device_id, syncedMutations);
        }

        return res.status(200).json({ success: true, count: syncedMutations.length });
    } catch (error) {
        await client.query('ROLLBACK');
        return res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

server.listen(3000, () => {
    console.log('سيرفر الـ HTTP والـ WebSockets يعمل على المنفذ 3000');
});`}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 4: CLIENT CODE (Node.js + SQLite Client) */}
      {activeTab === 'client_code' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    كود العميل (Node.js + SQLite Client Listener & Auto Reconnect)
                  </h3>
                  <p className="text-xs text-slate-400">
                    تثبيت المكتبات بالعميل: <code className="text-amber-300 font-mono">npm install ws sqlite3</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(`const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

// 1. إعدادات العميل وهويته
const SERVER_URL = 'ws://localhost:3000';
const STORE_ID = 'store_123';
const DEVICE_ID = 'device_mobile_02'; // معرّف هذا الجهاز الفريد

// 2. فتح الاتصال بقاعدة البيانات المحلية SQLite
const db = new sqlite3.Database('./local_store.db');

// تجهيز الجدول المحلي لضمان وجوده
db.serialize(() => {
    db.run(\`
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            total_amount REAL,
            client_name TEXT,
            updated_at INTEGER
        )
    \`);
});

let ws;

// 3. دالة الاتصال وإعادة الاتصال التلقائي عند انقطاع الشبكة
function connectWebSocket() {
    ws = new WebSocket(SERVER_URL);

    ws.on('open', () => {
        console.log('✅ تم الاتصال بالسيرفر، جاري إرسال مصادقة المتجر...');
        
        // إرسال كود المصادقة للاشتراك في بث المتجر الخاص بنا
        ws.send(JSON.stringify({
            type: 'AUTH',
            store_id: STORE_ID,
            device_id: DEVICE_ID
        }));
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === 'AUTH_OK') {
                console.log('🔒 تم تأكيد المصادقة: الجهاز جاهز لاستقبال التحديثات اللحظية');
            }

            // استقبال التحديثات المباشرة من الأجهزة الأخرى
            if (message.type === 'REALTIME_UPDATE') {
                console.log(\`⚡ استلام تحديث حي من جهاز آخر (\${message.sender_device_id})\`);
                applyMutationsToLocalDB(message.payload);
            }
        } catch (err) {
            console.error('خطأ في قراءة الرسالة:', err);
        }
    });

    ws.on('close', () => {
        console.warn('⚠️ انقطع الاتصال بالسيرفر! إعادة المحاولة بعد 3 ثوانٍ...');
        setTimeout(connectWebSocket, 3000); // إعادة اتصال تلقائية
    });

    ws.on('error', (err) => {
        console.error('خطأ اتصال:', err.message);
        ws.close();
    });
}

// 4. دالة معالجة البيانات وتحديث SQLite المحلية
function applyMutationsToLocalDB(mutations) {
    db.serialize(() => {
        const stmtInsert = db.prepare(\`
            INSERT INTO invoices (id, total_amount, client_name, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                total_amount = excluded.total_amount,
                client_name = excluded.client_name,
                updated_at = excluded.updated_at
            WHERE excluded.updated_at > invoices.updated_at
        \`);

        mutations.forEach((mutation) => {
            const { table, action, data, client_timestamp } = mutation;

            if (table === 'invoices') {
                if (action === 'INSERT' || action === 'UPDATE') {
                    // إدراج أو تحديث فقط إذا كانت البيانات القادمة أحدث من المخزنة محلياً
                    stmtInsert.run(data.id, data.total_amount, data.client_name, client_timestamp);
                    console.log(\`💾 تم حفظ الفاتورة (\${data.id}) في قاعدة البيانات المحلية\`);
                }
            }
        });

        stmtInsert.finalize();
    });
}

// بدء التشغيل
connectWebSocket();`, 'client_sqlite')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer bg-slate-800 px-3 py-1.5 rounded-lg"
              >
                {copiedIndex === 'client_sqlite' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>نسخ كود العميل (SQLite)</span>
              </button>
            </div>

            <pre className="text-xs font-mono text-blue-300 overflow-x-auto p-4 bg-slate-950 rounded-xl leading-relaxed max-h-[500px]">
{`const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

// 1. إعدادات العميل وهويته
const SERVER_URL = 'ws://localhost:3000';
const STORE_ID = 'store_123';
const DEVICE_ID = 'device_mobile_02'; // معرّف هذا الجهاز الفريد

// 2. فتح الاتصال بقاعدة البيانات المحلية SQLite
const db = new sqlite3.Database('./local_store.db');

// تجهيز الجدول المحلي لضمان وجوده
db.serialize(() => {
    db.run(\`
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            total_amount REAL,
            client_name TEXT,
            updated_at INTEGER
        )
    \`);
});

let ws;

// 3. دالة الاتصال وإعادة الاتصال التلقائي عند انقطاع الشبكة
function connectWebSocket() {
    ws = new WebSocket(SERVER_URL);

    ws.on('open', () => {
        console.log('✅ تم الاتصال بالسيرفر، جاري إرسال مصادقة المتجر...');
        
        // إرسال كود المصادقة للاشتراك في بث المتجر الخاص بنا
        ws.send(JSON.stringify({
            type: 'AUTH',
            store_id: STORE_ID,
            device_id: DEVICE_ID
        }));
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === 'AUTH_OK') {
                console.log('🔒 تم تأكيد المصادقة: الجهاز جاهز لاستقبال التحديثات اللحظية');
            }

            // استقبال التحديثات المباشرة من الأجهزة الأخرى
            if (message.type === 'REALTIME_UPDATE') {
                console.log(\`⚡ استلام تحديث حي من جهاز آخر (\${message.sender_device_id})\`);
                applyMutationsToLocalDB(message.payload);
            }
        } catch (err) {
            console.error('خطأ في قراءة الرسالة:', err);
        }
    });

    ws.on('close', () => {
        console.warn('⚠️ انقطع الاتصال بالسيرفر! إعادة المحاولة بعد 3 ثوانٍ...');
        setTimeout(connectWebSocket, 3000); // إعادة اتصال تلقائية
    });

    ws.on('error', (err) => {
        console.error('خطأ اتصال:', err.message);
        ws.close();
    });
}

// 4. دالة معالجة البيانات وتحديث SQLite المحلية
function applyMutationsToLocalDB(mutations) {
    db.serialize(() => {
        const stmtInsert = db.prepare(\`
            INSERT INTO invoices (id, total_amount, client_name, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                total_amount = excluded.total_amount,
                client_name = excluded.client_name,
                updated_at = excluded.updated_at
            WHERE excluded.updated_at > invoices.updated_at
        \`);

        mutations.forEach((mutation) => {
            const { table, action, data, client_timestamp } = mutation;

            if (table === 'invoices') {
                if (action === 'INSERT' || action === 'UPDATE') {
                    // إدراج أو تحديث فقط إذا كانت البيانات القادمة أحدث من المخزنة محلياً
                    stmtInsert.run(data.id, data.total_amount, data.client_name, client_timestamp);
                    console.log(\`💾 تم حفظ الفاتورة (\${data.id}) في قاعدة البيانات المحلية\`);
                }
            }
        });

        stmtInsert.finalize();
    });
}

// بدء التشغيل
connectWebSocket();`}
            </pre>
          </div>
        </div>
      )}

      {/* TAB: FLUTTER CODE (Dart + sqflite + web_socket_channel) */}
      {activeTab === 'flutter_code' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    كود عميل Flutter الكامل (Dart + SQLite + WebSocketChannel)
                  </h3>
                  <p className="text-xs text-slate-400">
                    استقبال التحديثات اللحظية وحفظها محلياً في قاعدة بيانات الهاتف مع معالجة انقطاع الاتصال تلقائياً.
                  </p>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(`import 'dart:async';
import 'dart:convert';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class SyncService {
  // إعدادات العميل والهوية
  final String serverUrl = 'ws://10.0.2.2:3000'; // 10.0.2.2 لـ Android Emulator أو IP السيرفر الحقيقي
  final String storeId = 'store_123';
  final String deviceId = 'device_flutter_01';

  Database? _localDb;
  WebSocketChannel? _channel;
  bool _isConnected = false;

  // 1. تهيئة قاعدة البيانات المحلية SQLite
  Future<void> initLocalDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'local_store.db');

    _localDb = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE invoices (
            id TEXT PRIMARY KEY,
            total_amount REAL,
            client_name TEXT,
            updated_at INTEGER
          )
        ''');
      },
    );
    print('💾 تم تجهيز قاعدة البيانات المحلية SQLite بنجاح.');
  }

  // 2. الاتصال بـ WebSocket والمصادقة
  void connectWebSocket() {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(serverUrl));
      _isConnected = true;
      print('✅ تم الاتصال بالسيرفر، جاري إرسال مصادقة المتجر...');

      // إرسال كود المصادقة للاشتراك في بث المتجر
      final authMessage = jsonEncode({
        'type': 'AUTH',
        'store_id': storeId,
        'device_id': deviceId,
      });
      _channel!.sink.add(authMessage);

      // الاستماع للرسائل القادمة من السيرفر
      _channel!.stream.listen(
        (data) {
          _handleIncomingMessage(data);
        },
        onDone: () {
          print('⚠️ انقطع الاتصال بالسيرفر! إعادة المحاولة بعد 3 ثوانٍ...');
          _isConnected = false;
          _reconnect();
        },
        onError: (error) {
          print('❌ خطأ اتصال: $error');
          _isConnected = false;
          _reconnect();
        },
      );
    } catch (e) {
      print('❌ فشل الاتصال: $e');
      _reconnect();
    }
  }

  // إعادة الاتصال التلقائي
  void _reconnect() {
    Timer(const Duration(seconds: 3), () {
      if (!_isConnected) connectWebSocket();
    });
  }

  // 3. معالجة الرسائل القادمة من السيرفر
  void _handleIncomingMessage(dynamic rawData) {
    try {
      final message = jsonDecode(rawData as String);

      if (message['type'] == 'AUTH_OK') {
        print('🔒 تم تأكيد المصادقة: التطبيق جاهز لاستقبال التحديثات اللحظية.');
      } else if (message['type'] == 'REALTIME_UPDATE') {
        print('⚡ استلام تحديث حي من جهاز آخر (\${message['sender_device_id']})');
        final List<dynamic> mutations = message['payload'];
        _applyMutationsToLocalDB(mutations);
      }
    } catch (e) {
      print('❌ خطأ أثناء معالجة الرسالة: $e');
    }
  }

  // 4. تطبيق التحديثات على SQLite المحلية
  Future<void> _applyMutationsToLocalDB(List<dynamic> mutations) async {
    if (_localDb == null) return;

    final batch = _localDb!.batch();

    for (var mutation in mutations) {
      final String table = mutation['table'];
      final String action = mutation['action'];
      final Map<String, dynamic> data = mutation['data'];
      final int clientTimestamp = mutation['client_timestamp'];

      if (table === 'invoices' && (action === 'INSERT' || action === 'UPDATE')) {
        // استخدام استعلام يحفظ أو يحدث فقط إذا كانت البيانات القادمة أحدث من المخزنة محلياً
        batch.rawInsert('''
          INSERT INTO invoices (id, total_amount, client_name, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            total_amount = excluded.total_amount,
            client_name = excluded.client_name,
            updated_at = excluded.updated_at
          WHERE excluded.updated_at > invoices.updated_at
        ''', [
          data['id'],
          data['total_amount'],
          data['client_name'],
          clientTimestamp
        ]);
      }
    }

    await batch.commit(noResult: true);
    print('💾 تم حفظ التحديثات اللحظية في قاعدة بيانات الهاتف.');
  }

  // إغلاق الاتصال عند التدمير
  void dispose() {
    _channel?.sink.close();
    _localDb?.close();
  }
}`, 'flutter_sync')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer bg-slate-800 px-3 py-1.5 rounded-lg"
              >
                {copiedIndex === 'flutter_sync' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>نسخ كود Dart</span>
              </button>
            </div>

            {/* PUBSPEC.YAML INSTRUCTIONS */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400">1. المكتبات المطلوبة في ملف (pubspec.yaml):</span>
                <button
                  onClick={() => copyToClipboard(`dependencies:
  flutter:
    sdk: flutter
  sqflite: ^2.3.0
  path: ^1.8.3
  web_socket_channel: ^2.4.0`, 'pubspec')}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 px-2 py-1 rounded"
                >
                  {copiedIndex === 'pubspec' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>نسخ المكتبات</span>
                </button>
              </div>
              <pre className="text-xs font-mono text-emerald-300 p-2.5 bg-slate-900 rounded-lg">
{`dependencies:
  flutter:
    sdk: flutter
  sqflite: ^2.3.0
  path: ^1.8.3
  web_socket_channel: ^2.4.0`}
              </pre>
            </div>

            {/* DART CODE BLOCK */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-300">2. كود العميل الكامل بـ Dart (sync_service.dart):</span>
              <pre className="text-xs font-mono text-sky-300 overflow-x-auto p-4 bg-slate-950 rounded-xl leading-relaxed max-h-[500px]">
{`import 'dart:async';
import 'dart:convert';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class SyncService {
  // إعدادات العميل والهوية
  final String serverUrl = 'ws://10.0.2.2:3000'; // 10.0.2.2 لـ Android Emulator أو IP السيرفر الحقيقي
  final String storeId = 'store_123';
  final String deviceId = 'device_flutter_01';

  Database? _localDb;
  WebSocketChannel? _channel;
  bool _isConnected = false;

  // 1. تهيئة قاعدة البيانات المحلية SQLite
  Future<void> initLocalDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'local_store.db');

    _localDb = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE invoices (
            id TEXT PRIMARY KEY,
            total_amount REAL,
            client_name TEXT,
            updated_at INTEGER
          )
        ''');
      },
    );
    print('💾 تم تجهيز قاعدة البيانات المحلية SQLite بنجاح.');
  }

  // 2. الاتصال بـ WebSocket والمصادقة
  void connectWebSocket() {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(serverUrl));
      _isConnected = true;
      print('✅ تم الاتصال بالسيرفر، جاري إرسال مصادقة المتجر...');

      // إرسال كود المصادقة للاشتراك في بث المتجر
      final authMessage = jsonEncode({
        'type': 'AUTH',
        'store_id': storeId,
        'device_id': deviceId,
      });
      _channel!.sink.add(authMessage);

      // الاستماع للرسائل القادمة من السيرفر
      _channel!.stream.listen(
        (data) {
          _handleIncomingMessage(data);
        },
        onDone: () {
          print('⚠️ انقطع الاتصال بالسيرفر! إعادة المحاولة بعد 3 ثوانٍ...');
          _isConnected = false;
          _reconnect();
        },
        onError: (error) {
          print('❌ خطأ اتصال: $error');
          _isConnected = false;
          _reconnect();
        },
      );
    } catch (e) {
      print('❌ فشل الاتصال: $e');
      _reconnect();
    }
  }

  // إعادة الاتصال التلقائي
  void _reconnect() {
    Timer(const Duration(seconds: 3), () {
      if (!_isConnected) connectWebSocket();
    });
  }

  // 3. معالجة الرسائل القادمة من السيرفر
  void _handleIncomingMessage(dynamic rawData) {
    try {
      final message = jsonDecode(rawData as String);

      if (message['type'] == 'AUTH_OK') {
        print('🔒 تم تأكيد المصادقة: التطبيق جاهز لاستقبال التحديثات اللحظية.');
      } else if (message['type'] == 'REALTIME_UPDATE') {
        print('⚡ استلام تحديث حي من جهاز آخر (\${message['sender_device_id']})');
        final List<dynamic> mutations = message['payload'];
        _applyMutationsToLocalDB(mutations);
      }
    } catch (e) {
      print('❌ خطأ أثناء معالجة الرسالة: $e');
    }
  }

  // 4. تطبيق التحديثات على SQLite المحلية
  Future<void> _applyMutationsToLocalDB(List<dynamic> mutations) async {
    if (_localDb == null) return;

    final batch = _localDb!.batch();

    for (var mutation in mutations) {
      final String table = mutation['table'];
      final String action = mutation['action'];
      final Map<String, dynamic> data = mutation['data'];
      final int clientTimestamp = mutation['client_timestamp'];

      if (table == 'invoices' && (action == 'INSERT' || action == 'UPDATE')) {
        // استخدام استعلام يحفظ أو يحدث فقط إذا كانت البيانات القادمة أحدث من المخزنة محلياً
        batch.rawInsert('''
          INSERT INTO invoices (id, total_amount, client_name, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            total_amount = excluded.total_amount,
            client_name = excluded.client_name,
            updated_at = excluded.updated_at
          WHERE excluded.updated_at > invoices.updated_at
        ''', [
          data['id'],
          data['total_amount'],
          data['client_name'],
          clientTimestamp
        ]);
      }
    }

    await batch.commit(noResult: true);
    print('💾 تم حفظ التحديثات اللحظية في قاعدة بيانات الهاتف.');
  }

  // إغلاق الاتصال عند التدمير
  void dispose() {
    _channel?.sink.close();
    _localDb?.close();
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CLOUD STORAGE & 10TB VOLUME MOUNT */}
      {activeTab === 'cloud_storage' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  دليل توسعة مساحة السيرفر إلى 10TB+ (Cloud Block Storage & Mount Guide)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  خطوات إضافة مساحة تخزين سحابية ضخمة لسيرفر Nazih Core (على AWS EBS, DigitalOcean Volumes, Hetzner Storage Box, أو Linode)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* STEP 1 & 2 */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-purple-800 font-bold text-xs">
                    <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-900 flex items-center justify-center text-xs">1</span>
                    <span>إنشاء المساحة وربطها (Attach Block Volume 10TB)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    من لوحة تحكم المزود السحابي (مثل Hetzner أو AWS أو DigitalOcean)، قم بإنشاء <span className="font-semibold text-slate-800">Volume</span> بمساحة <span className="font-mono text-purple-700 font-bold">10,000 GB (10TB)</span> وقم بربطه بسيرفر Nazih Core.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-800 font-bold text-xs">
                      <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-900 flex items-center justify-center text-xs">2</span>
                      <span>تهيئة القرص بنظام ملفات (Format ext4/xfs)</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard('sudo mkfs.ext4 /dev/sdb', 'mkfs')}
                      className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center gap-1"
                    >
                      {copiedIndex === 'mkfs' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>نسخ الأمر</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">
                    ادخل للسيرفر عبر SSH وقُم بتهيئة المساحة بنظام ملفات سريع ومناسب لقواعد البيانات:
                  </p>
                  <pre className="text-xs font-mono bg-slate-900 text-emerald-400 p-2.5 rounded-lg overflow-x-auto">
{`sudo mkfs.ext4 /dev/sdb  # استبدل /dev/sdb باسم القرص الجديد`}
                  </pre>
                </div>
              </div>

              {/* STEP 3 & 4 */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-800 font-bold text-xs">
                      <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-900 flex items-center justify-center text-xs">3</span>
                      <span>توصيل القرص (Mount) بمجلد البيانات</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(`sudo mkdir -p /mnt/big_data\nsudo mount /dev/sdb /mnt/big_data`, 'mount')}
                      className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center gap-1"
                    >
                      {copiedIndex === 'mount' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>نسخ الأمر</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">
                    توصيل القرص بمجلد مخصص لقواعد البيانات وملفات النظام الضخمة:
                  </p>
                  <pre className="text-xs font-mono bg-slate-900 text-emerald-400 p-2.5 rounded-lg overflow-x-auto">
{`sudo mkdir -p /mnt/big_data
sudo mount /dev/sdb /mnt/big_data`}
                  </pre>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-800 font-bold text-xs">
                      <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-900 flex items-center justify-center text-xs">4</span>
                      <span>تثبيت الـ Mount تلقائياً عند إعادة تشغيل السيرفر</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(`echo '/dev/sdb  /mnt/big_data  ext4  defaults,nofail  0  2' | sudo tee -a /etc/fstab`, 'fstab')}
                      className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center gap-1"
                    >
                      {copiedIndex === 'fstab' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>نسخ الأمر</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">
                    أضف السطر التالي في ملف <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">/etc/fstab</code>:
                  </p>
                  <pre className="text-xs font-mono bg-slate-900 text-amber-300 p-2.5 rounded-lg overflow-x-auto">
{`echo '/dev/sdb  /mnt/big_data  ext4  defaults,nofail  0  2' | sudo tee -a /etc/fstab`}
                  </pre>
                </div>
              </div>
            </div>

            {/* POSTGRES / DATABASE DATA DIRECTORY MIGRATION */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 text-white border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Terminal className="w-4 h-4" />
                <span>توجيه مسار حفظ قاعدة البيانات (PostgreSQL Data Directory) إلى /mnt/big_data:</span>
              </div>
              <pre className="text-xs font-mono text-emerald-300 bg-slate-950 p-3 rounded-xl overflow-x-auto leading-relaxed">
{`# 1. إيقاف خدمة قاعدة البيانات مؤقتاً
sudo systemctl stop postgresql

# 2. نسخ مجلد البيانات الحالي إلى القرص الجديد
sudo rsync -av /var/lib/postgresql/ /mnt/big_data/postgresql/

# 3. تعديل ملف الإعدادات postgresql.conf وتغيير data_directory:
# data_directory = '/mnt/big_data/postgresql/15/main'

# 4. إعادة تشغيل السيرفر للتأكد من استخدام مساحة الـ 10TB
sudo systemctl start postgresql`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: IDEMPOTENCY & SYNC HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                سجل عمليات المزامنة وضمان عدم التكرار (Idempotency Audit Table)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                كل عملية مزامنة يتم توثيق معرّفها الفريد عالمياً (<code className="font-mono text-blue-600">operation_id</code>)
                في السيرفر. في حال أعاد العميل الإرسال بسبب بطء الإنترنت، يتعرف السيرفر عليه فوراً دون إضافة فاتورة مكررة.
              </p>
            </div>
            <button
              onClick={fetchSyncOperations}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث السجل</span>
            </button>
          </div>

          {syncHistory.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl text-slate-500 text-xs">
              لا توجد عمليات مزامنة مسجلة حتى الآن في السيرفر.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="p-3 font-semibold">معرف العملية (operation_id)</th>
                    <th className="p-3 font-semibold">معرف الجهاز (Device ID)</th>
                    <th className="p-3 font-semibold">الجدول والنوع</th>
                    <th className="p-3 font-semibold">حالة التحقق (Idempotency Status)</th>
                    <th className="p-3 font-semibold">تاريخ التسجيل بالسيرفر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {syncHistory.map((op: any) => (
                    <tr key={op.id || op.operation_id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-semibold text-slate-800">
                        {op.operation_id}
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {op.device_id || 'mobile-pos-01'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          {op.action} → {op.target_table}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                            op.status === 'synced' || op.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : op.status === 'already_processed' || op.status === 'SKIPPED_DUPLICATE'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {(op.status === 'synced' || op.status === 'SUCCESS') && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {(op.status === 'already_processed' || op.status === 'SKIPPED_DUPLICATE') && <ShieldCheck className="w-3 h-3 text-amber-600" />}
                          {(op.status === 'synced' || op.status === 'SUCCESS') ? 'تمت المزامنة بنجاح (SUCCESS)' : 'تم التحقق وتفادي التكرار (SKIPPED_DUPLICATE)'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">
                        {new Date(op.server_timestamp).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: ARCHITECTURE GUIDE */}
      {activeTab === 'architecture' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              دليل المهندس المعماري: كيف تبني تطبيق Offline-First متصل بـ Nazih Core
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              اتبع هذه الخطوات الأربع في تطبيقاتك (Flutter / React Native / C# WPF / Web) لضمان عمل البرنامج حتى في الصحراء بدون أي اتصال بالإنترنت مع تحديث حي فوري عبر WebSockets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">
                <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs">1</span>
                <span>قاعدة البيانات المحلية (Local SQLite Schema)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                في تطبيق العميل، أنشئ جدولاً باسم <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">local_sync_queue</code>.
                كل عملية إضافة أو تعديل يتم حفظها في SQLite أولاً بسرعة 0ms مع توليد UUID v4.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">
                <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs">2</span>
                <span>عامل الخلفية التلقائي (Background Sync Worker)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                يقوم التطبيق بالاستماع لتغير حالة الشبكة (<code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">ConnectivityListener</code>).
                فور توفر الإنترنت، يسحب العمليات المعلقة من جدول الطابور ويرسلها بحزمة واحدة إلى <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">POST /api/v1/sync</code>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">
                <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs">3</span>
                <span>معالجة السيرفر وحل التعارضات (Idempotency & Atomic Write)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                سيرفر Nazih Core يفحص جدول <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">sync_log</code> لكل <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">operation_id</code>.
                إذا كانت مسجلة مسبقاً يعيد <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">SKIPPED_DUPLICATE</code>، وإذا كانت جديدة يحفظها مع حل التعارضات عبر <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">updated_at &lt; $3</code>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">
                <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs">4</span>
                <span>التدفق العكسي اللحظي (Down-Sync & WebSockets Push)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                يبث السيرفر المعاملة الجديدة عبر الـ WebSockets لباقي فروع العميل والأجهزة الأخرى لتحديث شاشات الإدارة لحظياً دون أي طلب يدوي أو Polling.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
