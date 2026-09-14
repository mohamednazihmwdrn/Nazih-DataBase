import React, { useState } from 'react';
import {
  Activity,
  Users,
  KeyRound,
  Code2,
  Database,
  ShoppingBag,
  Server,
  Zap,
  Volume2,
  VolumeX,
  ExternalLink,
  ShieldCheck,
  Trash2,
  RefreshCw,
  ArrowDownUp,
  BookOpen,
  Flame,
  FileText,
  X,
} from 'lucide-react';
import { SystemStats, ClientRecord } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../lib/i18n';

export type ActiveTab =
  | 'manager'
  | 'enterprise'
  | 'api_docs'
  | 'offline_sync'
  | 'accounting'
  | 'clients'
  | 'keys'
  | 'sdks'
  | 'database'
  | 'pos'
  | 'deployment';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isWsConnected: boolean;
  isSoundEnabled: boolean;
  toggleSound: () => void;
  onSimulateClick: () => void;
  clients: ClientRecord[];
  systemStats: SystemStats | null;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onResetData?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isWsConnected,
  isSoundEnabled,
  toggleSound,
  onSimulateClick,
  clients,
  systemStats,
  isCollapsed,
  setIsCollapsed,
  onResetData,
}) => {
  const { t, direction, language } = useLanguage();
  const [isResetting, setIsResetting] = useState(false);
  const activeClientsCount = clients.filter((c) => c.status === 'active').length;

  const handleWipeData = async () => {
    if (!window.confirm(t.confirmReset)) {
      return;
    }
    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/reset-data', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (onResetData) onResetData();
      }
    } catch (e) {
      console.error('Failed to reset data', e);
    } finally {
      setIsResetting(false);
    }
  };

  const navItems = [
    {
      id: 'manager' as ActiveTab,
      label: t.tabManager,
      sublabel: t.tabManagerDesc,
      icon: Activity,
      badge: t.liveBadge,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    },
    {
      id: 'enterprise' as ActiveTab,
      label: t.tabEnterprise,
      sublabel: t.tabEnterpriseDesc,
      icon: Flame,
      badge: 'PRO',
      badgeColor: 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30',
    },
    {
      id: 'database' as ActiveTab,
      label: t.tabDatabase,
      sublabel: t.tabDatabaseDesc,
      icon: Database,
      badge: 'SQL ACID',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30',
    },
    {
      id: 'offline_sync' as ActiveTab,
      label: t.tabOffline,
      sublabel: t.tabOfflineDesc,
      icon: ArrowDownUp,
      badge: 'CRDT Sync',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30',
    },
    {
      id: 'accounting' as ActiveTab,
      label: t.tabAccounting,
      sublabel: t.tabAccountingDesc,
      icon: BookOpen,
      badge: 'ERP Core',
      badgeColor: 'bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30',
    },
    {
      id: 'clients' as ActiveTab,
      label: t.tabClients,
      sublabel: t.tabClientsDesc,
      icon: Users,
      badge: `${activeClientsCount} ${language === 'ar' ? 'نشط' : 'Active'}`,
      badgeColor: 'bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30',
    },
    {
      id: 'keys' as ActiveTab,
      label: t.tabKeys,
      sublabel: t.tabKeysDesc,
      icon: KeyRound,
      badge: 'SHA-256',
      badgeColor: 'bg-slate-700/60 text-slate-300 font-mono border border-slate-600',
    },
    {
      id: 'api_docs' as ActiveTab,
      label: language === 'ar' ? 'شرح وتوثيق الـ API' : 'API Documentation',
      sublabel: language === 'ar' ? 'دليل ربط التطبيقات الخارجية والمصادقة' : 'External app integration & authentication guide',
      icon: FileText,
      badge: 'REST',
      badgeColor: 'bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30',
    },
    {
      id: 'sdks' as ActiveTab,
      label: t.tabSdks,
      sublabel: t.tabSdksDesc,
      icon: Code2,
      badge: language === 'ar' ? '5 لغات' : '5 SDKs',
      badgeColor: 'bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30',
    },
    {
      id: 'pos' as ActiveTab,
      label: t.tabPos,
      sublabel: t.tabPosDesc,
      icon: ShoppingBag,
      badge: 'Sandbox',
      badgeColor: 'bg-slate-700/60 text-slate-300 font-mono border border-slate-600',
    },
    {
      id: 'deployment' as ActiveTab,
      label: t.tabDeployment,
      sublabel: t.tabDeploymentDesc,
      icon: Server,
      badge: '24/7 VPS',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30',
    },
  ];

  const handleNavClick = (tabId: ActiveTab) => {
    setActiveTab(tabId);
    // Automatically close the sidebar when any section is chosen so it doesn't take up page space
    setIsCollapsed(true);
  };

  const isRtl = direction === 'rtl';

  return (
    <>
      {/* BACKDROP OVERLAY WHEN SIDEBAR IS OPEN */}
      {!isCollapsed && (
        <div
          onClick={() => setIsCollapsed(true)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 transition-opacity cursor-pointer"
          title={isRtl ? 'انقر هنا لإغلاق القائمة الجانبية' : 'Click to close sidebar'}
        />
      )}

      {/* FULL COLLAPSIBLE SLIDE-OVER DRAWER SIDEBAR (HIDES OFFSCREEN WHEN CLOSED) */}
      <aside
        id="app-drawer-sidebar"
        className={`fixed top-0 ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} h-full w-80 max-w-[85vw] bg-slate-900 text-slate-100 border-slate-800 flex flex-col justify-between transition-transform duration-300 ease-in-out z-50 select-none shadow-2xl overflow-x-hidden ${
          isCollapsed
            ? isRtl
              ? 'translate-x-full pointer-events-none'
              : '-translate-x-full pointer-events-none'
            : 'translate-x-0 pointer-events-auto'
        }`}
      >
        {/* BRAND & 3-BARS HAMBURGER CLOSE BUTTON */}
        <div>
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950">
            <div className="flex items-center gap-2.5 overflow-hidden flex-1">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm shadow-blue-600/30 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="overflow-hidden flex-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-black text-white tracking-tight truncate">
                    Nazih Core
                  </h1>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-600 text-white font-mono font-bold">
                    MNDB
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>محرك وقواعد بيانات شامل</span>
                </p>
              </div>
            </div>

            {/* 3-BARS / CLOSE BUTTON INSIDE DRAWER */}
            <button
              id="sidebar-drawer-close-btn"
              onClick={() => setIsCollapsed(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer flex flex-col items-center justify-center gap-1 shrink-0"
              title="إغلاق القائمة"
              aria-label="إغلاق القائمة الجانبية"
            >
              <div className="w-4 h-0.5 bg-blue-400 rounded-full" />
              <div className="w-3 h-0.5 bg-blue-400 rounded-full" />
              <div className="w-4 h-0.5 bg-blue-400 rounded-full" />
            </button>
          </div>

          {/* OWNER PROFILE & BRAND BANNER */}
          <div className="p-3.5 border-b border-slate-800/80 bg-gradient-to-b from-slate-950/80 to-slate-900/40">
            <div className="flex items-center gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm shadow-blue-500/30 font-mono">
                MN
              </div>
              <div className="overflow-hidden flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100 truncate">Mohamed Nazih</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <span className="text-[10px] text-slate-400 block truncate font-mono">
                  mnazih298@gmail.com
                </span>
              </div>
            </div>

            {/* REALTIME SYSTEM HEALTH */}
            <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 font-mono px-1">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{isWsConnected ? 'الويب سوكيت متصل 24/7' : 'جاري الاتصال'}</span>
              </span>
              <span>{systemStats?.server?.memory_rss_mb || 42}MB RAM</span>
            </div>
          </div>

          {/* MENU LABEL */}
          <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/60 text-[11px] text-slate-400 font-bold flex items-center justify-between">
            <span>{language === 'ar' ? 'أقسام النظام (اختر للفتح الفوري):' : 'System Modules:'}</span>
            <span className="text-[10px] text-slate-500 font-normal">{language === 'ar' ? 'تُغلق القائمة تلقائياً' : 'Auto-closes on tap'}</span>
          </div>

          {/* PRIMARY NAVIGATION ITEMS */}
          <nav className="p-2.5 space-y-1.5 overflow-y-auto max-h-[calc(100vh-360px)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`drawer-nav-${item.id}`}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer text-xs font-bold ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <div className={`${isRtl ? 'text-right' : 'text-left'} truncate`}>
                      <div className="leading-tight">{item.label}</div>
                      <div className={`text-[10px] font-normal ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                        {item.sublabel}
                      </div>
                    </div>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${isRtl ? 'mr-1' : 'ml-1'} ${
                        isActive ? 'bg-white/20 text-white' : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* FOOTER ACTIONS & CONTROLS */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950 space-y-2.5">
          {/* LANGUAGE SWITCHER IN SIDEBAR */}
          <LanguageToggle variant="full" />

          {/* PWA MOBILE APP INSTALL WIDGET */}
          <PWAInstallButton variant="sidebar" />

          {/* FAST SIMULATION BUTTON */}
          {clients.length > 0 && (
            <button
              id="sidebar-simulate-btn"
              onClick={() => {
                onSimulateClick();
                setIsCollapsed(true);
              }}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-95 transition cursor-pointer"
              title={t.simInvoice}
            >
              <Zap className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{language === 'ar' ? 'محاكاة فاتورة لحظية الآن' : 'Simulate Live Ingest Now'}</span>
            </button>
          )}

          {/* AUDIO TOGGLE & WIPE DATA */}
          <div className="flex items-center gap-2 justify-between">
            <button
              id="sidebar-sound-btn"
              onClick={toggleSound}
              className={`p-2 rounded-xl border border-slate-700/60 transition cursor-pointer text-xs flex items-center justify-center gap-1.5 flex-1 ${
                isSoundEnabled
                  ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                  : 'bg-slate-900 text-slate-500 hover:text-slate-300'
              }`}
              title={isSoundEnabled ? t.soundOn : t.soundOff}
            >
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="text-[11px]">{isSoundEnabled ? t.soundOn : t.soundOff}</span>
            </button>

            <button
              onClick={() => {
                handleWipeData();
                setIsCollapsed(true);
              }}
              disabled={isResetting}
              className="p-2 rounded-xl bg-slate-900 hover:bg-rose-900/60 border border-slate-800 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 transition text-xs flex items-center justify-center gap-1.5 cursor-pointer px-3"
              title={t.cleanReset}
            >
              {isResetting ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span className="text-[11px]">{isResetting ? t.resetting : t.cleanReset}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
