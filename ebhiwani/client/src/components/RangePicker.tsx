import { useState } from 'react';
import { Calendar } from 'lucide-react';

export type RangePreset = '7d' | '30d' | '3m' | '6m' | 'ytd' | '1y' | 'custom';

export interface RangeValue {
  range: RangePreset;
  from?: string;
  to?: string;
}

interface Preset {
  key: RangePreset;
  label: string;
}

const PRESETS: Preset[] = [
  { key: '7d',     label: 'Last 7D'   },
  { key: '30d',    label: 'Last 30D'  },
  { key: '3m',     label: 'Last 3M'   },
  { key: '6m',     label: 'Last 6M'   },
  { key: 'ytd',    label: 'YTD'       },
  { key: '1y',     label: 'Last 1Y'   },
  { key: 'custom', label: 'Custom'    },
];

interface Props {
  value: RangeValue;
  onChange: (v: RangeValue) => void;
}

export function RangePicker({ value, onChange }: Props) {
  const [localFrom, setLocalFrom] = useState(value.from ?? '');
  const [localTo,   setLocalTo  ] = useState(value.to   ?? '');

  function selectPreset(key: RangePreset) {
    if (key === 'custom') {
      onChange({ range: 'custom', from: localFrom || undefined, to: localTo || undefined });
    } else {
      onChange({ range: key });
    }
  }

  function applyCustom() {
    onChange({ range: 'custom', from: localFrom || undefined, to: localTo || undefined });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset pill buttons */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => selectPreset(p.key)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap
              ${value.range === p.key
                ? 'bg-white shadow text-brand-800'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {p.key === 'custom' && <Calendar size={11} className="inline mr-1 -mt-0.5" />}
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {value.range === 'custom' && (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <input
            type="date"
            value={localFrom}
            onChange={(e) => setLocalFrom(e.target.value)}
            className="border border-gray-200 rounded-md text-xs px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={localTo}
            onChange={(e) => setLocalTo(e.target.value)}
            className="border border-gray-200 rounded-md text-xs px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={applyCustom}
            className="px-3 py-1 bg-brand-700 text-white text-xs font-medium rounded-md hover:bg-brand-800 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
