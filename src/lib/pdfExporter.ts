import { InvoiceRecord, ClientRecord } from '../types';

/**
 * Utility for generating high-definition, printable PDF invoices and sales batch reports.
 * Uses native isolated print rendering with specialized Arabic RTL font styling and PDF print CSS.
 */

export interface ExportPdfOptions {
  storeName?: string;
  storePhone?: string;
  taxNumber?: string;
  commercialRecord?: string;
  currency?: string;
  notes?: string;
  mode?: 'a4' | 'thermal';
}

/**
 * Export a single invoice as a professional printable PDF document
 */
export function exportSingleInvoiceToPdf(
  invoice: InvoiceRecord,
  client?: ClientRecord | null,
  options?: ExportPdfOptions
) {
  const storeName = options?.storeName || client?.name || invoice.store_id || 'متجر StorePulse';
  const taxNumber = options?.taxNumber || '300987654300003';
  const commercialRecord = options?.commercialRecord || '1010987654';
  const currency = options?.currency || '$';
  const mode = options?.mode || 'a4';
  const invoiceDate = new Date(invoice.created_at).toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const paymentLabels: Record<string, string> = {
    cash: 'نقداً (Cash)',
    card: 'بطاقة مدى / ائتمان (Card)',
    online: 'دفع إلكتروني (Online)',
    qr: 'رمز استجابة سريعة (QR)',
    credit: 'آجل / حساب عميل (Credit)',
  };

  const paymentText = paymentLabels[invoice.payment_method] || invoice.payment_method;

  // Build items rows
  const items = invoice.items && invoice.items.length > 0 ? invoice.items : [];
  const itemsHtml =
    items.length > 0
      ? items
          .map(
            (it, idx) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 11px;">${idx + 1}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">
            ${escapeHtml(it.item_name)}
            ${it.category ? `<br><span style="font-size: 10px; font-weight: normal; color: #94a3b8;">${escapeHtml(it.category)}</span>` : ''}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #0f172a;">${it.quantity}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-family: monospace; color: #334155;">${currency}${Number(it.unit_price).toFixed(2)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-family: monospace; font-weight: bold; color: #047857;">${currency}${Number(it.total_price).toFixed(2)}</td>
        </tr>
      `
          )
          .join('')
      : `
        <tr>
          <td colspan="5" style="padding: 18px; text-align: center; color: #94a3b8; font-size: 12px;">
            تفاصيل الأصناف مسجلة بإجمالي ${invoice.item_count} قطع.
          </td>
        </tr>
      `;

  const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>فاتورة ضريبية - ${invoice.invoice_number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      padding: 24px;
      font-size: 12px;
      line-height: 1.5;
    }

    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 36px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }

    .store-brand h1 {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .store-brand p {
      font-size: 11px;
      color: #64748b;
    }

    .invoice-title-badge {
      text-align: left;
    }

    .badge {
      display: inline-block;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 4px 12px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 12px;
      margin-bottom: 6px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .meta-item .label {
      font-size: 10px;
      color: #64748b;
      display: block;
      margin-bottom: 2px;
    }

    .meta-item .value {
      font-weight: 700;
      color: #0f172a;
      font-size: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }

    th {
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      padding: 10px 12px;
      border-bottom: 2px solid #cbd5e1;
    }

    .totals-wrapper {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px dashed #cbd5e1;
    }

    .qr-box {
      border: 1px dashed #cbd5e1;
      padding: 12px;
      border-radius: 10px;
      text-align: center;
      background: #fafafa;
      width: 150px;
    }

    .totals-table {
      width: 280px;
      margin-left: 0;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
      color: #475569;
    }

    .grand-total {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      margin-top: 8px;
      border-top: 2px solid #0f172a;
      font-size: 15px;
      font-weight: 800;
      color: #047857;
    }

    .footer {
      margin-top: 36px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #94a3b8;
    }

    .actions-bar {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e293b;
      padding: 10px 20px;
      border-radius: 30px;
      display: flex;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      z-index: 999;
    }

    .btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 20px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: 0.2s;
    }

    .btn:hover {
      background: #1d4ed8;
    }

    .btn-secondary {
      background: #334155;
    }

    .btn-secondary:hover {
      background: #475569;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .invoice-card {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .actions-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <div class="actions-bar">
    <button class="btn" onclick="window.print()">
      🖨️ طباعة / حفظ بصيغة PDF
    </button>
    <button class="btn btn-secondary" onclick="window.close()">
      ✖ إغلاق النافذة
    </button>
  </div>

  <div class="invoice-card">
    <!-- HEADER -->
    <div class="header">
      <div class="store-brand">
        <h1>${escapeHtml(storeName)}</h1>
        <p>الرقم الضريبي: <span style="font-family: monospace; font-weight: bold;">${taxNumber}</span></p>
        <p>السجل التجاري: <span style="font-family: monospace;">${commercialRecord}</span></p>
        <p>معرف المتجر: <span style="font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${escapeHtml(invoice.store_id)}</span></p>
      </div>
      <div class="invoice-title-badge">
        <div class="badge">فاتورة مبيعات ضريبية مبسطة</div>
        <p style="font-family: monospace; font-size: 13px; font-weight: bold; color: #0f172a; margin-top: 4px;">
          #${escapeHtml(invoice.invoice_number)}
        </p>
        <p style="font-size: 10px; color: #64748b; margin-top: 2px;">
          ${invoiceDate}
        </p>
      </div>
    </div>

    <!-- META SUMMARY -->
    <div class="meta-grid">
      <div class="meta-item">
        <span class="label">اسم العميل:</span>
        <span class="value">${escapeHtml(invoice.customer_name || 'عميل نقدي')}</span>
      </div>
      <div class="meta-item">
        <span class="label">طريقة الدفع:</span>
        <span class="value">${paymentText}</span>
      </div>
      <div class="meta-item">
        <span class="label">حالة الفاتورة:</span>
        <span class="value" style="color: #047857;">مكتملة ومؤكدة (ACID)</span>
      </div>
      <div class="meta-item">
        <span class="label">معرف المعاملة الفريد:</span>
        <span class="value" style="font-family: monospace; font-size: 10px;">${invoice.id.substring(0, 16)}...</span>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <table>
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">#</th>
          <th style="text-align: right;">الصنف والوصف</th>
          <th style="width: 80px; text-align: center;">الكمية</th>
          <th style="width: 100px; text-align: left;">سعر الوحدة</th>
          <th style="width: 110px; text-align: left;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <!-- TOTALS & QR -->
    <div class="totals-wrapper">
      <div class="qr-box">
        <div style="font-size: 28px; line-height: 1; margin-bottom: 4px;">🏁</div>
        <div style="font-size: 9px; font-weight: bold; color: #334155;">رمز التحقق الرقمي</div>
        <div style="font-size: 8px; font-family: monospace; color: #94a3b8; word-break: break-all; margin-top: 4px;">
          ${invoice.id.substring(0, 20)}
        </div>
      </div>

      <div class="totals-table">
        <div class="totals-row">
          <span>المجموع الفرعي (Subtotal):</span>
          <span style="font-family: monospace;">${currency}${Number(invoice.subtotal || invoice.total_amount).toFixed(2)}</span>
        </div>
        <div class="totals-row">
          <span>ضريبة القيمة المضافة (15% VAT):</span>
          <span style="font-family: monospace;">${currency}${Number(invoice.tax || 0).toFixed(2)}</span>
        </div>
        ${
          invoice.discount > 0
            ? `<div class="totals-row" style="color: #b91c1c;">
                <span>الخصم المطبق (Discount):</span>
                <span style="font-family: monospace;">-${currency}${Number(invoice.discount).toFixed(2)}</span>
              </div>`
            : ''
        }
        <div class="grand-total">
          <span>الإجمالي النهائي:</span>
          <span style="font-family: monospace;">${currency}${Number(invoice.total_amount).toFixed(2)}</span>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div>تم إصدار هذه الفاتورة إلكترونياً بواسطة نظام StorePulse & Nazih Core Engine</div>
      <div style="font-family: monospace;">معاملة آمنة وموثوقة • النسخة الرسمية للأرشفة</div>
    </div>
  </div>

  <script>
    // Auto-trigger print dialog after small render timeout
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 400);
    });
  </script>
</body>
</html>
  `;

  openPrintWindow(htmlContent, `Invoice_${invoice.invoice_number}`);
}

/**
 * Export Batch Invoices Report as an Audit PDF
 */
export function exportBatchInvoicesReportToPdf(
  invoices: InvoiceRecord[],
  options?: {
    storeName?: string;
    dateRangeLabel?: string;
    filterLabel?: string;
    currency?: string;
  }
) {
  const storeName = options?.storeName || 'جميع المتاجر الموحدة';
  const dateRangeLabel = options?.dateRangeLabel || 'كامل الفترة';
  const currency = options?.currency || '$';
  const totalRevenue = invoices.reduce((acc, inv) => acc + (inv.total_amount || 0), 0);
  const totalTax = invoices.reduce((acc, inv) => acc + (inv.tax || 0), 0);
  const totalItems = invoices.reduce((acc, inv) => acc + (inv.item_count || 0), 0);

  const rowsHtml = invoices
    .map(
      (inv, idx) => `
    <tr>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b;">${idx + 1}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #1e293b;">${escapeHtml(inv.invoice_number)}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; color: #475569;">${escapeHtml(inv.store_id)}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; color: #334155;">${escapeHtml(inv.customer_name || 'عميل نقدي')}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${escapeHtml(inv.payment_method)}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${inv.item_count}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-family: monospace; font-weight: bold; color: #047857;">${currency}${Number(inv.total_amount).toFixed(2)}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">${new Date(inv.created_at).toLocaleDateString('ar-EG')}</td>
    </tr>
  `
    )
    .join('');

  const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>تقرير مبيعات وأرشيف الفواتير - ${escapeHtml(storeName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', system-ui, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      padding: 24px;
      font-size: 12px;
    }
    .report-card {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f1f5f9;
      padding: 14px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .kpi-item .label { font-size: 10px; color: #64748b; }
    .kpi-item .val { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 11px; }
    th {
      background: #e2e8f0;
      color: #334155;
      padding: 8px 10px;
      font-weight: 700;
      border-bottom: 2px solid #cbd5e1;
    }
    .actions-bar {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e293b;
      padding: 10px 20px;
      border-radius: 30px;
      display: flex;
      gap: 12px;
      z-index: 999;
    }
    .btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 20px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .report-card { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .actions-bar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="actions-bar">
    <button class="btn" onclick="window.print()">🖨️ طباعة التقرير / حفظ كـ PDF</button>
    <button class="btn" style="background: #475569;" onclick="window.close()">✖ إغلاق</button>
  </div>

  <div class="report-card">
    <div class="header">
      <div>
        <h1 style="font-size: 18px; font-weight: 800; color: #0f172a;">سجل مبيعات وأرشيف الفواتير المعتمد</h1>
        <p style="font-size: 11px; color: #64748b;">النطاق: ${escapeHtml(storeName)} • المدة: ${escapeHtml(dateRangeLabel)}</p>
      </div>
      <div style="text-align: left; font-size: 10px; color: #64748b;">
        <div>تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</div>
        <div style="font-weight: bold; color: #2563eb; margin-top: 2px;">نظام StorePulse Enterprise</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-item">
        <div class="label">إجمالي عدد الفواتير</div>
        <div class="val">${invoices.length.toLocaleString()} فاتورة</div>
      </div>
      <div class="kpi-item">
        <div class="label">إجمالي الإيرادات</div>
        <div class="val" style="color: #047857;">${currency}${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-item">
        <div class="label">إجمالي الضرائب (VAT)</div>
        <div class="val">${currency}${totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-item">
        <div class="label">إجمالي القطع المباعة</div>
        <div class="val">${totalItems.toLocaleString()} صنف</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 30px; text-align: center;">#</th>
          <th style="text-align: right;">رقم الفاتورة</th>
          <th style="text-align: right;">المتجر</th>
          <th style="text-align: right;">العميل</th>
          <th style="text-align: right;">طريقة الدفع</th>
          <th style="text-align: center;">الأصناف</th>
          <th style="text-align: left;">المبلغ</th>
          <th style="text-align: right;">التاريخ</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
      <div>تقرير رسمي صادر من محرك قواعد بيانات SQLite المقاوم للأعطال</div>
      <div>صفحة 1 من 1 • توقيع المحاسب القانوني / مدير النظام: ____________________</div>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => { window.print(); }, 400);
    });
  </script>
</body>
</html>
  `;

  openPrintWindow(htmlContent, `Sales_Report_${Date.now()}`);
}

function openPrintWindow(html: string, title: string) {
  const printWindow = window.open('', '_blank', 'width=900,height=800,menubar=no,toolbar=no,location=no');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = title;
  } else {
    // Fallback if popup blocked: render hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
