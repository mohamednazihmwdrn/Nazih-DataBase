import React, { useState } from 'react';
import {
  BookOpen,
  KeyRound,
  ShieldCheck,
  Send,
  Code2,
  Copy,
  Check,
  Zap,
  Terminal,
  Server,
  Layers,
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ClientRecord } from '../types';

interface ApiDocsPortalProps {
  clients: ClientRecord[];
  onNavigateToKeys: () => void;
  onNavigateToTester: () => void;
}

export const ApiDocsPortal: React.FC<ApiDocsPortalProps> = ({
  clients,
  onNavigateToKeys,
  onNavigateToTester,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCodeLang, setActiveCodeLang] = useState<'flutter' | 'ts' | 'csharp' | 'python' | 'curl'>('flutter');

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://api.storepulse.io';
  const sampleKey = clients.length > 0 ? clients[0].api_key : 'sk_live_storec_8f9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c';
  const sampleStoreId = clients.length > 0 ? clients[0].store_id : 'STORE_CAIRO_01';

  const copyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const codeSnippets: Record<'flutter' | 'ts' | 'csharp' | 'python' | 'curl', { langName: string; filename: string; code: string }> = {
    flutter: {
      langName: 'Flutter / Dart',
      filename: 'storepulse_service.dart',
      code: `import 'dart:convert';
import 'package:http/http.dart' as http;

class StorePulseClient {
  final String baseUrl = '${originUrl}';
  final String apiKey = '${sampleKey}';

  Future<bool> sendInvoice({
    required String invoiceNumber,
    required String customerName,
    required List<Map<String, dynamic>> items,
    String paymentMethod = 'cash',
    double tax = 0.0,
    double discount = 0.0,
  }) async {
    final url = Uri.parse('$baseUrl/api/invoices');
    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: jsonEncode({
        'invoice_number': invoiceNumber,
        'customer_name': customerName,
        'payment_method': paymentMethod,
        'items': items,
        'tax': tax,
        'discount': discount,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      print('✅ تم الحفظ في السيرفر: \${data["invoice_id"]}');
      return true;
    } else {
      print('❌ خطأ: \${response.body}');
      return false;
    }
  }
}`,
    },
    ts: {
      langName: 'TypeScript / Node.js',
      filename: 'ingestClient.ts',
      code: `export async function sendInvoice(invoiceData: {
  invoice_number: string;
  customer_name?: string;
  payment_method: 'cash' | 'card' | 'online';
  items: Array<{ item_name: string; quantity: number; unit_price: number; total_price: number }>;
  tax?: number;
  discount?: number;
}) {
  const response = await fetch('${originUrl}/api/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '${sampleKey}',
    },
    body: JSON.stringify(invoiceData),
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to ingest invoice');
  }

  console.log('✅ المعاملة سُجلت بنجاح:', result.invoice_id);
  return result;
}`,
    },
    csharp: {
      langName: 'C# (.NET / Unity)',
      filename: 'StorePulseApi.cs',
      code: `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

public class StorePulseApi
{
    private static readonly HttpClient client = new HttpClient();
    private const string BaseUrl = "${originUrl}/api/invoices";
    private const string ApiKey = "${sampleKey}";

    public static async Task<bool> IngestInvoiceAsync(string jsonPayload)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, BaseUrl);
        request.Headers.Add("x-api-key", ApiKey);
        request.Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        var response = await client.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();

        if (response.IsSuccessStatusCode)
        {
            Console.WriteLine("Committed atomically: " + responseBody);
            return true;
        }

        Console.WriteLine("Error: " + responseBody);
        return false;
    }
}`,
    },
    python: {
      langName: 'Python 3',
      filename: 'send_invoice.py',
      code: `import requests

SERVER_URL = "${originUrl}/api/invoices"
API_KEY = "${sampleKey}"

payload = {
    "invoice_number": "INV-2026-901",
    "customer_name": "سامح فوزي",
    "payment_method": "card",
    "items": [
        {"item_name": "اشتراك شهري", "quantity": 1, "unit_price": 75.0, "total_price": 75.0}
    ],
    "tax": 10.5,
    "discount": 0.0
}

response = requests.post(
    SERVER_URL,
    headers={
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
    },
    json=payload
)

print(response.status_code, response.json())`,
    },
    curl: {
      langName: 'cURL',
      filename: 'terminal.sh',
      code: `curl -X POST ${originUrl}/api/invoices \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${sampleKey}" \\
  -d '{
    "invoice_number": "INV-001",
    "customer_name": "عميل نقدي",
    "payment_method": "cash",
    "items": [
      { "item_name": "مشروب مثلج", "quantity": 2, "unit_price": 12.5, "total_price": 25.0 }
    ],
    "tax": 3.5,
    "discount": 0.0
  }'`,
    },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold tracking-wide flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                دليل المطورين والربط الخارجي
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono font-semibold">
                REST API v1 + WebSockets
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
              توثيق تكامل التطبيقات والأنظمة الخارجية
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
              شرح شامل ومبسط لكيفية استخراج مفاتيح الـ API، واعتماد ترويسات المصادقة (Auth Headers)، وإرسال معاملات المبيعات والبيانات (Ingest) مع الحفظ الذري (ACID) والتحديث اللحظي عبر الويب سوكت.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              onClick={onNavigateToKeys}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>توليد مفتاح جديد (API Key)</span>
            </button>
            <button
              onClick={onNavigateToTester}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>تجربة الإرسال الحي (Sandbox)</span>
            </button>
          </div>
        </div>
      </div>

      {/* THREE CORE STEPS ARCHITECTURE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* STEP 1 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs relative flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 font-black text-base">
              1
            </div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600" />
              الحصول على API Key
            </h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              يتم إصدار مفتاح مشفر فريد لكل تطبيق أو متجر من تبويب <strong>«مولد المفاتيح والتراخيص»</strong>. المفتاح يحدد صلاحية الوصول وسقف الطلبات (Rate Limit).
            </p>
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 truncate">
              {sampleKey}
            </div>
          </div>
          <button
            onClick={onNavigateToKeys}
            className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer pt-2 border-t border-slate-100"
          >
            <span>انتقل لتوليد التراخيص</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>

        {/* STEP 2 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs relative flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4 font-black text-base">
              2
            </div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              المصادقة (Authentication)
            </h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              يتم تضمين المفتاح في ترويسة الطلب <code>x-api-key</code> أو <code>Authorization: Bearer</code> في كل طلب HTTP يرسله التطبيق إلى السيرفر.
            </p>
            <div className="mt-4 p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] space-y-1">
              <div>x-api-key: {sampleKey.slice(0, 18)}...</div>
              <div className="text-slate-400">Content-Type: application/json</div>
            </div>
          </div>
          <div className="mt-4 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            تشفير وحماية تلقائية لكل متجر
          </div>
        </div>

        {/* STEP 3 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs relative flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 mb-4 font-black text-base">
              3
            </div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-600" />
              إرسال البيانات (Ingest)
            </h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              إرسال مصفوفة الفاتورة وعناصرها عبر طلب <code>POST /api/invoices</code>. يتم الحفظ الذري بأقل من 1.5ms وبث الحدث لحظياً لجميع الشاشات.
            </p>
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 flex items-center justify-between">
              <span className="font-bold text-purple-700">POST</span>
              <span className="truncate text-slate-600">{originUrl}/api/invoices</span>
            </div>
          </div>
          <button
            onClick={onNavigateToTester}
            className="mt-4 text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer pt-2 border-t border-slate-100"
          >
            <span>اختبر إرسال فاتورة الآن</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      </div>

      {/* TECHNICAL SPECIFICATION DETAILS & PAYLOAD FORMAT */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              مواصفات مسار استقبال الفواتير (Invoice Ingestion Spec)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تفاصيل بنية البيانات المقبولة (Payload Schema) وكود الاستجابة
            </p>
          </div>
          <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-mono text-xs font-bold self-start">
            POST /api/invoices
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* JSON PAYLOAD INPUT */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">جسم الطلب المرسل من التطبيق (JSON Body):</span>
              <button
                onClick={() =>
                  copyCode(
                    JSON.stringify(
                      {
                        invoice_number: 'INV-2026-001',
                        customer_name: 'أحمد محمود',
                        customer_phone: '01012345678',
                        payment_method: 'card',
                        items: [
                          {
                            item_name: 'قهوة لاتيه كافيه',
                            category: 'مشروبات',
                            quantity: 2,
                            unit_price: 4.5,
                            total_price: 9.0,
                          },
                          {
                            item_name: 'كرواسون زبدة فرنسي',
                            category: 'مخبوزات',
                            quantity: 1,
                            unit_price: 3.5,
                            total_price: 3.5,
                          },
                        ],
                        tax: 1.88,
                        discount: 0.0,
                        notes: 'طلب سفري طاولة 4',
                      },
                      null,
                      2
                    ),
                    'body-json'
                  )
                }
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                {copiedId === 'body-json' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>نسخ الـ JSON</span>
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 dir-ltr text-left">
{`{
  "invoice_number": "INV-2026-001",
  "customer_name": "أحمد محمود",
  "customer_phone": "01012345678",
  "payment_method": "card", // "cash" | "card" | "online" | "qr"
  "items": [
    {
      "item_name": "قهوة لاتيه كافيه",
      "category": "مشروبات",
      "quantity": 2,
      "unit_price": 4.50,
      "total_price": 9.00
    },
    {
      "item_name": "كرواسون زبدة فرنسي",
      "category": "مخبوزات",
      "quantity": 1,
      "unit_price": 3.50,
      "total_price": 3.50
    }
  ],
  "tax": 1.88,
  "discount": 0.00,
  "notes": "طلب سفري طاولة 4"
}`}
            </pre>
          </div>

          {/* SERVER RESPONSE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">رد السيرفر بعد الحفظ اللحظي (Response 200 OK):</span>
              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>زمن المعالجة ~ 1.2ms</span>
              </span>
            </div>
            <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 dir-ltr text-left">
{`{
  "success": true,
  "message": "Invoice ingested and committed in single atomic transaction",
  "invoice_id": "inv_89af32c1",
  "invoice_number": "INV-2026-001",
  "total_amount": 14.38,
  "processing_time_ms": 1.18
}`}
            </pre>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-blue-800">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                ماذا يحدث فور إرسال هذا الطلب؟
              </p>
              <ul className="list-disc list-inside space-y-1 text-blue-700 text-[11px]">
                <li>يتم فحص صلاحية الـ <code>x-api-key</code> والتأكد من اشتراك المتجر ونشاطه.</li>
                <li>تُسجل الفاتورة وجميع عناصرها داخل معاملة SQLite ACID ذرية.</li>
                <li>يتم إطلاق حدث بث <code>NEW_INVOICE</code> عبر WebSocket و SSE ليظهر في لوحة المدير فورياً.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* CODE SNIPPETS SELECTOR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Code2 className="w-5 h-5 text-indigo-600" />
              أكواد الربط الجاهزة لمختلف المنصات (Copy & Paste SDKs)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              حدد لغة البرمجة المفضلة لديك لنسخ كود الاتصال والإرسال مباشرة في مشروعك
            </p>
          </div>

          {/* TABS */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {(['flutter', 'ts', 'csharp', 'python', 'curl'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveCodeLang(lang)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeCodeLang === lang
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {codeSnippets[lang].langName}
              </button>
            ))}
          </div>
        </div>

        {/* ACTIVE CODE BLOCK */}
        <div className="relative">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-slate-300 rounded-t-xl text-xs font-mono border-b border-slate-700">
            <span>{codeSnippets[activeCodeLang].filename}</span>
            <button
              onClick={() => copyCode(codeSnippets[activeCodeLang].code, activeCodeLang)}
              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[11px] flex items-center gap-1.5 transition cursor-pointer font-sans font-semibold"
            >
              {copiedId === activeCodeLang ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تم النسخ بنجاح!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ الكود بالكامل</span>
                </>
              )}
            </button>
          </div>
          <pre className="bg-slate-950 text-slate-100 p-4 sm:p-5 rounded-b-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 dir-ltr text-left max-h-[450px]">
            {codeSnippets[activeCodeLang].code}
          </pre>
        </div>
      </div>

      {/* OFFLINE FIRST SYNC SECTION */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              دعم العمل أثناء انقطاع الإنترنت (Offline-First Batch Ingest)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              هل يعمل تطبيقك في بيئة ذات اتصال متقطع؟ استخدم مسار الدفعات الجماعي <code>POST /api/sync/batch</code>
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          يمكن لتطبيق الكاشير أو الهاتف تخزين الفواتير في قاعدة بيانات محلية (SQLite أو Hive أو Room) مع إسناد معرف عملية فريد <code>operation_id</code> لكل سجل. وعندما يستعيد الجهاز الاتصال بالإنترنت، يرسل مصفوفة العمليات دفعة واحدة. السيرفر مزود بـ <strong>Idempotency Layer</strong> تضمن عدم تكرار أي فاتورة مرتين أبداً.
        </p>

        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 dir-ltr text-left">
{`POST /api/sync/batch
Headers: { "x-api-key": "${sampleKey}" }
Body: {
  "device_id": "pos_terminal_cairo_01",
  "mutations": [
    {
      "operation_id": "op_983274981",
      "action": "INSERT",
      "table": "invoices",
      "data": { "invoice_number": "OFFLINE-001", "total_amount": 45.0, ... }
    }
  ]
}`}
        </div>
      </div>
    </div>
  );
};
