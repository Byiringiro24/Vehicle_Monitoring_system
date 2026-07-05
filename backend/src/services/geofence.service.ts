import { prisma } from '../config/database';
import { getSocketServer } from '../websocket/socketServer';

// Simple point-in-polygon (ray casting algorithm)
function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export async function checkGeofences(vehicleId: string, lat: number, lng: number) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { organizationId: true },
  });
  if (!vehicle) return;

  const geofences = await prisma.geofence.findMany({
    where: { organizationId: vehicle.organizationId, isActive: true },
  });

  for (const geo of geofences) {
    // Skip if this geofence has specific vehicles assigned and this vehicle isn't one of them
    const geoAny = geo as any;
    if (geoAny.vehicleIds && geoAny.vehicleIds.length > 0 && !geoAny.vehicleIds.includes(vehicleId)) {
      continue;
    }
    const coords = geo.coordinates as [number, number][];
    const inside = pointInPolygon(lat, lng, coords);

    // Get last event for this vehicle + geofence
    const lastEvent = await prisma.geofenceEvent.findFirst({
      where: { vehicleId, geofenceId: geo.id },
      orderBy: { timestamp: 'desc' },
    });

    const wasInside = lastEvent?.eventType === 'ENTRY';

    if (inside && !wasInside) {
      await prisma.geofenceEvent.create({
        data: { vehicleId, geofenceId: geo.id, eventType: 'ENTRY' },
      });
      if (geo.alertOnEntry) {
        const alert = await prisma.alert.create({
          data: {
            vehicleId,
            type: 'GEOFENCE_ENTRY',
            severity: 'MEDIUM',
            title: `Geofence Entry: ${geo.name}`,
            message: `Vehicle entered geofence zone "${geo.name}"`,
            metadata: { geofenceId: geo.id },
          },
        });
        const io = getSocketServer();
        io?.to(`org:${vehicle.organizationId}`).emit('alert:new', alert);
      }
    } else if (!inside && wasInside) {
      await prisma.geofenceEvent.create({
        data: { vehicleId, geofenceId: geo.id, eventType: 'EXIT' },
      });
      if (geo.alertOnExit) {
        const alert = await prisma.alert.create({
          data: {
            vehicleId,
            type: 'GEOFENCE_EXIT',
            severity: 'MEDIUM',
            title: `Geofence Exit: ${geo.name}`,
            message: `Vehicle exited geofence zone "${geo.name}"`,
            metadata: { geofenceId: geo.id },
          },
        });
        const io = getSocketServer();
        io?.to(`org:${vehicle.organizationId}`).emit('alert:new', alert);
      }
    }
  }
}
