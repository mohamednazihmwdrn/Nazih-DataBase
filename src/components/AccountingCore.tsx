import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Building2,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  PieChart,
  HardHat,
  AlertCircle,
  FileCheck2,
  Briefcase
} from 'lucide-react';
import { ClientRecord, CostCenter, JournalEntry } from '../types';
import { safeFetchJson } from '../lib/api';

interface Props {
  clients: ClientRecord[];
}

export const AccountingCore: React.FC<Props> = ({ clients }) => {
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    clients.length > 0 ? clients[0].store_id : ''
  );
  const [activeSubTab, setActiveSubTab] = useState<'ledger' | 'cost_centers' | 'contractor_calc' | 'trial_balance'>('ledger');
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [trialBalance, setTrialBalance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // New Cost Center Modal/Form
  const [showAddProject, setShowAddProject] = useState<boolean>(false);
  const [newProjectCode, setNewProjectCode] = useState('PRJ-TOWER-A');
  const [newProjectName, setNewProjectName] = useState('مشروع برج النور السكني - التجمع الخامس');
  const [newProjectCategory, setNewProjectCategory] = useState('إنشاءات ومقاولات');
  const [newProjectManager, setNewProjectManager] = useState('م. أحمد النجار');
  const [newProjectBudget, setNewProjectBudget] = useState('2500000');

  // Contractor Invoice Calculator
  const [grossAmount, setGrossAmount] = useState('100000'); // قيمة الأعمال المنجزة
  const [advancePercent, setAdvancePercent] = useState('10'); // خصم دفعة مقدمة 10%
  const [warrantyPercent, setWarrantyPercent] = useState('5'); // تأمين أعمال / ضمان 5%
  const [withholdingPercent, setWithholdingPercent] = useState('1'); // ضريبة أرباح تجارية 1%
  const [vatPercent, setVatPercent] = useState('14'); // ضريبة قيمة مضافة 14%
  const [selectedProjectForCalc, setSelectedProjectForCalc] = useState('');

  // Reversal Entry State
  const [reversingEntryId, setReversingEntryId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('تصحيح خطأ تسجيلي في بند التوريد');

  useEffect(() => {
    if (clients.length > 0 && !selectedStoreId) {
      setSelectedStoreId(clients[0].store_id);
    }
  }, [clients]);

  useEffect(() => {
    fetchData();
  }, [selectedStoreId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [jeRes, ccRes, tbRes] = await Promise.all([
        safeFetchJson<{ success: boolean; journal_entries: JournalEntry[] }>(`/api/accounting/journal-entries?store_id=${selectedStoreId || 'ALL'}&limit=100`),
        safeFetchJson<{ success: boolean; cost_centers: CostCenter[] }>(`/api/accounting/cost-centers?store_id=${selectedStoreId || 'ALL'}`),
        safeFetchJson<{ success: boolean; trial_balance: any[] }>(`/api/accounting/trial-balance?store_id=${selectedStoreId || 'ALL'}`),
      ]);

      if (jeRes.success && jeRes.data?.journal_entries) setJournalEntries(jeRes.data.journal_entries);
      if (ccRes.success && ccRes.data?.cost_centers) setCostCenters(ccRes.data.cost_centers);
      if (tbRes.success && tbRes.data?.trial_balance) setTrialBalance(tbRes.data.trial_balance);
    } catch (e) {
      console.warn('[Accounting] Warning loading data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCostCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId) return;

    try {
      const res = await fetch('/api/accounting/cost-centers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: selectedStoreId,
          code: newProjectCode,
          name: newProjectName,
          category: newProjectCategory,
          manager_name: newProjectManager,
          budget: parseFloat(newProjectBudget) || 0,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddProject(false);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReverseEntry = async (entryId: string) => {
    if (!confirm('هل أنت متأكد من إنشاء قيد تسوية عكسي لإلغاء هذا القيد؟ وفقاً للمعايير المحاسبية لا يتم مسح القيد الأصلي بل يُنشأ قيد معاكس لتوثيق التدقيق المالي.')) {
      return;
    }

    try {
      const res = await fetch('/api/accounting/reverse-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: entryId,
          reason: reversalReason,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReversingEntryId(null);
        fetchData();
        alert('تم إنشاء القيد العكسي بنجاح وإلغاء القيد المالي السابق.');
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Calculations for Contractor Progress Certificate
  const gross = parseFloat(grossAmount) || 0;
  const advDeduction = (gross * (parseFloat(advancePercent) || 0)) / 100;
  const warRetention = (gross * (parseFloat(warrantyPercent) || 0)) / 100;
  const withTax = (gross * (parseFloat(withholdingPercent) || 0)) / 100;
  const vat = (gross * (parseFloat(vatPercent) || 0)) / 100;
  const netPayable = gross + vat - advDeduction - warRetention - withTax;

  const handleSaveContractorProgress = async () => {
    if (!selectedStoreId) return;

    try {
      const client = clients.find((c) => c.store_id === selectedStoreId);
      if (!client) return;

      const res = await fetch('/api/sync/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': client.api_key,
        },
        body: JSON.stringify({
          store_id: selectedStoreId,
          device_id: 'contractor-office-desk',
          mutations: [
            {
              operation_id: `prog_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              action: 'INSERT',
              table: 'contractor_invoices',
              data: {
                invoice_number: `CERT-${Date.now().toString().slice(-4)}`,
                customer_name: 'شركة الاستشارات الهندسية - مستخلص جاري رقم 3',
                payment_method: 'credit',
                cost_center_id: selectedProjectForCalc || (costCenters[0]?.id ?? undefined),
                project_stage: 'أعمال الهيكل الخرساني والتشطيبات',
                advance_deduction: advDeduction,
                warranty_retention: warRetention,
                withholding_tax: withTax,
                tax: vat,
                subtotal: gross,
                items: [
                  {
                    item_name: 'أعمال خرسانة مسلحة وصب أسقف (مستخلص جاري)',
                    category: 'مستخلصات مقاولات',
                    quantity: 1,
                    unit_price: gross,
                    total_price: gross,
                  },
                ],
              },
            },
          ],
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('تم حفظ مستخلص المقاولة وتوليد القيد المحاسبي المزدوج وتحديث حساب المشروع بنجاح!');
        fetchData();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* TOP BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/80 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white">
                  محرك القيود المحاسبية ومراكز تكلفة المشاريع (Double-Entry & Cost Centers)
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                  Immutable Ledger (قوانين المحاسبة)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                نظام محاسبي حقيقي يعتمد على القيود المزدوجة المتوازنة (مدين / دائن)، ودفتر أستاذ غير قابل للتعديل المباشر
                (يتم التصحيح عبر قيود عكسية موثقة)، ودعم مستخلصات المقاولات والإنشاءات ومراكز التكلفة المستقلة.
              </p>
            </div>
          </div>

          {/* STORE PICKER */}
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 flex flex-col gap-1 min-w-[220px]">
            <span className="text-[11px] text-slate-400 font-semibold">المتجر / الشركة:</span>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">جميع المتاجر والشركات</option>
              {clients.map((c) => (
                <option key={c.id} value={c.store_id}>
                  {c.name} ({c.store_id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* SUB-TABS */}
        <div className="flex items-center gap-2 mt-6 border-t border-slate-800 pt-4 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveSubTab('ledger')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeSubTab === 'ledger'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>دفتر اليومية العامة والقيود المزدوجة ({journalEntries.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('cost_centers')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeSubTab === 'cost_centers'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>مراكز التكلفة ومشاريع الإنشاءات ({costCenters.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('contractor_calc')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeSubTab === 'contractor_calc'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <HardHat className="w-4 h-4" />
            <span>حاسبة مستخلصات المقاولات والاستقطاعات</span>
          </button>

          <button
            onClick={() => setActiveSubTab('trial_balance')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeSubTab === 'trial_balance'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>ميزان المراجعة وتجميع الحسابات</span>
          </button>
        </div>
      </div>

      {/* TAB 1: JOURNAL ENTRIES (DOUBLE-ENTRY LEDGER) */}
      {activeSubTab === 'ledger' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>دفتر اليومية العامة والقيود المزدوجة (General Ledger)</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                  متوازن (Debit = Credit)
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                كل فاتورة أو مستخلص مقاولة يتم تحويلها تلقائياً إلى قيد محاسبي مزدوج من طرفين لحماية سلامة الدفاتر المالية.
              </p>
            </div>

            <button
              onClick={fetchData}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>تحديث القيود</span>
            </button>
          </div>

          {journalEntries.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl text-slate-500 text-xs">
              لا توجد قيود محاسبية مسجلة بعد. عند تسجيل أي فاتورة أو استيراد حزمة مزامنة ستظهر قيودها هنا فوراً.
            </div>
          ) : (
            <div className="space-y-4">
              {journalEntries.map((je) => (
                <div
                  key={je.id}
                  className={`border rounded-xl p-4 transition ${
                    je.is_reversed === 1
                      ? 'bg-rose-50/40 border-rose-200'
                      : je.reference_type === 'reversal'
                      ? 'bg-amber-50/40 border-amber-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* HEADER */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-white">
                        {je.entry_number}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{je.description}</span>
                      {je.cost_center_name && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                          مشروع: {je.cost_center_name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-mono">{je.date}</span>

                      {je.is_reversed === 1 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          <span>تم إلغاؤه بقيد عكسي</span>
                        </span>
                      ) : je.reference_type === 'reversal' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          قيد تسوية عكسي
                        </span>
                      ) : (
                        <button
                          onClick={() => handleReverseEntry(je.id)}
                          className="text-[11px] text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-2.5 py-1 rounded-lg transition font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3 text-rose-500" />
                          <span>إلغاء بقيد عكسي</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* LINES TABLE */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="text-slate-500 font-semibold border-b border-slate-100">
                          <th className="pb-2 font-mono">رقم الحساب</th>
                          <th className="pb-2">اسم الحساب المالي</th>
                          <th className="pb-2">البيان والتفاصيل</th>
                          <th className="pb-2 text-left font-mono">مدين (Debit)</th>
                          <th className="pb-2 text-left font-mono">دائن (Credit)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {je.lines?.map((line, idx) => (
                          <tr key={line.id || idx} className="hover:bg-slate-50/50">
                            <td className="py-2 font-mono font-bold text-slate-700">{line.account_code}</td>
                            <td className="py-2 font-medium text-slate-900">{line.account_name}</td>
                            <td className="py-2 text-slate-500">{line.line_memo || '-'}</td>
                            <td className="py-2 text-left font-mono font-semibold text-emerald-700">
                              {line.debit > 0 ? line.debit.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="py-2 text-left font-mono font-semibold text-blue-700">
                              {line.credit > 0 ? line.credit.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-bold bg-slate-50/80">
                          <td colSpan={3} className="py-2 text-slate-800">
                            إجمالي القيد المتوازن
                          </td>
                          <td className="py-2 text-left font-mono text-emerald-800">
                            {je.total_debit?.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 text-left font-mono text-blue-800">
                            {je.total_credit?.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COST CENTERS & PROJECTS */}
      {activeSubTab === 'cost_centers' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  مراكز التكلفة ومشاريع الإنشاءات والمقاولات (Cost Centers & Projects)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تتبع ميزانية كل موقع أو مشروع إنشائي بشكل مستقل، ومقارنة الإيرادات بالمصاريف والمستخلصات.
                </p>
              </div>

              <button
                onClick={() => setShowAddProject(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مشروع / مركز تكلفة جديد</span>
              </button>
            </div>

            {/* ADD PROJECT MODAL/FORM */}
            {showAddProject && (
              <form onSubmit={handleCreateCostCenter} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold text-slate-800">بيانات المشروع / مركز التكلفة الجديد:</h4>
                  <button
                    type="button"
                    onClick={() => setShowAddProject(false)}
                    className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">كود المشروع (Code):</label>
                    <input
                      type="text"
                      value={newProjectCode}
                      onChange={(e) => setNewProjectCode(e.target.value)}
                      required
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">اسم المشروع / المركز:</label>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      required
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">مدير المشروع / المهندس:</label>
                    <input
                      type="text"
                      value={newProjectManager}
                      onChange={(e) => setNewProjectManager(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">الميزانية التقديرية (Budget):</label>
                    <input
                      type="number"
                      value={newProjectBudget}
                      onChange={(e) => setNewProjectBudget(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">التصنيف:</label>
                    <select
                      value={newProjectCategory}
                      onChange={(e) => setNewProjectCategory(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5"
                    >
                      <option value="إنشاءات ومقاولات">إنشاءات ومقاولات</option>
                      <option value="بنية تحتية وطرق">بنية تحتية وطرق</option>
                      <option value="تشطيبات وديكور">تشطيبات وديكور</option>
                      <option value="توريدات مواد بناء">توريدات مواد بناء</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    حفظ وتفعيل مركز التكلفة
                  </button>
                </div>
              </form>
            )}

            {costCenters.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl text-slate-500 text-xs">
                لا توجد مراكز تكلفة مسجلة بعد. اضغط على الزر أعلاه لإضافة أول مشروع إنشائي.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {costCenters.map((cc) => {
                  const budget = Number(cc.budget) || 0;
                  const rev = Number(cc.revenue_amount) || 0;
                  const percent = budget > 0 ? Math.min(100, Math.round((rev / budget) * 100)) : 0;

                  return (
                    <div
                      key={cc.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 hover:border-indigo-300 transition shadow-2xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                            {cc.code}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 mt-1.5">{cc.name}</h4>
                          <span className="text-[11px] text-slate-500 block mt-0.5">{cc.category}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          نشط (Active)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                        <div>
                          <span className="text-slate-500 block text-[10px]">الميزانية التقديرية:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {budget.toLocaleString('ar-EG')} ج.م
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">الإيرادات المحققة:</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {rev.toLocaleString('ar-EG')} ج.م
                          </span>
                        </div>
                      </div>

                      {/* PROGRESS BAR */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>نسبة التحصيل من الميزانية</span>
                          <span className="font-bold text-slate-700">{percent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CONTRACTOR CERTIFICATE & RETENTION CALCULATOR */}
      {activeSubTab === 'contractor_calc' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <HardHat className="w-5 h-5 text-indigo-600" />
              <span>حاسبة مستخلصات الإنشاءات والاستقطاعات النظامية (Contractor Progress Engine)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              حساب استقطاعات الدفعة المقدمة، تأمين الأعمال المحتجز (5%-10%)، وضريبة الخصم والإضافة (1%)، وتوليد القيد المحاسبي المزدوج تلقائياً.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* INPUTS (6 cols) */}
            <div className="lg:col-span-6 space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">مدخلات المستخلص المالي:</h4>

              <div>
                <label className="text-xs text-slate-600 block mb-1">ربط بالمشروع / مركز التكلفة:</label>
                <select
                  value={selectedProjectForCalc}
                  onChange={(e) => setSelectedProjectForCalc(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- اختر المشروع --</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name} ({cc.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">قيمة الأعمال المنجزة (Gross Amount):</label>
                <input
                  type="number"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">استقطاع دفعة مقدمة (%):</label>
                  <input
                    type="number"
                    value={advancePercent}
                    onChange={(e) => setAdvancePercent(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">تأمين أعمال وضمان (%):</label>
                  <input
                    type="number"
                    value={warrantyPercent}
                    onChange={(e) => setWarrantyPercent(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">ضريبة الخصم والإضافة (%):</label>
                  <input
                    type="number"
                    value={withholdingPercent}
                    onChange={(e) => setWithholdingPercent(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">ضريبة القيمة المضافة (%):</label>
                  <input
                    type="number"
                    value={vatPercent}
                    onChange={(e) => setVatPercent(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* BREAKDOWN & SAVE (6 cols) */}
            <div className="lg:col-span-6 space-y-4 bg-slate-900 text-white p-5 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">تفقيط المستخلص والاستحقاق:</h4>

              <div className="space-y-2 text-xs divide-y divide-slate-800">
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">إجمالي الأعمال المنجزة:</span>
                  <span className="font-mono font-bold">{gross.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between py-1.5 text-emerald-400">
                  <span>+ ضريبة القيمة المضافة (14%):</span>
                  <span className="font-mono font-bold">{vat.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between py-1.5 text-rose-400">
                  <span>- استقطاع دفعة مقدمة ({advancePercent}%):</span>
                  <span className="font-mono font-bold">{advDeduction.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between py-1.5 text-amber-400">
                  <span>- تأمين أعمال محتجز لدى المالك ({warrantyPercent}%):</span>
                  <span className="font-mono font-bold">{warRetention.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between py-1.5 text-rose-400">
                  <span>- ضريبة أرباح تجارية وصناعية (1%):</span>
                  <span className="font-mono font-bold">{withTax.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between pt-3 text-sm font-bold bg-indigo-950/60 p-3 rounded-xl border border-indigo-800">
                  <span className="text-indigo-200">صافي المستحق للصرف للمقاول:</span>
                  <span className="font-mono text-emerald-400 text-base">{netPayable.toLocaleString('ar-EG')} ج.م</span>
                </div>
              </div>

              <button
                onClick={handleSaveContractorProgress}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>ترحيل المستخلص وإصدار القيد المحاسبي المزدوج فوراً</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TRIAL BALANCE */}
      {activeSubTab === 'trial_balance' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">ميزان المراجعة وتجميع أرصدة الحسابات (Trial Balance)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تجميع تراكمي لحركات الحسابات الدائنة والمدينة وتأكيد التوازن العام للنظام المالي.
              </p>
            </div>
          </div>

          {trialBalance.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl text-slate-500 text-xs">
              لا توجد بيانات حسابية في ميزان المراجعة حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="p-3 font-mono font-bold">كود الحساب</th>
                    <th className="p-3 font-semibold">اسم الحساب</th>
                    <th className="p-3 text-left font-mono font-semibold">مجموع المدين (Total Debit)</th>
                    <th className="p-3 text-left font-mono font-semibold">مجموع الدائن (Total Credit)</th>
                    <th className="p-3 text-left font-mono font-semibold">الرصيد الصافي (Net Balance)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trialBalance.map((row: any) => (
                    <tr key={row.account_code} className="hover:bg-slate-50/80">
                      <td className="p-3 font-mono font-bold text-slate-800">{row.account_code}</td>
                      <td className="p-3 font-medium text-slate-900">{row.account_name}</td>
                      <td className="p-3 text-left font-mono text-emerald-700 font-semibold">
                        {Number(row.total_debit || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-left font-mono text-blue-700 font-semibold">
                        {Number(row.total_credit || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-slate-900">
                        {Number(row.net_balance || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
