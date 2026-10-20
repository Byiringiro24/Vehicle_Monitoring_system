import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate);

// ── GET /maintenance/upcoming — vehicles due for service soon ─────────────────
router.get('/upcoming', async (req: any, res, next) => {
  try {
    const orgId   = req.user.organizationId;
    const days    = parseInt(req.query.days as string ?? '30', 10);
    const cutoff  = new Date(Date.now() + days * 86400000);

    const vehicles = await prisma.vehicle.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { nextServiceDate: { lte: cutoff } },
          { inspectionExpiry: { lte: cutoff } },
          { insuranceExpiry:  { lte: cutoff } },
          { roadTaxExpiry:    { lte: cutoff } },
        ],
      },
      select: {
        id: true, name: true, licensePlate: true, manufacturer: true, model: true,
        year: true, odometer: true, status: true,
        nextServiceDate: true, lastServiceDate: true, lastServiceOdometer: true,
        oilChangeKmInterval: true,
        insuranceExpiry: true, roadTaxExpiry: true, inspectionExpiry: true,
      },
      orderBy: { nextServiceDate: 'asc' },
    });

    res.json(vehicles);
  } catch (err) { next(err); }
});

// ── GET /maintenance — list all maintenance records ───────────────────────────
router.get('/', async (req: any, res, next) => {
  try {
    const orgId     = req.user.organizationId;
    const vehicleId = req.query.vehicleId as string | undefined;
    const page      = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
    const limit     = Math.min(100, parseInt(req.query.limit as string ?? '50', 10));
    const skip      = (page - 1) * limit;

    const where: any = { vehicle: { organizationId: orgId } };
    if (vehicleId) where.vehicleId = vehicleId;

    const [records, total] = await Promise.all([
      prisma.maintenanceRecord.findMany({
        where,
        include: {
          vehicle: { select: { id: true, name: true, licensePlate: true, manufacturer: true, model: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.maintenanceRecord.count({ where }),
    ]);

    res.json({ data: records, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// ── GET /maintenance/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const record = await prisma.maintenanceRecord.findFirst({
      where: { id: req.params.id, vehicle: { organizationId: orgId } },
      include: {
        vehicle: { select: { id: true, name: true, licensePlate: true, manufacturer: true, model: true } },
      },
    });
    if (!record) { res.status(404).json({ error: 'Record not found' }); return; }
    res.json(record);
  } catch (err) { next(err); }
});

// ── POST /maintenance — create a new record ───────────────────────────────────
router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const {
      vehicleId, maintenanceType, description, garage, garageAddress,
      mechanicName, invoiceNumber, cost, currency, mileageAtService,
      nextServiceDate, nextServiceOdometer, receiptUrl, notes, date,
    } = req.body;

    if (!vehicleId || !maintenanceType || !description || cost == null) {
      res.status(400).json({ error: 'vehicleId, maintenanceType, description and cost are required' });
      return;
    }

    // Verify vehicle belongs to this org
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId: orgId },
    });
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return; }

    const record = await prisma.maintenanceRecord.create({
      data: {
        vehicleId, maintenanceType, description, garage, garageAddress,
        mechanicName, invoiceNumber,
        cost: parseFloat(cost),
        currency: currency ?? 'RWF',
        mileageAtService: mileageAtService ? parseFloat(mileageAtService) : null,
        nextServiceDate:  nextServiceDate  ? new Date(nextServiceDate)    : null,
        nextServiceOdometer: nextServiceOdometer ? parseFloat(nextServiceOdometer) : null,
        receiptUrl, notes,
        date: date ? new Date(date) : new Date(),
      },
      include: {
        vehicle: { select: { id: true, name: true, licensePlate: true } },
      },
    });

    // Update vehicle's maintenance schedule fields
    const updateData: any = { lastServiceDate: record.date };
    if (mileageAtService) updateData.lastServiceOdometer = parseFloat(mileageAtService);
    if (nextServiceDate)  updateData.nextServiceDate = new Date(nextServiceDate);
    await prisma.vehicle.update({ where: { id: vehicleId }, data: updateData });

    res.status(201).json(record);
  } catch (err) { next(err); }
});

// ── PUT /maintenance/:id — update a record ────────────────────────────────────
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;

    const existing = await prisma.maintenanceRecord.findFirst({
      where: { id: req.params.id, vehicle: { organizationId: orgId } },
    });
    if (!existing) { res.status(404).json({ error: 'Record not found' }); return; }

    const {
      maintenanceType, description, garage, garageAddress, mechanicName,
      invoiceNumber, cost, currency, mileageAtService, nextServiceDate,
      nextServiceOdometer, receiptUrl, notes, date,
    } = req.body;

    const record = await prisma.maintenanceRecord.update({
      where: { id: req.params.id },
      data: {
        maintenanceType, description, garage, garageAddress, mechanicName,
        invoiceNumber,
        cost:               cost != null ? parseFloat(cost) : undefined,
        currency:           currency ?? undefined,
        mileageAtService:   mileageAtService   ? parseFloat(mileageAtService)   : undefined,
        nextServiceDate:    nextServiceDate     ? new Date(nextServiceDate)       : undefined,
        nextServiceOdometer: nextServiceOdometer ? parseFloat(nextServiceOdometer) : undefined,
        receiptUrl, notes,
        date: date ? new Date(date) : undefined,
      },
      include: { vehicle: { select: { id: true, name: true, licensePlate: true } } },
    });

    res.json(record);
  } catch (err) { next(err); }
});

// ── DELETE /maintenance/:id ───────────────────────────────────────────────────
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const existing = await prisma.maintenanceRecord.findFirst({
      where: { id: req.params.id, vehicle: { organizationId: orgId } },
    });
    if (!existing) { res.status(404).json({ error: 'Record not found' }); return; }
    await prisma.maintenanceRecord.delete({ where: { id: req.params.id } });
    res.json({ message: 'Record deleted' });
  } catch (err) { next(err); }
});

export default router;
