import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: ${BASE_URL}/api/v1,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = Bearer ;
  return config;
});

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, updateToken, logout } = useAuthStore.getState();
      if (refreshToken) {
        try {
          const { data } = await axios.post(${BASE_URL}/api/v1/auth/refresh, { refreshToken });
          updateToken(data.accessToken);
          original.headers.Authorization = Bearer ;
          return apiClient(original);
        } catch {
          logout();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── API helpers ──────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }).then(r => r.data),
  me: () => apiClient.get('/auth/me').then(r => r.data),
  logout: (refreshToken: string) => apiClient.post('/auth/logout', { refreshToken }),
};

export const vehicleApi = {
  list: (params?: object) => apiClient.get('/vehicles', { params }).then(r => r.data),
  get: (id: string) => apiClient.get(/vehicles/).then(r => r.data),
  create: (data: object) => apiClient.post('/vehicles', data).then(r => r.data),
  update: (id: string, data: object) => apiClient.put(/vehicles/, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(/vehicles/),
  regenerateToken: (id: string) => apiClient.post(/vehicles//regenerate-token).then(r => r.data),
};

export const telemetryApi = {
  getHistory: (vehicleId: string, params?: object) =>
    apiClient.get(/telemetry/, { params }).then(r => r.data),
  getLatest: (vehicleId: string) =>
    apiClient.get(/telemetry//latest).then(r => r.data),
  getLocations: () => apiClient.get('/telemetry/locations').then(r => r.data),
};

export const alertApi = {
  list: (params?: object) => apiClient.get('/alerts', { params }).then(r => r.data),
  acknowledge: (id: string) => apiClient.patch(/alerts//acknowledge).then(r => r.data),
  resolve: (id: string) => apiClient.patch(/alerts//resolve).then(r => r.data),
  listRules: () => apiClient.get('/alerts/rules').then(r => r.data),
  createRule: (data: object) => apiClient.post('/alerts/rules', data).then(r => r.data),
  deleteRule: (id: string) => apiClient.delete(/alerts/rules/),
};

export const fleetApi = {
  list: () => apiClient.get('/fleets').then(r => r.data),
  create: (data: object) => apiClient.post('/fleets', data).then(r => r.data),
  update: (id: string, data: object) => apiClient.put(/fleets/, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(/fleets/),
};

export const dashboardApi = {
  stats: () => apiClient.get('/dashboard/stats').then(r => r.data),
};

export const geofenceApi = {
  list: () => apiClient.get('/geofences').then(r => r.data),
  create: (data: object) => apiClient.post('/geofences', data).then(r => r.data),
  update: (id: string, data: object) => apiClient.put(/geofences/, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(/geofences/),
};