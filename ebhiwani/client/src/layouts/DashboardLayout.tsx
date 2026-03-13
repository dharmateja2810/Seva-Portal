import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, FileText, PlusCircle, BarChart2, Settings,
  LogOut, ChevronDown, ChevronLeft, ChevronRight, Menu
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { NotificationBell } from '@/components/NotificationBell';

const PHED_NAV = [
  { to: '/dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
  { to: '/complaints', label: 'Complaints',          icon: FileText },
  { to: '/register',   label: 'Register Complaint',  icon: PlusCircle },
  { to: '/reports',    label: 'Reports',             icon: BarChart2 },
  { to: '/masters',    label: 'Masters',             icon: Settings },
];

const DC_NAV = [
  { to: '/dc/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dc/complaints', label: 'Complaints', icon: FileText },
];

/** Returns true when the viewport is narrower than Tailwind's `md` (768 px). */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

export default function DashboardLayout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  // Close mobile drawer when the user navigates
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const navItems = user?.role === 'dc_monitor' ? DC_NAV : PHED_NAV;
  const showLabels = isMobile ? true : sidebarOpen;

  // Framer Motion sidebar targets — mobile: slide in/out; desktop: collapse width
  const sidebarWidth  = isMobile ? 280 : (sidebarOpen ? 260 : 76);
  const sidebarX      = isMobile ? (mobileOpen ? 0 : -280) : 0;

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      clearAuth();
      navigate('/login');
      toast.success('Logged out');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">

      {/* ── Mobile backdrop ────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ────────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth, x: sidebarX }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed md:relative inset-y-0 left-0 h-full flex flex-col
                   bg-brand-950 text-white shadow-2xl z-50 md:z-20 overflow-hidden"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10 relative z-10">
          <div className="w-10 h-10 bg-brand-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">eB</span>
          </div>
          {showLabels && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.25 }}
            >
              <p className="font-bold text-lg leading-tight tracking-tight text-white">eBhiwani</p>
              <p className="text-brand-400 text-xs mt-0.5">District Portal</p>
            </motion.div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-6 space-y-1 px-3 overflow-y-auto relative z-10">
          {navItems.map(({ to, label, icon: Icon }, i) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative
                ${isActive
                  ? 'bg-white/15 text-white'
                  : 'text-brand-300/80 hover:bg-white/8 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4.5 h-4.5 flex-shrink-0 transition-transform duration-150
                    ${isActive ? '' : 'group-hover:scale-110'}`} />
                  {showLabels && (
                    <span className="truncate">{label}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Collapse button — desktop only */}
        <div className="p-4 border-t border-white/10 relative z-10 hidden md:block">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2.5 rounded-xl hover:bg-white/10 text-brand-200 hover:text-white transition-all duration-200"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="bg-white border-b border-brand-100 px-4 md:px-8 py-4
                           flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-semibold text-brand-700/60 hidden sm:block">
              eBhiwani Portal
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full hover:bg-brand-50
                           border border-transparent hover:border-brand-100 transition-all duration-200
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <div className="w-9 h-9 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">
                    {user?.fullName?.charAt(0) ?? 'U'}
                  </span>
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-semibold text-slate-800 tracking-tight">{user?.fullName}</p>
                  <p className="text-xs text-brand-500/70 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-brand-400 transition-transform duration-150 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    key="user-menu"
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 mt-3 w-52 bg-white rounded-xl shadow-lg border border-brand-100 p-2 z-50"
                  >
                    <div className="px-4 py-3 border-b border-slate-50 mb-2 sm:hidden">
                      <p className="text-sm font-semibold text-slate-800">{user?.fullName}</p>
                      <p className="text-xs text-brand-500/70 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600
                                 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-brand-50/40">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="p-4 md:p-8 max-w-7xl mx-auto"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
