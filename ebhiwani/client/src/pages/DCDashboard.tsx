import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { complaintsApi } from '@/api';
import { KPICard } from '@/components/KPICard';
import { Loader } from '@/components/Loader';
import { RangePicker, type RangeValue } from '@/components/RangePicker';
import { useNavigate } from 'react-router-dom';

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
  if (groupBy === 'month')
    return new Date(`${v}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function DCDashboard() {
  const [rangeVal, setRangeVal] = useState<RangeValue>({ range: '30d' });
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dc-stats', rangeVal],
    queryFn: () =>
      complaintsApi
        .stats({ range: rangeVal.range, from: rangeVal.from, to: rangeVal.to })
        .then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <Loader />;

  const stats     = data?.stats    ?? {};
  const trendData = data?.trendData ?? data?.weeklyTrend ?? [];
  const groupBy   = data?.groupBy   ?? 'day';
  const byTehsil  = data?.byTehsil  ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Dashboard › DC Monitoring</p>
          <h1 className="text-2xl font-bold text-gray-900">DC Monitoring Dashboard</h1>
        </div>
        <RangePicker value={rangeVal} onChange={setRangeVal} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Complaints" value={Number(stats.total_open ?? 0) + Number(stats.closed_today ?? 0)} color="blue" />
        <KPICard label="Pending"       value={stats.pending ?? 0}     color="amber"  />
        <KPICard label="In Progress"   value={stats.in_progress ?? 0} color="purple" />
        <KPICard label="Resolved"      value={stats.closed_today ?? 0} color="green" />
      </div>

      {/* Trend chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Complaints Trend</h2>
          <span className="text-xs text-gray-400">{rangeLabel(rangeVal)}</span>
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => fmtPeriod(v, groupBy)}
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              labelFormatter={(v) => fmtPeriod(String(v), groupBy)}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="new_count"         name="New"         stackId="a" fill="#3b82f6" />
            <Bar dataKey="pending_count"     name="Pending"     stackId="a" fill="#f59e0b" />
            <Bar dataKey="in_progress_count" name="In Progress" stackId="a" fill="#8b5cf6" />
            <Bar dataKey="resolved_count"    name="Resolved"    stackId="a" fill="#10b981" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Tehsil bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-5"
        >
          <h2 className="font-semibold text-gray-800 mb-4">
            Complaints by Tehsil
            <span className="text-xs font-normal text-gray-400 ml-2">{rangeLabel(rangeVal)}</span>
          </h2>
          <div className="space-y-3">
            {byTehsil.map((t: { tehsil: string; total: string }) => {
              const max = Number(byTehsil[0]?.total ?? 1);
              const pct = (Number(t.total) / max) * 100;
              return (
                <div key={t.tehsil}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{t.tehsil}</span>
                    <span className="font-semibold text-gray-900">{t.total}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      className="h-full bg-brand-600 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Oldest pending */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card p-5 col-span-2"
        >
          <h2 className="font-semibold text-gray-800 mb-4">Oldest Pending Complaints</h2>
          <OldestPending navigate={navigate} />
        </motion.div>
      </div>
    </div>
  );
}

function OldestPending({ navigate }: { navigate: (p: string) => void }) {
  const { data } = useQuery({
    queryKey: ['oldest-pending'],
    queryFn: () =>
      complaintsApi
        .list({ page: 1, limit: 5, status: 'Pending', sortBy: 'created_at', sortDir: 'asc' })
        .then((r) => r.data.data),
  });

  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-gray-500 uppercase border-b">
        <tr>
          <th className="pb-2 text-left font-medium">ID</th>
          <th className="pb-2 text-left font-medium">Tehsil</th>
          <th className="pb-2 text-left font-medium">Category</th>
          <th className="pb-2 text-left font-medium">Days Open</th>
          <th className="pb-2" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {(data ?? []).map((c: Record<string, unknown>) => {
          const days = Math.floor(
            (Date.now() - new Date(c.created_at as string).getTime()) / 86_400_000
          );
          return (
            <tr key={String(c.id)} className="hover:bg-gray-50">
              <td className="py-2.5 font-mono font-semibold text-brand-700">{String(c.complaint_number)}</td>
              <td className="py-2.5 text-gray-700">{String(c.tehsil_name)}</td>
              <td className="py-2.5 text-gray-600">{String(c.category_name)}</td>
              <td className="py-2.5">
                <span className={`font-semibold ${days > 7 ? 'text-red-600' : 'text-gray-700'}`}>
                  {days}
                </span>
              </td>
              <td className="py-2.5 text-right">
                <button
                  onClick={() => navigate(`/complaints/${String(c.id)}`)}
                  className="text-xs text-brand-700 hover:underline font-medium"
                >
                  View →
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
