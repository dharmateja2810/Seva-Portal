import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Download, Filter, X, FileText, Clock,
  CheckCircle2, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { reportsApi, mastersApi, type ReportFilters } from '@/api';
import { StatusBadge } from '@/components/StatusBadge';
import { Loader } from '@/components/Loader';

// ── Colour palette ────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  New:          '#3068a0',
  Pending:      '#e9a32a',
  'In Progress':'#78a4cc',
  Resolved:     '#2b9e84',
  Closed:       '#4e84b6',
};

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  const COLS = [
    { key: 'complaint_number', label: 'ID' },
    { key: 'status',           label: 'Status' },
    { key: 'tehsil_name',      label: 'Tehsil' },
    { key: 'category_name',    label: 'Category' },
    { key: 'location',         label: 'Location' },
    { key: 'complainant_name', label: 'Complainant' },
    { key: 'assigned_to_name', label: 'Assigned To' },
    { key: 'days_open',        label: 'Days Open' },
    { key: 'due_date',         label: 'Due Date' },
    { key: 'created_at',       label: 'Filed On' },
  ];

  const header = COLS.map((c) => c.label).join(',');
  const body = rows
    .map((r) =>
      COLS.map((c) => {
        const v = r[c.key] ?? '';
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      }).join(',')
    )
    .join('\n');

  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── KPI card ──────────────────────────────────────────────────
function Kpi({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function Reports() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState<ReportFilters>({
    sortBy: 'created_at', sortDir: 'desc',
  });
  const [applied, setApplied] = useState<ReportFilters>({
    sortBy: 'created_at', sortDir: 'desc',
  });
  const [showFilters, setShowFilters] = useState(true);

  // Masters for dropdowns
  const { data: tehsilsRes }     = useQuery({ queryKey: ['tehsils'],     queryFn: () => mastersApi.tehsils().then((r) => r.data.data) });
  const { data: categoriesRes }  = useQuery({ queryKey: ['categories'],  queryFn: () => mastersApi.categories().then((r) => r.data.data) });

  const tehsils    = (tehsilsRes    ?? []) as { id: number; name: string }[];
  const categories = (categoriesRes ?? []) as { id: number; name: string }[];

  // Summary KPIs
  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['report-summary', applied],
    queryFn: () => reportsApi.summary(applied).then((r) => r.data.data),
  });

  // Rows
  const { data: rowsRes, isLoading: rowsLoading, refetch } = useQuery({
    queryKey: ['report-data', applied],
    queryFn: () => reportsApi.data(applied).then((r) => r.data),
  });

  const rows = useMemo(() => (rowsRes?.data ?? []) as Record<string, unknown>[], [rowsRes]);
  const summary  = summaryRes?.summary   ?? {};
  const byStatus = (summaryRes?.byStatus ?? []) as { status: string; total: string }[];
  const byTehsil = (summaryRes?.byTehsil ?? []) as { tehsil: string; total: string }[];

  function applyFilters() {
    setApplied({ ...filters });
  }

  function clearFilters() {
    const base = { sortBy: 'created_at', sortDir: 'desc' };
    setFilters(base);
    setApplied(base);
  }

  const hasActiveFilters = !!(
    applied.status || applied.tehsilId || applied.categoryId ||
    applied.from || applied.to || applied.search
  );

  const csvFilename = `complaints-report-${new Date().toISOString().slice(0, 10)}.csv`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Analyse and export complaint data
            {rowsRes?.total != null && (
              <span className="ml-2 text-brand-700 font-medium">{rowsRes.total} records</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters((p) => !p)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all
              ${showFilters ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="bg-brand-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">ON</span>
            )}
          </button>
          <button
            onClick={() => downloadCSV(rows, csvFilename)}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 disabled:opacity-40 transition-all"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={filters.status ?? ''}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value || undefined }))}
                className="w-full border border-gray-200 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All</option>
                {['New','Pending','In Progress','Resolved','Closed'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Tehsil */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tehsil</label>
              <select
                value={filters.tehsilId ?? ''}
                onChange={(e) => setFilters((p) => ({ ...p, tehsilId: e.target.value || undefined }))}
                className="w-full border border-gray-200 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All</option>
                {tehsils.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select
                value={filters.categoryId ?? ''}
                onChange={(e) => setFilters((p) => ({ ...p, categoryId: e.target.value || undefined }))}
                className="w-full border border-gray-200 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={filters.from ?? ''}
                onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value || undefined }))}
                className="w-full border border-gray-200 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={filters.to ?? ''}
                onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value || undefined }))}
                className="w-full border border-gray-200 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Search */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
              <input
                type="text"
                placeholder="ID or location…"
                value={filters.search ?? ''}
                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value || undefined }))}
                className="w-full border border-gray-200 rounded-lg text-sm px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={applyFilters}
              className="px-5 py-1.5 bg-brand-700 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors"
            >
              Apply
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-4 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
            <button
              onClick={() => refetch()}
              className="ml-auto p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-brand-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* KPI strip */}
      {summaryLoading ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Kpi label="Total"       value={summary.total ?? 0}          icon={FileText}      color="bg-blue-100 text-blue-600" />
          <Kpi label="New"         value={summary.new_count ?? 0}      icon={FileText}      color="bg-sky-100 text-sky-600" />
          <Kpi label="Pending"     value={summary.pending ?? 0}        icon={Clock}         color="bg-amber-100 text-amber-600" />
          <Kpi label="In Progress"     value={summary.in_progress ?? 0}    icon={RefreshCw}     color="bg-sky-100 text-sky-700" />
          <Kpi label="Resolved"    value={summary.resolved ?? 0}       icon={CheckCircle2}  color="bg-green-100 text-green-600" />
          <Kpi
            label="Overdue"
            value={summary.overdue ?? 0}
            icon={AlertTriangle}
            color="bg-red-100 text-red-600"
            sub={summary.avg_resolution_days ? `Avg ${summary.avg_resolution_days}d to resolve` : undefined}
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status donut */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5"
        >
          <h2 className="font-semibold text-brand-900 mb-4">By Status</h2>
          {byStatus.length === 0 ? (
            <p className="text-brand-400/60 text-sm text-center py-10">No data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="total"
                    nameKey="status"
                    cx="50%" cy="50%"
                    innerRadius={48} outerRadius={72}
                    paddingAngle={3}
                  >
                    {byStatus.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#aac6e1'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #aac6e1',
                      fontSize: 12,
                      color: '#162d4a',
                    }}
                    formatter={(v) => [v, 'Complaints']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 justify-center">
                {byStatus.map((s) => (
                  <div key={s.status} className="flex items-center gap-1.5 text-xs text-brand-600/70">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: STATUS_COLORS[s.status] ?? '#aac6e1' }}
                    />
                    {s.status} <span className="text-brand-400/60">({s.total})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

        {/* By tehsil bars */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="card p-5 col-span-1 lg:col-span-2"
        >
          <h2 className="font-semibold text-brand-900 mb-4">By Tehsil</h2>
          {byTehsil.length === 0 ? (
            <p className="text-brand-400/60 text-sm text-center py-10">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byTehsil} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" horizontal={false} stroke="#d5e3f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#4e84b6' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="tehsil" tick={{ fontSize: 11, fill: '#4e84b6' }} tickLine={false} axisLine={false} width={80} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #aac6e1', fontSize: 12, color: '#162d4a' }} />
                <Bar dataKey="total" name="Complaints" fill="#3068a0" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Data table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="card overflow-hidden"
      >
        {/* Table header row */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            Complaint Records
          </h2>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">Sort by</label>
            <select
              value={`${applied.sortBy}-${applied.sortDir}`}
              onChange={(e) => {
                const [sb, sd] = e.target.value.split('-');
                setFilters((p) => ({ ...p, sortBy: sb, sortDir: sd }));
                setApplied((p) => ({ ...p, sortBy: sb, sortDir: sd }));
              }}
              className="border border-gray-200 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="created_at-desc">Newest first</option>
              <option value="created_at-asc">Oldest first</option>
              <option value="updated_at-desc">Recently updated</option>
              <option value="complaint_number-asc">ID ↑</option>
              <option value="complaint_number-desc">ID ↓</option>
            </select>
          </div>
        </div>

        {rowsLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">No records match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">ID</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium">Tehsil</th>
                  <th className="px-3 py-2.5 text-left font-medium">Category</th>
                  <th className="px-3 py-2.5 text-left font-medium hidden md:table-cell">Complainant</th>
                  <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">Assigned To</th>
                  <th className="px-3 py-2.5 text-left font-medium">Days Open</th>
                  <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">Due</th>
                  <th className="px-3 py-2.5 text-left font-medium">Filed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((c) => {
                  const daysOpen = Number(c.days_open ?? 0);
                  const isOverdue =
                    c.due_date &&
                    new Date(c.due_date as string) < new Date() &&
                    !['Resolved', 'Closed'].includes(c.status as string);
                  return (
                    <tr
                      key={String(c.id)}
                      onClick={() => navigate(`/complaints/${String(c.id)}`)}
                      className="hover:bg-brand-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono font-semibold text-brand-700">
                        {String(c.complaint_number)}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={String(c.status)} />
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">{String(c.tehsil_name)}</td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[140px] truncate">
                        {String(c.category_name)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 hidden md:table-cell">
                        {c.complainant_name ? String(c.complainant_name) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 hidden lg:table-cell">
                        {c.assigned_to_name ? String(c.assigned_to_name) : <span className="text-gray-300">Unassigned</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`font-semibold ${daysOpen > 7 ? 'text-red-600' : 'text-gray-700'}`}>
                          {daysOpen}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        {c.due_date ? (
                          <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            {fmtDate(c.due_date as string)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">
                        {fmtDate(c.created_at as string)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between text-xs text-gray-400">
            <span>Showing {rows.length} records {rowsRes?.total === 1000 && '(limit 1000 — use filters to narrow)'}</span>
            <button
              onClick={() => downloadCSV(rows, csvFilename)}
              className="flex items-center gap-1.5 text-brand-700 font-medium hover:underline"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
