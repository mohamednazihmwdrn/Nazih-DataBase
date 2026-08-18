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
} from 'lucide-react';
import { SystemStats, ClientRecord } from '../types';

export type ActiveTab = 'manager' | 'clients' | 'keys' | 'sdks' | 'database' | 'pos' | 'deployment';

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
  const [isResetting, setIsResetting] = useState(false);
  const activeClientsCount = clients.filter((c) => c.status === 'active').length;

  const handleWipeData = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في مسح كافة البيانات والبدء بقاعدة بيانات نظيفة 100% للعملاء الحقيقيين؟')) {
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
      label: 'لوحة العمليات المباشرة',
      sublabel: 'بث المعاملات والمؤشرات',
      icon: Activity,
      badge: isWsConnected ? 'مباشر 24/7' : 'غير متصل',
      badgeColor: isWsConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300',
    },
    {
      id: 'clients' as ActiveTab,
      label: 'بوابات المتاجر والعملاء',
      sublabel: 'صفحة وملفات كل تطبيق',
      icon: Users,
      badge: `${clients.length} متجر`,
      badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono',
    },
    {
      id: 'keys' as ActiveTab,
      label: 'مولد المفاتيح والتراخيص',
      sublabel: 'إصدار وتأمين API Keys',
      icon: KeyRound,
      badge: `${activeClientsCount} نشط`,
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
    },
    {
      id: 'sdks' as ActiveTab,
      label: 'مركز ربط التطبيقات (SDKs)',
      sublabel: 'أكواد Flutter, JS, Python, C#',
      icon: Code2,
      badge: 'جاهز للنسخ',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    },
    {
      id: 'database' as ActiveTab,
      label: 'محرك البيانات واستعلامات SQL',
      sublabel: 'MNDB ACID ومحرر الاستعلامات',
      icon: Database,
      badge: systemStats?.database?.file_size_formatted || 'MNDB',
      badgeColor: 'bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30',
    },
    {
      id: 'pos' as ActiveTab,
      label: 'محاكي الكاشير ونقاط البيع',
      sublabel: 'تجربة الإرسال والتحقق',
      icon: ShoppingBag,
      badge: 'Live POS',
      badgeColor: 'bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30',
    },
    {
      id: 'deployment' as ActiveTab,
      label: 'دليل النشر والاستضافة المستقلة',
      sublabel: 'تشغيل VPS وRender وDocker',
      icon: Server,
      badge: '24/7 VPS',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30',
    },
  ];

  return (
    <aside
      className={`bg-slate-900 text-slate-100 border-l border-slate-800 flex flex-col justify-between transition-all duration-300 z-30 shrink-0 select-none shadow-xl ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* BRAND & 3-BARS HAMBURGER HEADER */}
      <div>
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {/* 3-BARS HAMBURGER BUTTON WITH SUBTLE ACTIVE STATE COLOR SHIFT */}
            <button
              id="sidebar-hamburger-toggle"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 flex flex-col items-center justify-center gap-1 group active:scale-90 ${
                !isCollapsed
                  ? 'bg-blue-600/25 text-blue-400 border border-blue-500/50 shadow-inner ring-1 ring-blue-500/30 hover:bg-blue-600/35 hover:text-blue-300'
                  : 'bg-slate-800/90 text-slate-400 hover:text-slate-200 hover:bg-slate-700/90 border border-slate-700/80 shadow-sm'
              }`}
              title={isCollapsed ? 'فتح القائمة الجانبية (3 شرط)' : 'إغلاق القائمة الجانبية (3 شرط - مفعلة)'}
              aria-label="Toggle Sidebar Menu"
            >
              {/* 3 Distinct Bars with active color indication */}
              <div
                className={`h-0.5 rounded-full transition-all ${
                  !isCollapsed
                    ? 'w-4 bg-blue-400 group-hover:w-4.5 group-hover:bg-blue-300'
                    : 'w-4 bg-slate-400 group-hover:w-4.5 group-hover:bg-slate-200'
                }`}
              />
              <div
                className={`h-0.5 rounded-full transition-all ${
                  !isCollapsed
                    ? 'w-3.5 bg-blue-400 group-hover:w-4 group-hover:bg-blue-300'
                    : 'w-3.5 bg-slate-400 group-hover:w-4 group-hover:bg-slate-200'
                }`}
              />
              <div
                className={`h-0.5 rounded-full transition-all ${
                  !isCollapsed
                    ? 'w-4 bg-blue-400 group-hover:w-4.5 group-hover:bg-blue-300'
                    : 'w-4 bg-slate-400 group-hover:w-4.5 group-hover:bg-slate-200'
                }`}
              />
            </button>

            {!isCollapsed && (
              <div className="overflow-hidden">
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
                  <span>محرك محمد نزيه لقواعد البيانات</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* OWNER PROFILE & BRAND BANNER */}
        {!isCollapsed && (
          <div className="p-3 border-b border-slate-800/80 bg-gradient-to-b from-slate-950/80 to-slate-900/40">
            <div className="flex items-center gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm shadow-blue-500/30 font-mono">
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
        )}

        {/* PRIMARY NAVIGATION ITEMS */}
        <nav className="p-2.5 space-y-1 overflow-y-auto max-h-[calc(100vh-320px)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                    isActive
                      ? 'bg-blue-500/50 text-white'
                      : 'text-slate-400 group-hover:text-blue-400 group-hover:bg-slate-700/50'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5" />
                </div>

                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between overflow-hidden">
                    <div className="truncate">
                      <div className="text-xs font-semibold truncate leading-tight">{item.label}</div>
                      <div className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                        {item.sublabel}
                      </div>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0 mr-1 ${
                          isActive ? 'bg-white/20 text-white' : item.badgeColor
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* FOOTER ACTIONS & CONTROLS */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 space-y-2">
        {/* FAST SIMULATION BUTTON */}
        {clients.length > 0 && (
          <button
            id="sidebar-simulate-btn"
            onClick={onSimulateClick}
            className={`w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-95 transition cursor-pointer ${
              isCollapsed ? 'px-2' : 'px-3'
            }`}
            title="محاكاة فورية لمعاملة جديدة واختبار البث اللحظي"
          >
            <Zap className="w-4 h-4 text-amber-300 shrink-0" />
            {!isCollapsed && <span>محاكاة فاتورة لحظية</span>}
          </button>
        )}

        {/* AUDIO TOGGLE & WIPE DATA */}
        <div className="flex items-center gap-1.5 justify-between">
          <button
            id="sidebar-sound-btn"
            onClick={toggleSound}
            className={`p-2 rounded-xl border border-slate-700/60 transition cursor-pointer text-xs flex items-center justify-center gap-1.5 flex-1 ${
              isSoundEnabled
                ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                : 'bg-slate-900 text-slate-500 hover:text-slate-300'
            }`}
            title={isSoundEnabled ? 'تنبيهات الصوت مفعلة' : 'الصوت صامت'}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {!isCollapsed && <span className="text-[10px]">{isSoundEnabled ? 'الصوت مفعّل' : 'صامت'}</span>}
          </button>

          <button
            onClick={handleWipeData}
            disabled={isResetting}
            className="p-2 rounded-xl bg-slate-900 hover:bg-rose-900/60 border border-slate-800 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 transition text-xs flex items-center justify-center gap-1 cursor-pointer"
            title="مسح وتصفير البيانات للبدء ببيانات حقيقية 100%"
          >
            {isResetting ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <Trash2 className="w-3.5 h-3.5" />}
            {!isCollapsed && <span className="text-[10px]">تصفير نظيف</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
