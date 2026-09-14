import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';

export interface Translations {
  // Global & Navigation
  appName: string;
  appSub: string;
  langName: string;
  toggleLang: string;
  installApp: string;
  installedApp: string;
  simInvoice: string;
  soundOn: string;
  soundOff: string;
  cleanReset: string;
  confirmReset: string;
  resetting: string;
  liveBadge: string;
  sseBadge: string;
  connectingBadge: string;
  offlineMode: string;
  reconnected: string;
  latency: string;
  vpsGuide: string;
  dbEngine: string;
  byAuthor: string;
  sqliteEngine: string;
  dbSize: string;

  // Tabs
  tabManager: string;
  tabManagerDesc: string;
  tabEnterprise: string;
  tabEnterpriseDesc: string;
  tabOffline: string;
  tabOfflineDesc: string;
  tabAccounting: string;
  tabAccountingDesc: string;
  tabClients: string;
  tabClientsDesc: string;
  tabKeys: string;
  tabKeysDesc: string;
  tabSdks: string;
  tabSdksDesc: string;
  tabDatabase: string;
  tabDatabaseDesc: string;
  tabPos: string;
  tabPosDesc: string;
  tabDeployment: string;
  tabDeploymentDesc: string;

  // Manager Dashboard
  liveOpsTitle: string;
  liveOpsDesc: string;
  metricRevenue: string;
  metricInvoices: string;
  metricActiveStores: string;
  metricThroughput: string;
  filterStoreAll: string;
  filterToday: string;
  filter7Days: string;
  filter30Days: string;
  filterAllTime: string;
  liveStreamHeading: string;
  liveStreamSub: string;
  topSellingHeading: string;
  topSellingSub: string;
  itemCol: string;
  categoryCol: string;
  qtyCol: string;
  priceCol: string;
  revenueCol: string;
  ordersCol: string;
  invoiceExplorerHeading: string;
  exportPdf: string;
  tabHotActive: string;
  tabColdArchive: string;
  searchPlaceholder: string;
  invNumberCol: string;
  storeIdCol: string;
  customerCol: string;
  paymentCol: string;
  itemsCol: string;
  totalCol: string;
  datetimeCol: string;
  actionsCol: string;
  inspectBtn: string;
  printBtn: string;
  noInvoices: string;
  loadingInvoices: string;
  cashPayment: string;
  cardPayment: string;
  onlinePayment: string;
  qrPayment: string;
  cashCustomer: string;
  singleInvoiceView: string;

  // Client Portals
  clientPortalsTitle: string;
  clientPortalsSub: string;
  newStoreBtn: string;
  storeActiveStatus: string;
  storeSuspendedStatus: string;
  storeRevenue: string;
  storeInvoices: string;
  rateLimit: string;
  licenseExpires: string;
  permanent: string;
  apiKeyLabel: string;
  copyKey: string;
  copied: string;
  readyFilesTitle: string;
  readyFilesSub: string;
  downloadCsv: string;
  downloadSql: string;
  appConfigJson: string;
  recentStoreInvoices: string;
  timeCol: string;

  // Key Generator
  keyGenTitle: string;
  keyGenSub: string;
  createKeyBtn: string;
  genFormStoreId: string;
  genFormStoreName: string;
  genFormEmail: string;
  genFormPlan: string;
  genFormValidity: string;
  genFormRateLimit: string;
  genKeySuccess: string;
  securityTitle: string;
  activeLicensesCount: string;
  suspendedLicensesCount: string;

  // Common UI
  cancel: string;
  close: string;
  save: string;
  delete: string;
  preview: string;
  status: string;
  download: string;
  search: string;

  // POS Tester
  posTitle: string;
  posSub: string;
  posStep1: string;
  posStep1Sub: string;
  posSelectActiveStore: string;
  posManualKey: string;
  posQuickCatalog: string;
  posCartItems: string;
  posEmptyCart: string;
  posClearCart: string;
  posSubtotal: string;
  posTax: string;
  posGrandTotal: string;
  posStep3: string;
  posSendInvoice: string;
  posSending: string;
  posPayloadLabel: string;
  posServerResponse: string;
  posWaitingResponse: string;
  posInstantTranslate: string;
  posTranslating: string;

  // Database Studio
  dbStudioTitle: string;
  dbStudioSub: string;
  dbStudioTenant: string;
  dbStudioAllTenants: string;
  dbStudioTabRunner: string;
  dbStudioTabPortability: string;
  dbStudioTabSchema: string;
  dbStudioTabWal: string;
  dbStudioTabSlow: string;
  dbStudioExecute: string;
  dbStudioExecuting: string;
  dbStudioExport: string;
  dbStudioImport: string;
  dbStudioCreateTable: string;
  dbStudioWalAudit: string;
  dbStudioSlowQueries: string;
  dbStudioTablesList: string;
  dbStudioSampleQueries: string;
}

const arTranslations: Translations = {
  appName: 'StorePulse • Nazih Core',
  appSub: 'سيرفر وقواعد بيانات محمد نزيه المستقل',
  langName: 'العربية',
  toggleLang: 'English',
  installApp: 'تثبيت التطبيق على الموبايل',
  installedApp: 'مثبت كتطبيق موبايل',
  simInvoice: 'محاكاة',
  soundOn: 'الصوت مفعّل',
  soundOff: 'الصوت صامت',
  cleanReset: 'تصفير نظيف',
  confirmReset: 'هل أنت متأكد من رغبتك في مسح كافة الفواتير والبدء من الصفر؟',
  resetting: 'جاري التصفير...',
  liveBadge: 'مباشر',
  sseBadge: 'SSE',
  connectingBadge: 'اتصال',
  offlineMode: 'وضع عدم الاتصال (Offline Mode) — التطبيق يعمل محلياً',
  reconnected: 'تمت استعادة الاتصال بالإنترنت بنجاح',
  latency: 'مللي ثانية',
  vpsGuide: 'دليل الاستضافة 24/7',
  dbEngine: 'Nazih Core • MNDB Engine',
  byAuthor: 'بواسطة Mohamed Nazih',
  sqliteEngine: 'SQLite WAL Engine 100% Real',
  dbSize: 'حجم قاعدة البيانات',

  tabManager: 'لوحة العمليات المباشرة',
  tabManagerDesc: 'مراقبة المبيعات وتدفق فواتير العملاء الحقيقية لحظة بلحظة',
  tabEnterprise: 'حزمة الميزات المتقدمة',
  tabEnterpriseDesc: 'Zero-Trust RBAC، خوارزميات CRDTs، مركز Webhooks، ومراقبة APM',
  tabOffline: 'المزامنة والعمل بدون إنترنت',
  tabOfflineDesc: 'معمارية Offline-First وحل التعارضات وطابور العمليات المعلقة',
  tabAccounting: 'القيود المحاسبية ومراكز التكلفة',
  tabAccountingDesc: 'دفتر اليومية العامة المزدوج، مستخلصات المقاولات والإنشاءات',
  tabClients: 'بوابات المتاجر والعملاء',
  tabClientsDesc: 'صفحة وملفات البيانات المخصصة لكل تطبيق',
  tabKeys: 'مولد المفاتيح والتراخيص',
  tabKeysDesc: 'إصدار وإدارة تراخيص الربط البرمجي المشفرة للعملاء',
  tabSdks: 'مركز ربط التطبيقات (SDKs)',
  tabSdksDesc: 'أكواد جاهزة للنسخ في Flutter وJS وPython وC# وPHP',
  tabDatabase: 'محرك البيانات واستعلامات SQL',
  tabDatabaseDesc: 'إدارة MNDB ومحرر استعلامات SQL التفاعلي',
  tabPos: 'محاكي الكاشير ونقاط البيع',
  tabPosDesc: 'اختبار الإرسال والتحقق من الترويسات والصلاحيات',
  tabDeployment: 'دليل النشر والاستضافة المستقلة',
  tabDeploymentDesc: 'تشغيل السيرفر 24/7 على VPS أو Render أو Docker',

  liveOpsTitle: 'لوحة العمليات والمراقبة المباشرة',
  liveOpsDesc: 'مراقبة المبيعات وتدفق فواتير المتاجر الحقيقية لحظة بلحظة',
  metricRevenue: 'إجمالي المبيعات المجمعة',
  metricInvoices: 'إجمالي الفواتير المسجلة',
  metricActiveStores: 'المتاجر والعملاء النشطين',
  metricThroughput: 'معدل المعالجة اللحظية',
  filterStoreAll: 'كافة الفروع والمتاجر الموحدة',
  filterToday: 'اليوم',
  filter7Days: 'آخر 7 أيام',
  filter30Days: 'آخر 30 يوم',
  filterAllTime: 'كامل الأرشيف',
  liveStreamHeading: 'تدفق الفواتير الحي (Real-time Stream)',
  liveStreamSub: 'بث مباشر لحظي لكافة العمليات القادمة من نقاط البيع',
  topSellingHeading: 'أفضل الأصناف مبيعاً عبر المتاجر',
  topSellingSub: 'تحليل دقيق ومجمع بحسب الإيرادات والكميات المسحوبة',
  itemCol: 'الصنف',
  categoryCol: 'القسم',
  qtyCol: 'الكمية المباعة',
  priceCol: 'متوسط السعر',
  revenueCol: 'إجمالي الإيراد',
  ordersCol: 'الطلبات',
  invoiceExplorerHeading: 'مستكشف سجل الفواتير والمبيعات',
  exportPdf: 'تصدير PDF',
  tabHotActive: 'النشطة (Hot Table)',
  tabColdArchive: 'المؤرشفة (Cold Table)',
  searchPlaceholder: 'بحث برقم الفاتورة أو اسم العميل...',
  invNumberCol: 'رقم الفاتورة',
  storeIdCol: 'رمز المتجر',
  customerCol: 'العميل',
  paymentCol: 'طريقة الدفع',
  itemsCol: 'الأصناف',
  totalCol: 'المبلغ الإجمالي',
  datetimeCol: 'التاريخ والوقت',
  actionsCol: 'الإجراءات',
  inspectBtn: 'معاينة',
  printBtn: 'طباعة',
  noInvoices: 'لا توجد فواتير مسجلة في هذا الجدول.',
  loadingInvoices: 'جاري تحميل الفواتير من قاعدة بيانات SQLite...',
  cashPayment: 'نقداً',
  cardPayment: 'بطاقة',
  onlinePayment: 'دفع إلكتروني',
  qrPayment: 'رمز QR',
  cashCustomer: 'عميل نقدي',
  singleInvoiceView: 'تفاصيل الفاتورة',

  clientPortalsTitle: 'بوابات المتاجر وتخصيص البيانات',
  clientPortalsSub: 'إدارة عملاء السيرفر، تحميل ملفات التطبيقات الجاهزة، ومراقبة الحصص',
  newStoreBtn: 'إضافة متجر جديد',
  storeActiveStatus: 'الاشتراك سارٍ',
  storeSuspendedStatus: 'الاشتراك موقوف',
  storeRevenue: 'إجمالي مبيعات المتجر',
  storeInvoices: 'عدد الفواتير المستلمة',
  rateLimit: 'معدل الطلبات المسموح',
  licenseExpires: 'تاريخ انتهاء الترخيص',
  permanent: 'دائم',
  apiKeyLabel: 'مفتاح الربط البرمجي المشفر (API Key):',
  copyKey: 'نسخ المفتاح',
  copied: 'تم النسخ',
  readyFilesTitle: 'ملفات التطبيق والبيانات الجاهزة للمتجر',
  readyFilesSub: 'تحميل وتصدير كافة سجلات وفواتير التطبيق كملف مستقل كامل بضغطة زر واحدة',
  downloadCsv: 'تنزيل جدول Excel / CSV',
  downloadSql: 'تنزيل تفريغ SQL',
  appConfigJson: 'ملف إعدادات التطبيق المباشر (App Config JSON)',
  recentStoreInvoices: 'آخر فواتير المتجر',
  timeCol: 'التوقيت',

  keyGenTitle: 'مولد المفاتيح والتراخيص المشفرة',
  keyGenSub: 'إصدار تراخيص الربط البرمجي ومفاتيح API المشفرة لربط تطبيقات العملاء',
  createKeyBtn: 'توليد وإصدار مفتاح الربط الآن',
  genFormStoreId: 'معرف المتجر الفريد (Store ID)',
  genFormStoreName: 'اسم المتجر أو التطبيق',
  genFormEmail: 'بريد صاحب المتجر',
  genFormPlan: 'نوع الباقة',
  genFormValidity: 'مدة الصلاحية (أيام)',
  genFormRateLimit: 'معدل الطلبات في الدقيقة',
  genKeySuccess: 'تم توليد وإصدار المفتاح بنجاح!',
  securityTitle: 'مواصفات الأمان والحماية',
  activeLicensesCount: 'مفاتيح وتراخيص نشطة',
  suspendedLicensesCount: 'مفاتيح موقوفة',

  cancel: 'إلغاء',
  close: 'إغلاق',
  save: 'حفظ',
  delete: 'حذف',
  preview: 'معاينة',
  status: 'الحالة',
  download: 'تنزيل',
  search: 'بحث',

  posTitle: 'محاكي كاشير ونقاط البيع',
  posSub: 'اختبار تدفق الفواتير واستقبال السيرفر الفوري',
  posStep1: '1. التحقق وتحديد متجر الكاشير',
  posStep1Sub: 'اختر المتجر الحقيقي المراد اختبار إرسال الفاتورة إليه للتحقق من سلامة الترويسة',
  posSelectActiveStore: 'تحديد متجر نشط',
  posManualKey: 'إدخال يدوي للمفتاح',
  posQuickCatalog: '2. سلة مشتريات نقطة البيع',
  posCartItems: 'عناصر الفاتورة',
  posEmptyCart: 'السلة فارغة. اضغط على أي صنف لإضافته.',
  posClearCart: 'تفريغ السلة',
  posSubtotal: 'المجموع الفرعي:',
  posTax: 'الضريبة (8%):',
  posGrandTotal: 'الإجمالي الكلي:',
  posStep3: '3. بيانات الإرسال (ACID Single Transaction)',
  posSendInvoice: 'إرسال الفاتورة POST',
  posSending: 'جاري الحفظ...',
  posPayloadLabel: 'محتوى الطلب (JSON قابل للتعديل المباشر):',
  posServerResponse: 'استجابة السيرفر',
  posWaitingResponse: 'في انتظار إرسال الطلب...',
  posInstantTranslate: 'الترجمة الفورية عبر السيرفر',
  posTranslating: 'جاري الترجمة...',

  dbStudioTitle: 'خادم محرك البيانات السحابي (SaaS Database Server Engine)',
  dbStudioSub: 'محرك قواعد بيانات SQL متقدم مع عزل صارم للشركات، دعم الاستعلامات وسجل المعاملات',
  dbStudioTenant: 'عزل الشركة (Tenant):',
  dbStudioAllTenants: 'كافة الشركات (Master Admin)',
  dbStudioTabRunner: 'محرر الاستعلامات (SQL)',
  dbStudioTabPortability: 'تصدير واستيراد الشركات',
  dbStudioTabSchema: 'منشئ الجداول (DDL)',
  dbStudioTabWal: 'سجل المعاملات (WAL)',
  dbStudioTabSlow: 'الأداء ومراقبة البطء',
  dbStudioExecute: 'تنفيذ الاستعلام (F5)',
  dbStudioExecuting: 'جاري التنفيذ...',
  dbStudioExport: 'تصدير بيانات الشركة',
  dbStudioImport: 'استيراد وفحص البيانات',
  dbStudioCreateTable: 'إنشاء جدول جديد',
  dbStudioWalAudit: 'سجل تدقيق المعاملات الحية',
  dbStudioSlowQueries: 'تحليل الاستعلامات والأداء',
  dbStudioTablesList: 'الجداول النشطة',
  dbStudioSampleQueries: 'استعلامات سريعة جاهزة',
};

const enTranslations: Translations = {
  appName: 'StorePulse • Nazih Core',
  appSub: 'Mohamed Nazih Proprietary Server & Database Engine',
  langName: 'English',
  toggleLang: 'العربية',
  installApp: 'Install Mobile App',
  installedApp: 'Installed on Device',
  simInvoice: 'Simulate',
  soundOn: 'Audio Enabled',
  soundOff: 'Audio Muted',
  cleanReset: 'Clean Reset',
  confirmReset: 'Are you sure you want to wipe all records and start fresh?',
  resetting: 'Resetting...',
  liveBadge: 'LIVE',
  sseBadge: 'SSE',
  connectingBadge: 'Connecting',
  offlineMode: 'Offline Mode — Operating on Local Storage',
  reconnected: 'Network Connection Restored Successfully',
  latency: 'ms',
  vpsGuide: '24/7 Deployment Guide',
  dbEngine: 'Nazih Core • MNDB Engine',
  byAuthor: 'By Mohamed Nazih',
  sqliteEngine: 'SQLite WAL Engine 100% Real',
  dbSize: 'Database File Size',

  tabManager: 'Live Operations Dashboard',
  tabManagerDesc: 'Real-time sales tracking and client invoice streaming',
  tabEnterprise: 'Enterprise Power Suite',
  tabEnterpriseDesc: 'Zero-Trust RBAC, CRDT sync algorithms, Webhooks hub & APM',
  tabOffline: 'Offline Sync & Resilience',
  tabOfflineDesc: 'Offline-First architecture, conflict resolution & pending queue',
  tabAccounting: 'Double-Entry Accounting & Ledger',
  tabAccountingDesc: 'General journal entries, ledger accounts & cost centers',
  tabClients: 'Store & Client Portals',
  tabClientsDesc: 'Dedicated dashboards, export files & isolated tenant data',
  tabKeys: 'Key & License Generator',
  tabKeysDesc: 'Issue encrypted API keys and authenticate client apps',
  tabSdks: 'App Integration Hub (SDKs)',
  tabSdksDesc: 'Ready-to-use code snippets in Flutter, JS, Python, C# & PHP',
  tabDatabase: 'Database Studio & SQL Engine',
  tabDatabaseDesc: 'MNDB management, interactive SQL runner & live schemas',
  tabPos: 'POS Cashier Simulator',
  tabPosDesc: 'Test transactions, ingest verification & header validation',
  tabDeployment: '24/7 Deployment Guide',
  tabDeploymentDesc: 'Run self-hosted 24/7 on VPS, Render, Railway, or Docker',

  liveOpsTitle: 'Live Operations & Metrics Dashboard',
  liveOpsDesc: 'Real-time monitoring of POS ingest and unified retail activity',
  metricRevenue: 'Total Ingested Revenue',
  metricInvoices: 'Total Invoices Recorded',
  metricActiveStores: 'Active Connected Stores',
  metricThroughput: 'Real-time Throughput',
  filterStoreAll: 'All Stores & Branches (Consolidated)',
  filterToday: 'Today',
  filter7Days: 'Last 7 Days',
  filter30Days: 'Last 30 Days',
  filterAllTime: 'Full Archive',
  liveStreamHeading: 'Real-time Ingest Stream',
  liveStreamSub: 'Instant live feed of POS transactions from connected apps',
  topSellingHeading: 'Top Selling Products Across Stores',
  topSellingSub: 'Granular breakdown ranked by revenue and units sold',
  itemCol: 'Item Name',
  categoryCol: 'Category',
  qtyCol: 'Qty Sold',
  priceCol: 'Avg Price',
  revenueCol: 'Total Revenue',
  ordersCol: 'Orders',
  invoiceExplorerHeading: 'Invoice & Sales Ledger Explorer',
  exportPdf: 'Export PDF',
  tabHotActive: 'Hot Active Table',
  tabColdArchive: 'Cold Archive Table',
  searchPlaceholder: 'Search by invoice # or customer name...',
  invNumberCol: 'Invoice #',
  storeIdCol: 'Store ID',
  customerCol: 'Customer',
  paymentCol: 'Payment Method',
  itemsCol: 'Items',
  totalCol: 'Total Amount',
  datetimeCol: 'Date & Time',
  actionsCol: 'Actions',
  inspectBtn: 'Inspect',
  printBtn: 'Print',
  noInvoices: 'No invoices recorded in this view.',
  loadingInvoices: 'Loading invoices from SQLite database engine...',
  cashPayment: 'Cash',
  cardPayment: 'Credit Card',
  onlinePayment: 'Online',
  qrPayment: 'QR Code',
  cashCustomer: 'Walk-in Customer',
  singleInvoiceView: 'Invoice Details',

  clientPortalsTitle: 'Store Portals & Tenant Data Hub',
  clientPortalsSub: 'Manage tenant clients, download isolated data files & track quotas',
  newStoreBtn: 'Add New Store',
  storeActiveStatus: 'Subscription Active',
  storeSuspendedStatus: 'Subscription Suspended',
  storeRevenue: 'Store Total Revenue',
  storeInvoices: 'Invoices Ingested',
  rateLimit: 'Allowed Rate Limit',
  licenseExpires: 'License Expiry',
  permanent: 'Permanent',
  apiKeyLabel: 'Encrypted API Access Key:',
  copyKey: 'Copy Key',
  copied: 'Copied!',
  readyFilesTitle: 'Dedicated App Data Files & Downloads',
  readyFilesSub: 'Download and export all tenant records with a single click',
  downloadCsv: 'Download Excel / CSV',
  downloadSql: 'Download SQL Dump',
  appConfigJson: 'Live App Configuration (JSON)',
  recentStoreInvoices: 'Recent Store Invoices',
  timeCol: 'Time',

  keyGenTitle: 'License & API Key Generator',
  keyGenSub: 'Issue cryptographic API keys and manage multi-tenant access',
  createKeyBtn: 'Generate & Activate API Key',
  genFormStoreId: 'Unique Store ID',
  genFormStoreName: 'Store or App Name',
  genFormEmail: 'Owner Email',
  genFormPlan: 'Subscription Tier',
  genFormValidity: 'Validity Period (Days)',
  genFormRateLimit: 'Rate Limit (Requests / Min)',
  genKeySuccess: 'API key successfully generated and activated!',
  securityTitle: 'Security & Verification Standards',
  activeLicensesCount: 'Active Licenses',
  suspendedLicensesCount: 'Suspended Licenses',

  cancel: 'Cancel',
  close: 'Close',
  save: 'Save',
  delete: 'Delete',
  preview: 'Preview',
  status: 'Status',
  download: 'Download',
  search: 'Search',

  posTitle: 'POS Cashier Simulator',
  posSub: 'Test real-time invoice dispatch and instant server ingestion',
  posStep1: '1. Authenticate & Select Cashier Store',
  posStep1Sub: 'Select the registered store to test transaction dispatch and verify headers',
  posSelectActiveStore: 'Select Active Store',
  posManualKey: 'Manual API Key Input',
  posQuickCatalog: '2. Point-of-Sale Quick Catalog',
  posCartItems: 'Invoice Items',
  posEmptyCart: 'Cart is empty. Click any product above to add.',
  posClearCart: 'Clear Cart',
  posSubtotal: 'Subtotal:',
  posTax: 'Tax (8%):',
  posGrandTotal: 'Grand Total:',
  posStep3: '3. Transaction Payload (ACID Ingestion)',
  posSendInvoice: 'Send Invoice POST',
  posSending: 'Processing...',
  posPayloadLabel: 'Request Body (Live Editable JSON):',
  posServerResponse: 'Server Response',
  posWaitingResponse: 'Awaiting dispatch...',
  posInstantTranslate: 'Instant Server Translation',
  posTranslating: 'Translating...',

  dbStudioTitle: 'Cloud Database Server Engine (SaaS MNDB)',
  dbStudioSub: 'Advanced SQL database engine with strict tenant isolation, transaction logs, and full zero lock-in portability',
  dbStudioTenant: 'Tenant Isolation:',
  dbStudioAllTenants: 'All Tenants (Master Admin)',
  dbStudioTabRunner: 'SQL Query Runner',
  dbStudioTabPortability: 'Tenant Import & Export',
  dbStudioTabSchema: 'DDL Schema Designer',
  dbStudioTabWal: 'WAL Audit Log',
  dbStudioTabSlow: 'Slow Query APM',
  dbStudioExecute: 'Execute Query (F5)',
  dbStudioExecuting: 'Executing...',
  dbStudioExport: 'Export Company Data',
  dbStudioImport: 'Import & Validate Data',
  dbStudioCreateTable: 'Create Dynamic Table',
  dbStudioWalAudit: 'Live Transaction WAL Stream',
  dbStudioSlowQueries: 'Query Performance & APM',
  dbStudioTablesList: 'Active Tables',
  dbStudioSampleQueries: 'Pre-built SQL Queries',
};

interface LanguageContextType {
  language: Language;
  direction: 'rtl' | 'ltr';
  t: Translations;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ar',
  direction: 'rtl',
  t: arTranslations,
  setLanguage: () => {},
  toggleLanguage: () => {},
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('storepulse_lang');
      if (saved === 'en' || saved === 'ar') return saved;
    }
    return 'ar';
  });

  const direction: 'rtl' | 'ltr' = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('storepulse_lang', language);
      document.documentElement.lang = language;
      document.documentElement.dir = direction;
    }
  }, [language, direction]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };

  const t = language === 'ar' ? arTranslations : enTranslations;

  return (
    <LanguageContext.Provider value={{ language, direction, t, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  return useContext(LanguageContext);
}
