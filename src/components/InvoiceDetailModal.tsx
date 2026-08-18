import React from 'react';
import { X, Receipt, CheckCircle, Clock } from 'lucide-react';
import { InvoiceRecord } from '../types';

interface InvoiceDetailModalProps {
  invoice: InvoiceRecord | null;
  onClose: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoice, onClose }) => {
  if (!invoice) return null;

  let rawJson = '';
  try {
    rawJson = invoice.raw_payload
      ? JSON.stringify(JSON.parse(invoice.raw_payload), null, 2)
      : JSON.stringify(invoice, null, 2);
  } catch (e) {
    rawJson = JSON.stringify(invoice, null, 2);
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 text-right">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="font-mono">{invoice.invoice_number}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                  {invoice.store_id}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                المعرف: {invoice.id} • {new Date(invoice.created_at).toLocaleString('ar-EG')}
              </p>
            </div>
          </div>

          <button
            id="close-invoice-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* METRICS SUMMARY ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block">العميل</span>
            <span className="font-semibold text-slate-900 truncate block">
              {invoice.customer_name || 'عميل نقدي'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">طريقة الدفع</span>
            <span className="font-semibold text-slate-900">
              {invoice.payment_method === 'card' ? 'بطاقة' : invoice.payment_method === 'cash' ? 'نقداً' : invoice.payment_method === 'online' ? 'إلكتروني' : invoice.payment_method}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">الضريبة / الخصم</span>
            <span className="font-sans text-slate-700">
              ${invoice.tax.toFixed(2)} / -${invoice.discount.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">المبلغ الإجمالي</span>
            <span className="font-bold text-emerald-700 font-sans text-sm">
              ${invoice.total_amount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* LINE ITEMS TABLE */}
        <div className="flex-1 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>الأصناف المسجلة في الفاتورة ({invoice.items?.length || invoice.item_count})</span>
            <span className="text-emerald-600 font-sans text-[10px] flex items-center font-bold gap-1">
              <CheckCircle className="w-3 h-3" /> معاملة ذرية مكتملة (Single TX)
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">اسم الصنف</th>
                  <th className="py-2.5 px-3">التصنيف</th>
                  <th className="py-2.5 px-3 text-left">الكمية</th>
                  <th className="py-2.5 px-3 text-left">سعر الوحدة</th>
                  <th className="py-2.5 px-3 text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-900 font-medium">{it.item_name}</td>
                      <td className="py-2 px-3 text-[11px] text-slate-500">{it.category || 'عام'}</td>
                      <td className="py-2 px-3 text-left text-slate-800 font-bold">{it.quantity}</td>
                      <td className="py-2 px-3 text-left text-slate-600">${it.unit_price.toFixed(2)}</td>
                      <td className="py-2 px-3 text-left font-bold text-emerald-700">
                        ${it.total_price.toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400 font-sans">
                      تم تسجيل {invoice.item_count} أصناف في ملخص الفاتورة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RAW JSON INGESTION PAYLOAD */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>حمولة البيانات الأصلية (Raw JSON)</span>
            <span className="text-[10px] text-slate-500 font-mono" dir="ltr">POST /api/invoices</span>
          </div>
          <pre className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-800 max-h-32 overflow-y-auto select-all" dir="ltr">
            {rawJson}
          </pre>
        </div>

        {/* FOOTER */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center text-xs text-slate-500 font-sans gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>معاملة مطابقة لمعايير ACID ومحفوظة بنجاح</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            إغلاق المعاينة
          </button>
        </div>

      </div>
    </div>
  );
};
