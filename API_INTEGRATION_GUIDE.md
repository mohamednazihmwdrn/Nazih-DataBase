# دليل التكامل والتوثيق التقني لمطوري التطبيقات الخارجية
## StorePulse / Nazih Core - Independent SaaS Database & Sync Engine

هذا المستند التقني موجه لمطوري الأنظمة الخارجية (تطبيقات الموبايل عبر Flutter أو React Native أو Swift، أنظمة الكاشير ونقاط البيع POS Desktop/Web، ومواقع التجارة الإلكترونية، والألعاب). يوضح المستند بالتفصيل كيفية الحصول على مفتاح الربط وتأمينه، وتنفيذ عمليات المصادقة، وإرسال البيانات (Data Ingestion) بصورة ذرية وسريعة.

---

## 1. الفلسفة المعمارية للربط (Architecture Overview)

يعمل السيرفر كـ **محرك بيانات ومزامنة لحظي مستقل (Self-Hosted Data Engine)** يتميز بما يلي:
1. **معاملات ذرية (ACID Transactions):** لا توجد كتابة جزئية؛ إما أن تسجل الفاتورة وبنودها والمخزون معاً أو يتم رفض العملية دون تلف البيانات.
2. **استجابة فائقة السرعة (< 1.5ms):** استخدام SQLite في وضع `WAL` (Write-Ahead Logging) مع قفل مؤقت حصري وسريع جداً.
3. **مصادقة مشفرة غير مركزية:** استخدام مفاتيح وصول مشفرة بصيغة `sk_live_...` مربوطة بمعرف متجر `store_id` ومعدل طلبات محدد (Rate Limit).
4. **بث لحظي مباشر:** بمجرد استلام البيانات على الـ API، يتم بثها فوراً عبر WebSocket و Server-Sent Events (SSE) إلى شاشات الإدارة.

---

## 2. كيفية توليد والحصول على الـ API Key

لربط أي متجر أو تطبيق، يجب إنشاء سجل عميل/متجر وإصدار مفتاح مشفر:

### الخطوات من لوحة التحكم:
1. افتح القائمة الجانبية للنظام ثم اختر **«مولد المفاتيح والتراخيص» (Key Generator)** أو **«بوابات المتاجر والعملاء» (Client Portals)**.
2. أدخل بيانات المتجر:
   - **معرف المتجر الفريد (Store ID):** مثل `STORE_CAIRO_01` أو `APP_FRANCHISE_12`.
   - **اسم المتجر / الشركة:** مثل `شركة الهدى للتجارة`.
   - **البريد الإلكتروني ورقم الهاتف.**
   - **فترة الصلاحية ومعدل الطلبات المسموح (Rate Limit):** مثل `200 طلب / دقيقة`.
3. اضغط **«توليد وإصدار مفتاح الربط المشفر الآن»**.
4. ستحصل على مفتاح وصول على الصيغة:
   ```text
   sk_live_storec_8f9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c
   ```
> ⚠️ **ملاحظة أمنية هامة:** المفتاح يمنح صلاحية الكتابة والقراءة لبيانات هذا المتجر فقط. لا تشارك المفتاح في مستودعات Git عامة أو تضعه في الواجهات الأمامية المكشوفة للمتصفح.

---

## 3. طريقة تنفيذ عمليات المصادقة (Authentication)

تتم المصادقة عبر إضافة ترويسة (Header) واحدة في جميع طلبات الـ HTTP:

```http
x-api-key: sk_live_storec_8f9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c
```
أو عبر الـ Bearer Token القياسي:
```http
Authorization: Bearer sk_live_storec_8f9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c
```

### معالجة ردود المصادقة:
- **`200 OK` / `201 Created`:** تم قبول الطلب وتنفيذه بنجاح.
- **`401 Unauthorized`:** المفتاح مفقود أو غير مسجل في السيرفر.
- **`403 Forbidden`:** المتجر معطل مؤقتاً أو ترخيصه منتهي الصلاحية.
- **`429 Too Many Requests`:** تجاوز التطبيق عدد الطلبات المسموح بها في الدقيقة (Rate Limit).

---

## 4. مسارات إرسال البيانات (Data Ingestion Endpoints)

### أ) إرسال فاتورة أو معاملة مبيعات (POST /api/invoices)

يستخدم هذا المسار لتسجيل الفواتير المباشرة من أجهزة الكاشير أو تطبيقات الموبايل.

#### عنوان الطلب:
```http
POST /api/invoices
Content-Type: application/json
x-api-key: sk_live_storec_...
```

#### جسم الطلب (JSON Body):
```json
{
  "invoice_number": "INV-2026-00921",
  "customer_name": "محمد حسن",
  "customer_phone": "+201012345678",
  "payment_method": "card",
  "items": [
    {
      "item_name": "قهوة كورتادو",
      "category": "مشروبات ساخنة",
      "quantity": 2,
      "unit_price": 4.50,
      "total_price": 9.00
    },
    {
      "item_name": "ساندوتش تركي وجبن",
      "category": "مأكولات خفيفة",
      "quantity": 1,
      "unit_price": 6.50,
      "total_price": 6.50
    }
  ],
  "tax": 1.55,
  "discount": 0.00,
  "notes": "الطلب سفري - كاشير 1"
}
```

#### استجابة السيرفر عند النجاح (Success Response):
```json
{
  "success": true,
  "message": "Invoice ingested and committed in single atomic transaction",
  "invoice_id": "inv_a83f91",
  "invoice_number": "INV-2026-00921",
  "total_amount": 17.05,
  "processing_time_ms": 1.15
}
```

---

### ب) المزامنة الجماعية بدون إنترنت (POST /api/sync/batch)

في حال انقطاع اتصال الإنترنت لدى جهاز الكاشير أو الهاتف، يقوم التطبيق بتسجيل العمليات محلياً (مثلاً في SQLite داخل التطبيق)، وعند عودة الاتصال يرسل حزمة واحدة مجمعة (Batch Ingest). السيرفر يتعامل معها بـ **Idempotency** بحيث يتجاهل أي عملية مكررة برقم `operation_id`.

#### عنوان الطلب:
```http
POST /api/sync/batch
Content-Type: application/json
x-api-key: sk_live_storec_...
```

#### جسم الطلب:
```json
{
  "device_id": "pos_terminal_03",
  "mutations": [
    {
      "operation_id": "op_uuid_8923746182",
      "action": "INSERT",
      "table": "invoices",
      "data": {
        "invoice_number": "OFFLINE-001",
        "customer_name": "عميل نقدي",
        "payment_method": "cash",
        "items": [
          { "item_name": "مياه معدنية", "quantity": 1, "unit_price": 1.0, "total_price": 1.0 }
        ]
      },
      "client_timestamp": 1726239100000
    }
  ]
}
```

---

## 5. أمثلة برمجية متعددة اللغات (SDK Examples)

### 1. Flutter / Dart (Mobile & Desktop)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class StorePulseClient {
  final String baseUrl;
  final String apiKey;

  StorePulseClient({required this.baseUrl, required this.apiKey});

  Future<Map<String, dynamic>> sendInvoice({
    required String invoiceNumber,
    required String customerName,
    required List<Map<String, dynamic>> items,
    String paymentMethod = 'cash',
    double tax = 0.0,
    double discount = 0.0,
  }) async {
    final url = Uri.parse('$baseUrl/api/invoices');
    
    final payload = {
      'invoice_number': invoiceNumber,
      'customer_name': customerName,
      'payment_method': paymentMethod,
      'items': items,
      'tax': tax,
      'discount': discount,
      'created_at': DateTime.now().toIso8601String(),
    };

    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: jsonEncode(payload),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(response.body);
    } else {
      throw Exception('خطأ من السيرفر (${response.statusCode}): ${response.body}');
    }
  }
}
```

---

### 2. TypeScript / JavaScript (Node.js, React, React Native, Electron)

```typescript
export interface InvoiceItem {
  item_name: string;
  category?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface IngestInvoiceOptions {
  serverUrl: string;
  apiKey: string;
  invoiceNumber: string;
  customerName?: string;
  items: InvoiceItem[];
  paymentMethod?: 'cash' | 'card' | 'online';
  tax?: number;
  discount?: number;
}

export async function ingestInvoice(opts: IngestInvoiceOptions) {
  const endpoint = `${opts.serverUrl.replace(/\/$/, '')}/api/invoices`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
    },
    body: JSON.stringify({
      invoice_number: opts.invoiceNumber,
      customer_name: opts.customerName,
      payment_method: opts.paymentMethod || 'cash',
      items: opts.items,
      tax: opts.tax || 0,
      discount: opts.discount || 0,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Failed with status ${response.status}`);
  }

  return data;
}
```

---

### 3. C# (.NET / WinForms / WPF / Unity POS)

```csharp
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class StorePulseService
{
    private readonly HttpClient _httpClient = new HttpClient();
    private readonly string _serverUrl;
    private readonly string _apiKey;

    public StorePulseService(string serverUrl, string apiKey)
    {
        _serverUrl = serverUrl.TrimEnd('/');
        _apiKey = apiKey;
    }

    public async Task<bool> IngestInvoiceAsync(object invoicePayload)
    {
        var requestUrl = $"{_serverUrl}/api/invoices";
        var json = JsonSerializer.Serialize(invoicePayload);
        
        var request = new HttpRequestMessage(HttpMethod.Post, requestUrl)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("x-api-key", _apiKey);

        var response = await _httpClient.SendAsync(request);
        var responseContent = await response.Content.ReadAsStringAsync();

        if (response.IsSuccessStatusCode)
        {
            Console.WriteLine($"[StorePulse] النجاح: {responseContent}");
            return true;
        }

        Console.WriteLine($"[StorePulse] خطأ: {response.StatusCode} - {responseContent}");
        return false;
    }
}
```

---

### 4. Python (Django / FastAPI / Odoo Integration / Scripts)

```python
import requests

def send_invoice_to_server(server_url: str, api_key: str, invoice_data: dict):
    endpoint = f"{server_url.rstrip('/')}/api/invoices"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
    }
    
    response = requests.post(endpoint, json=invoice_data, headers=headers)
    if response.status_code in (200, 201):
        return response.json()
    else:
        raise Exception(f"HTTP {response.status_code}: {response.text}")
```

---

### 5. cURL (تجربة سريعة من سطر الأوامر)

```bash
curl -X POST https://YOUR_SERVER_DOMAIN/api/invoices \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_live_storec_YOUR_GENERATED_KEY" \
  -d '{
    "invoice_number": "INV-TEST-001",
    "customer_name": "تجربة اتصال عبر cURL",
    "payment_method": "cash",
    "items": [
      {
        "item_name": "باقة اشتراك سنوي",
        "quantity": 1,
        "unit_price": 100.0,
        "total_price": 100.0
      }
    ]
  }'
```

---

## 6. أفضل الممارسات البرمجية الموصى بها (Best Practices)

1. **إعادة المحاولة التلقائية (Exponential Backoff):** في حال حدوث انقطاع مؤقت في الشبكة، يفضل إعادة المحاولة بعد `1s`, `2s`, `4s`.
2. **استخدام معرّفات فريدة (Idempotency):** تأكد دائماً من توليد `invoice_number` فريد لكل فاتورة من جهة التطبيق لمنع تكرار الحسابات المحاسبية.
3. **الاستماع للتحديثات عبر WebSockets:** إذا كان تطبيقك يحتاج إلى معرفة تحديثات الفواتير فور حدوثها على أجهزة أخرى، افتح اتصال WebSocket بالمسار `/` واستمع للأحداث من نوع `NEW_INVOICE`.
4. **مزامنة التوقيت:** استخدم توقيت UTC أو ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`) لضمان مطابقة السجلات في التقارير المحاسبية.
