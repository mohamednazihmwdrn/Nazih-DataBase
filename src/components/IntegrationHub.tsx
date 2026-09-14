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
  Gamepad2,
  Database,
} from 'lucide-react';
import { ClientRecord } from '../types';

interface IntegrationHubProps {
  clients: ClientRecord[];
}

export const IntegrationHub: React.FC<IntegrationHubProps> = ({ clients }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<
    'flutter' | 'offline_sync_flutter' | 'javascript' | 'python' | 'csharp' | 'offline_sync_csharp' | 'unity_game' | 'godot_game' | 'redis_cache' | 'php' | 'curl' | 'websocket'
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
      title: 'Flutter / Dart Realtime Sync (SQLite + WebSocket)',
      filename: 'sync_service.dart',
      desc: 'كود عميل Flutter كامل مع تهيئة SQLite والاستماع المباشر للتحديثات عبر WebSockets.',
      code: `// 1. أضف المكتبات في pubspec.yaml:
// dependencies:
//   flutter:
//     sdk: flutter
//   sqflite: ^2.3.0
//   path: ^1.8.3
//   web_socket_channel: ^2.4.0

import 'dart:async';
import 'dart:convert';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class SyncService {
  // إعدادات العميل والهوية
  final String serverUrl = '${wsOrigin}'; // أو ws://10.0.2.2:3000 لـ Android Emulator
  final String storeId = '${storeId}';
  final String deviceId = 'device_flutter_01';

  Database? _localDb;
  WebSocketChannel? _channel;
  bool _isConnected = false;

  // 1. تهيئة قاعدة البيانات المحلية SQLite
  Future<void> initLocalDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'local_store.db');

    _localDb = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE invoices (
            id TEXT PRIMARY KEY,
            total_amount REAL,
            client_name TEXT,
            updated_at INTEGER
          )
        ''');
      },
    );
    print('💾 تم تجهيز قاعدة البيانات المحلية SQLite بنجاح.');
  }

  // 2. الاتصال بـ WebSocket والمصادقة
  void connectWebSocket() {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(serverUrl));
      _isConnected = true;
      print('✅ تم الاتصال بالسيرفر، جاري إرسال مصادقة المتجر...');

      // إرسال كود المصادقة للاشتراك في بث المتجر
      final authMessage = jsonEncode({
        'type': 'AUTH',
        'store_id': storeId,
        'device_id': deviceId,
      });
      _channel!.sink.add(authMessage);

      // الاستماع للرسائل القادمة من السيرفر
      _channel!.stream.listen(
        (data) {
          _handleIncomingMessage(data);
        },
        onDone: () {
          print('⚠️ انقطع الاتصال بالسيرفر! إعادة المحاولة بعد 3 ثوانٍ...');
          _isConnected = false;
          _reconnect();
        },
        onError: (error) {
          print('❌ خطأ اتصال: $error');
          _isConnected = false;
          _reconnect();
        },
      );
    } catch (e) {
      print('❌ فشل الاتصال: $e');
      _reconnect();
    }
  }

  // إعادة الاتصال التلقائي
  void _reconnect() {
    Timer(const Duration(seconds: 3), () {
      if (!_isConnected) connectWebSocket();
    });
  }

  // 3. معالجة الرسائل القادمة من السيرفر
  void _handleIncomingMessage(dynamic rawData) {
    try {
      final message = jsonDecode(rawData as String);

      if (message['type'] == 'AUTH_OK') {
        print('🔒 تم تأكيد المصادقة: التطبيق جاهز لاستقبال التحديثات اللحظية.');
      } else if (message['type'] == 'REALTIME_UPDATE') {
        print('⚡ استلام تحديث حي من جهاز آخر (\${message['sender_device_id']})');
        final List<dynamic> mutations = message['payload'];
        _applyMutationsToLocalDB(mutations);
      }
    } catch (e) {
      print('❌ خطأ أثناء معالجة الرسالة: $e');
    }
  }

  // 4. تطبيق التحديثات على SQLite المحلية
  Future<void> _applyMutationsToLocalDB(List<dynamic> mutations) async {
    if (_localDb == null) return;

    final batch = _localDb!.batch();

    for (var mutation in mutations) {
      final String table = mutation['table'];
      final String action = mutation['action'];
      final Map<String, dynamic> data = mutation['data'];
      final int clientTimestamp = mutation['client_timestamp'];

      if (table == 'invoices' && (action == 'INSERT' || action == 'UPDATE')) {
        // حفظ أو تحديث فقط إذا كانت البيانات القادمة أحدث من المخزنة محلياً
        batch.rawInsert('''
          INSERT INTO invoices (id, total_amount, client_name, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            total_amount = excluded.total_amount,
            client_name = excluded.client_name,
            updated_at = excluded.updated_at
          WHERE excluded.updated_at > invoices.updated_at
        ''', [
          data['id'],
          data['total_amount'],
          data['client_name'],
          clientTimestamp
        ]);
      }
    }

    await batch.commit(noResult: true);
    print('💾 تم حفظ التحديثات اللحظية في قاعدة بيانات الهاتف.');
  }

  // إغلاق الاتصال عند التدمير
  void dispose() {
    _channel?.sink.close();
    _localDb?.close();
  }
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
      title: 'Node.js + WebSockets + SQLite Listener (البث المباشر والدفع الفوري)',
      filename: 'client_realtime_listener.js',
      desc: 'استقبال الفواتير والمعاملات فور حدوثها في تطبيقات العميل عبر WebSockets وحفظها محلياً في SQLite.',
      code: `const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

// 1. إعدادات العميل وهويته
const SERVER_URL = '${wsOrigin}';
const STORE_ID = '${storeId}';
const DEVICE_ID = 'device_mobile_02'; // معرّف هذا الجهاز الفريد

// 2. فتح الاتصال بقاعدة البيانات المحلية SQLite
const db = new sqlite3.Database('./local_store.db');

// تجهيز الجدول المحلي لضمان وجوده
db.serialize(() => {
    db.run(\`
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            total_amount REAL,
            client_name TEXT,
            updated_at INTEGER
        )
    \`);
});

let ws;

// 3. دالة الاتصال وإعادة الاتصال التلقائي عند انقطاع الشبكة
function connectWebSocket() {
    ws = new WebSocket(SERVER_URL);

    ws.on('open', () => {
        console.log('✅ تم الاتصال بالسيرفر، جاري إرسال مصادقة المتجر...');
        
        // إرسال كود المصادقة للاشتراك في بث المتجر الخاص بنا
        ws.send(JSON.stringify({
            type: 'AUTH',
            store_id: STORE_ID,
            device_id: DEVICE_ID
        }));
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === 'AUTH_OK') {
                console.log('🔒 تم تأكيد المصادقة: الجهاز جاهز لاستقبال التحديثات اللحظية');
            }

            // استقبال التحديثات المباشرة من الأجهزة الأخرى
            if (message.type === 'REALTIME_UPDATE') {
                console.log(\`⚡ استلام تحديث حي من جهاز آخر (\${message.sender_device_id})\`);
                applyMutationsToLocalDB(message.payload);
            }
        } catch (err) {
            console.error('خطأ في قراءة الرسالة:', err);
        }
    });

    ws.on('close', () => {
        console.warn('⚠️ انقطع الاتصال بالسيرفر! إعادة المحاولة بعد 3 ثوانٍ...');
        setTimeout(connectWebSocket, 3000); // إعادة اتصال تلقائية
    });

    ws.on('error', (err) => {
        console.error('خطأ اتصال:', err.message);
        ws.close();
    });
}

// 4. دالة معالجة البيانات وتحديث SQLite المحلية
function applyMutationsToLocalDB(mutations) {
    db.serialize(() => {
        const stmtInsert = db.prepare(\`
            INSERT INTO invoices (id, total_amount, client_name, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                total_amount = excluded.total_amount,
                client_name = excluded.client_name,
                updated_at = excluded.updated_at
            WHERE excluded.updated_at > invoices.updated_at
        \`);

        mutations.forEach((mutation) => {
            const { table, action, data, client_timestamp } = mutation;

            if (table === 'invoices') {
                if (action === 'INSERT' || action === 'UPDATE') {
                    // إدراج أو تحديث فقط إذا كانت البيانات القادمة أحدث من المخزنة محلياً
                    stmtInsert.run(data.id, data.total_amount, data.client_name, client_timestamp);
                    console.log(\`💾 تم حفظ الفاتورة (\${data.id}) في قاعدة البيانات المحلية\`);
                }
            }
        });

        stmtInsert.finalize();
    });
}

// بدء التشغيل
connectWebSocket();`,
    },
    offline_sync_flutter: {
      title: 'Flutter Offline-First Sync (SQLite Queue & Idempotency)',
      filename: 'offline_sync_engine.dart',
      desc: 'محرك متكامل لتطبيق فلاتر يحفظ المعاملات في SQLite محلياً ويرسل الحزم للسيرفر مع حل التعارضات.',
      code: `import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

/// محرك المزامنة غير المتصلة - Nazih Offline-First Engine
class NazihOfflineSyncManager {
  static const String serverUrl = '${serverOrigin}/api/sync/batch';
  static const String apiKey = '${apiKey}';
  static const String storeId = '${storeId}';
  static const String deviceId = 'pos-mobile-cairo-01';

  late Database _db;

  /// 1. تهيئة قاعدة البيانات المحلية وجدول طابور العمليات
  Future<void> initLocalDatabase() async {
    _db = await openDatabase(
      'nazih_pos_local.db',
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE IF NOT EXISTS local_sync_queue (
            operation_id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            target_table TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at INTEGER
          )
        ''');
      },
    );
  }

  /// 2. تسجيل فاتورة أو مستخلص محلياً بسرعة 0ms في وضع عدم الاتصال
  Future<String> recordOfflineInvoice({
    required String invoiceNumber,
    required String customerName,
    required List<Map<String, dynamic>> items,
    String? costCenterCode,
  }) async {
    final operationId = const Uuid().v4(); // UUID v4 لمنع التكرار
    final payload = {
      'invoice_number': invoiceNumber,
      'customer_name': customerName,
      'cost_center_id': costCenterCode,
      'items': items,
      'offline_created_at': DateTime.now().toIso8601String(),
    };

    await _db.insert('local_sync_queue', {
      'operation_id': operationId,
      'action': 'INSERT',
      'target_table': 'invoices',
      'payload_json': jsonEncode(payload),
      'status': 'pending',
      'created_at': DateTime.now().millisecondsSinceEpoch,
    });

    // محاولة المزامنة الفورية إذا توفر الإنترنت
    syncPendingQueueToServer();
    return operationId;
  }

  /// 3. إرسال الحزمة دفعة واحدة للسيرفر وحذف العمليات المتزامنة
  Future<void> syncPendingQueueToServer() async {
    final pendingRecords = await _db.query(
      'local_sync_queue',
      where: 'status = ?',
      whereArgs: ['pending'],
      limit: 50,
    );

    if (pendingRecords.isEmpty) return;

    final List<Map<String, dynamic>> mutations = pendingRecords.map((r) {
      return {
        'operation_id': r['operation_id'],
        'action': r['action'],
        'table': r['target_table'],
        'client_timestamp': r['created_at'],
        'data': jsonDecode(r['payload_json'] as String),
      };
    }).toList();

    try {
      final response = await http.post(
        Uri.parse(serverUrl),
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: jsonEncode({
          'store_id': storeId,
          'device_id': deviceId,
          'mutations': mutations,
        }),
      );

      if (response.statusCode == 200) {
        final result = jsonDecode(response.body);
        if (result['success'] == true) {
          // حذف العمليات التي تمت معالجتها بأمان
          final syncedOps = (result['synced_operations'] as List)
              .map((op) => op['operation_id'] as String)
              .toList();

          for (final opId in syncedOps) {
            await _db.delete('local_sync_queue', where: 'operation_id = ?', whereArgs: [opId]);
          }
          print('✅ [Nazih Core Sync] تم مزامنة \${syncedOps.length} عملية بنجاح وحل التعارضات');
        }
      }
    } catch (e) {
      print('⚠️ [Nazih Core Sync] لا يوجد اتصال بالإنترنت حالياً: \$e');
    }
  }
}`,
    },
    offline_sync_csharp: {
      title: 'C# .NET Offline Sync (SQLite Queue & Background Worker)',
      filename: 'NazihOfflineSync.cs',
      desc: 'محرك متكامل لبرامج المحاسبة المكتبية WinForms وWPF للعمل في المواقع بدون نت.',
      code: `using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class NazihOfflineSync
{
    private static readonly HttpClient httpClient = new HttpClient();
    private const string ServerUrl = "${serverOrigin}/api/sync/batch";
    private const string ApiKey = "${apiKey}";
    private const string StoreId = "${storeId}";
    private const string DeviceId = "desktop-pos-01";

    public class MutationItem
    {
        public string operation_id { get; set; }
        public string action { get; set; }
        public string table { get; set; }
        public long client_timestamp { get; set; }
        public object data { get; set; }
    }

    /// إرسال حزمة العمليات غير المتصلة مع التحقق من المعرف الفريد لمنع تكرار الفاتورة
    public static async Task<bool> PushBatchSyncAsync(List<MutationItem> pendingMutations)
    {
        if (pendingMutations == null || pendingMutations.Count == 0) return true;

        var payload = new
        {
            store_id = StoreId,
            device_id = DeviceId,
            mutations = pendingMutations
        };

        var json = JsonSerializer.Serialize(payload);
        var request = new HttpRequestMessage(HttpMethod.Post, ServerUrl);
        request.Headers.Add("x-api-key", ApiKey);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            var response = await httpClient.SendAsync(request);
            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine("✅ [Nazih Core] Sync Batch Processed: " + responseContent);
                return true;
            }
            return false;
        }
        catch (Exception ex)
        {
            Console.WriteLine("⚠️ No network connection, queue retained: " + ex.Message);
            return false;
        }
    }
}`,
    },
    unity_game: {
      title: 'Unity C# Game Engine SDK (Multiplayer & Cloud Saves)',
      filename: 'NazihGameClient.cs',
      desc: 'محرك للألعاب التنافسية (Unity 3D / 2D) لمزامنة حالة اللاعبين، لوحة المتصدرين، وحفظ تقدم اللعبة سحابياً.',
      code: `using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// Nazih Core Game Engine SDK for Unity (C#)
/// Supports Player State, Cloud Saves, Leaderboards, and Live Room Events
/// </summary>
public class NazihGameClient : MonoBehaviour
{
    [Header("Server Configuration")]
    public string serverUrl = "${serverOrigin}";
    public string apiKey = "${apiKey}";
    public string gameTenantId = "${storeId}";

    [System.Serializable]
    public class PlayerScoreData
    {
        public string player_id;
        public string player_name;
        public int score;
        public int level_reached;
        public string extra_json;
    }

    /// <summary>
    /// إرسال نتيجة اللاعب وتحديث لوحة المتصدرين فورياً في السيرفر
    /// </summary>
    public void SubmitScore(string playerId, string playerName, int score, int level)
    {
        StartCoroutine(PostScoreRoutine(playerId, playerName, score, level));
    }

    private IEnumerator PostScoreRoutine(string playerId, string playerName, int score, int level)
    {
        string endpoint = serverUrl + "/api/v1/game/leaderboard";
        var payload = new PlayerScoreData
        {
            player_id = playerId,
            player_name = playerName,
            score = score,
            level_reached = level,
            extra_json = "{\\"platform\\": \\"Unity\\", \\"timestamp\\": \\"" + DateTime.UtcNow.ToString("o") + "\\"}"
        };

        string jsonPayload = JsonUtility.ToJson(payload);
        using (UnityWebRequest req = new UnityWebRequest(endpoint, "POST"))
        {
            byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonPayload);
            req.uploadHandler = new UploadHandlerRaw(bodyRaw);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("x-api-key", apiKey);

            yield return req.SendWebRequest();

            if (req.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("🏆 [Nazih Game Core] Score Submitted Successfully: " + req.downloadHandler.text);
            }
            else
            {
                Debug.LogError("❌ [Nazih Game Core] Failed to submit score: " + req.error);
            }
        }
    }
}`,
    },
    godot_game: {
      title: 'Godot Engine GDScript (WebSockets Multiplayer & REST)',
      filename: 'NazihGameClient.gd',
      desc: 'عميل ألعاب خفيف لمحرك Godot Engine 4.x للاتصال بالسيرفر وإرسال البيانات والتحكم بالغرف الجماعية.',
      code: `extends Node
class_name NazihGameClient

# Nazih Core GDScript Client for Godot Engine 4.x
const SERVER_URL = "${serverOrigin}"
const API_KEY = "${apiKey}"
const GAME_STORE_ID = "${storeId}"

var http_request : HTTPRequest

func _ready():
    http_request = HTTPRequest.new()
    add_child(http_request)
    http_request.request_completed.connect(_on_request_completed)

# 1. إرسال حدث حفظ سحابي للعبة (Cloud Save)
func save_player_state(player_id: String, state_dict: Dictionary):
    var endpoint = SERVER_URL + "/api/v1/game/cloud-save"
    var headers = [
        "Content-Type: application/json",
        "x-api-key: " + API_KEY
    ]
    var body = JSON.stringify({
        "game_id": GAME_STORE_ID,
        "player_id": player_id,
        "state": state_dict,
        "timestamp": Time.get_datetime_string_from_system(true)
    })
    
    var error = http_request.request(endpoint, headers, HTTPClient.METHOD_POST, body)
    if error != OK:
        push_error("❌ خطأ أثناء إرسال بيانات اللعبة لمحرك Nazih Core")

func _on_request_completed(result, response_code, headers, body):
    if response_code == 200 or response_code == 201:
        print("✅ [Nazih Core] تم حفظ تقدم اللعبة بنجاح على السيرفر")
    else:
        print("⚠️ خطأ في الاستجابة: ", response_code)`,
    },
    redis_cache: {
      title: 'In-Memory Key-Value Store (Redis-Like Sub-millisecond Engine)',
      filename: 'cache_client.js',
      desc: 'محرك كاش سريع جداً في الذاكرة لتسريع قراءة البيانات وحفظ جلسات المستخدمين (Sessions & Rate Limiting).',
      code: `// Nazih Core In-Memory Cache Engine Client
const axios = require('axios');

const SERVER_URL = '${serverOrigin}';
const API_KEY = '${apiKey}';

async function setCache(key, value, ttlSeconds = 300) {
    const res = await axios.post(\`\${SERVER_URL}/api/v1/cache/set\`, {
        key: key,
        value: value,
        ttl_seconds: ttlSeconds
    }, {
        headers: { 'x-api-key': API_KEY }
    });
    console.log('⚡ [Nazih Cache SET]:', res.data);
}

async function getCache(key) {
    const res = await axios.get(\`\${SERVER_URL}/api/v1/cache/get/\${key}\`, {
        headers: { 'x-api-key': API_KEY }
    });
    console.log('⚡ [Nazih Cache GET]:', res.data);
    return res.data;
}

// استخدام عملي: كاش سريع لفواتير المتجر لتفادي الضغط على قاعدة البيانات
setCache('store_${storeId}_today_total', { total: 45200.50, count: 142 }, 60);`,
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
          { id: 'offline_sync_flutter', label: 'Flutter Offline Sync (SQLite)', icon: Smartphone },
          { id: 'javascript', label: 'JavaScript / React', icon: Globe },
          { id: 'unity_game', label: 'Unity 3D/2D (C# Game Engine)', icon: Gamepad2 },
          { id: 'godot_game', label: 'Godot Engine 4 (GDScript)', icon: Gamepad2 },
          { id: 'redis_cache', label: 'In-Memory Cache (Redis Fast)', icon: Database },
          { id: 'python', label: 'Python', icon: Terminal },
          { id: 'csharp', label: 'C# / .NET POS', icon: Server },
          { id: 'offline_sync_csharp', label: 'C# Offline Sync Engine', icon: Server },
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
