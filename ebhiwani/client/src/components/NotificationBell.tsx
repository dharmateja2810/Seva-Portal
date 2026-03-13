import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { complaintsApi } from '@/api';
import { useNotifStore, type AppNotification } from '@/store/notifications';

type ComplaintRow = {
  id: number;
  complaint_number: string;
  status: string;
  tehsil_name: string;
  category_name: string;
  updated_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  new:            'New Complaint',
  resolved:       'Resolved',
  status_changed: 'Status Updated',
};
const TYPE_ICON: Record<string, string> = {
  new:            '🆕',
  resolved:       '✅',
  status_changed: '🔄',
};
const TYPE_COLOR: Record<string, string> = {
  new:            'bg-blue-100 text-blue-700',
  resolved:       'bg-green-100 text-green-700',
  status_changed: 'bg-amber-100 text-amber-700',
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, addNotifications, markRead, markAllRead, clear } = useNotifStore();
  const snapshotRef   = useRef<Map<number, string>>(new Map());
  const initializedRef = useRef(false);
  const navigate = useNavigate();

  // Poll complaints every 30 s to detect status changes / new filings
  const { data } = useQuery({
    queryKey: ['notif-poll'],
    queryFn: () =>
      complaintsApi
        .list({ page: 1, limit: 50, sortBy: 'updated_at', sortDir: 'desc' })
        .then((r) => r.data.data as ComplaintRow[]),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!data) return;

    // First load: seed snapshot silently — don't fire notifications for existing data
    if (!initializedRef.current) {
      data.forEach((c) => snapshotRef.current.set(c.id, c.status));
      initializedRef.current = true;
      return;
    }

    const fresh: Omit<AppNotification, 'read'>[] = [];

    data.forEach((c) => {
      const prev = snapshotRef.current.get(c.id);

      if (prev === undefined) {
        // Brand-new complaint
        fresh.push({
          uid:             `${c.id}-new`,
          complaintId:     c.id,
          complaintNumber: c.complaint_number,
          type:            'new',
          message:         `New complaint #${c.complaint_number} filed in ${c.tehsil_name} — ${c.category_name}`,
          timestamp:       new Date().toISOString(),
        });
      } else if (prev !== c.status) {
        // Status changed
        const type =
          c.status === 'Resolved' || c.status === 'Closed' ? 'resolved' : 'status_changed';
        fresh.push({
          uid:             `${c.id}-${c.status}`,
          complaintId:     c.id,
          complaintNumber: c.complaint_number,
          type,
          message:
            type === 'resolved'
              ? `Complaint #${c.complaint_number} has been ${c.status.toLowerCase()}`
              : `Complaint #${c.complaint_number} moved to "${c.status}"`,
          timestamp: new Date().toISOString(),
        });
      }

      snapshotRef.current.set(c.id, c.status);
    });

    if (fresh.length) addNotifications(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label="Notifications"
        className="relative p-2.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all duration-300"
      >
        <Bell className="w-5 h-5" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-white"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-3 w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-brand-600" />
                  <h3 className="font-semibold text-sm text-slate-800">Notifications</h3>
                  {unread > 0 && (
                    <span className="bg-red-100 text-red-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
                      {unread} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unread > 0 && (
                    <button
                      onClick={markAllRead}
                      title="Mark all read"
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={clear}
                    title="Clear all"
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div className="overflow-y-auto max-h-[420px] divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-slate-400">
                    <Bell className="w-9 h-9 mb-3 opacity-20" />
                    <p className="text-sm font-medium">No notifications yet</p>
                    <p className="text-xs mt-1 opacity-60">Activity will appear here in real-time</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.uid}
                      onClick={() => {
                        markRead(n.uid);
                        navigate(`/complaints/${n.complaintId}`);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                        !n.read ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <span className="text-base mt-0.5 flex-shrink-0">{TYPE_ICON[n.type]}</span>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLOR[n.type]}`}
                        >
                          {TYPE_LABEL[n.type]}
                        </span>
                        <p className="text-[13px] text-slate-700 leading-snug mt-1">{n.message}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{timeAgo(n.timestamp)}</p>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/80">
                  <button
                    onClick={() => { navigate('/complaints'); setOpen(false); }}
                    className="text-xs text-brand-700 font-medium hover:underline"
                  >
                    View all complaints →
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
