import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { FilePlus, Clock, Activity, CheckCircle2 } from 'lucide-react';
import { complaintsApi } from '@/api';
import { StatusBadge } from '@/components/StatusBadge';
import { KPICard } from '@/components/KPICard';
import { Loader } from '@/components/Loader';
import { RangePicker, type RangeValue } from '@/components/RangePicker';

function rangeLabel(rv: RangeValue): string {
  const labels: Record<string, string> = {
    '7d': 'Last 7 Days', '30d': 'Last 30 Days', '3m': 'Last 3 Months',
    '6m': 'Last 6 Months', 'ytd': 'Year to Date', '1y': 'Last 12 Months',
  };
  if (rv.range === 'custom' && rv.from && rv.to)
    return `${rv.from} → ${rv.to}`;
  return labels[rv.range] ?? rv.range;
}

function fmtPeriod(v: string, groupBy: string) {
  if (groupBy === 'month') {
    // v is "YYYY-MM"
    return new Date(`${v}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  }
  // v is "YYYY-MM-DD"
  return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const [rangeVal, setRangeVal] = useState<RangeValue>({ range: '30d' });

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats', rangeVal],
    queryFn: () =>
      complaintsApi
        .stats({ range: rangeVal.range, from: rangeVal.from, to: rangeVal.to })
        .then((r) => r.data.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) return <Loader />;

  const stats          = data?.stats           ?? {};
  const trendData      = data?.trendData        ?? data?.weeklyTrend ?? [];
  const groupBy        = data?.groupBy          ?? 'day';
  const byTehsil       = data?.byTehsil         ?? [];
  const officerWorkload = data?.officerWorkload  ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-950">Dashboard</h1>
          <p className="text-brand-600/60 text-sm mt-0.5">PHED Complaints Overview</p>
        </div>
        <RangePicker value={rangeVal} onChange={setRangeVal} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="New Today"     value={stats.new_today   ?? 0} color="blue"   icon={FilePlus}      index={0} />
        <KPICard label="Pending"       value={stats.pending     ?? 0} color="amber"  icon={Clock}         index={1} />
        <KPICard label="In Progress"   value={stats.in_progress ?? 0} color="purple" icon={Activity}      index={2} />
        <KPICard label="Closed Today"  value={stats.closed_today ?? 0} color="green"  icon={CheckCircle2}  index={3} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="card p-5"
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-semibold text-brand-900">Complaints Overview</h2>
              <p className="text-xs text-brand-500/60 mt-0.5">{rangeLabel(rangeVal)}</p>
            </div>
            {/* Custom legend pills */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-end">
              {[
                { label: 'New',         color: '#3068a0' },
                { label: 'Pending',     color: '#e9a32a' },
                { label: 'In Progress', color: '#78a4cc' },
                { label: 'Resolved',    color: '#2b9e84' },
              ].map(({ label, color }) => (
                <span key={label} className="flex items-center gap-1.5 text-[11px] text-brand-700/60 font-medium">
                  <span style={{ background: color }} className="w-2 h-2 rounded-full flex-shrink-0" />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="40%">
              <CartesianGrid vertical={false} stroke="#d5e3f0" strokeDasharray="0" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: '#4e84b6' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmtPeriod(v, groupBy)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#4e84b6' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: '#eef3f9' }}
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #aac6e1',
                  boxShadow: '0 4px 16px rgba(15,31,51,0.08)',
                  padding: '10px 14px',
                  fontSize: 12,
                  color: '#162d4a',
                  background: '#fff',
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 6, color: '#1e3a5f', fontSize: 11 }}
                itemStyle={{ color: '#245488', padding: '1px 0' }}
                labelFormatter={(v) => fmtPeriod(String(v), groupBy)}
              />
              <Bar dataKey="new_count"         name="New"         stackId="a" fill="#3068a0" radius={[0,0,0,0]} />
              <Bar dataKey="pending_count"     name="Pending"     stackId="a" fill="#e9a32a" radius={[0,0,0,0]} />
              <Bar dataKey="in_progress_count" name="In Progress" stackId="a" fill="#78a4cc" radius={[0,0,0,0]} />
              <Bar dataKey="resolved_count"    name="Resolved"    stackId="a" fill="#2b9e84" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Officer Workload */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-900">Officer Workload</h2>
            <button className="text-xs text-brand-600 font-medium hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {officerWorkload.length === 0 && (
              <p className="text-brand-400/60 text-sm text-center py-8">No data</p>
            )}
            {officerWorkload.map((o: { full_name: string; complaint_count: string }, i: number) => {
              const max = Number(officerWorkload[0]?.complaint_count ?? 1);
              const pct = (Number(o.complaint_count) / max) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-brand-800 font-medium">{o.full_name}</span>
                    <span className="text-brand-500/70">{o.complaint_count}</span>
                  </div>
                  <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full bg-brand-600 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By tehsil */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card p-5 col-span-1"
        >
          <h2 className="font-semibold text-brand-900 mb-4">
            By Tehsil
            <span className="text-xs font-normal text-brand-400/70 ml-2">{rangeLabel(rangeVal)}</span>
          </h2>
          <div className="space-y-3">
            {byTehsil.length === 0 && (
              <p className="text-brand-400/60 text-sm text-center py-6">No data for this range</p>
            )}
            {byTehsil.map((t: { tehsil: string; total: string }, i: number) => {
              const max = Number(byTehsil[0]?.total ?? 1);
              const pct = (Number(t.total) / max) * 100;
              return (
                <div key={t.tehsil}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-brand-800 font-medium">{t.tehsil}</span>
                    <span className="text-sm font-semibold text-brand-900">{t.total}</span>
                  </div>
                  <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.2 + i * 0.06, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="h-full bg-brand-600 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Recent complaints table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-5 col-span-2 overflow-hidden"
        >
          <RecentComplaintsHeader />
          <RecentComplaints />
        </motion.div>
      </div>
    </div>
  );
}

function RecentComplaintsHeader() {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-semibold text-brand-900">Recent Complaints</h2>
      <button
        onClick={() => navigate('/complaints')}
        className="text-xs text-brand-600 font-medium hover:underline"
      >
        View All →
      </button>
    </div>
  );
}

function RecentComplaints() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['complaints-recent'],
    queryFn: () =>
      complaintsApi.list({ page: 1, limit: 5, sortBy: 'created_at', sortDir: 'desc' })
        .then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  if (isLoading)
    return <div className="text-center py-6 text-brand-400/60 text-sm">Loading...</div>;

  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-brand-50/60 text-brand-500/70 text-xs">
            <th className="px-5 py-2 text-left font-medium">ID</th>
            <th className="px-3 py-2 text-left font-medium">Tehsil</th>
            <th className="px-3 py-2 text-left font-medium">Category</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-left font-medium">Days Open</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-50">
          {(data ?? []).map((c: Record<string, unknown>) => {
            const days = Math.floor(
              (Date.now() - new Date(c.created_at as string).getTime()) / 86_400_000
            );
            return (
              <tr
                key={String(c.id)}
                onClick={() => navigate(`/complaints/${String(c.id)}`)}
                className="hover:bg-brand-50/60 transition-colors cursor-pointer"
              >
                <td className="px-5 py-2.5 font-mono font-semibold text-brand-700">
                  {String(c.complaint_number)}
                </td>
                <td className="px-3 py-2.5 text-brand-800">{String(c.tehsil_name)}</td>
                <td className="px-3 py-2.5 text-brand-700/80">{String(c.category_name)}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={String(c.status)} />
                </td>
                <td className="px-3 py-2.5 text-brand-500/70">{days}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
