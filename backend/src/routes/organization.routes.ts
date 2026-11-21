import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authenticate);

// ── Logo upload setup ─────────────────────────────────────────────────────────
const LOGO_DIR = path.join(process.cwd(), 'uploads', 'logos');
if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGO_DIR),
  filename:    (req: any, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `org-${req.user.organizationId}-logo${ext}`);
  },
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']);
    if (allowed.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP and SVG images are allowed for logos'));
  },
});

router.get('/me', async (req: any, res, next) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
    res.json(org);
  } catch (err) { next(err); }
});

router.put('/me', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const allowedFields = ['name', 'description', 'email', 'phone', 'address', 'website', 'country', 'currency', 'taxId'];
    const payload: Record<string, any> = {};

    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        const value = req.body[key];
        if (value === null || value === undefined || value === '') {
          payload[key] = null;
          continue;
        }
        payload[key] = typeof value === 'string' ? value.trim() : value;
      }
    }

    if (payload.name && payload.name.length < 2) {
      throw new Error('Organization name must be at least 2 characters');
    }
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      throw new Error('Organization email is invalid');
    }
    if (payload.country && payload.country.length > 100) {
      throw new Error('Country name is too long');
    }
    if (payload.currency && payload.currency.length > 10) {
      throw new Error('Currency code is too long');
    }
    if (payload.phone && payload.phone.length > 30) {
      throw new Error('Phone number is too long');
    }
    if (payload.website && payload.website.length > 255) {
      throw new Error('Website URL is too long');
    }

    const org = await prisma.organization.update({
      where: { id: req.user.organizationId },
      data: payload,
    });
    res.json(org);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'A value conflicts with an existing record' });
      return;
    }
    if (err?.message) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// ── POST /organizations/me/logo — upload company logo ─────────────────────────
router.post('/me/logo', authorize('SUPER_ADMIN', 'ADMIN'), logoUpload.single('logo'), async (req: any, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Send a JPG, PNG, WEBP or SVG as form-data field "logo".' });
      return;
    }

    // Build public URL — served by Express static from /uploads
    const logoUrl = `/uploads/logos/${req.file.filename}`;

    const org = await prisma.organization.update({
      where: { id: req.user.organizationId },
      data:  { logoUrl },
    });

    res.json({ logoUrl, org });
  } catch (err) { next(err); }
});

// ── DELETE /organizations/me/logo — remove company logo ──────────────────────
router.delete('/me/logo', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
      select: { logoUrl: true },
    });

    if (org?.logoUrl) {
      const filePath = path.join(process.cwd(), org.logoUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const updated = await prisma.organization.update({
      where: { id: req.user.organizationId },
      data:  { logoUrl: null },
    });

    res.json(updated);
  } catch (err) { next(err); }
});

export default router;