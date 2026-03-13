import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, RefreshCw, FileSearch } from 'lucide-react';
import { complaintsApi, mastersApi } from '@/api';
import { StatusBadge } from '@/components/StatusBadge';
import { Loader } from '@/components/Loader';
import { Pagination } from '@/components/Pagination';

const STATUSES = ['', 'New', 'Pending', 'In Progress', 'Resolved', 'Closed'];

export default function Complaints() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tehsilFilter, setTehsilFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: tehsils } = useQuery({
    queryKey: ['tehsils'],
    queryFn: () => mastersApi.tehsils().then((r) => r.data.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => mastersApi.categories().then((r) => r.data.data),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['complaints', page, search, statusFilter, tehsilFilter, categoryFilter],
    queryFn: () =>
      complaintsApi
        .list({
          page,
          limit: 10,
          ...(search && { search }),
          ...(statusFilter && { status: statusFilter }),
          ...(tehsilFilter && { tehsilId: tehsilFilter }),
          ...(categoryFilter && { categoryId: categoryFilter }),
        })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
    staleTime: 20_000,
  });

  const complaints = data?.data ?? [];
  const pagination = data?.pagination;

  const reset = () => {
    setSearch(''); setStatusFilter(''); setTehsilFilter(''); setCategoryFilter(''); setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complaints</h1>
          {pagination && (
            <p className="text-sm text-gray-500 mt-0.5">
              Showing {complaints.length} of {pagination.total} complaints
            </p>
          )}
        </div>
        <button onClick={() => navigate('/register')} className="btn-primary flex items-center gap-2">
          + Register Complaint
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search ID, location..."
            className="input-field pl-9 py-2"
          />
        </div>

        <select
          value={tehsilFilter}
          onChange={(e) => { setTehsilFilter(e.target.value); setPage(1); }}
          className="input-field w-auto py-2"
        >
          <option value="">All Tehsils</option>
          {(tehsils ?? []).map((t: { id: number; name: string }) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input-field w-auto py-2"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || 'All Status'}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="input-field w-auto py-2"
        >
          <option value="">All Categories</option>
          {(categories ?? []).map((c: { id: number; name: string }) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button onClick={reset} className="btn-secondary flex items-center gap-1.5 py-2">
          <Filter className="w-4 h-4" /> Reset
        </button>

        <button onClick={() => refetch()} className="btn-secondary p-2">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <Loader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-gray-500 uppercase text-xs">
                  <th className="px-5 py-3 text-left font-medium">ID</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Tehsil</th>
                  <th className="px-4 py-3 text-left font-medium">Location</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <AnimatePresence>
                  {complaints.map((c: Record<string, unknown>, i: number) => (
                    <motion.tr
                      key={String(c.id)}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                      onClick={() => navigate(`/complaints/${String(c.id)}`)}
                      className="hover:bg-brand-50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3 font-mono font-semibold text-brand-700">
                        {String(c.complaint_number)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(c.created_at as string).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{String(c.tehsil_name)}</td>
                      <td className="px-4 py-3 text-gray-600">{String(c.location)}</td>
                      <td className="px-4 py-3 text-gray-600">{String(c.category_name)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={String(c.status)} />
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {complaints.length === 0 && (
              <div className="text-center py-16 px-6">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileSearch className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-base font-semibold text-slate-700">
                  {(search || statusFilter || tehsilFilter || categoryFilter)
                    ? 'No complaints match these filters'
                    : 'No complaints yet'}
                </p>
                <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
                  {(search || statusFilter || tehsilFilter || categoryFilter)
                    ? 'Try broadening your search or clearing some filters.'
                    : 'Complaints will appear here once they are registered.'}
                </p>
                {(search || statusFilter || tehsilFilter || categoryFilter) && (
                  <button
                    onClick={reset}
                    className="mt-4 text-sm text-brand-600 font-semibold hover:text-brand-700
                               underline-offset-2 hover:underline transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {pagination && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
