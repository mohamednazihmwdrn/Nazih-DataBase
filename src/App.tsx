import React, { useState, useEffect, useRef } from 'react';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { ManagerDashboard } from './components/ManagerDashboard';
import { ClientPortals } from './components/ClientPortals';
import { KeyGenerator } from './components/KeyGenerator';
import { IntegrationHub } from './components/IntegrationHub';
import { DatabaseStudio } from './components/DatabaseStudio';
import { PosTester } from './components/PosTester';
import { DeploymentCenter } from './components/DeploymentCenter';
import { InvoiceRecord, ClientRecord, SystemStats } from './types';
import {
  Zap,
  Volume2,
  VolumeX,
  Menu,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('manager');
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [liveInvoices, setLiveInvoices] = useState<{ invoice: InvoiceRecord; items: any[]; store: any }[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Pleasant notification chime using Web Audio API
  const playChime = () => {
    if (!isSoundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch (e) {
      console.warn('Audio chime unavailable', e);
    }
  };

  // Fetch Clients
  const fetchClients = async () => {
    try {
      const res = await fetch('/api/admin/clients');
      if (!res.ok) {
        console.warn(`[Clients] API status ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data && data.success) {
        setClients(data.clients || []);
      }
    } catch (e) {
      console.error('Failed to load clients', e);
    }
  };

  // Fetch System Stats
  const fetchSystemStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) {
        console.warn(`[Stats] API status ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data && data.success) {
        setSystemStats(data);
      }
    } catch (e) {
      console.error('Failed to load stats', e);
    }
  };

  // Initialize WebSocket Connection
  useEffect(() => {
    fetchClients();
    fetchSystemStats();

    let reconnectTimer: any = null;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'NEW_INVOICE') {
            playChime();
            setLiveInvoices((prev) => [msg.payload, ...prev.slice(0, 49)]);
            fetchSystemStats();
          }
        } catch (err) {
          console.error('WS parse error', err);
        }
      };

      ws.onclose = () => {
        setIsWsConnected(false);
        reconnectTimer = setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        setIsWsConnected(false);
      };
    };

    connectWebSocket();

    const statsInterval = setInterval(fetchSystemStats, 15000);

    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(statsInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [isSoundEnabled]);

  // Fast Ingestion Simulation Trigger
  const simulatePOSIngest = async () => {
    const activeClient = clients.find((c) => c.status === 'active') || clients[0];
    if (!activeClient) {
      alert('يرجى إنشاء متجر / عميل حقيقي أولاً من قسم "مولد المفاتيح والتراخيص" أو "بوابات العملاء".');
      setActiveTab('keys');
      return;
    }

    const itemsCatalog = [
      { name: 'قهوة كولد برو كولومبي', cat: 'مشروبات', price: 4.75 },
      { name: 'كرواسون زبدة فرنسي', cat: 'مخبوزات', price: 3.95 },
      { name: 'ماتشا لاتيه مثلج بحليب الشوفان', cat: 'مشروبات', price: 5.5 },
      { name: 'ساندويتش سلمون مدخن', cat: 'مأكولات', price: 11.5 },
      { name: 'سلطة كينوا بالبروتين', cat: 'مأكولات', price: 9.75 },
      { name: 'كابل شحن سريع USB-C بطول 2 متر', cat: 'إلكترونيات', price: 14.99 },
    ];

    const count = Math.floor(Math.random() * 3) + 1;
    const selectedItems = [];
    let subtotal = 0;

    for (let i = 0; i < count; i++) {
      const item = itemsCatalog[Math.floor(Math.random() * itemsCatalog.length)];
      const qty = Math.floor(Math.random() * 2) + 1;
      const total = Number((item.price * qty).toFixed(2));
      subtotal += total;
      selectedItems.push({
        item_name: item.name,
        category: item.cat,
        quantity: qty,
        unit_price: item.price,
        total_price: total,
      });
    }

    const tax = Number((subtotal * 0.08).toFixed(2));
    const randomInvNum = `INV-${activeClient.store_id.substring(0, 4)}-${Math.floor(
      Math.random() * 90000 + 10000
    )}`;

    const payload = {
      store_id: activeClient.store_id,
      invoice_number: randomInvNum,
      customer_name: ['أحمد منصور', 'سارة العتيبي', 'محمود الشريف', 'نور الهدى', 'كريم عبد الله'][
        Math.floor(Math.random() * 5)
      ],
      payment_method: ['card', 'cash', 'online', 'qr'][Math.floor(Math.random() * 4)],
      tax: tax,
      discount: 0.0,
      items: selectedItems,
      notes: 'معاملة اختبارية في سيرفر Nazih Core',
      timestamp: new Date().toISOString(),
    };

    try {
      await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': activeClient.api_key,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('Simulation request failed', e);
    }
  };

  const getSectionTitle = () => {
    switch (activeTab) {
      case 'manager':
        return { title: 'لوحة العمليات المباشرة', desc: 'مراقبة المبيعات وتدفق فواتير العملاء الحقيقية لحظة بلحظة' };
      case 'clients':
        return { title: 'بوابات المتاجر والعملاء', desc: 'صفحة وملفات البيانات المخصصة لكل تطبيق' };
      case 'keys':
        return { title: 'مولد المفاتيح والتراخيص', desc: 'إصدار وإدارة تراخيص الربط البرمجي المشفرة للعملاء' };
      case 'sdks':
        return { title: 'مركز ربط التطبيقات (SDKs)', desc: 'أكواد جاهزة للنسخ في Flutter وJS وPython وC# وPHP' };
      case 'database':
        return { title: 'محرك البيانات واستعلامات SQL', desc: 'إدارة MNDB ومحرر استعلامات SQL التفاعلي' };
      case 'pos':
        return { title: 'محاكي الكاشير ونقاط البيع', desc: 'اختبار الإرسال والتحقق من الترويسات والصلاحيات' };
      case 'deployment':
        return { title: 'دليل النشر والاستضافة المستقلة', desc: 'تشغيل السيرفر 24/7 على VPS أو Render أو Docker' };
      default:
        return { title: 'Nazih Core • MNDB Engine', desc: 'سيرفر وقواعد بيانات محمد نزيه المستقل' };
    }
  };

  const sectionInfo = getSectionTitle();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex antialiased selection:bg-blue-600 selection:text-white" dir="rtl">
      
      {/* PROFESSIONAL SIDEBAR WITH 3-BARS HAMBURGER */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isWsConnected={isWsConnected}
        isSoundEnabled={isSoundEnabled}
        toggleSound={() => setIsSoundEnabled(!isSoundEnabled)}
        onSimulateClick={simulatePOSIngest}
        clients={clients}
        systemStats={systemStats}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onResetData={() => {
          fetchClients();
          fetchSystemStats();
          setLiveInvoices([]);
        }}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
        
        {/* TOP COMPACT HEADER BAR WITH 3-BARS MENU TOGGLE */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            {/* 3-BARS HAMBURGER BUTTON IN TOP BAR WITH ACTIVE STATE */}
            <button
              id="topbar-hamburger-btn"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`p-2 rounded-xl border transition cursor-pointer flex flex-col items-center justify-center gap-1 group active:scale-90 ${
                !isSidebarCollapsed
                  ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:text-slate-800'
              }`}
              title={!isSidebarCollapsed ? 'إغلاق القائمة الجانبية (مفعلة)' : 'فتح القائمة الجانبية (3 شرط)'}
            >
              <div
                className={`h-0.5 rounded-full transition-all ${
                  !isSidebarCollapsed
                    ? 'w-4 bg-blue-600 group-hover:w-4.5'
                    : 'w-4 bg-slate-600 group-hover:w-4.5 group-hover:bg-slate-800'
                }`}
              />
              <div
                className={`h-0.5 rounded-full transition-all ${
                  !isSidebarCollapsed
                    ? 'w-3.5 bg-blue-600 group-hover:w-4'
                    : 'w-3.5 bg-slate-600 group-hover:w-4 group-hover:bg-slate-800'
                }`}
              />
              <div
                className={`h-0.5 rounded-full transition-all ${
                  !isSidebarCollapsed
                    ? 'w-4 bg-blue-600 group-hover:w-4.5'
                    : 'w-4 bg-slate-600 group-hover:w-4.5 group-hover:bg-slate-800'
                }`}
              />
            </button>

            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{sectionInfo.title}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold hidden sm:inline-block">
                  Nazih Core v2.5
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 font-sans">{sectionInfo.desc}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* WS LIVE PULSE */}
            <div
              className={`flex items-center text-xs px-2.5 py-1 rounded-full font-medium border gap-2 ${
                isWsConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isWsConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
                }`}
              />
              <span className="hidden md:inline">{isWsConnected ? 'سيرفر NazihSync متصل 24/7' : 'جاري الاتصال...'}</span>
            </div>

            {/* FAST SIMULATE BUTTON */}
            {clients.length > 0 && (
              <button
                onClick={simulatePOSIngest}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-600/20 active:scale-95 transition cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">محاكاة فاتورة</span>
              </button>
            )}

            {/* AUDIO TOGGLE */}
            <button
              onClick={() => setIsSoundEnabled(!isSoundEnabled)}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isSoundEnabled
                  ? 'bg-white border-slate-300 text-emerald-600 hover:bg-emerald-50'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
              title={isSoundEnabled ? 'تنبيهات الصوت مفعلة' : 'الصوت صامت'}
            >
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* MAIN VIEWPORT */}
        <main className="p-4 sm:p-6 flex-1 w-full max-w-7xl mx-auto space-y-6">
          {activeTab === 'manager' && (
            <ManagerDashboard
              clients={clients}
              liveInvoices={liveInvoices}
              onInspectInvoice={() => {}}
              onTriggerSimulation={simulatePOSIngest}
            />
          )}

          {activeTab === 'clients' && (
            <ClientPortals
              clients={clients}
              onRefreshClients={fetchClients}
            />
          )}

          {activeTab === 'keys' && (
            <KeyGenerator
              clients={clients}
              onRefreshClients={fetchClients}
              onRefreshStats={fetchSystemStats}
            />
          )}

          {activeTab === 'sdks' && (
            <IntegrationHub clients={clients} />
          )}

          {activeTab === 'database' && (
            <DatabaseStudio
              systemStats={systemStats}
              onRefreshStats={fetchSystemStats}
            />
          )}

          {activeTab === 'pos' && (
            <PosTester clients={clients} onInvoiceSent={fetchSystemStats} />
          )}

          {activeTab === 'deployment' && <DeploymentCenter />}
        </main>

        {/* FOOTER WITH MOHAMED NAZIH SIGNATURE */}
        <footer className="border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">Nazih Core • MNDB Engine</span>
              <span>•</span>
              <span className="text-blue-600 font-semibold">بواسطة Mohamed Nazih</span>
              <span>•</span>
              <span className="text-emerald-700 font-medium font-mono">SQLite WAL Engine 100% Real</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 font-sans">
                حجم قاعدة البيانات: {systemStats?.database?.file_size_formatted || '0.04 MB'}
              </span>
              <span>•</span>
              <a
                href="/deployment.html"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium transition"
              >
                دليل الاستضافة 24/7
              </a>
            </div>
          </div>
        </footer>

      </div>

    </div>
  );
}
