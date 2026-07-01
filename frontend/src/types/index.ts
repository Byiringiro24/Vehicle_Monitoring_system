// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'FLEET_MANAGER' | 'DRIVER' | 'VIEWER';

export type VehicleStatus = 'ACTIVE' | 'IDLE' | 'OFFLINE' | 'MAINTENANCE' | 'DECOMMISSIONED';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export type AlertType =
  | 'SPEEDING'
  | 'GEOFENCE_ENTRY'
  | 'GEOFENCE_EXIT'
  | 'LOW_FUEL'
  | 'ENGINE_OVERHEAT'
  | 'BATTERY_LOW'
  | 'HARSH_BRAKING'
  | 'HARSH_ACCELERATION'
  | 'ACCIDENT'
  | 'IDLE_TOO_LONG'
  | 'OFFLINE'
  | 'CUSTOM';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  organization: Pick<Organization, 'id' | 'name' | 'slug'>;
}

export interface Fleet {
  id: string;
  name: string;
  description?: string;
  color: string;
  organizationId: string;
  managerId?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { vehicles: number };
}

export interface Vehicle {
  id: string;
  name: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  vin?: string;
  deviceToken: string;
  status: VehicleStatus;
  fuelCapacity: number;
  organizationId: string;
  fleetId?: string;
  fleet?: Pick<Fleet, 'id' | 'name' | 'color'> | null;
  lastLocation?: LastLocation | null;
  driver?: DriverProfile | null;
  createdAt: string;
  updatedAt: string;
  _count?: { telemetry: number; alerts: number };
}

export interface DriverProfile {
  id: string;
  licenseNumber: string;
  licenseExpiry?: string;
  vehicleId?: string;
  vehicle?: Pick<Vehicle, 'id' | 'name' | 'licensePlate' | 'status'> | null;
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'isActive'>;
}

export interface LastLocation {
  id: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  fuelLevel?: number | null;
  engineTemp?: number | null;
  engineOn: boolean;
  updatedAt: string;
  vehicle?: Pick<Vehicle, 'id' | 'name' | 'licensePlate' | 'status'> & {
    fleet?: Pick<Fleet, 'id' | 'name' | 'color'> | null;
  };
}

export interface Telemetry {
  id: string;
  vehicleId: string;
  timestamp: string;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  odometer?: number | null;
  engineTemp?: number | null;
  rpm?: number | null;
  engineOn: boolean;
  fuelLevel?: number | null;
  fuelUsed?: number | null;
  batteryVoltage?: number | null;
  ignition: boolean;
}

export interface Alert {
  id: string;
  vehicleId: string;
  vehicle: Pick<Vehicle, 'id' | 'name' | 'licensePlate'>;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface AlertRule {
  id: string;
  organizationId: string;
  name: string;
  type: AlertType;
  severity: AlertSeverity;
  isActive: boolean;
  conditions: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface Geofence {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  color: string;
  coordinates: [number, number][];
  type: string;
  alertOnEntry: boolean;
  alertOnExit: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { events: number };
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DashboardStats {
  totals: {
    vehicles: number;
    activeVehicles: number;
    alerts: number;
    activeAlerts: number;
    fleets: number;
  };
  vehiclesByStatus: Record<VehicleStatus, number>;
  alertsBySeverity: Record<AlertSeverity, number>;
  recentAlerts: Alert[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role'> & {
    organization: Pick<Organization, 'id' | 'name' | 'slug'>;
  };
}
