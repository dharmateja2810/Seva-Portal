import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';
import { adminApi } from '@/api';
import toast from 'react-hot-toast';

const DEPARTMENTS = ['PHED', 'District', 'Administration', 'Revenue', 'Police', 'Other'];

const ROLES = [
  { value: 'system_admin', label: 'System Admin' },
  { value: 'phed_admin',   label: 'PHED Admin' },
  { value: 'phed_updater', label: 'PHED Updater' },
  { value: 'dc_viewer',    label: 'DC Viewer' },
];

interface FormData {
  username:    string;
  fullName:    string;
  email:       string;
  mobile:      string;
  department:  string;
  designation: string;
  role:        string;
  isActive:    boolean;
  password:    string;
}

const DEFAULT_FORM: FormData = {
  username:    '',
  fullName:    '',
  email:       '',
  mobile:      '',
  department:  'PHED',
  designation: '',
  role:        'phed_updater',
  isActive:    true,
  password:    '',
};

export default function AddEditUser() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState<FormData>(DEFAULT_FORM);

  // If navigated from list with state, use that. Otherwise fetch from API.
  const stateUser = (location.state as { user?: Record<string, unknown> })?.user;

  const { data: fetchedUser } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => adminApi.getUser(Number(id)).then(r => r.data.data),
    enabled: isEdit && !stateUser,
  });

  const userToEdit = stateUser ?? fetchedUser;

  useEffect(() => {
    if (isEdit && userToEdit) {
      setForm({
        username:    String(userToEdit.username ?? ''),
        fullName:    String(userToEdit.full_name ?? ''),
        email:       String(userToEdit.email ?? ''),
        mobile:      '',
        department:  String(userToEdit.department ?? 'PHED'),
        designation: String(userToEdit.designation ?? ''),
        role:        String(userToEdit.role ?? 'phed_updater'),
        isActive:    Boolean(userToEdit.is_active ?? true),
        password:    '',
      });
    }
  }, [isEdit, userToEdit]);

  const createMutation = useMutation({
    mutationFn: () => adminApi.createUser({
      username:    form.username,
      fullName:    form.fullName,
      email:       form.email || undefined,
      mobile:      form.mobile || undefined,
      department:  form.department || undefined,
      designation: form.designation || undefined,
      role:        form.role,
      isActive:    form.isActive,
      password:    form.password || undefined,
    }),
    onSuccess: () => {
      toast.success('User created successfully');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      navigate('/admin/users');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => adminApi.updateUser(Number(id), {
      fullName:    form.fullName,
      email:       form.email || undefined,
      department:  form.department || undefined,
      designation: form.designation || undefined,
      role:        form.role,
      isActive:    form.isActive,
      ...(form.password ? { password: form.password } : {}),
    }),
    onSuccess: () => {
      toast.success('User updated successfully');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-user', id] });
      navigate('/admin/users');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to update user');
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) { toast.error('Full name is required'); return; }
    if (!isEdit && !form.username.trim()) { toast.error('Username is required'); return; }
    if (isEdit) { updateMutation.mutate(); } else { createMutation.mutate(); }
  }

  function set(field: keyof FormData, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/users')}
          className="p-2 rounded-xl hover:bg-brand-100 transition-colors border border-brand-100 group"
        >
          <ArrowLeft className="w-4 h-4 text-brand-500 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div>
          <p className="text-xs text-brand-400/70">Users / {isEdit ? 'Edit User' : 'Add User'}</p>
          <h1 className="text-xl font-bold text-brand-950">{isEdit ? 'Edit User' : 'Add User'}</h1>
        </div>
      </div>

      {/* Form */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="card p-6 space-y-5"
      >
        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-brand-800 mb-1.5">Full Name *</label>
          <input
            type="text"
            value={form.fullName}
            onChange={e => set('fullName', e.target.value)}
            placeholder="e.g. Rajesh Kumar"
            className="input-field"
            required
          />
        </div>

        {/* Username — only on create */}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-brand-800 mb-1.5">Username *</label>
            <input
              type="text"
              value={form.username}
              onChange={e => set('username', e.target.value)}
              placeholder="e.g. rajesh.kumar"
              className="input-field"
              required
            />
          </div>
        )}

        {/* Mobile + Email */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-800 mb-1.5">Mobile Number</label>
            <input
              type="tel"
              value={form.mobile}
              onChange={e => set('mobile', e.target.value)}
              placeholder="9876543210"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-800 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="example@example.com"
              className="input-field"
            />
          </div>
        </div>

        {/* Department + Designation */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-800 mb-1.5">Department</label>
            <select
              value={form.department}
              onChange={e => set('department', e.target.value)}
              className="input-field"
            >
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-800 mb-1.5">Designation</label>
            <input
              type="text"
              value={form.designation}
              onChange={e => set('designation', e.target.value)}
              placeholder="e.g. Junior Engineer"
              className="input-field"
            />
          </div>
        </div>

        {/* Role + Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-800 mb-1.5">Role *</label>
            <select
              value={form.role}
              onChange={e => set('role', e.target.value)}
              className="input-field"
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-800 mb-1.5">Status</label>
            <select
              value={form.isActive ? 'active' : 'inactive'}
              onChange={e => set('isActive', e.target.value === 'active')}
              className="input-field"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-brand-800 mb-1.5">
            {isEdit ? 'New Password (leave blank to keep current)' : 'Password (default: Admin@123)'}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder={isEdit ? 'Enter new password…' : 'Min 8 characters'}
            className="input-field"
            minLength={isEdit ? undefined : 0}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
