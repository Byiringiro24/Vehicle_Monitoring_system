import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatSpeed(speed: number | null | undefined): string {
  if (speed == null) return 'N/A';
  return `${Math.round(speed)} km/h`;
}

export function formatFuel(level: number | null | undefined): string {
  if (level == null) return 'N/A';
  return `${Math.round(level)}%`;
}

export function formatTemp(temp: number | null | undefined): string {
  if (temp == null) return 'N/A';
  return `${Math.round(temp)}°C`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(date));
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    IDLE: 'bg-yellow-100 text-yellow-800',
    OFFLINE: 'bg-gray-100 text-gray-800',
    MAINTENANCE: 'bg-orange-100 text-orange-800',
    DECOMMISSIONED: 'bg-red-100 text-red-800',
  };
  return colors[status] ?? 'bg-gray-100 text-gray-800';
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-800 border-red-200',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    LOW: 'bg-blue-100 text-blue-800 border-blue-200',
    INFO: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return colors[severity] ?? 'bg-gray-100 text-gray-800';
}
