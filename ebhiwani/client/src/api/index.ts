import api from './axios';

export interface LoginPayload { username: string; password: string; }

export const authApi = {
  login: (payload: LoginPayload) => api.post('/auth/login', payload),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', payload),
};

export const complaintsApi = {
  list: (params: Record<string, unknown>) => api.get('/complaints', { params }),
  get: (id: number) => api.get(`/complaints/${id}`),
  create: (data: Record<string, unknown>) => api.post('/complaints', data),
  updateStatus: (id: number, data: { status: string; notes?: string; resolutionSummary?: string }) =>
    api.patch(`/complaints/${id}/status`, data),
  assign: (id: number, data: { assignedTo: number; dueDate?: string; comments?: string }) =>
    api.post(`/complaints/${id}/assign`, data),
  stats: (params?: { range?: string; from?: string; to?: string }) =>
    api.get('/complaints/dashboard/stats', { params }),
};

export const attachmentsApi = {
  list: (complaintId: number) =>
    api.get(`/complaints/${complaintId}/attachments`),
  upload: (complaintId: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/complaints/${complaintId}/attachments`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (complaintId: number, attachmentId: number) =>
    api.delete(`/complaints/${complaintId}/attachments/${attachmentId}`),
};

export const mastersApi = {
  tehsils: () => api.get('/masters/tehsils'),
  categories: () => api.get('/masters/categories'),
  users: () => api.get('/masters/users'),
};

export interface ReportFilters {
  status?: string;
  tehsilId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  search?: string;
  sortBy?: string;
  sortDir?: string;
}

export const reportsApi = {
  data:    (filters: ReportFilters) => api.get('/complaints/report', { params: filters }),
  summary: (filters: Omit<ReportFilters, 'search' | 'sortBy' | 'sortDir'>) =>
    api.get('/complaints/report/summary', { params: filters }),
};
