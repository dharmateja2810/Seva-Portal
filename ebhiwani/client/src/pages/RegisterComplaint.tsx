import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Phone, MapPin, Building, Folder, FileText, Share2 } from 'lucide-react';
import { complaintsApi, mastersApi } from '@/api';
import toast from 'react-hot-toast';

const SOURCES = ['Walk-in', 'Phone Call', 'WhatsApp', 'Inspection', 'Office Entry'];

export default function RegisterComplaint() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    complainantName: '',
    complainantPhone: '',
    address: '',
    tehsilId: '',
    location: '',
    categoryId: '',
    source: 'Walk-in',
    description: '',
  });

  const { data: tehsils } = useQuery({
    queryKey: ['tehsils'],
    queryFn: () => mastersApi.tehsils().then((r) => r.data.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => mastersApi.categories().then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: () =>
      complaintsApi.create({
        complainantName: form.complainantName,
        complainantPhone: form.complainantPhone,
        tehsilId: Number(form.tehsilId),
        location: form.location,
        categoryId: Number(form.categoryId),
        source: form.source,
        description: form.description || undefined,
      }),
    onSuccess: (res) => {
      toast.success(`Complaint #${res.data.data.complaint_number} registered`);
      navigate('/complaints');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Failed to register complaint';
      toast.error(msg);
    },
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.complainantName || !form.complainantPhone || !form.tehsilId || !form.location || !form.categoryId) {
      toast.error('Please fill all required fields');
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-5 bg-white p-6 rounded-2xl shadow-sm border border-brand-100 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-2.5 rounded-xl hover:bg-brand-50 transition-all duration-200 border border-brand-100 group"
          type="button"
        >
          <ArrowLeft className="w-5 h-5 text-brand-500 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-brand-950">Register New Complaint</h1>
          <p className="text-sm text-brand-500/70 mt-1">Fill in the details below to log a new issue</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Complainant Details */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="card p-8 space-y-6"
        >
          <div className="flex items-center gap-3 border-b border-brand-100 pb-4">
            <div className="p-2.5 bg-brand-50 rounded-xl">
              <User className="w-5 h-5 text-brand-600" />
            </div>
            <h2 className="text-base font-semibold text-brand-900">Complainant Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-brand-800 mb-1.5">
                <User className="w-4 h-4 text-brand-400" /> Full Name <span className="text-red-500">*</span>
              </label>
              <input value={form.complainantName} onChange={set('complainantName')}
                className="input-field" placeholder="E.g. Rajesh Kumar" />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-brand-800 mb-1.5">
                <Phone className="w-4 h-4 text-brand-400" /> Phone Number <span className="text-red-500">*</span>
              </label>
              <input value={form.complainantPhone} onChange={set('complainantPhone')}
                className="input-field" placeholder="+91 XXXXX XXXXX" />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-brand-800 mb-1.5">
              <MapPin className="w-4 h-4 text-brand-400" /> Address
            </label>
            <input value={form.address} onChange={set('address')}
              className="input-field" placeholder="House/Flat No., Street, Landmark (optional)" />
          </div>
        </motion.div>

        {/* Complaint Details */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.07 }}
          className="card p-8 space-y-6"
        >
          <div className="flex items-center gap-3 border-b border-brand-100 pb-4">
            <div className="p-2.5 bg-amber-50 rounded-xl">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-base font-semibold text-brand-900">Issue Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-brand-800 mb-1.5">
                <Building className="w-4 h-4 text-brand-400" /> Tehsil <span className="text-red-500">*</span>
              </label>
              <select value={form.tehsilId} onChange={set('tehsilId')} className="input-field">
                <option value="">Select Tehsil</option>
                {(tehsils ?? []).map((t: { id: number; name: string }) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-brand-800 mb-1.5">
                <MapPin className="w-4 h-4 text-brand-400" /> Ward / Village <span className="text-red-500">*</span>
              </label>
              <input
                value={form.location}
                onChange={set('location')}
                className="input-field"
                placeholder="Enter ward or village name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-brand-800 mb-1.5">
                <Folder className="w-4 h-4 text-brand-400" /> Category <span className="text-red-500">*</span>
              </label>
              <select value={form.categoryId} onChange={set('categoryId')} className="input-field">
                <option value="">Select Category</option>
                {(categories ?? []).map((c: { id: number; name: string }) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-brand-800 mb-1.5">
                <Share2 className="w-4 h-4 text-brand-400" /> Source
              </label>
              <select value={form.source} onChange={set('source')} className="input-field">
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-brand-800 mb-1.5">
              <FileText className="w-4 h-4 text-brand-400" /> Description
            </label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={4}
              className="input-field resize-none"
              placeholder="Describe the issue in detail to help our team understand better..."
            />
          </div>

          {/* Note: File attachment typically handled after registration or via a separate endpoint implementation */}
          <div className="bg-brand-50/40 p-4 rounded-xl border border-brand-100 border-dashed">
            <label className="flex items-center gap-2 text-sm font-medium text-brand-800 mb-1.5">
              Attachment <span className="text-brand-400/70 font-normal">(Optional)</span>
            </label>
            <input type="file" accept="image/*,.pdf" className="text-sm text-brand-500
              file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0
              file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700
              hover:file:bg-brand-100 transition-all file:cursor-pointer file:transition-colors" />
            <p className="text-xs text-brand-400/70 mt-2">Supported formats: JPEG, PNG, PDF · Max 5 MB</p>
          </div>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, y: 15 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.14 }}
           className="flex items-center justify-end gap-4 pt-4"
        >
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-6">
            Cancel
          </button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary px-10 text-base shadow-brand-500/30 shadow-lg">
            {mutation.isPending ? 'Submitting...' : 'Submit Complaint'}
          </button>
        </motion.div>
      </form>
    </div>
  );
}
