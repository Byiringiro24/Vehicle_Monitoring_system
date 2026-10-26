import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, updateToken, logout } = useAuthStore.getState();
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken });
          updateToken(data.accessToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return apiClient(original);
        } catch {
          logout();
          if (typeof window !== 'undefined') window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register:       (data: object) => apiClient.post('/auth/register', data).then(r => r.data),
  login:          (email: string, password: string) => apiClient.post('/auth/login', { email, password }).then(r => r.data),
  me:             () => apiClient.get('/auth/me').then(r => r.data),
  logout:         (refreshToken: string) => apiClient.post('/auth/logout', { refreshToken }),
  changePassword: (data: object) => apiClient.post('/auth/change-password', data).then(r => r.data),
  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }).then(r => r.data),
  resetPassword:  (token: string, newPassword: string) =>
    apiClient.post('/auth/reset-password', { token, newPassword }).then(r => r.data),
};

// ─── Vehicles ─────────────────────────────────────────────────────────────────
export const vehicleApi = {
  list:            (params?: object) => apiClient.get('/vehicles', { params }).then(r => r.data),
  get:             (id: string)      => apiClient.get(`/vehicles/${id}`).then(r => r.data),
  create:          (data: object)    => apiClient.post('/vehicles', data).then(r => r.data),
  update:          (id: string, data: object) => apiClient.put(`/vehicles/${id}`, data).then(r => r.data),
  delete:          (id: string)      => apiClient.delete(`/vehicles/${id}`),
  regenerateToken: (id: string)      => apiClient.post(`/vehicles/${id}/regenerate-token`).then(r => r.data),
  lock:            (id: string, locked: boolean) => apiClient.patch(`/vehicles/${id}/lock`, { locked }).then(r => r.data),
  gpsPing:         (id: string)      => apiClient.post(`/vehicles/${id}/gps-ping`).then(r => r.data),
  gpsHistory:      (id: string, params?: object) => apiClient.get(`/vehicles/${id}/gps-history`, { params }).then(r => r.data),
};

// ─── Telemetry ────────────────────────────────────────────────────────────────
export const telemetryApi = {
  getHistory:      (vehicleId: string, params?: object) => apiClient.get(`/telemetry/${vehicleId}`, { params }).then(r => r.data),
  getLatest:       (vehicleId: string) => apiClient.get(`/telemetry/${vehicleId}/latest`).then(r => r.data),
  getLocations:    () => apiClient.get('/telemetry/locations').then(r => r.data),
  deleteTelemetry: (vehicleId: string, params: { from: string; to: string }) =>
    apiClient.delete(`/telemetry/${vehicleId}`, { params }).then(r => r.data),
};

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertApi = {
  list:        (params?: object) => apiClient.get('/alerts', { params }).then(r => r.data),
  acknowledge: (id: string)      => apiClient.patch(`/alerts/${id}/acknowledge`).then(r => r.data),
  resolve:     (id: string)      => apiClient.patch(`/alerts/${id}/resolve`).then(r => r.data),
  listRules:   () => apiClient.get('/alerts/rules').then(r => r.data),
  createRule:  (data: object) => apiClient.post('/alerts/rules', data).then(r => r.data),
  deleteRule:  (id: string)   => apiClient.delete(`/alerts/rules/${id}`),
};

// ─── Fleets ───────────────────────────────────────────────────────────────────
export const fleetApi = {
  list:   () => apiClient.get('/fleets').then(r => r.data),
  create: (data: object) => apiClient.post('/fleets', data).then(r => r.data),
  update: (id: string, data: object) => apiClient.put(`/fleets/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/fleets/${id}`),
};

// ─── Drivers ─────────────────────────────────────────────────────────────────
export const driverApi = {
  list:     () => apiClient.get('/drivers').then(r => r.data),
  create:   (data: object) => apiClient.post('/drivers', data).then(r => r.data),
  assign:   (driverId: string, vehicleId: string | null) => apiClient.patch(`/drivers/${driverId}/assign`, { vehicleId }).then(r => r.data),
  activity: (driverId: string) => apiClient.get(`/drivers/${driverId}/activity`).then(r => r.data),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => apiClient.get('/dashboard/stats').then(r => r.data),
};

// ─── Geofences ────────────────────────────────────────────────────────────────
export const geofenceApi = {
  list:   () => apiClient.get('/geofences').then(r => r.data),
  create: (data: object) => apiClient.post('/geofences', data).then(r => r.data),
  update: (id: string, data: object) => apiClient.put(`/geofences/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/geofences/${id}`),
  events: (id: string) => apiClient.get(`/geofences/${id}/events`).then(r => r.data),
  assignVehicles: (id: string, vehicleIds: string[]) =>
    apiClient.patch(`/geofences/${id}/vehicles`, { vehicleIds }).then(r => r.data),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportApi = {
  trips:          (params?: object) => apiClient.get('/reports/trips', { params }).then(r => r.data),
  alertsSummary:  (params?: object) => apiClient.get('/reports/alerts-summary', { params }).then(r => r.data),
  dailyPayments:  (params?: object) => apiClient.get('/reports/daily-payments', { params }).then(r => r.data),
};

// ─── Financial ────────────────────────────────────────────────────────────────
export const financialApi = {
  dashboard:       (params?: object) => apiClient.get('/financial/dashboard', { params }).then(r => r.data),
  profitability:   (params?: object) => apiClient.get('/financial/vehicle-profitability', { params }).then(r => r.data),
  cashFlow:        (params?: object) => apiClient.get('/financial/cash-flow', { params }).then(r => r.data),
  statement:       (params?: object) => apiClient.get('/financial/statement', { params }).then(r => r.data),
  driverPayments:  (params?: object) => apiClient.get('/financial/driver-payments', { params }).then(r => r.data),
  createDriverPayment: (data: object) => apiClient.post('/financial/driver-payments', data).then(r => r.data),
  markDriverPaid:  (id: string)      => apiClient.patch(`/financial/driver-payments/${id}/mark-paid`).then(r => r.data),
};

// ─── Contracts ────────────────────────────────────────────────────────────────
export const contractApi = {
  customers:       (params?: object) => apiClient.get('/contracts/customers', { params }).then(r => r.data),
  createCustomer:  (data: object)    => apiClient.post('/contracts/customers', data).then(r => r.data),
  updateCustomer:  (id: string, data: object) => apiClient.put(`/contracts/customers/${id}`, data).then(r => r.data),
  list:            (params?: object) => apiClient.get('/contracts/contracts', { params }).then(r => r.data),
  get:             (id: string)      => apiClient.get(`/contracts/contracts/${id}`).then(r => r.data),
  create:          (data: object)    => apiClient.post('/contracts/contracts', data).then(r => r.data),
  update:          (id: string, data: object) => apiClient.put(`/contracts/contracts/${id}`, data).then(r => r.data),
  payments:        (contractId: string) => apiClient.get(`/contracts/contracts/${contractId}/payments`).then(r => r.data),
  addPayment:      (contractId: string, data: object) => apiClient.post(`/contracts/contracts/${contractId}/payments`, data).then(r => r.data),
  markPaymentPaid: (paymentId: string, data: object) => apiClient.patch(`/contracts/payments/${paymentId}/mark-paid`, data).then(r => r.data),
};

// ─── Device remote commands ───────────────────────────────────────────────────
export const deviceApi = {
  sendCommand: (vehicleId: string, command: string, params?: object) =>
    apiClient.post(`/devices/${vehicleId}/command`, { command, ...params }).then(r => r.data),
  updateSim: (vehicleId: string, simNumber: string) =>
    apiClient.patch(`/devices/${vehicleId}/sim`, { simNumber }).then(r => r.data),
  updateDataPlan: (vehicleId: string, data: { dataPlanType: string; dataPlanBoughtAt?: string; dataPlanExpiry?: string }) =>
    apiClient.patch(`/devices/${vehicleId}/data-plan`, data).then(r => r.data),
};

// ─── Expenses ────────────────────────────────────────────────────────────────
export const expenseApi = {
  list:    (params?: object) => apiClient.get('/expenses', { params }).then(r => r.data),
  create:  (data: object)    => apiClient.post('/expenses', data).then(r => r.data),
  update:  (id: string, data: object) => apiClient.put(`/expenses/${id}`, data).then(r => r.data),
  delete:  (id: string)      => apiClient.delete(`/expenses/${id}`),
  summary: (params?: object) => apiClient.get('/expenses/summary', { params }).then(r => r.data),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const userApi = {
  // All authenticated users: list users in own organisation
  list:          () => apiClient.get('/users').then(r => r.data),
  // SUPER_ADMIN only: list all users across every organisation
  listAll:       () => apiClient.get('/users/all').then(r => r.data),
  create:        (data: object)    => apiClient.post('/users', data).then(r => r.data),
  update:        (id: string, data: object) => apiClient.put(`/users/${id}`, data).then(r => r.data),
  // SUPER_ADMIN only: force-reset any user's password (no current password needed)
  resetPassword: (id: string, newPassword: string) =>
    apiClient.post(`/users/${id}/reset-password`, { newPassword }).then(r => r.data),
  // Activate or deactivate a user account
  setStatus:     (id: string, isActive: boolean) =>
    apiClient.patch(`/users/${id}/status`, { isActive }).then(r => r.data),
};

// ─── Maintenance ──────────────────────────────────────────────────────────────
export const maintenanceApi = {
  list:   (params?: object) => apiClient.get('/maintenance', { params }).then(r => r.data),
  get:    (id: string)      => apiClient.get(`/maintenance/${id}`).then(r => r.data),
  create: (data: object)    => apiClient.post('/maintenance', data).then(r => r.data),
  update: (id: string, data: object) => apiClient.put(`/maintenance/${id}`, data).then(r => r.data),
  delete: (id: string)      => apiClient.delete(`/maintenance/${id}`),
  upcoming: (params?: object) => apiClient.get('/maintenance/upcoming', { params }).then(r => r.data),
};

// ─── Memberships ──────────────────────────────────────────────────────────────
export const membershipApi = {
  me:            () => apiClient.get('/memberships/me').then(r => r.data),
  list:          () => apiClient.get('/memberships').then(r => r.data),
  invite:        (data: object) => apiClient.post('/memberships/invite', data).then(r => r.data),
  accept:        (id: string)   => apiClient.post(`/memberships/${id}/accept`).then(r => r.data),
  updateStatus:  (id: string, status: string, reason?: string) =>
    apiClient.patch(`/memberships/${id}`, { status, reason }).then(r => r.data),
};

// ─── Platform (Super Admin) ───────────────────────────────────────────────────
export const platformApi = {
  stats:          () => apiClient.get('/platform/stats').then(r => r.data),
  organizations:  (params?: object) => apiClient.get('/platform/organizations', { params }).then(r => r.data),
  organization:   (id: string)      => apiClient.get(`/platform/organizations/${id}`).then(r => r.data),
  activateSub:    (orgId: string, data: object) =>
    apiClient.post(`/platform/organizations/${orgId}/subscription`, data).then(r => r.data),
  updateSub:      (orgId: string, data: object) =>
    apiClient.patch(`/platform/organizations/${orgId}/subscription`, data).then(r => r.data),
  grantFeature:   (orgId: string, data: object) =>
    apiClient.post(`/platform/organizations/${orgId}/entitlements`, data).then(r => r.data),
  revokeFeature:  (orgId: string, key: string) =>
    apiClient.delete(`/platform/organizations/${orgId}/entitlements/${key}`).then(r => r.data),
  plans:          () => apiClient.get('/platform/plans').then(r => r.data),
  createPlan:     (data: object) => apiClient.post('/platform/plans', data).then(r => r.data),
  updatePlan:     (id: string, data: object) => apiClient.put(`/platform/plans/${id}`, data).then(r => r.data),
  auditLogs:      (params?: object) => apiClient.get('/platform/audit-logs', { params }).then(r => r.data),
};

// ─── Documents ────────────────────────────────────────────────────────────────
export const documentApi = {
  list:       (params?: object) => apiClient.get('/documents', { params }).then(r => r.data),
  compliance: () => apiClient.get('/documents/compliance').then(r => r.data),
  get:        (id: string) => apiClient.get(`/documents/${id}`).then(r => r.data),
  create:     (data: object) => apiClient.post('/documents', data).then(r => r.data),
  update:     (id: string, data: object) => apiClient.put(`/documents/${id}`, data).then(r => r.data),
  verify:     (id: string) => apiClient.post(`/documents/${id}/verify`).then(r => r.data),
  reject:     (id: string, reason: string) => apiClient.post(`/documents/${id}/reject`, { reason }).then(r => r.data),
  delete:     (id: string) => apiClient.delete(`/documents/${id}`),
  // Upload a file to an existing document slot
  uploadFile: (id: string, file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post(`/documents/${id}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: e => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
    }).then(r => r.data);
  },
  // Create slot + upload file in one step
  uploadAndCreate: (data: object, file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(data).forEach(([k, v]) => { if (v != null) form.append(k, String(v)); });
    return apiClient.post('/documents/upload-and-create', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: e => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
    }).then(r => r.data);
  },
};

// ─── Agreements (Business Model Builder) ─────────────────────────────────────
export const agreementApi = {
  businessModels: () => apiClient.get('/agreements/business-models').then(r => r.data),
  createModel:    (data: object) => apiClient.post('/agreements/business-models', data).then(r => r.data),
  list:           (params?: object) => apiClient.get('/agreements', { params }).then(r => r.data),
  get:            (id: string)   => apiClient.get(`/agreements/${id}`).then(r => r.data),
  create:         (data: object) => apiClient.post('/agreements', data).then(r => r.data),
  activate:       (id: string)   => apiClient.post(`/agreements/${id}/activate`).then(r => r.data),
  update:         (id: string, data: object) => apiClient.patch(`/agreements/${id}`, data).then(r => r.data),
  payments:       (id: string)   => apiClient.get(`/agreements/${id}/payments`).then(r => r.data),
  recordPayment:  (id: string, data: object) => apiClient.post(`/agreements/${id}/payments`, data).then(r => r.data),
};

// ─── Support (contacts + tickets + org approval) ──────────────────────────────
export const supportApi = {
  // Public — no auth needed
  contacts:       () => apiClient.get('/support/contacts').then(r => r.data),
  submitTicket:   (data: object) => apiClient.post('/support/tickets', data).then(r => r.data),

  // Authenticated
  myTickets:      () => apiClient.get('/support/my-tickets').then(r => r.data),

  // Super Admin only
  allTickets:     (params?: object) => apiClient.get('/support/admin/tickets', { params }).then(r => r.data),
  updateTicket:   (id: string, data: object) => apiClient.patch(`/support/admin/tickets/${id}`, data).then(r => r.data),
  pendingOrgs:    () => apiClient.get('/support/admin/pending-orgs').then(r => r.data),
  approveOrg:     (id: string, planId?: string) => apiClient.post(`/support/admin/orgs/${id}/approve`, { planId }).then(r => r.data),
  rejectOrg:      (id: string, reason: string) => apiClient.post(`/support/admin/orgs/${id}/reject`, { reason }).then(r => r.data),
  updateContacts: (contacts: object[]) => apiClient.put('/support/admin/contacts', contacts).then(r => r.data),
};
