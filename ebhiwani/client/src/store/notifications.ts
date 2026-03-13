import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppNotification {
  uid: string;              // `${complaintId}-${eventKey}` — used for dedup
  complaintId: number;
  complaintNumber: string;
  type: 'new' | 'resolved' | 'status_changed';
  message: string;
  timestamp: string;        // ISO
  read: boolean;
}

interface NotifState {
  notifications: AppNotification[];
  addNotifications: (items: Omit<AppNotification, 'read'>[]) => void;
  markRead: (uid: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotifStore = create<NotifState>()(
  persist(
    (set, get) => ({
      notifications: [],
      addNotifications: (items) => {
        const seen = new Set(get().notifications.map((n) => n.uid));
        const fresh = items
          .filter((i) => !seen.has(i.uid))
          .map((i) => ({ ...i, read: false }));
        if (!fresh.length) return;
        set((s) => ({
          notifications: [...fresh, ...s.notifications].slice(0, 60),
        }));
      },
      markRead: (uid) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.uid === uid ? { ...n, read: true } : n
          ),
        })),
      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),
      clear: () => set({ notifications: [] }),
    }),
    { name: 'ebhiwani-notifications' }
  )
);
