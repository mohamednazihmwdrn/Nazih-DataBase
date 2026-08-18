import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Smartphone,
  Globe,
  Terminal,
  Server,
  Layers,
  Sparkles,
  Zap,
  Radio,
  FileCode,
  ShieldCheck,
} from 'lucide-react';
import { ClientRecord } from '../types';

interface IntegrationHubProps {
  clients: ClientRecord[];
}

export const IntegrationHub: React.FC<IntegrationHubProps> = ({ clients }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<
    'flutter' | 'javascript' | 'python' | 'csharp' | 'php' | 'curl' | 'websocket'
  >('flutter');
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    clients.length > 0 ? clients[0].store_id : 'STORE_CLIENT_01'
  );
  const [copied, setCopied] = useState<boolean>(false);

  const activeClient =
    clients.find((c) => c.store_id === selectedStoreId) ||
    (clients.length > 0
      ? clients[0]
      : {
          store_id: 'STORE_REAL_01',
          name: 'متجر العميل الجديد',
          api_key: 'sk_live_mndb_7823947823947823',
        });

  const serverOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://api.nazihdb.com';
  const wsOrigin = serverOrigin.replace(/^http/, 'ws');
  const apiKey = activeClient.api_key;
  const storeId = activeClient.store_id;

  // Production-Ready SDK Snippets for Nazih Core / MNDB
  const codeSnippets: Record<string, { title: string; filename: string; code: string; desc: string }> = {
    flutter: {
      title: 'Flutter / Dart (تطبيقات الموبايل Android & iOS)',
      filename: 'nazih_core_service.dart',
      desc: 'كود كامل جاهز للنسخ في مشروع فلاتر لإرسال فواتير نقاط البيع مباشرة لمحرك Nazih Core.',
      code: `import 'dart:convert';
import 'package:http/http.dart' as http;

/// محرك مزامنة البيانات - Nazih Core (MNDB Engine)
class NazihCoreService {
  static const String serverUrl = '$serverOrigin/api/invoices';
  static const String apiKey = '$apiKey';
  static const String storeId = '$storeId';

  /// إرسال فاتورة جديدة إلى السيرفر في معاملة ذرية واحدة (ACID Transaction)
  static Future<bool> sendInvoice({
    required String invoiceNumber,
    String? customerName,
    String paymentMethod = 'card',
    required List<Map<String, dynamic>> items,
    double tax = 0.0,
    double discount = 0.0,
    String? notes,
  }) async {
    try {
      final response = await http.post(
        Uri.parse(serverUrl),
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: jsonEncode({
          'store_id': storeId,
          'invoice_number': invoiceNumber,
          'customer_name': customerName ?? 'عميل نقدي',
          'payment_method': paymentMethod,
          'tax': tax,
          'discount': discount,
          'items': items,
          'notes': notes ?? 'فاتورة نقطة بيع POS',
          'timestamp': DateTime.now().toIso8601String(),
        }),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        print('✅ [Nazih Core] تم استلام وحفظ الفاتورة بنجاح: \${response.body}');
        return true;
      } else {
        print('❌ [Nazih Core] خطأ في الإرسال: \${response.statusCode} - \${response.body}');
        return false;
      }
    } catch (e) {
      print('⚠️ [Nazih Core] تعذر الاتصال بالسيرفر: \$e');
      return false;
    }
  }
}

// مثال للاستخدام داخل التطبيق:
void main() async {
  final success = await NazihCoreService.sendInvoice(
    invoiceNumber: 'INV-2026-001',
    customerName: 'عميل حقيقي',
    paymentMethod: 'card',
    items: [
      {
        'item_name': 'منتج رقم 1',
        'category': 'مبيعات',
        'quantity': 1,
        'unit_price': 15.00,
        'total_price': 15.00,
      }
    ],
    tax: 1.20,
  );
}`,
    },
    javascript: {
      title: 'JavaScript / TypeScript / React / Node.js',
      filename: 'nazihCoreClient.ts',
      desc: 'عميل JS/TS متكامل لإرسال المعاملات والفواتير مع التحقق والتأمين.',
      code: `// nazihCoreClient.ts
export interface InvoiceItem {
  item_name: string;
  category?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface InvoicePayload {
  invoice_number: string;
  customer_name?: string;
  payment_method?: 'cash' | 'card' | 'online' | 'qr';
  items: InvoiceItem[];
  tax?: number;
  discount?: number;
  notes?: string;
}

const SERVER_URL = '${serverOrigin}/api/invoices';
const API_KEY = '${apiKey}';
const STORE_ID = '${storeId}';

export async function sendInvoiceToNazihCore(invoice: InvoicePayload) {
  try {
    const res = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        store_id: STORE_ID,
        ...invoice,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || \`HTTP error! status: \${res.status}\`);
    }

    const data = await res.json();
    console.log('✅ [Nazih Core] تم تسجيل الفاتورة بنجاح:', data);
    return data;
  } catch (error) {
    console.error('❌ [Nazih Core] فشل إرسال الفاتورة:', error);
    throw error;
  }
}

// مثال للاستخدام:
sendInvoiceToNazihCore({
  invoice_number: 'INV-' + Date.now(),
  customer_name: 'محمد أحمد',
  payment_method: 'card',
  items: [
    { item_name: 'طلب كاشير', category: 'مبيعات', quantity: 1, unit_price: 25.0, total_price: 25.0 },
  ],
  tax: 2.0,
});`,
    },
    python: {
      title: 'Python (Flask, Django, FastAPI, أو أجهزة IoT)',
      filename: 'nazih_core_client.py',
      desc: 'مكتبة بايثون خفيفة لإرسال الفواتير من أجهزة الكاشير أو الخوادم الخلفية.',
      code: `import requests
from datetime import datetime

SERVER_URL = "${serverOrigin}/api/invoices"
API_KEY = "${apiKey}"
STORE_ID = "${storeId}"

def ingest_invoice(invoice_number, items, customer_name="عميل نقدي", payment_method="card", tax=0.0, discount=0.0):
    payload = {
        "store_id": STORE_ID,
        "invoice_number": invoice_number,
        "customer_name": customer_name,
        "payment_method": payment_method,
        "tax": tax,
        "discount": discount,
        "items": items,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
    }
    
    response = requests.post(SERVER_URL, json=payload, headers=headers, timeout=5)
    
    if response.status_code in [200, 201]:
        print("✅ [Nazih Core] تم تخزين الفاتورة بنجاح:", response.json())
        return response.json()
    else:
        print(f"❌ [Nazih Core] خطأ {response.status_code}:", response.text)
        return None

# تجربة الإرسال:
if __name__ == "__main__":
    sample_items = [
        {"item_name": "منتج تجاري", "category": "عام", "quantity": 1, "unit_price": 10.00, "total_price": 10.00}
    ]
    ingest_invoice("INV-PY-1001", sample_items, customer_name="سارة العتيبي", tax=0.80)`,
    },
    csharp: {
      title: 'C# / .NET (برامج الكاشير لسطح المكتب WinForms & WPF)',
      filename: 'NazihCoreClient.cs',
      desc: 'كود C# .NET حديث باستخدام HttpClient غير المتزامن لنقاط البيع المكتبية.',
      code: `using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class NazihCoreClient
{
    private static readonly HttpClient client = new HttpClient();
    private const string ServerUrl = "${serverOrigin}/api/invoices";
    private const string ApiKey = "${apiKey}";
    private const string StoreId = "${storeId}";

    public static async Task<bool> SendInvoiceAsync(string invoiceNum, object itemsList, string customer = "عميل نقدي", double tax = 0.0)
    {
        var payload = new
        {
            store_id = StoreId,
            invoice_number = invoiceNum,
            customer_name = customer,
            payment_method = "card",
            tax = tax,
            discount = 0.0,
            items = itemsList,
            timestamp = DateTime.UtcNow.ToString("o")
        };

        var json = JsonSerializer.Serialize(payload);
        var request = new HttpRequestMessage(HttpMethod.Post, ServerUrl);
        request.Headers.Add("x-api-key", ApiKey);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            var response = await client.SendAsync(request);
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadAsStringAsync();
                Console.WriteLine("✅ [Nazih Core] Ingested successfully: " + result);
                return true;
            }
            Console.WriteLine($"❌ [Nazih Core] Ingestion error: {response.StatusCode}");
            return false;
        }
        catch (Exception ex)
        {
            Console.WriteLine("⚠️ Server connection error: " + ex.Message);
            return false;
        }
    }
}`,
    },
    php: {
      title: 'PHP / Laravel / WooCommerce / WordPress',
      filename: 'nazih_core.php',
      desc: 'دالة PHP cURL متوافقة مع جميع أنظمة إدارة المتاجر الإلكترونية وWordPress.',
      code: `<?php

function send_nazih_core_invoice($invoice_number, $items, $customer_name = 'عميل نقدي', $tax = 0.0) {
    $server_url = '${serverOrigin}/api/invoices';
    $api_key = '${apiKey}';
    $store_id = '${storeId}';

    $payload = [
        'store_id' => $store_id,
        'invoice_number' => $invoice_number,
        'customer_name' => $customer_name,
        'payment_method' => 'online',
        'tax' => (float)$tax,
        'discount' => 0.0,
        'items' => $items,
        'timestamp' => gmdate('Y-m-d\\TH:i:s\\Z')
    ];

    $ch = curl_init($server_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-api-key: ' . $api_key
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code == 200 || $http_code == 201) {
        return json_decode($response, true);
    } else {
        error_log("Nazih Core Ingest Failed [$http_code]: $response");
        return false;
    }
}
?>`,
    },
    curl: {
      title: 'cURL / Bash / REST Client',
      filename: 'send_invoice.sh',
      desc: 'أمر cURL واحد لاختبار إرسال الفواتير مباشرة من الطرفية Terminal.',
      code: `curl -X POST "${serverOrigin}/api/invoices" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '{
    "store_id": "${storeId}",
    "invoice_number": "INV-CURL-001",
    "customer_name": "عميل حقيقي",
    "payment_method": "card",
    "tax": 1.20,
    "discount": 0.0,
    "items": [
      {
        "item_name": "خدمة أو منتج",
        "category": "مبيعات",
        "quantity": 1,
        "unit_price": 20.00,
        "total_price": 20.00
      }
    ],
    "notes": "تم الإرسال إلى سيرفر Nazih Core"
  }'`,
    },
    websocket: {
      title: 'WebSocket Realtime Listener (مستمع البث المباشر)',
      filename: 'nazihSyncListener.js',
      desc: 'استقبال الفواتير والمعاملات فور حدوثها في تطبيقات العميل عبر WebSockets.',
      code: `// WebSocket Live Stream Listener - NazihSync
const wsUrl = '${wsOrigin}/ws';
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  console.log('⚡ [NazihSync] متصل بالبث المباشر للسيرفر 24/7 بنجاح');
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data.type === 'NEW_INVOICE') {
      console.log('🔔 [NazihSync] تم استلام فاتورة جديدة في النظام:', data.payload.invoice);
      // تحديث واجهة المستخدم فورياً
    }
  } catch (err) {
    console.error('خطأ في معالجة رسالة WebSocket:', err);
  }
};

ws.onclose = () => {
  console.log('[NazihSync] انقطع الاتصال بالويب سوكيت، جاري إعادة الاتصال تلقائياً...');
};`,
    },
  };

  const currentSnippet = codeSnippets[selectedLanguage];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentSnippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Code2 className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">مركز ربط التطبيقات والأكواد الجاهزة (Nazih Core SDKs)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            أعطِ هذه الأكواد لأي عميل لربط تطبيقاته (Flutter, React, Python, C#, PHP) بسيرفرك فورياً، مع دمج مفتاح المتجر وعنوان السيرفر تلقائياً!
          </p>
        </div>

        {/* STORE SELECTOR */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-600">المتجر المستهدف:</span>
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
          >
            {clients.length > 0 ? (
              clients.map((c) => (
                <option key={c.id} value={c.store_id}>
                  {c.name} ({c.store_id})
                </option>
              ))
            ) : (
              <option value="STORE_REAL_01">سجل عميلك الحقيقي الأول لتوليد كوده المباشر</option>
            )}
          </select>
        </div>
      </div>

      {/* LANGUAGE SELECTOR PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'flutter', label: 'Flutter / Dart', icon: Smartphone },
          { id: 'javascript', label: 'JavaScript / React', icon: Globe },
          { id: 'python', label: 'Python', icon: Terminal },
          { id: 'csharp', label: 'C# / .NET POS', icon: Server },
          { id: 'php', label: 'PHP / Laravel', icon: Layers },
          { id: 'curl', label: 'cURL / Bash', icon: Terminal },
          { id: 'websocket', label: 'WebSocket البث المباشر', icon: Radio },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = selectedLanguage === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedLanguage(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* CODE VIEWER BOX */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        {/* TOP BAR */}
        <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileCode className="w-5 h-5 text-blue-400" />
            <div>
              <span className="text-xs font-bold text-white font-mono">{currentSnippet.filename}</span>
              <span className="text-[11px] text-slate-400 block font-sans">{currentSnippet.title}</span>
            </div>
          </div>

          <button
            onClick={handleCopyCode}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم نسخ الكود!' : 'نسخ الكود بالكامل'}</span>
          </button>
        </div>

        {/* CODE BLOCK */}
        <div className="p-5 overflow-x-auto max-h-[500px]">
          <pre className="text-xs font-mono text-slate-200 select-all leading-relaxed" dir="ltr">
            {currentSnippet.code}
          </pre>
        </div>

        {/* FOOTER INFO */}
        <div className="bg-slate-950/60 px-5 py-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-sans">
          <span>{currentSnippet.desc}</span>
          <span className="font-mono text-[10px] text-slate-500">Auto-injected: {storeId}</span>
        </div>
      </div>
    </div>
  );
};
