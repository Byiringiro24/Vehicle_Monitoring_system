/**
 * /api/v1/documents
 * Document upload, management, and verification.
 * Files are stored in /uploads on the container filesystem.
 * In production, replace storage with S3-compatible object storage.
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();
router.use(authenticate);

// ── Multer configuration ──────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic',
]);
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

// ── Helper: compute SHA-256 of a file ────────────────────────────────────────
function hashFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ── Helper: build public URL from stored filename ────────────────────────────
function fileUrl(filename: string): string {
  const appUrl = process.env.APP_URL ?? 'http://localhost:4000';
  return `${appUrl}/uploads/${filename}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /documents — list documents (filter by ownerType + ownerId) ───────────
router.get('/', async (req: any, res, next) => {
  try {
    const orgId     = req.user.organizationId;
    const ownerType = req.query.ownerType as string | undefined;
    const ownerId   = req.query.ownerId   as string | undefined;
    const status    = req.query.status    as string | undefined;
    const category  = req.query.category  as string | undefined;

    const where: any = { organizationId: orgId };
    if (ownerType) where.ownerType = ownerType;
    if (ownerId)   where.ownerId   = ownerId;
    if (status)    where.status    = status;
    if (category)  where.category  = category;

    const docs = await prisma.document.findMany({
      where,
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(docs);
  } catch (err) { next(err); }
});

// ── GET /documents/compliance — expiry summary for org ───────────────────────
router.get('/compliance', async (req: any, res, next) => {
  try {
    const orgId  = req.user.organizationId;
    const now    = new Date();
    const in30d  = new Date(Date.now() + 30 * 86400000);
    const in7d   = new Date(Date.now() +  7 * 86400000);

    const [expired, expiring30, expiring7, pendingReview, verified, pendingUpload] =
      await Promise.all([
        prisma.document.count({ where: { organizationId: orgId, expiresAt: { lt: now }, status: { not: 'EXPIRED' } } }),
        prisma.document.count({ where: { organizationId: orgId, expiresAt: { gte: now, lte: in30d }, status: 'VERIFIED' } }),
        prisma.document.count({ where: { organizationId: orgId, expiresAt: { gte: now, lte: in7d  }, status: 'VERIFIED' } }),
        prisma.document.count({ where: { organizationId: orgId, status: 'PENDING_REVIEW' } }),
        prisma.document.count({ where: { organizationId: orgId, status: 'VERIFIED' } }),
        prisma.document.count({ where: { organizationId: orgId, status: 'PENDING_UPLOAD' } }),
      ]);

    // Critical docs expiring within 30 days
    const criticalDocs = await prisma.document.findMany({
      where: {
        organizationId: orgId,
        expiresAt: { gte: now, lte: in30d },
        status: { in: ['VERIFIED', 'PENDING_REVIEW'] },
      },
      orderBy: { expiresAt: 'asc' },
      take: 20,
    });

    res.json({ expired, expiring30, expiring7, pendingReview, verified, pendingUpload, criticalDocs });
  } catch (err) { next(err); }
});

// ── GET /documents/:id ────────────────────────────────────────────────────────
router.get('/:id', async (req: any, res, next) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!doc) throw new AppError(404, 'Document not found');
    res.json(doc);
  } catch (err) { next(err); }
});

// ── POST /documents — create a document slot (before uploading the file) ─────
router.post('/', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const { ownerType, ownerId, category, label, documentNumber, issuer, issuedAt, expiresAt, notes } = req.body;

    if (!ownerType || !ownerId || !label) {
      throw new AppError(400, 'ownerType, ownerId and label are required');
    }

    const doc = await prisma.document.create({
      data: {
        organizationId: orgId,
        ownerType,
        ownerId,
        category: category ?? 'OTHER',
        label,
        documentNumber,
        issuer,
        issuedAt:  issuedAt  ? new Date(issuedAt)  : undefined,
        expiresAt: expiresAt ? new Date(expiresAt)  : undefined,
        notes,
        status: 'PENDING_UPLOAD',
        uploadedById: req.user.userId,
      },
    });
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

// ── POST /documents/:id/upload — attach a file to an existing document slot ──
router.post('/:id/upload', upload.single('file'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user.organizationId;
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!doc) throw new AppError(404, 'Document not found');
    if (!req.file) throw new AppError(400, 'No file provided');

    const storedPath = req.file.path;
    const hash       = hashFile(storedPath);
    const url        = fileUrl(req.file.filename);

    // If the doc already had a file, delete the old one
    if (doc.fileUrl && doc.fileName) {
      const oldPath = path.join(UPLOAD_DIR, doc.fileName);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        fileUrl:       url,
        fileName:      req.file.filename,
        fileMimeType:  req.file.mimetype,
        fileSizeBytes: req.file.size,
        fileHash:      hash,
        status:        'PENDING_REVIEW',
        uploadedById:  req.user.userId,
      },
    });

    logger.info(`[DOCS] File uploaded for document ${doc.id} by user ${req.user.userId}`);
    res.json(updated);
  } catch (err) { next(err); }
});

// ── POST /documents/upload-and-create — create slot + upload in one step ─────
router.post('/upload-and-create', upload.single('file'), async (req: any, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user.organizationId;
    if (!req.file) throw new AppError(400, 'No file provided');

    const { ownerType, ownerId, category, label, documentNumber, issuer, issuedAt, expiresAt, notes } = req.body;
    if (!ownerType || !ownerId || !label) {
      // Clean up the uploaded file before throwing
      fs.unlinkSync(req.file.path);
      throw new AppError(400, 'ownerType, ownerId and label are required');
    }

    const hash = hashFile(req.file.path);
    const url  = fileUrl(req.file.filename);

    const doc = await prisma.document.create({
      data: {
        organizationId: orgId,
        ownerType,
        ownerId,
        category:      category ?? 'OTHER',
        label,
        documentNumber,
        issuer,
        issuedAt:      issuedAt  ? new Date(issuedAt)  : undefined,
        expiresAt:     expiresAt ? new Date(expiresAt)  : undefined,
        notes,
        fileUrl:       url,
        fileName:      req.file.filename,
        fileMimeType:  req.file.mimetype,
        fileSizeBytes: req.file.size,
        fileHash:      hash,
        status:        'PENDING_REVIEW',
        uploadedById:  req.user.userId,
      },
    });

    res.status(201).json(doc);
  } catch (err) { next(err); }
});

// ── PUT /documents/:id — update metadata (no file change) ────────────────────
router.put('/:id', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const doc = await prisma.document.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!doc) throw new AppError(404, 'Document not found');

    const { label, documentNumber, issuer, issuedAt, expiresAt, notes, category } = req.body;
    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        ...(label          && { label }),
        ...(documentNumber && { documentNumber }),
        ...(issuer         && { issuer }),
        ...(category       && { category }),
        ...(notes !== undefined && { notes }),
        ...(issuedAt  && { issuedAt:  new Date(issuedAt) }),
        ...(expiresAt && { expiresAt: new Date(expiresAt) }),
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ── POST /documents/:id/verify — mark as verified ────────────────────────────
router.post('/:id/verify', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const doc = await prisma.document.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!doc) throw new AppError(404, 'Document not found');
    if (!doc.fileUrl) throw new AppError(400, 'Cannot verify a document with no file uploaded');

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: { status: 'VERIFIED', reviewedById: req.user.userId, reviewedAt: new Date(), rejectionReason: null },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ── POST /documents/:id/reject — mark as rejected ────────────────────────────
router.post('/:id/reject', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const { reason } = req.body;
    if (!reason) throw new AppError(400, 'Rejection reason is required');

    const doc = await prisma.document.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!doc) throw new AppError(404, 'Document not found');

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: { status: 'REJECTED', reviewedById: req.user.userId, reviewedAt: new Date(), rejectionReason: reason },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ── DELETE /documents/:id — remove document and its file ─────────────────────
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const doc = await prisma.document.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!doc) throw new AppError(404, 'Document not found');

    if (doc.fileName) {
      const filePath = path.join(UPLOAD_DIR, doc.fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.document.delete({ where: { id: doc.id } });
    res.json({ message: 'Document deleted' });
  } catch (err) { next(err); }
});

export default router;
