import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Search, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '@/api';

const ROLE_LABEL: Record<string, string> = {
  system_admin: 'System Admin',
  phed_admin:   'PHED Admin',
  phed_updater: 'PHED Updater',
  dc_viewer:    'DC Viewer',
};

const ROLE_COLOR: Record<string, string> = {
  system_admin: 'bg-brand-100 text-brand-800',
  phed_admin:   'bg-sky-100 text-sky-700',
  phed_updater: 'bg-emerald-100 text-emerald-700',
  dc_viewer:    'bg-amber-100 text-amber-700',
};

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  department: string | null;
  designation: string | null;
  is_active: boolean;
  last_login_at: string | null;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getUsers().then(r => r.data.data),
    staleTime: 15_000,
  });

  const filtered = useMemo(() =>
    allUsers.filter(u =>
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase())
    ),
    [allUsers, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  function onSearch(v: string) { setSearch(v); setPage(1); }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-950">Users</h1>
        <p className="text-sm text-brand-500/70 mt-0.5">
          Manage portal users and their access roles.
        </p>
      </div>

      {/* Card */}
      <div className="card overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-brand-100">
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
                placeholder="Search user…"
                className="pl-8 pr-3 py-1.5 text-sm border border-brand-200 rounded-lg bg-white
                           text-brand-800 placeholder-brand-300 focus:outline-none
                           focus:ring-2 focus:ring-brand-500/20 w-44"
              />
            </div>
            <button
              onClick={() => navigate('/admin/users/new')}
              className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-3"
            >
              <UserPlus className="w-3.5 h-3.5" />
              + Add User
            </button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-[3px] border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-50/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-brand-500/70">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-brand-500/70">Department</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-brand-500/70">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-brand-500/70">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-brand-500/70">Last Login</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-brand-500/70">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((u, i) => (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  className="border-t border-brand-50 hover:bg-brand-50/40 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">{u.full_name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-brand-900">{u.full_name}</p>
                        <p className="text-xs text-brand-400/70">{u.email || u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-brand-600/80">{u.department || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                      ${ROLE_COLOR[u.role] ?? 'bg-brand-100 text-brand-700'}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                      ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-brand-400'}`} />
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-brand-500/70 text-xs">
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                      : 'Never'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => navigate(`/admin/users/${u.id}/edit`, { state: { user: u } })}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600
                                 hover:text-brand-800 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  </td>
                </motion.tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-brand-400/60 text-sm">
                    {search ? `No users matching "${search}"` : 'No users found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-brand-50 bg-brand-50/30">
          <p className="text-xs text-brand-400/70">
            {filtered.length === 0
              ? 'No entries'
              : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length} users`}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg
                         border border-brand-200 text-brand-600 hover:bg-brand-50
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
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
                      ${page === n
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
    </div>
  );
}
