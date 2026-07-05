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
  login:          (email: string, password: string) => apiClient.post('/auth/login', { email, password }).then(r => r.data),
  me:             () => apiClient.get('/auth/me').then(r => r.data),
  logout:         (refreshToken: string) => apiClient.post('/auth/logout', { refreshToken }),
  changePassword: (data: object) => apiClient.post('/auth/change-password', data).then(r => r.data),
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
  getHistory:   (vehicleId: string, params?: object) => apiClient.get(`/telemetry/${vehicleId}`, { params }).then(r => r.data),
  getLatest:    (vehicleId: string) => apiClient.get(`/telemetry/${vehicleId}/latest`).then(r => r.data),
  getLocations: () => apiClient.get('/telemetry/locations').then(r => r.data),
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
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportApi = {
  trips:        (params?: object) => apiClient.get('/reports/trips', { params }).then(r => r.data),
  alertsSummary:(params?: object) => apiClient.get('/reports/alerts-summary', { params }).then(r => r.data),
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

// ─── Expenses ────────────────────────────────────────────────────────────────
export const expenseApi = {
  list:    (params?: object) => apiClient.get('/expenses', { params }).then(r => r.data),
  create:  (data: object)    => apiClient.post('/expenses', data).then(r => r.data),
  update:  (id: string, data: object) => apiClient.put(`/expenses/${id}`, data).then(r => r.data),
  delete:  (id: string)      => apiClient.delete(`/expenses/${id}`),
  summary: (params?: object) => apiClient.get('/expenses/summary', { params }).then(r => r.data),
};
