import React, { useState, useEffect, useRef } from 'react';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { ManagerDashboard } from './components/ManagerDashboard';
import { ClientPortals } from './components/ClientPortals';
import { KeyGenerator } from './components/KeyGenerator';
import { IntegrationHub } from './components/IntegrationHub';
import { DatabaseStudio } from './components/DatabaseStudio';
import { PosTester } from './components/PosTester';
import { DeploymentCenter } from './components/DeploymentCenter';
import { OfflineSyncStudio } from './components/OfflineSyncStudio';
import { AccountingCore } from './components/AccountingCore';
import { EnterprisePowerSuite } from './components/EnterprisePowerSuite';
import { ApiDocsPortal } from './components/ApiDocsPortal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { LanguageToggle } from './components/LanguageToggle';
import { useLanguage } from './lib/i18n';
import { InvoiceRecord, ClientRecord, SystemStats } from './types';
import { safeFetchJson } from './lib/api';
import {
  Zap,
  Volume2,
  VolumeX,
  Menu,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export default function App() {
  const { t, direction, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<ActiveTab>('manager');
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [realtimeMode, setRealtimeMode] = useState<'websocket' | 'sse' | 'reconnecting'>('reconnecting');
  const [pingLatency, setPingLatency] = useState<number>(1.2);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const [liveInvoices, setLiveInvoices] = useState<{ invoice: InvoiceRecord; items: any[]; store: any }[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pingStartRef = useRef<number>(0);

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
      const res = await safeFetchJson<{ success: boolean; clients: ClientRecord[] }>('/api/admin/clients');
      if (res.success && res.data?.clients) {
        setClients(res.data.clients);
      }
    } catch (e) {
      console.warn('[Clients] Could not load clients:', e);
    }
  };

  // Fetch System Stats
  const fetchSystemStats = async () => {
    try {
      const res = await safeFetchJson<SystemStats>('/api/admin/stats');
      if (res.success && res.data) {
        setSystemStats(res.data);
      }
    } catch (e) {
      console.warn('[Stats] Could not load system stats:', e);
    }
  };

  // Connect Fallback SSE stream if WS fails
  const connectSSE = () => {
    if (sseRef.current) {
      sseRef.current.close();
    }
    try {
      const sse = new EventSource('/api/realtime/stream');
      sseRef.current = sse;

      sse.onopen = () => {
        setIsWsConnected(true);
        setRealtimeMode('sse');
      };

      sse.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'NEW_INVOICE' && msg.payload) {
            playChime();
            setLiveInvoices((prev) => [msg.payload, ...prev.slice(0, 49)]);
            fetchSystemStats();
          }
        } catch (e) {
          console.error('[SSE] Parse error', e);
        }
      };

      sse.onerror = () => {
        setIsWsConnected(false);
        setRealtimeMode('reconnecting');
      };
    } catch (e) {
      console.warn('[SSE] EventSource init failed', e);
    }
  };

  // Initialize Bi-Directional Realtime Connection (WebSocket + SSE Fallback)
  useEffect(() => {
    fetchClients();
    fetchSystemStats();

    let reconnectTimer: any = null;
    let pingInterval: any = null;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsWsConnected(true);
          setRealtimeMode('websocket');
          if (sseRef.current) {
            sseRef.current.close();
            sseRef.current = null;
          }

          // Send auth & subscribe
          ws.send(
            JSON.stringify({
              type: 'AUTH',
              store_id: 'ALL',
              device_id: 'manager_web_dashboard',
            })
          );

          // Start ping measurement
          pingStartRef.current = performance.now();
          ws.send(JSON.stringify({ type: 'PING' }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'PONG') {
              if (pingStartRef.current > 0) {
                const rtt = Math.max(0.6, Number((performance.now() - pingStartRef.current).toFixed(1)));
                setPingLatency(rtt);
              }
            } else if (msg.type === 'NEW_INVOICE') {
              playChime();
              setLiveInvoices((prev) => [msg.payload, ...prev.slice(0, 49)]);
              fetchSystemStats();
            } else if (msg.type === 'REALTIME_UPDATE' || msg.type === 'SYNC_COMPLETED') {
              fetchSystemStats();
            }
          } catch (err) {
            console.error('WS parse error', err);
          }
        };

        ws.onclose = () => {
          setIsWsConnected(false);
          setRealtimeMode('reconnecting');
          connectSSE(); // Fallback immediately
          reconnectTimer = setTimeout(connectWebSocket, 3500);
        };

        ws.onerror = () => {
          setIsWsConnected(false);
          connectSSE();
        };
      } catch (err) {
        connectSSE();
      }
    };

    connectWebSocket();

    // Regular ping every 12 seconds
    pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        pingStartRef.current = performance.now();
        wsRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 12000);

    const statsInterval = setInterval(fetchSystemStats, 15000);

    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(pingInterval);
      clearInterval(statsInterval);
      if (wsRef.current) wsRef.current.close();
      if (sseRef.current) sseRef.current.close();
    };
  }, [isSoundEnabled]);

  // Keyboard Shortcut Listener: 'Ctrl+M' to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+M or Cmd+M (also handle Arabic keyboard layout equivalent if needed)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M' || e.code === 'KeyM')) {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
        return { title: t.tabManager, desc: t.tabManagerDesc };
      case 'enterprise':
        return { title: t.tabEnterprise, desc: t.tabEnterpriseDesc };
      case 'offline_sync':
        return { title: t.tabOffline, desc: t.tabOfflineDesc };
      case 'accounting':
        return { title: t.tabAccounting, desc: t.tabAccountingDesc };
      case 'clients':
        return { title: t.tabClients, desc: t.tabClientsDesc };
      case 'keys':
        return { title: t.tabKeys, desc: t.tabKeysDesc };
      case 'sdks':
        return { title: t.tabSdks, desc: t.tabSdksDesc };
      case 'database':
        return { title: t.tabDatabase, desc: t.tabDatabaseDesc };
      case 'pos':
        return { title: t.tabPos, desc: t.tabPosDesc };
      case 'deployment':
        return { title: t.tabDeployment, desc: t.tabDeploymentDesc };
      default:
        return { title: t.appName, desc: t.appSub };
    }
  };

  const sectionInfo = getSectionTitle();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col antialiased selection:bg-blue-600 selection:text-white w-full max-w-full overflow-x-hidden" dir={direction}>
      
      {/* PROFESSIONAL SIDEBAR DRAWER (TRIGGERED BY 3-BARS BUTTON) */}
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
      <div className="flex-1 flex flex-col w-full min-w-0 max-w-full overflow-x-hidden">
        
        {/* TOP COMPACT HEADER BAR WITH 3-BARS MENU TOGGLE */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-3 sm:px-6 py-3 flex items-center justify-between shadow-xs w-full max-w-full">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* 3-BARS HAMBURGER BUTTON IN TOP BAR WITH ACTIVE STATE */}
            <button
              id="topbar-hamburger-btn"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              aria-label="Toggle navigation menu"
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-600 transition cursor-pointer flex flex-col items-center justify-center gap-1 shrink-0 active:scale-95 shadow-2xs"
              title="القائمة / Menu"
            >
              <div className="w-4 h-0.5 bg-slate-700 rounded-full transition-all" />
              <div className="w-3 h-0.5 bg-blue-600 rounded-full transition-all" />
              <div className="w-4 h-0.5 bg-slate-700 rounded-full transition-all" />
            </button>

            <div className="min-w-0 truncate">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 truncate">
                <span className="truncate">{sectionInfo.title}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold hidden md:inline-block shrink-0">
                  v2.5
                </span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-sans truncate">{sectionInfo.desc}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* BILINGUAL LANGUAGE SWITCHER */}
            <LanguageToggle variant="compact" />

            {/* REALTIME DUAL-CHANNEL STATUS BADGE */}
            <div
              className={`flex items-center text-[10px] sm:text-xs px-2.5 py-1 rounded-xl font-medium border gap-1.5 shadow-2xs transition ${
                realtimeMode === 'websocket'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : realtimeMode === 'sse'
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
              title={
                realtimeMode === 'websocket'
                  ? `WebSocket: ${pingLatency}ms`
                  : 'Realtime Channel'
              }
            >
              <span
                className={`w-2 h-2 rounded-full relative flex items-center justify-center ${
                  isWsConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              >
                {isWsConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
              </span>
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <span className="font-bold font-sans">
                  {realtimeMode === 'websocket' ? t.liveBadge : realtimeMode === 'sse' ? t.sseBadge : t.connectingBadge}
                </span>
                {isWsConnected && (
                  <span className="bg-white/80 px-1 py-0.2 rounded text-[9px] text-slate-600 font-bold hidden sm:inline-block">
                    {pingLatency}{t.latency}
                  </span>
                )}
              </div>
            </div>

            {/* FAST SIMULATE BUTTON */}
            {clients.length > 0 && (
              <button
                onClick={simulatePOSIngest}
                className="px-2.5 sm:px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm shadow-blue-600/20 active:scale-95 transition cursor-pointer"
                title={t.simInvoice}
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.simInvoice}</span>
              </button>
            )}

            {/* PWA MOBILE APP INSTALL BUTTON */}
            <PWAInstallButton variant="header" />

            {/* AUDIO TOGGLE */}
            <button
              onClick={() => setIsSoundEnabled(!isSoundEnabled)}
              className={`p-1.5 sm:p-2 rounded-xl border transition cursor-pointer ${
                isSoundEnabled
                  ? 'bg-white border-slate-300 text-emerald-600 hover:bg-emerald-50'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
              title={isSoundEnabled ? t.soundOn : t.soundOff}
            >
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* MAIN VIEWPORT */}
        <main className="p-3.5 sm:p-6 flex-1 w-full max-w-7xl mx-auto space-y-6 overflow-x-hidden">
          {activeTab === 'manager' && (
            <ManagerDashboard
              clients={clients}
              liveInvoices={liveInvoices}
              onInspectInvoice={() => {}}
              onTriggerSimulation={simulatePOSIngest}
            />
          )}

          {activeTab === 'enterprise' && (
            <EnterprisePowerSuite clients={clients} />
          )}

          {activeTab === 'offline_sync' && (
            <OfflineSyncStudio clients={clients} />
          )}

          {activeTab === 'accounting' && (
            <AccountingCore clients={clients} />
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

          {activeTab === 'api_docs' && (
            <ApiDocsPortal
              clients={clients}
              onNavigateToKeys={() => setActiveTab('keys')}
              onNavigateToTester={() => setActiveTab('pos')}
            />
          )}

          {activeTab === 'sdks' && (
            <IntegrationHub clients={clients} />
          )}

          {activeTab === 'database' && (
            <DatabaseStudio
              systemStats={systemStats}
              onRefreshStats={fetchSystemStats}
              clients={clients}
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
              <span className="font-bold text-slate-800">{t.dbEngine}</span>
              <span>•</span>
              <span className="text-blue-600 font-semibold">{t.byAuthor}</span>
              <span>•</span>
              <span className="text-emerald-700 font-medium font-mono">{t.sqliteEngine}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 font-sans">
                {t.dbSize}: {systemStats?.database?.file_size_formatted || '0.04 MB'}
              </span>
              <span>•</span>
              <a
                href="/deployment.html"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium transition"
              >
                {t.vpsGuide}
              </a>
            </div>
          </div>
        </footer>

        <OfflineIndicator />
      </div>

    </div>
  );
}
