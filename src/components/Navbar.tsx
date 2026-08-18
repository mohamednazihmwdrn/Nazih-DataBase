import React from 'react';
import {
  Activity,
  KeyRound,
  ShoppingBag,
  Server,
  ExternalLink,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'manager' | 'admin' | 'pos' | 'deployment';
  setActiveTab: (tab: 'manager' | 'admin' | 'pos' | 'deployment') => void;
  isWsConnected: boolean;
  isSoundEnabled: boolean;
  toggleSound: () => void;
  onSimulateClick: () => void;
  activeStoresCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isWsConnected,
  isSoundEnabled,
  toggleSound,
  onSimulateClick,
  activeStoresCount,
}) => {
  return (
    <header className="bg-white/95 border-b border-slate-200 sticky top-0 z-40 backdrop-blur shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* BRAND IDENTITY */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm shadow-blue-600/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900">ستور بالس | StorePulse</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                محرك الـ SaaS المستقل
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-sans hidden sm:block">
              استضافة ذاتية مع SQLite • بدون Firebase • معاملات ACID أحادية
            </p>
          </div>
        </div>

        {/* PRIMARY VIEW NAVIGATION */}
        <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            id="nav-manager-btn"
            onClick={() => setActiveTab('manager')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'manager'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>لوحة المدير المباشرة</span>
          </button>

          <button
            id="nav-admin-btn"
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>إدارة المتاجر والاشتراكات</span>
            {activeStoresCount > 0 && (
              <span className="mr-1 text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 border border-blue-300 font-mono">
                {activeStoresCount}
              </span>
            )}
          </button>

          <button
            id="nav-pos-btn"
            onClick={() => setActiveTab('pos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'pos'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>محاكي الكاشير وAPI</span>
          </button>

          <button
            id="nav-deploy-btn"
            onClick={() => setActiveTab('deployment')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'deployment'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>دليل النشر والاستضافة</span>
          </button>
        </nav>

        {/* CONTROLS & STATUS */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* WEBSOCKET STATUS */}
          <div
            id="ws-status-pill"
            className={`hidden lg:flex items-center text-xs px-2.5 py-1 rounded-full font-medium border gap-2 ${
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
            <span>{isWsConnected ? 'بث الويب سوكيت متصل' : 'جاري الاتصال...'}</span>
          </div>

          {/* AUDIO CHIME TOGGLE */}
          <button
            id="sound-toggle-btn"
            onClick={toggleSound}
            className={`p-2 rounded-lg border transition cursor-pointer ${
              isSoundEnabled
                ? 'bg-white border-slate-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300'
                : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600'
            }`}
            title={isSoundEnabled ? 'تنبيهات الصوت مفعلة' : 'تنبيهات الصوت صامتة'}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* FAST SIMULATION BUTTON */}
          <button
            id="simulate-ingest-btn"
            onClick={onSimulateClick}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer"
            title="محاكاة فورية لإرسال فاتورة كاشير جديدة واختبار البث اللحظي"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">محاكاة فاتورة لحظية</span>
          </button>

          {/* STANDALONE HTML DROPDOWN / LINK */}
          <div className="relative group">
            <button
              id="raw-html-links-btn"
              className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 transition shadow-xs cursor-pointer"
              title="فتح صفحات HTML المستقلة بدون بناء"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <div className="absolute left-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 hidden group-hover:block z-50 text-xs">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                صفحات HTML نقية ومستقلة
              </div>
              <a
                href="/manager.html"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
              >
                <span>لوحة المدير المباشرة</span>
                <span className="font-mono text-[10px] text-slate-400">manager.html</span>
              </a>
              <a
                href="/admin.html"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
              >
                <span>إدارة المتاجر والمفاتيح</span>
                <span className="font-mono text-[10px] text-slate-400">admin.html</span>
              </a>
              <a
                href="/pos-tester.html"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
              >
                <span>محاكي الكاشير وAPI</span>
                <span className="font-mono text-[10px] text-slate-400">pos-tester.html</span>
              </a>
              <a
                href="/deployment.html"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
              >
                <span>دليل تشغيل VPS وRender</span>
                <span className="font-mono text-[10px] text-slate-400">deployment.html</span>
              </a>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
};
