type Status = 'New' | 'Pending' | 'In Progress' | 'Resolved' | 'Closed' | string;

const MAP: Record<string, string> = {
  New:         'badge-new',
  Pending:     'badge-pending',
  'In Progress': 'badge-progress',
  Resolved:    'badge-resolved',
  Closed:      'badge-closed',
};

export function StatusBadge({ status }: { status: Status }) {
  const cls = MAP[status] ?? 'badge-closed';
  return <span className={cls}>{status}</span>;
}
