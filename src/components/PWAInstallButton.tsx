import React, { useState } from 'react';
import { Download, Smartphone, Check, X, Share2, PlusSquare, ArrowLeft } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // If already installed and running inside standalone window, do not show install CTA
  if (isInstalled) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
        <Check className="w-3.5 h-3.5 text-emerald-400" />
        <span>مثبت كتطبيق موبايل</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setInstalledSuccess(true);
        setTimeout(() => setInstalledSuccess(false), 4000);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      {variant === 'header' && (
        <button
          onClick={handleInstallClick}
          className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition cursor-pointer shrink-0"
          title="تثبيت المنظومة كتطبيق على هاتفك"
        >
          <Smartphone className="w-4 h-4 text-cyan-200" />
          <span className="hidden sm:inline">تثبيت التطبيق على الموبايل</span>
          <span className="sm:hidden">تثبيت التطبيق</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <div className="p-3 bg-gradient-to-b from-slate-800/90 to-slate-900 rounded-xl border border-slate-700/70 text-slate-200 space-y-2">
          <div className="flex items-center gap-2.5">
            <img src="/pwa-192x192.png" alt="StorePulse Icon" className="w-9 h-9 rounded-xl shadow-md border border-slate-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">تطبيق StorePulse</div>
              <div className="text-[10px] text-slate-400">تثبيت على الشاشة الرئيسية</div>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تنزيل وتثبيت كـ App</span>
          </button>
        </div>
      )}

      {/* INSTALLATION GUIDE MODAL (FOR IOS SAFARI OR MANUAL BROWSERS) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 text-white shadow-2xl space-y-5">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 left-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <img src="/pwa-192x192.png" alt="StorePulse Icon" className="w-12 h-12 rounded-2xl border border-slate-600 shadow-md" />
              <div>
                <h3 className="text-base font-bold text-white">تثبيت StorePulse على الموبايل</h3>
                <p className="text-xs text-slate-400">ليعمل كأي تطبيق مثبت من Google Play أو App Store</p>
              </div>
            </div>

            {isInstallable ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  متصفحك يدعم التثبيت المباشر بنقرة واحدة. اضغط على الزر أدناه لإضافة أيقونة التطبيق لشاشة هاتفك فوراً:
                </p>
                <button
                  onClick={async () => {
                    const ok = await install();
                    if (ok) setShowModal(false);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تأكيد تثبيت التطبيق الآن</span>
                </button>
              </div>
            ) : isIOS ? (
              <div className="space-y-3 bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-xs text-slate-300 space-y-2.5">
                <div className="font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  <span>طريقة التثبيت على هواتف آيفون (Safari):</span>
                </div>
                <ol className="space-y-2 list-decimal list-inside text-slate-300">
                  <li>
                    اضغط على زر <strong>المشاركة (Share)</strong>{' '}
                    <Share2 className="w-3.5 h-3.5 inline text-blue-400 mx-1" /> في أسفل شاشة سفاري.
                  </li>
                  <li>
                    مرر لأسفل واختر <strong>«إضافة إلى الشاشة الرئيسية» (Add to Home Screen)</strong>{' '}
                    <PlusSquare className="w-3.5 h-3.5 inline text-emerald-400 mx-1" />.
                  </li>
                  <li>
                    اضغط على <strong>«إضافة» (Add)</strong> في أعلى اليمين.
                  </li>
                </ol>
                <p className="text-[11px] text-cyan-300 pt-1 border-t border-slate-700">
                  ستظهر أيقونة StorePulse الرسمية على شاشة هاتفك وتفتح بملء الشاشة دون شريط المتصفح!
                </p>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-xs text-slate-300">
                <div className="font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  <span>طريقة التثبيت على أندرويد (Google Chrome):</span>
                </div>
                <ol className="space-y-2 list-decimal list-inside text-slate-300">
                  <li>افتح قائمة الخيارات (الثلاث نقاط الرأسية ⋮ في أعلى يمين المتصفح).</li>
                  <li>اختر <strong>«تثبيت التطبيق» (Install app)</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.</li>
                  <li>سيتم تحميل الأيقونة على جهازك وستجده ضمن قائمة التطبيقات على هاتفك.</li>
                </ol>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
