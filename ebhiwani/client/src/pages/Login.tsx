import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api';
import toast from 'react-hot-toast';

const FEATURES = [
  'Departmental modules',
  'Complaint management',
  'Monitoring dashboards',
  'Reports & analytics',
];

const listVariants: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1, delayChildren: 0.4 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, x: -14 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) {
      toast.error('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.login(form);
      setAuth(data.accessToken, data.refreshToken, data.user);
      toast.success(`Welcome, ${data.user.fullName}`);
      navigate(data.user.role === 'dc_monitor' ? '/dc/dashboard' : '/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex"
      >
        {/* Left panel */}
        <div className="hidden md:flex flex-col justify-between w-5/12 bg-gradient-to-br from-brand-800 to-brand-950 p-10 text-white">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                <span className="text-brand-900 font-bold text-sm">eB</span>
              </div>
              <div>
                <p className="font-bold text-xl">eBhiwani</p>
                <p className="text-brand-300 text-xs">District Administration Portal</p>
              </div>
            </div>
            <h2 className="text-3xl font-bold leading-snug mb-4">
              One platform<br />
              <span className="text-brand-300">for district</span> operations
            </h2>
            <motion.ul
              variants={listVariants}
              initial="hidden"
              animate="show"
              className="space-y-3 mt-6"
            >
              {FEATURES.map((item) => (
                <motion.li key={item} variants={itemVariants} className="flex items-center gap-2.5 text-sm text-brand-100">
                  <span className="w-5 h-5 rounded-full bg-brand-600/60 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">✓</span>
                  {item}
                </motion.li>
              ))}
            </motion.ul>
          </div>
          <p className="text-brand-400 text-xs">© District Administration Bhiwani</p>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 flex flex-col justify-center p-8 md:p-12">
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-900">Sign in to eBhiwani</h3>
            <p className="text-gray-500 text-sm mt-1">
              Access district dashboards and complaint tracking
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Username / Mobile
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Enter username"
                  className="input-field pl-9"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter password"
                  className="input-field pl-9 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" className="text-sm text-brand-700 hover:text-brand-900 font-medium">
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
