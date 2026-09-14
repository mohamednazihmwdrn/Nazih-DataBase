import React from 'react';
import { Languages, Check } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

interface LanguageToggleProps {
  variant?: 'compact' | 'full';
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ variant = 'compact' }) => {
  const { language, toggleLanguage, t } = useLanguage();

  if (variant === 'full') {
    return (
      <button
        onClick={toggleLanguage}
        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition cursor-pointer"
        title="تغيير لغة الواجهة الفورية / Switch Language"
      >
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-blue-400" />
          <span>{language === 'ar' ? 'اللغة: العربية' : 'Language: English'}</span>
        </div>
        <span className="px-2 py-0.5 rounded-md bg-blue-600/30 text-blue-300 font-mono text-[10px] font-bold">
          {language === 'ar' ? 'EN' : 'عربي'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleLanguage}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-600 transition cursor-pointer text-xs font-bold shrink-0 shadow-2xs active:scale-95"
      title={language === 'ar' ? 'التحويل للغة الإنجليزية (Switch to English)' : 'التحويل للغة العربية (Switch to Arabic)'}
    >
      <Languages className="w-3.5 h-3.5 text-blue-600 shrink-0" />
      <span className="font-mono text-xs">{language === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
};
