import { GoogleGenAI } from '@google/genai';

/**
 * Server-side Instant Translation Engine (StorePulse Real-Time Translator)
 * Bidirectional instant translation between Arabic & English for:
 * - POS Transactions & Invoices (Items, Categories, Payment methods, notes)
 * - System Labels & Metrics
 * - Status codes & Error messages
 * - Custom user queries & text
 */

// Comprehensive domain dictionary for retail, POS, accounting, and system terms
const DICTIONARY_EN_TO_AR: Record<string, string> = {
  // Common Retail / POS
  'cold brew coffee': 'قهوة كولد برو مبردة',
  'colombian cold brew': 'قهوة كولد برو كولومبي',
  'iced latte': 'آيس لاتيه',
  'spanish latte': 'سبانش لاتيه',
  'espresso': 'إسبريسو',
  'cappuccino': 'كابتشينو',
  'flat white': 'فلات وايت',
  'french butter croissant': 'كرواسون زبدة فرنسي',
  'croissant': 'كرواسون',
  'blueberry muffin': 'مافن التوت البري',
  'muffin': 'مافن',
  'cheesecake': 'تشيز كيك',
  'chocolate cake': 'كعكة الشوكولاتة',
  'mineral water': 'مياه معدنية',
  'fresh orange juice': 'عصير برتقال طازج',
  'green tea': 'شاي أخضر',
  'black tea': 'شاي أسود',
  'organic salad': 'سلطة عضوية',
  'club sandwich': 'كلوب ساندوتش',
  'halloumi sandwich': 'ساندوتش حلومي',
  'smoked turkey sandwich': 'ساندوتش ديك رومي مدخن',
  'burger': 'برجر',
  'crispy fries': 'بطاطس مقلية مقرمشة',
  'french fries': 'بطاطس مقلية',
  'pizza': 'بيتزا',

  // Categories
  'beverages': 'مشروبات',
  'drinks': 'مشروبات',
  'hot drinks': 'مشروبات ساخنة',
  'cold drinks': 'مشروبات باردة',
  'bakery': 'مخبوزات',
  'pastries': 'معجنات',
  'desserts': 'حلويات',
  'food': 'مأكولات',
  'snacks': 'وجبات خفيفة',
  'retail': 'تجزئة',
  'grocery': 'بقالة',
  'general': 'عام',

  // Financial & Invoicing Terms
  'invoice': 'فاتورة',
  'invoices': 'فواتير',
  'invoice number': 'رقم الفاتورة',
  'receipt': 'إيصال',
  'tax invoice': 'فاتورة ضريبية',
  'simplified tax invoice': 'فاتورة ضريبية مبسطة',
  'subtotal': 'المجموع الفرعي',
  'tax': 'الضريبة',
  'vat': 'ضريبة القيمة المضافة',
  'discount': 'الخصم',
  'total': 'الإجمالي',
  'total amount': 'المبلغ الإجمالي',
  'amount': 'المبلغ',
  'unit price': 'سعر الوحدة',
  'price': 'السعر',
  'quantity': 'الكمية',
  'items': 'أصناف',
  'item': 'صنف',
  'item name': 'اسم الصنف',
  'category': 'التصنيف',
  'customer': 'العميل',
  'customer name': 'اسم العميل',
  'walk-in customer': 'عميل نقدي',
  'cash customer': 'عميل نقدي',
  'phone': 'رقم الهاتف',
  'notes': 'ملاحظات',
  'store': 'المتجر',
  'branch': 'الفرع',
  'store id': 'رمز المتجر',
  'cashier': 'الكاشير',
  'terminal': 'جهاز الكاشير',
  'date': 'التاريخ',
  'time': 'الوقت',
  'date and time': 'التاريخ والوقت',

  // Payment Methods
  'cash': 'نقداً',
  'card': 'بطاقة بنكية',
  'credit card': 'بطاقة ائتمان',
  'debit card': 'بطاقة مدى / خصم',
  'online': 'دفع إلكتروني',
  'apple pay': 'آبل باي',
  'mada': 'مدى',
  'paid': 'مدفوع',
  'unpaid': 'غير مدفوع',
  'refunded': 'مسترجع',

  // Dashboard & Metrics
  'revenue': 'الإيرادات',
  'total revenue': 'إجمالي الإيرادات',
  'orders': 'الطلبات',
  'total orders': 'إجمالي الطلبات',
  'average ticket': 'متوسط الفاتورة',
  'average order value': 'متوسط قيمة الطلب',
  'active stores': 'المتاجر النشطة',
  'sales': 'المبيعات',
  'top selling': 'الأكثر مبيعاً',
  'top revenue': 'الأعلى إيراداً',
  'live feed': 'البث المباشر',
  'live invoices': 'الفواتير المباشرة',
  'active invoices': 'الفواتير النشطة',
  'archived invoices': 'الفواتير المؤرشفة',
  'all stores': 'كافة الفروع والمتاجر',
  'today': 'اليوم',
  'last 7 days': 'آخر 7 أيام',
  'last 30 days': 'آخر 30 يوم',
  'all time': 'كامل الأرشيف',
  'status': 'الحالة',
  'active': 'نشط',
  'suspended': 'موقوف',
  'expired': 'منتهي الصلاحية',
  'export pdf': 'تصدير PDF',
  'preview': 'معاينة',
  'page': 'صفحة',
  'next': 'التالي',
  'previous': 'السابق',
  'search': 'بحث',
  'simulate': 'محاكاة',
  'filter': 'تصفية',

  // System & API Messages
  'unauthorized': 'غير مصرح بالوصول',
  'missing api key': 'مفتاح API مفقود',
  'invalid api key': 'مفتاح API غير صالح',
  'subscription suspended': 'الاشتراك موقوف',
  'success': 'تمت العملية بنجاح',
  'invoice created': 'تم تسجيل الفاتورة بنجاح',
  'healthy': 'النظام يعمل بكفاءة',
};

// Build inverted Arabic to English map
const DICTIONARY_AR_TO_EN: Record<string, string> = {};
for (const [en, ar] of Object.entries(DICTIONARY_EN_TO_AR)) {
  const normAr = normalizeArabic(ar);
  DICTIONARY_AR_TO_EN[normAr] = en;
}

// Additional specific Arabic terms
DICTIONARY_AR_TO_EN[normalizeArabic('عميل نقدي')] = 'Cash Customer';
DICTIONARY_AR_TO_EN[normalizeArabic('نقدا')] = 'Cash';
DICTIONARY_AR_TO_EN[normalizeArabic('بطاقة')] = 'Card';
DICTIONARY_AR_TO_EN[normalizeArabic('دفع الكتروني')] = 'Online Payment';
DICTIONARY_AR_TO_EN[normalizeArabic('قهوة كولد برو كولومبي')] = 'Colombian Cold Brew Coffee';
DICTIONARY_AR_TO_EN[normalizeArabic('كرواسون زبدة فرنسي')] = 'French Butter Croissant';
DICTIONARY_AR_TO_EN[normalizeArabic('شاي مثلج بالخوخ')] = 'Peach Iced Tea';
DICTIONARY_AR_TO_EN[normalizeArabic('كيك الجزر')] = 'Carrot Cake';
DICTIONARY_AR_TO_EN[normalizeArabic('ساندوتش تونة')] = 'Tuna Sandwich';

function normalizeArabic(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel/diacritics
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, ''); // Remove tatweel
}

// In-memory LRU cache to ensure sub-millisecond repeated translations
const translationCache = new Map<string, string>();

/**
 * Detect language of a given text (Arabic vs English)
 */
export function detectLanguage(text: string): 'ar' | 'en' {
  if (!text) return 'en';
  // Check for presence of Arabic unicode range \u0600-\u06FF
  const arabicRegex = /[\u0600-\u06FF]/;
  return arabicRegex.test(text) ? 'ar' : 'en';
}

/**
 * Instant translation function for single string
 */
export async function translateText(
  text: string,
  targetLang: 'ar' | 'en',
  sourceLang?: 'ar' | 'en'
): Promise<{ translated: string; sourceLang: 'ar' | 'en'; cached: boolean; provider: 'dictionary' | 'ai' | 'fallback' }> {
  if (!text || typeof text !== 'string') {
    return { translated: '', sourceLang: targetLang === 'ar' ? 'en' : 'ar', cached: true, provider: 'fallback' };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { translated: text, sourceLang: targetLang, cached: true, provider: 'fallback' };
  }

  const detectedSource = sourceLang || detectLanguage(trimmed);
  if (detectedSource === targetLang) {
    return { translated: trimmed, sourceLang: detectedSource, cached: true, provider: 'fallback' };
  }

  const cacheKey = `${detectedSource}->${targetLang}:${trimmed.toLowerCase()}`;
  if (translationCache.has(cacheKey)) {
    return {
      translated: translationCache.get(cacheKey)!,
      sourceLang: detectedSource,
      cached: true,
      provider: 'dictionary',
    };
  }

  // 1. Direct Dictionary Match
  if (detectedSource === 'en' && targetLang === 'ar') {
    const directMatch = DICTIONARY_EN_TO_AR[trimmed.toLowerCase()];
    if (directMatch) {
      translationCache.set(cacheKey, directMatch);
      return { translated: directMatch, sourceLang: 'en', cached: false, provider: 'dictionary' };
    }
  } else if (detectedSource === 'ar' && targetLang === 'en') {
    const norm = normalizeArabic(trimmed);
    const directMatch = DICTIONARY_AR_TO_EN[norm];
    if (directMatch) {
      // Capitalize nicely for English
      const capitalized = directMatch.charAt(0).toUpperCase() + directMatch.slice(1);
      translationCache.set(cacheKey, capitalized);
      return { translated: capitalized, sourceLang: 'ar', cached: false, provider: 'dictionary' };
    }
  }

  // 2. Word-by-word / N-gram translation if compound
  const words = trimmed.split(/\s+/);
  if (words.length > 1 && words.length <= 6) {
    let allFound = true;
    const translatedWords: string[] = [];

    for (const w of words) {
      if (detectedSource === 'en' && targetLang === 'ar') {
        const tr = DICTIONARY_EN_TO_AR[w.toLowerCase()];
        if (tr) {
          translatedWords.push(tr);
        } else {
          allFound = false;
          break;
        }
      } else {
        const tr = DICTIONARY_AR_TO_EN[normalizeArabic(w)];
        if (tr) {
          translatedWords.push(tr);
        } else {
          allFound = false;
          break;
        }
      }
    }

    if (allFound && translatedWords.length > 0) {
      const combined = translatedWords.join(' ');
      translationCache.set(cacheKey, combined);
      return { translated: combined, sourceLang: detectedSource, cached: false, provider: 'dictionary' };
    }
  }

  // 3. Fallback to Gemini if API key is configured
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Translate the following ${detectedSource === 'en' ? 'English' : 'Arabic'} phrase accurately to ${
        targetLang === 'ar' ? 'modern Arabic (Saudi / GCC retail context)' : 'natural professional English'
      }. Return ONLY the direct translation, nothing else.\nText: "${trimmed}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const aiTranslation = response.text?.trim().replace(/^["']|["']$/g, '');
      if (aiTranslation) {
        translationCache.set(cacheKey, aiTranslation);
        return { translated: aiTranslation, sourceLang: detectedSource, cached: false, provider: 'ai' };
      }
    } catch (err) {
      console.warn('[Server Translator] Gemini translation fallback failed:', err);
    }
  }

  // 4. Default graceful fallback: Return original text
  return {
    translated: trimmed,
    sourceLang: detectedSource,
    cached: false,
    provider: 'fallback',
  };
}

/**
 * Translate an array of strings in parallel
 */
export async function translateBatch(
  texts: string[],
  targetLang: 'ar' | 'en',
  sourceLang?: 'ar' | 'en'
): Promise<string[]> {
  if (!Array.isArray(texts)) return [];
  const results = await Promise.all(
    texts.map((t) => translateText(t, targetLang, sourceLang).then((r) => r.translated))
  );
  return results;
}

/**
 * Translate entire invoice payload (items, customer details, notes, payment method)
 */
export async function translateInvoicePayload(
  invoice: any,
  targetLang: 'ar' | 'en'
): Promise<any> {
  if (!invoice || typeof invoice !== 'object') return invoice;

  const translatedInvoice = { ...invoice };

  // Translate customer name if present and generic
  if (translatedInvoice.customer_name) {
    const custTr = await translateText(translatedInvoice.customer_name, targetLang);
    translatedInvoice.customer_name = custTr.translated;
  }

  // Translate notes
  if (translatedInvoice.notes) {
    const notesTr = await translateText(translatedInvoice.notes, targetLang);
    translatedInvoice.notes = notesTr.translated;
  }

  // Translate payment method label
  if (translatedInvoice.payment_method) {
    const pm = translatedInvoice.payment_method.toLowerCase();
    if (targetLang === 'ar') {
      translatedInvoice.payment_method_label =
        pm === 'card' ? 'بطاقة' : pm === 'cash' ? 'نقداً' : pm === 'online' ? 'دفع إلكتروني' : pm;
    } else {
      translatedInvoice.payment_method_label =
        pm === 'card' ? 'Card' : pm === 'cash' ? 'Cash' : pm === 'online' ? 'Online Payment' : pm;
    }
  }

  // Translate items array
  if (Array.isArray(translatedInvoice.items)) {
    translatedInvoice.items = await Promise.all(
      translatedInvoice.items.map(async (item: any) => {
        const itemCopy = { ...item };
        if (itemCopy.item_name) {
          const nameTr = await translateText(itemCopy.item_name, targetLang);
          itemCopy.item_name = nameTr.translated;
        }
        if (itemCopy.category) {
          const catTr = await translateText(itemCopy.category, targetLang);
          itemCopy.category = catTr.translated;
        }
        return itemCopy;
      })
    );
  }

  return translatedInvoice;
}
