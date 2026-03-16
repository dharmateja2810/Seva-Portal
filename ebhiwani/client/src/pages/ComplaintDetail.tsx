import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Clock, User, MapPin, Tag, FileText,
  Paperclip, Upload, Trash2, FileImage, File as FileIcon,
} from 'lucide-react';
import { complaintsApi, mastersApi, attachmentsApi } from '@/api';
import { StatusBadge } from '@/components/StatusBadge';
import { Loader } from '@/components/Loader';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';

interface Attachment {
  id: number;
  original_name: string;
  stored_name?: string;
  size_bytes: number;
  mime_type: string;
  uploaded_by_name?: string;
  created_at: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_MB = 5;

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <FileImage className="w-4 h-4 text-brand-500" />;
  return <FileIcon className="w-4 h-4 text-red-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [notes, setNotes] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignPriority, setAssignPriority] = useState('Medium');
  const [assignComments, setAssignComments] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => complaintsApi.get(Number(id)).then((r) => r.data.data),
    enabled: !!id,
  });

  // Attachments come embedded in the complaint response;
  // the uploads query keeps them live after uploads/deletes
  const { data: liveAttachments, isLoading: attachmentsLoading } = useQuery<Attachment[]>({
    queryKey: ['attachments', id],
    queryFn: () => attachmentsApi.list(Number(id)).then((r) => r.data.data),
    enabled: !!id,
    initialData: undefined,
  });

  const attachments: Attachment[] = liveAttachments ?? (data?.attachments as Attachment[] ?? []);

  const { data: staff } = useQuery({
    queryKey: ['users'],
    queryFn: () => mastersApi.users().then((r) => r.data.data),
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { status: string; notes?: string; resolutionSummary?: string }) =>
      complaintsApi.updateStatus(Number(id), payload),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['complaint', id] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setNotes('');
      setResolutionSummary('');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const assignMutation = useMutation({
    mutationFn: (assignedTo: number) =>
      complaintsApi.assign(Number(id), {
        assignedTo,
        dueDate:  assignDueDate  || undefined,
        priority: assignPriority || undefined,
        comments: assignComments || undefined,
      }),
    onSuccess: () => {
      toast.success('Complaint assigned');
      qc.invalidateQueries({ queryKey: ['complaint', id] });
      setAssignTo('');
      setAssignDueDate('');
      setAssignComments('');
    },
    onError: () => toast.error('Failed to assign'),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(Number(id), file),
    onSuccess: () => {
      toast.success('File uploaded');
      qc.invalidateQueries({ queryKey: ['attachments', id] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Upload failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: number) =>
      attachmentsApi.delete(Number(id), attachmentId),
    onSuccess: () => {
      toast.success('Attachment removed');
      qc.invalidateQueries({ queryKey: ['attachments', id] });
    },
    onError: () => toast.error('Failed to delete attachment'),
  });

  function validateAndUpload(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP and PDF files allowed');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File must be under ${MAX_SIZE_MB} MB`);
      return;
    }
    uploadMutation.mutate(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndUpload(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndUpload(file);
  }

  if (isLoading) return <Loader />;
  if (!data) return <div className="flex flex-col items-center justify-center py-32 text-brand-400/60">
    <FileText className="w-16 h-16 mb-4 opacity-40 text-brand-300" />
    <span className="text-lg font-medium text-brand-500/70">Complaint not found</span>
  </div>;

  const canEdit = user?.role !== 'dc_viewer';
  const isAdmin = user?.role === 'phed_admin' || user?.role === 'system_admin';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-5 bg-white p-6 rounded-2xl shadow-sm border border-brand-100 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-2.5 rounded-xl hover:bg-brand-50 transition-all duration-200 border border-brand-100 group"
        >
          <ArrowLeft className="w-5 h-5 text-brand-500 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-brand-950">
                #{data.complaint_number}
              </h1>
              <StatusBadge status={data.status} />
            </div>
          </div>
          <p className="text-sm text-brand-500/70 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {data.tehsil_name} <span className="text-brand-200">&bull;</span> {data.location}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Details */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="card p-6 space-y-5 lg:col-span-2"
        >
          <div className="flex items-center gap-2.5 border-b border-brand-100 pb-4">
            <FileText className="w-4 h-4 text-brand-500" />
            <h2 className="text-base font-semibold text-brand-900">Complaint Information</h2>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
            <InfoRow icon={<Clock className="w-4 h-4 text-brand-500" />} label="Registered"
              value={new Date(data.created_at).toLocaleString('en-IN', {
                dateStyle: 'medium', timeStyle: 'short'
              })} />
            <InfoRow icon={<User className="w-4 h-4 text-brand-500" />} label="Complainant"
              value={data.complainant_name} />
            <InfoRow icon={<User className="w-4 h-4 text-brand-500" />} label="Phone"
              value={data.complainant_phone} />
            <InfoRow icon={<MapPin className="w-4 h-4 text-brand-500" />} label="Location"
              value={`${data.tehsil_name} — ${data.location}`} />
            <InfoRow icon={<Tag className="w-4 h-4 text-brand-500" />} label="Category"
              value={data.category_name} />
            <InfoRow icon={<Clock className="w-4 h-4 text-brand-500" />} label="Due Date"
              value={data.due_date
                ? new Date(data.due_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                : '—'} />
            <InfoRow icon={<User className="w-4 h-4 text-brand-500" />} label="Assigned To"
              value={data.assigned_to_name ?? 'Unassigned'} />
            <InfoRow icon={<FileText className="w-4 h-4 text-brand-500" />} label="Source"
              value={data.source} />
          </div>

          {data.description && (
            <div>
              <p className="text-xs font-medium text-brand-400/80 mb-1.5">Description</p>
              <p className="text-sm text-brand-800 bg-brand-50/50 rounded-lg p-3 leading-relaxed">{data.description}</p>
            </div>
          )}

          {/* ── Attachments ─────────────────────────────────── */}
          <div>
            <p className="text-xs font-medium text-brand-500/70 mb-3 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" /> Attachments
              {attachments.length > 0 && (
                <span className="ml-1 bg-brand-100 text-brand-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                  {attachments.length}
                </span>
              )}
            </p>

            {/* Upload zone */}
            {canEdit && (
              <div
                className={`
                  border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors mb-3
                  ${dragOver
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-brand-200 hover:border-brand-400 hover:bg-brand-50/40'}
                  ${uploadMutation.isPending ? 'opacity-60 pointer-events-none' : ''}
                `}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {uploadMutation.isPending ? (
                  <p className="text-sm text-brand-600 font-medium animate-pulse">Uploading…</p>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-brand-400 mx-auto mb-1" />
                    <p className="text-sm text-brand-600/70">
                      <span className="font-medium text-brand-600">Click to upload</span> or drag & drop
                    </p>
                    <p className="text-xs text-brand-400/70 mt-0.5">JPEG, PNG, WebP or PDF · max 5 MB</p>
                  </>
                )}
              </div>
            )}

            {/* Attachment list */}
            {attachmentsLoading ? (
              <p className="text-xs text-brand-400/60">Loading attachments…</p>
            ) : attachments.length === 0 ? (
              <p className="text-xs text-brand-400/60 text-center py-2">No attachments yet</p>
            ) : (
              <AnimatePresence>
                <div className="space-y-1.5">
                  {attachments.map((a) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-brand-50/50 group"
                    >
                      {fileIcon(a.mime_type)}
                      <span className="flex-1 text-brand-800 truncate">{a.original_name}</span>
                      <span className="text-xs text-brand-400/70 shrink-0">
                        {formatBytes(a.size_bytes)}
                      </span>
                      <span className="text-xs text-brand-400/70 shrink-0 hidden group-hover:block">
                        {a.uploaded_by_name}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => deleteMutation.mutate(a.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1 rounded hover:bg-red-50 text-brand-400/60 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            )}
          </div>

          {/* ── Status History ──────────────────────────────── */}
          <div>
            <p className="text-xs font-medium text-brand-500/70 mb-3">Status History</p>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-brand-100" />
              <div className="space-y-4">
                {(data.history ?? []).map((h: Record<string, unknown>, i: number) => (
                  <div key={i} className="flex items-start gap-4 pl-8 relative">
                    <div className="absolute left-2 top-1 w-2.5 h-2.5 rounded-full bg-brand-500 ring-2 ring-white" />
                    <div>
                      <p className="text-sm font-medium text-brand-900">
                        {h.from_status ? `${String(h.from_status)} → ` : ''}{String(h.to_status)}
                      </p>
                      <p className="text-xs text-brand-500/70">
                        by {String(h.updated_by_name)} ·{' '}
                        {new Date(h.created_at as string).toLocaleString('en-IN')}
                      </p>
                      {h.notes != null && String(h.notes) && (
                        <p className="text-xs text-brand-700/70 mt-0.5 italic">"{String(h.notes)}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right — Actions */}
        {canEdit && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {/* Assign (admin/nodal only) */}
            {isAdmin && (
              <div className="card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-brand-900">Assignment</h2>

                <div>
                  <label className="block text-xs font-medium text-brand-500/70 mb-1">Assign To</label>
                  <select
                    value={assignTo}
                    onChange={(e) => setAssignTo(e.target.value)}
                    className="input-field text-sm"
                  >
                    <option value="">Select officer…</option>
                    {(staff ?? []).map((u: { id: number; full_name: string }) => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-brand-500/70 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-500/70 mb-1">Priority</label>
                    <select
                      value={assignPriority}
                      onChange={(e) => setAssignPriority(e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-brand-500/70 mb-1">Assignment Comments</label>
                  <textarea
                    value={assignComments}
                    onChange={(e) => setAssignComments(e.target.value)}
                    placeholder="Optional comments…"
                    rows={2}
                    className="input-field resize-none text-sm"
                  />
                </div>

                <button
                  disabled={!assignTo || assignMutation.isPending}
                  onClick={() => assignMutation.mutate(Number(assignTo))}
                  className="btn-primary w-full"
                >
                  {assignMutation.isPending ? 'Assigning…' : 'Assign Complaint'}
                </button>
              </div>
            )}

            {/* Status update */}
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-brand-900">Update Status</h2>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes (optional)..."
                rows={3}
                className="input-field resize-none text-sm"
              />

              {data.status === 'In Progress' && (
                <textarea
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  placeholder="Resolution summary..."
                  rows={2}
                  className="input-field resize-none text-sm"
                />
              )}

              <div className="grid grid-cols-2 gap-2">
                {data.status !== 'Closed' && data.status !== 'Resolved' && (
                  <button
                    onClick={() =>
                      statusMutation.mutate({
                        status: 'In Progress',
                        notes: notes || undefined,
                      })
                    }
                    disabled={statusMutation.isPending}
                    className="btn-secondary text-sm py-2"
                  >
                    Mark In Progress
                  </button>
                )}

                {data.status !== 'Closed' && (
                  <button
                    onClick={() =>
                      statusMutation.mutate({
                        status: 'Closed',
                        notes: notes || undefined,
                        resolutionSummary: resolutionSummary || undefined,
                      })
                    }
                    disabled={statusMutation.isPending}
                    className="btn-primary text-sm py-2"
                  >
                    Close Complaint
                  </button>
                )}
              </div>

              <p className="text-xs text-brand-400/60 text-center">
                Registered by {data.created_by_name}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon, label, value
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-brand-50 last:border-0">
      <span className="text-brand-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-brand-400/80 font-medium mb-0.5">{label}</p>
        <p className="text-sm text-brand-900 font-medium leading-snug truncate">{value}</p>
      </div>
    </div>
  );
}
