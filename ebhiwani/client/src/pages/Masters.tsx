import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, X, Check, Search, ChevronLeft, ChevronRight, MapPin, Tag } from 'lucide-react';
import { mastersApi } from '@/api';
import toast from 'react-hot-toast';

type Tab = 'tehsils' | 'categories';

interface Tehsil   { id: number; name: string; district: string; is_active: boolean; }
interface Category { id: number; name: string; sla_days: number; is_active: boolean; }

interface ModalState {
  open: boolean;
  mode: 'add' | 'edit';
  tab: Tab;
  data: Partial<Tehsil & Category> | null;
}

const DISTRICTS = ['Bhiwani', 'Bawani Khera', 'Loharu', 'Tosham', 'Siwani'];

export default function Masters() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('tehsils');
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add', tab: 'tehsils', data: null });
  const [form, setForm] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const { data: tehsils = [], isLoading: tLoading } = useQuery<Tehsil[]>({
    queryKey: ['masters-tehsils'],
    queryFn: () => mastersApi.tehsils().then(r => r.data.data),
  });

  const { data: categories = [], isLoading: cLoading } = useQuery<Category[]>({
    queryKey: ['masters-categories'],
    queryFn: () => mastersApi.categories().then(r => r.data.data),
  });

  const tehsilMutation = useMutation({
    mutationFn: (payload: { id?: number; name: string; district?: string }) =>
      payload.id
        ? mastersApi.updateTehsil(payload.id, { name: payload.name })
        : mastersApi.createTehsil({ name: payload.name, district: payload.district }),
    onSuccess: () => {
      toast.success(modal.mode === 'add' ? 'Tehsil added' : 'Tehsil updated');
      qc.invalidateQueries({ queryKey: ['masters-tehsils'] });
      qc.invalidateQueries({ queryKey: ['tehsils'] });
      closeModal();
    },
    onError: () => toast.error('Failed to save tehsil'),
  });

  const categoryMutation = useMutation({
    mutationFn: (payload: { id?: number; name: string; sla_days: number }) =>
      payload.id
        ? mastersApi.updateCategory(payload.id, { name: payload.name, sla_days: payload.sla_days })
        : mastersApi.createCategory({ name: payload.name, sla_days: payload.sla_days }),
    onSuccess: () => {
      toast.success(modal.mode === 'add' ? 'Category added' : 'Category updated');
      qc.invalidateQueries({ queryKey: ['masters-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
    },
    onError: () => toast.error('Failed to save category'),
  });

  function openAdd(t: Tab) {
    setForm(t === 'tehsils' ? { name: '', district: 'Bhiwani' } : { name: '', sla_days: '5' });
    setModal({ open: true, mode: 'add', tab: t, data: null });
  }

  function openEdit(t: Tab, row: Tehsil | Category) {
    if (t === 'tehsils') {
      const r = row as Tehsil;
      setForm({ name: r.name, district: r.district });
    } else {
      const r = row as Category;
      setForm({ name: r.name, sla_days: String(r.sla_days) });
    }
    setModal({ open: true, mode: 'edit', tab: t, data: row });
  }

  function closeModal() {
    setModal(m => ({ ...m, open: false }));
    setForm({});
  }

  function handleSave() {
    if (!form.name?.trim()) { toast.error('Name is required'); return; }
    if (modal.tab === 'tehsils') {
      tehsilMutation.mutate({ id: modal.data?.id, name: form.name, district: form.district });
    } else {
      categoryMutation.mutate({
        id: modal.data?.id,
        name: form.name,
        sla_days: parseInt(form.sla_days ?? '5', 10) || 5,
      });
    }
  }

  // Filtered + paginated data
  const filteredTehsils = useMemo(() =>
    tehsils.filter(t => t.name.toLowerCase().includes(search.toLowerCase())),
    [tehsils, search]
  );
  const filteredCategories = useMemo(() =>
    categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase())),
    [categories, search]
  );
  const activeRows = tab === 'tehsils' ? filteredTehsils : filteredCategories;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / pageSize));
  const pagedRows  = activeRows.slice((page - 1) * pageSize, page * pageSize);

  // Reset page on tab or search change
  function switchTab(t: Tab) { setTab(t); setPage(1); setSearch(''); }
  function onSearch(v: string) { setSearch(v); setPage(1); }

  const isPending = tehsilMutation.isPending || categoryMutation.isPending;
  const isLoading = tLoading || cLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-950">Masters</h1>
        <p className="text-sm text-brand-500/70 mt-0.5">
          Manage master data such as tehsils, complaint categories etc. to ensure the portal is up-to-date and consistent.
        </p>
      </div>

      {/* Card */}
      <div className="card overflow-hidden">

        {/* Tabs */}
        <div className="border-b border-brand-100 px-5 pt-4 flex gap-6">
          {(['tehsils', 'categories'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`pb-3 text-sm font-medium transition-colors relative
                ${ tab === t
                  ? 'text-brand-700 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-brand-600 after:rounded-full'
                  : 'text-brand-400/70 hover:text-brand-600'
                }`}
            >
              {t === 'tehsils' ? 'Tehsils' : 'Complaint Categories'}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-brand-50">
          {/* Left: Show N entries */}
          <div className="flex items-center gap-2 text-sm text-brand-500/70">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border border-brand-200 rounded-lg px-2 py-1 text-sm text-brand-800
                         bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>entries</span>
          </div>

          {/* Right: Search + Add */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-400" />
              <input
                value={search}
                onChange={e => onSearch(e.target.value)}
                placeholder="Search…"
                className="pl-8 pr-3 py-1.5 text-sm border border-brand-200 rounded-lg bg-white
                           text-brand-800 placeholder-brand-300 focus:outline-none
                           focus:ring-2 focus:ring-brand-500/20 w-44"
              />
            </div>
            <button
              onClick={() => openAdd(tab)}
              className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              {tab === 'tehsils' ? '+ Add Tehsil' : '+ Add Category'}
            </button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-[3px] border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'tehsils' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-50/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-brand-500/70 w-20">ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-brand-500/70">Tehsil</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-brand-500/70">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(pagedRows as Tehsil[]).map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  className="border-t border-brand-50 hover:bg-brand-50/40 transition-colors"
                >
                  <td className="px-5 py-3 text-brand-400/70">{t.id}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                      <span className="font-medium text-brand-900">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => openEdit('tehsils', t)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600
                                 hover:text-brand-800 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  </td>
                </motion.tr>
              ))}
              {pagedRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-brand-400/60 text-sm">
                    {search ? `No tehsils matching "${search}"` : 'No tehsils found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-50/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-brand-500/70 w-20">ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-brand-500/70">Category Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-brand-500/70 w-28">SLA (days)</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-brand-500/70">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(pagedRows as Category[]).map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  className="border-t border-brand-50 hover:bg-brand-50/40 transition-colors"
                >
                  <td className="px-5 py-3 text-brand-400/70">{c.id}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                      <span className="font-medium text-brand-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full
                                    bg-brand-100 text-brand-700 text-xs font-medium">
                      {c.sla_days}d
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => openEdit('categories', c)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600
                                 hover:text-brand-800 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  </td>
                </motion.tr>
              ))}
              {pagedRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-brand-400/60 text-sm">
                    {search ? `No categories matching "${search}"` : 'No categories found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-brand-50 bg-brand-50/30">
          <p className="text-xs text-brand-400/70">
            Showing {activeRows.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, activeRows.length)} of {activeRows.length} entries
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg
                         border border-brand-200 text-brand-600 hover:bg-brand-50
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                if (idx > 0 && (arr[idx - 1] as number) !== n - 1) acc.push('...');
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === '...' ? (
                  <span key={`dot-${i}`} className="px-2 text-brand-300 text-xs">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n as number)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors
                      ${ page === n
                        ? 'bg-brand-700 text-white'
                        : 'border border-brand-200 text-brand-600 hover:bg-brand-50'
                      }`}
                  >
                    {n}
                  </button>
                )
              )
            }
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg
                         border border-brand-200 text-brand-600 hover:bg-brand-50
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modal.open && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={closeModal}
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.96, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                         bg-white rounded-2xl shadow-2xl border border-brand-100 w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-brand-900">
                  {modal.mode === 'add' ? 'Add' : 'Edit'}{' '}
                  {modal.tab === 'tehsils' ? 'Tehsil' : 'Complaint Category'}
                </h2>
                <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-brand-50 transition-colors">
                  <X className="w-4 h-4 text-brand-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-brand-800 mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={form.name ?? ''}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={modal.tab === 'tehsils' ? 'e.g. Bhiwani' : 'e.g. Pipeline Leakage'}
                    className="input-field"
                    autoFocus
                  />
                </div>

                {modal.tab === 'tehsils' && modal.mode === 'add' && (
                  <div>
                    <label className="block text-sm font-medium text-brand-800 mb-1.5">District</label>
                    <select
                      value={form.district ?? 'Bhiwani'}
                      onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                      className="input-field"
                    >
                      {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}

                {modal.tab === 'categories' && (
                  <div>
                    <label className="block text-sm font-medium text-brand-800 mb-1.5">SLA (days)</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form.sla_days ?? '5'}
                      onChange={e => setForm(f => ({ ...f, sla_days: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {modal.mode === 'add' ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
