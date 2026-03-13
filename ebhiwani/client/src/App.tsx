import { useEffect, useState } from 'react';
import axios from 'axios';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import LoginPage from '@/pages/Login';
import DashboardLayout from '@/layouts/DashboardLayout';
import Dashboard from '@/pages/Dashboard';
import Complaints from '@/pages/Complaints';
import ComplaintDetail from '@/pages/ComplaintDetail';
import RegisterComplaint from '@/pages/RegisterComplaint';
import DCDashboard from '@/pages/DCDashboard';
import Reports from '@/pages/Reports';

/** Silently restores accessToken from the persisted refreshToken on page load. */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { refreshToken, accessToken, setTokens, clearAuth } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!accessToken && refreshToken) {
      axios
        .post('/api/auth/refresh', { refreshToken })
        .then(({ data }) => setTokens(data.accessToken, data.refreshToken))
        .catch(() => clearAuth())
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function DCRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'dc_monitor') return <>{children}</>;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <AuthBootstrap>
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* PHED staff layout */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="complaints/:id" element={<ComplaintDetail />} />
        <Route path="register" element={<RegisterComplaint />} />
        <Route path="reports" element={<Reports />} />
      </Route>

      {/* DC monitoring */}
      <Route
        path="/dc"
        element={
          <PrivateRoute>
            <DCRoute>
              <DashboardLayout />
            </DCRoute>
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dc/dashboard" replace />} />
        <Route path="dashboard" element={<DCDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </AuthBootstrap>
  );
}
