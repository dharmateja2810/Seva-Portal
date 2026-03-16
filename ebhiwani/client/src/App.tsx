import { useEffect, useState } from 'react';
import axios from 'axios';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import LoginPage from '@/pages/Login';
import DashboardLayout from '@/layouts/DashboardLayout';
import AdminLayout from '@/layouts/AdminLayout';
import Dashboard from '@/pages/Dashboard';
import Complaints from '@/pages/Complaints';
import ComplaintDetail from '@/pages/ComplaintDetail';
import RegisterComplaint from '@/pages/RegisterComplaint';
import Reports from '@/pages/Reports';
import Masters from '@/pages/Masters';
import DCDashboard from '@/pages/DCDashboard';
import AdminUsers from '@/pages/admin/AdminUsers';
import AddEditUser from '@/pages/admin/AddEditUser';
import RolesPermissions from '@/pages/admin/RolesPermissions';

// ── Silently restore access token from persisted refresh token ──
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
      <div className="h-screen flex items-center justify-center bg-brand-50">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}

// ── Redirect to login if not authenticated ──────────────────────
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

// ── Redirect if user lacks required role ────────────────────────
function RoleRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return user.role === 'system_admin'
      ? <Navigate to="/admin/users" replace />
      : <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// ── Smart root redirect based on role ──────────────────────────
function HomeRedirect() {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Navigate to="/login" replace />;
  if (user?.role === 'system_admin') return <Navigate to="/admin/users" replace />;
  if (user?.role === 'dc_viewer')    return <Navigate to="/dc/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <AuthBootstrap>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* ── PHED layout (phed_admin, phed_updater) ── */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <RoleRoute roles={['phed_admin', 'phed_updater']}>
                <DashboardLayout />
              </RoleRoute>
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="complaints/:id" element={<ComplaintDetail />} />

          {/* phed_admin + phed_updater only */}
          <Route
            path="register"
            element={
              <RoleRoute roles={['phed_admin', 'phed_updater']}>
                <RegisterComplaint />
              </RoleRoute>
            }
          />

          {/* phed_admin only */}
          <Route
            path="reports"
            element={
              <RoleRoute roles={['phed_admin']}>
                <Reports />
              </RoleRoute>
            }
          />
          <Route
            path="masters"
            element={
              <RoleRoute roles={['phed_admin']}>
                <Masters />
              </RoleRoute>
            }
          />
        </Route>

        {/* ── DC Viewer layout ────────────────────────────────────── */}
        <Route
          path="/dc"
          element={
            <PrivateRoute>
              <RoleRoute roles={['dc_viewer']}>
                <DashboardLayout />
              </RoleRoute>
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dc/dashboard" replace />} />
          <Route path="dashboard" element={<DCDashboard />} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="complaints/:id" element={<ComplaintDetail />} />
        </Route>

        {/* ── System Admin layout ─────────────────────────────────── */}
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <RoleRoute roles={['system_admin']}>
                <AdminLayout />
              </RoleRoute>
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/admin/users" replace />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/new" element={<AddEditUser />} />
          <Route path="users/:id/edit" element={<AddEditUser />} />
          <Route path="roles" element={<RolesPermissions />} />
          <Route path="masters" element={<Masters />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </AuthBootstrap>
  );
}
