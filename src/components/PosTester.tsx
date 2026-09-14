import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Send,
  CheckCircle,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  Key,
  Clock,
  Terminal,
  Zap,
  Languages,
  RotateCw,
} from 'lucide-react';
import { ClientRecord } from '../types';
import { useLanguage } from '../lib/i18n';

interface PosTesterProps {
  clients: ClientRecord[];
  onInvoiceSent?: () => void;
}

interface CartItem {
  item_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export const PosTester: React.FC<PosTesterProps> = ({ clients, onInvoiceSent }) => {
  const { language, t } = useLanguage();
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>(
    language === 'ar' ? 'عميل نقدي' : 'Cash Customer'
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('card');

  const [cart, setCart] = useState<CartItem[]>([
    {
      item_name: language === 'ar' ? 'قهوة كولد برو كولومبي' : 'Cold Brew Coffee Colombian',
      category: language === 'ar' ? 'مشروبات' : 'Beverages',
      quantity: 2,
      unit_price: 4.75,
      total_price: 9.5,
    },
    {
      item_name: language === 'ar' ? 'كرواسون زبدة فرنسي' : 'French Butter Croissant',
      category: language === 'ar' ? 'مخبوزات' : 'Bakery',
      quantity: 1,
      unit_price: 3.95,
      total_price: 3.95,
    },
  ]);

  const [isSending, setIsSending] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseLatency, setResponseLatency] = useState<number | null>(null);
  const [responseData, setResponseData] = useState<any>(null);
  const [customJson, setCustomJson] = useState<string>('');

  // Auto-select first active client
  useEffect(() => {
    if (clients.length > 0 && !selectedApiKey) {
      const activeClient = clients.find((c) => c.status === 'active') || clients[0];
      setSelectedApiKey(activeClient.api_key);
      setSelectedStoreId(activeClient.store_id);
    }
  }, [clients]);

  // Sync JSON when ticket or fields change
  useEffect(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
    const tax = Number((subtotal * 0.08).toFixed(2));
    const storeTarget = selectedStoreId || (clients.length > 0 ? clients[0].store_id : 'STORE_REAL_01');
    const payload = {
      store_id: storeTarget,
      invoice_number: `INV-${storeTarget.replace(/[^A-Za-z0-9]/g, '').substring(0, 4)}-${Math.floor(
        Math.random() * 90000 + 10000
      )}`,
      customer_name: customerName,
      customer_phone: '+966500000000',
      payment_method: paymentMethod,
      tax: tax,
      discount: 0.0,
      items: cart.map((it) => ({
        item_name: it.item_name,
        category: it.category,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.total_price,
      })),
      notes: language === 'ar' ? 'معاملة تجريبية لنقطة بيع كاشير' : 'POS Cashier simulator test transaction',
      timestamp: new Date().toISOString(),
    };
    setCustomJson(JSON.stringify(payload, null, 2));
  }, [cart, selectedStoreId, customerName, paymentMethod, clients, language]);

  const handleSelectClient = (apiKey: string) => {
    setSelectedApiKey(apiKey);
    const client = clients.find((c) => c.api_key === apiKey);
    if (client) {
      setSelectedStoreId(client.store_id);
    }
  };

  const addItemToCart = (name: string, category: string, price: number) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item_name === name);
      if (existing) {
        return prev.map((i) =>
          i.item_name === name
            ? {
                ...i,
                quantity: i.quantity + 1,
                total_price: Number(((i.quantity + 1) * i.unit_price).toFixed(2)),
              }
            : i
        );
      }
      return [
        ...prev,
        { item_name: name, category, quantity: 1, unit_price: price, total_price: price },
      ];
    });
  };

  const updateQuantity = (name: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.item_name === name) {
            const newQty = i.quantity + delta;
            return newQty > 0
              ? { ...i, quantity: newQty, total_price: Number((newQty * i.unit_price).toFixed(2)) }
              : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Instant server-side translation of the current invoice
  const handleServerTranslateInvoice = async () => {
    setIsTranslating(true);
    try {
      let currentPayload: any;
      try {
        currentPayload = JSON.parse(customJson);
      } catch {
        currentPayload = {
          items: cart,
          notes: 'POS invoice notes',
        };
      }

      const targetLang = language === 'ar' ? 'en' : 'ar';
      const res = await fetch('/api/translate/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: currentPayload,
          targetLang: targetLang,
        }),
      });

      const data = await res.json();
      if (data && data.success && data.translated) {
        setCustomJson(JSON.stringify(data.translated, null, 2));
        if (Array.isArray(data.translated.items)) {
          setCart(data.translated.items);
        }
      }
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const sendInvoice = async () => {
    if (!selectedApiKey) {
      alert(
        language === 'ar'
          ? 'يرجى اختيار أو إدخال مفتاح API Key الخاص بالمتجر'
          : 'Please select or enter the store API Key'
      );
      return;
    }

    let payloadObj: any;
    try {
      payloadObj = JSON.parse(customJson);
    } catch (e) {
      alert(
        language === 'ar'
          ? 'خطأ في صياغة الـ JSON في حقل البيانات'
          : 'Invalid JSON formatting in request body'
      );
      return;
    }

    setIsSending(true);
    setResponseStatus(null);
    setResponseData(null);

    const start = performance.now();
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': selectedApiKey,
        },
        body: JSON.stringify(payloadObj),
      });

      const elapsed = Math.round(performance.now() - start);
      setResponseLatency(elapsed);
      setResponseStatus(res.status);

      const data = await res.json();
      setResponseData(data);

      if (res.ok && onInvoiceSent) {
        onInvoiceSent();
      }
    } catch (err: any) {
      setResponseStatus(500);
      setResponseData({ error: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const tax = Number((subtotal * 0.08).toFixed(2));
  const grandTotal = Number((subtotal + tax).toFixed(2));

  const catalogItems =
    language === 'ar'
      ? [
          { name: 'قهوة كولد برو كولومبي', cat: 'مشروبات', price: 4.75 },
          { name: 'كرواسون زبدة فرنسي', cat: 'مخبوزات', price: 3.95 },
          { name: 'ماتشا لاتيه بحليب الشوفان', cat: 'مشروبات', price: 5.5 },
          { name: 'ساندويتش سلمون مدخن', cat: 'مأكولات', price: 11.5 },
          { name: 'سلطة كينوا بالبروتين', cat: 'مأكولات', price: 9.75 },
          { name: 'كابل شحن سريع USB-C', cat: 'إلكترونيات', price: 14.99 },
        ]
      : [
          { name: 'Cold Brew Coffee Colombian', cat: 'Beverages', price: 4.75 },
          { name: 'French Butter Croissant', cat: 'Bakery', price: 3.95 },
          { name: 'Oat Milk Matcha Latte', cat: 'Beverages', price: 5.5 },
          { name: 'Smoked Salmon Sandwich', cat: 'Food', price: 11.5 },
          { name: 'Quinoa Protein Salad', cat: 'Food', price: 9.75 },
          { name: 'USB-C Fast Charging Cable', cat: 'Electronics', price: 14.99 },
        ];

  return (
    <div className="space-y-6">
      {/* AUTHENTICATION & STORE PICKER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-600" />
              <span>{t.posStep1}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.posStep1Sub}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {clients.length > 0 ? (
              <button
                onClick={() => {
                  const act = clients.find((c) => c.status === 'active') || clients[0];
                  if (act) handleSelectClient(act.api_key);
                }}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold hover:bg-emerald-600 hover:text-white transition cursor-pointer"
              >
                {t.posSelectActiveStore}
              </button>
            ) : (
              <span className="text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
                {language === 'ar' ? 'سجل عميلك الأول لتجربة الإرسال الحي' : 'Register your first store to test ingestion'}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              {t.posSelectActiveStore}:
            </label>
            <select
              id="pos-store-selector"
              value={selectedApiKey}
              onChange={(e) => handleSelectClient(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl text-slate-900 px-3 py-2 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-2xs"
            >
              {clients.length > 0 ? (
                <>
                  <option value="">{t.posManualKey}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.api_key}>
                      {c.name} ({c.store_id})
                    </option>
                  ))}
                </>
              ) : (
                <option value="">{language === 'ar' ? 'لا يوجد متاجر مسجلة بعد' : 'No registered stores yet'}</option>
              )}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">
              {language === 'ar' ? 'ترويسة الأمان:' : 'Security Header:'} <code className="text-blue-600 font-bold font-mono">x-api-key</code>
            </label>
            <input
              type="text"
              id="pos-api-key-input"
              value={selectedApiKey}
              onChange={(e) => setSelectedApiKey(e.target.value)}
              placeholder="sk_live_..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 px-3 py-2 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* POS REGISTER & DYNAMIC PAYLOAD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT: QUICK REGISTER CATALOG (6 COLS) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span>{t.posQuickCatalog}</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              {language === 'ar' ? 'إضافة بنقرة واحدة' : 'One-click add'}
            </span>
          </div>

          {/* CATALOG BUTTONS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {catalogItems.map((prod, idx) => (
              <button
                key={idx}
                onClick={() => addItemToCart(prod.name, prod.cat, prod.price)}
                className="p-3 bg-slate-50 border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 rounded-xl text-start transition group active:scale-95 cursor-pointer shadow-2xs"
              >
                <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">{prod.name}</div>
                <div className="text-[10px] text-slate-500">{prod.cat}</div>
                <div className="text-xs font-bold text-emerald-600 mt-1 font-mono">${prod.price.toFixed(2)}</div>
              </button>
            ))}
          </div>

          {/* TICKET ITEMS */}
          <div className="border-t border-slate-200 pt-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{t.posCartItems}</span>
              <button onClick={() => setCart([])} className="text-[11px] text-slate-500 hover:text-rose-600 font-medium cursor-pointer">
                {t.posClearCart}
              </button>
            </div>

            <div className="space-y-1.5 flex-1 max-h-48 overflow-y-auto pr-1 text-xs">
              {cart.length === 0 ? (
                <div className="text-center py-6 text-slate-400">{t.posEmptyCart}</div>
              ) : (
                cart.map((it) => (
                  <div
                    key={it.item_name}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div className="truncate flex-1 ml-2">
                      <div className="font-bold text-slate-900 truncate text-xs">{it.item_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">${it.unit_price.toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <div className="flex items-center bg-white rounded-lg border border-slate-300 px-1 shadow-2xs">
                        <button
                          onClick={() => updateQuantity(it.item_name, -1)}
                          className="px-1.5 py-0.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-1 text-slate-900 font-bold">{it.quantity}</span>
                        <button
                          onClick={() => updateQuantity(it.item_name, 1)}
                          className="px-1.5 py-0.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-bold text-emerald-700 w-14 text-left">
                        ${it.total_price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* TOTALS */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 mt-3 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>{t.posSubtotal}</span>
                <span className="font-mono text-slate-900 font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>{t.posTax}</span>
                <span className="font-mono text-slate-900 font-semibold">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold pt-1 border-t border-slate-200">
                <span>{t.posGrandTotal}</span>
                <span className="font-mono text-emerald-700 text-sm font-bold">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: JSON INGESTION & DISPATCHER (6 COLS) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-600" />
              <span>{t.posStep3}</span>
            </h3>

            <div className="flex items-center gap-2">
              {/* INSTANT SERVER TRANSLATION BUTTON */}
              <button
                onClick={handleServerTranslateInvoice}
                disabled={isTranslating}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Translate invoice payload instantly using the server engine"
              >
                <Languages className={`w-3.5 h-3.5 ${isTranslating ? 'animate-spin' : ''}`} />
                <span>{isTranslating ? t.posTranslating : (language === 'ar' ? 'ترجمة فورية (EN)' : 'Translate (AR)')}</span>
              </button>

              <button
                id="pos-submit-btn"
                onClick={sendInvoice}
                disabled={isSending}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>{isSending ? t.posSending : t.posSendInvoice}</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5 flex-1 flex flex-col">
            <label className="block text-xs text-slate-500 font-medium">{t.posPayloadLabel}</label>
            <textarea
              id="pos-payload-textarea"
              value={customJson}
              onChange={(e) => setCustomJson(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 h-52 resize-none select-all shadow-2xs"
              dir="ltr"
            />
          </div>

          {/* RESPONSE VIEWER */}
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-500">{t.posServerResponse}</span>
              {responseStatus !== null && (
                <span
                  className={`font-mono px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    responseStatus === 201
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  HTTP {responseStatus} ({responseLatency}ms)
                </span>
              )}
            </div>

            <pre
              id="pos-response-area"
              className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-800 max-h-36 overflow-y-auto select-all"
              dir="ltr"
            >
              {responseData
                ? JSON.stringify(responseData, null, 2)
                : `{ "status": "${t.posWaitingResponse}" }`}
            </pre>
          </div>
        </div>

      </div>

    </div>
  );
};
