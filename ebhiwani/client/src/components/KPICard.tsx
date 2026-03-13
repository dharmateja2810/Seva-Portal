import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export type KPIColor = 'blue' | 'amber' | 'purple' | 'green' | 'red';

const PALETTE: Record<KPIColor, {
  border: string; iconBg: string; iconText: string; accentText: string;
}> = {
  blue:   { border: 'border-l-blue-500',   iconBg: 'bg-blue-50',   iconText: 'text-blue-600',   accentText: 'text-blue-600'   },
  amber:  { border: 'border-l-amber-500',  iconBg: 'bg-amber-50',  iconText: 'text-amber-600',  accentText: 'text-amber-600'  },
  purple: { border: 'border-l-purple-500', iconBg: 'bg-purple-50', iconText: 'text-purple-600', accentText: 'text-purple-600' },
  green:  { border: 'border-l-green-500',  iconBg: 'bg-green-50',  iconText: 'text-green-600',  accentText: 'text-green-600'  },
  red:    { border: 'border-l-red-500',    iconBg: 'bg-red-50',    iconText: 'text-red-600',    accentText: 'text-red-600'    },
};

export interface KPICardProps {
  label: string;
  value: number | string;
  color: KPIColor;
  sublabel?: string;
  icon?: LucideIcon;
  index?: number;
}

export function KPICard({ label, value, color, sublabel, icon: Icon, index = 0 }: KPICardProps) {
  const c = PALETTE[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${c.border} p-5 shadow-sm hover:shadow-md transition-shadow duration-300`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 leading-none">
            {label}
          </p>
          <motion.p
            key={String(value)}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="text-3xl font-bold leading-none tracking-tight text-slate-900"
          >
            {value}
          </motion.p>
          {sublabel && (
            <p className="text-[11px] text-slate-400 mt-2 leading-tight">{sublabel}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${c.iconBg} flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${c.iconText}`} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
