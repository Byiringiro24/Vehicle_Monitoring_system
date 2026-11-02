/**
 * /api/v1/support
 * Support contacts (public read, Super Admin write)
 * Support tickets (any user can create, Super Admin manages)
 * Organization approval (Super Admin only)
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { sendWelcomeEmail } from '../services/email.service';
import logger from '../utils/logger';

const router = Router();

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  PUBLIC â€” no authentication required
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// GET /support/contacts â€” visible to everyone (including pending users)
router.get('/contacts', async (_req, res, next) => {
  try {
    const contacts = await prisma.supportContact.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(contacts);
  } catch (err) { next(err); }
});

// POST /support/tickets â€” any authenticated OR unauthenticated user can submit
router.post('/tickets', async (req: any, res, next) => {
  try {
    const { userEmail, userName, subject, message, category, priority } = req.body;
    if (!userEmail || !userName || !subject || !message) {
      throw new AppError(400, 'userEmail, userName, subject and message are required');
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        organizationId: req.user?.organizationId ?? null,
        userId:         req.user?.userId ?? null,
        userEmail:      userEmail.toLowerCase(),
        userName,
        subject,
        message,
        category: category ?? 'general',
        priority: priority ?? 'MEDIUM',
      },
    });

    // Notify Super Admin via logger (email notification can be added later)
    logger.info(`[SUPPORT] New ticket #${ticket.id.slice(0,8)} from ${userEmail}: ${subject}`);
    res.status(201).json({ message: 'Ticket submitted successfully', ticketId: ticket.id });
  } catch (err) { next(err); }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  AUTHENTICATED â€” requires login
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.use(authenticate as any);

// GET /support/my-tickets â€” user's own tickets
router.get('/my-tickets', async (req: any, res, next) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tickets);
  } catch (err) { next(err); }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SUPER ADMIN â€” all ticket management + org approval + contact config
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// GET /support/admin/tickets â€” super admin + platform support agent
router.get('/admin/tickets', authorize('SUPER_ADMIN', 'SUPER_ADMIN') as any, async (req: any, res, next) => {
  try {
    const status   = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;
    const tickets  = await prisma.supportTicket.findMany({
      where: {
        ...(status   && { status:   status   as any }),
        ...(category && { category }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(tickets);
  } catch (err) { next(err); }
});

// PATCH /support/admin/tickets/:id â€” update status, add notes
router.patch('/admin/tickets/:id', authorize('SUPER_ADMIN', 'SUPER_ADMIN') as any, async (req: any, res, next) => {
  try {
    const { status, priority, adminNotes } = req.body;
    const isSupportAgent = req.user.role === 'SUPER_ADMIN';

    if (isSupportAgent) {
      const allowedStatus = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
      if (status && !allowedStatus.includes(status)) {
        throw new AppError(403, 'Support agents can only update ticket status within the support workflow');
      }
      if (priority && priority !== 'HIGH' && priority !== 'MEDIUM' && priority !== 'LOW') {
        throw new AppError(403, 'Support agents cannot change the ticket priority beyond the configured support levels');
      }
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: {
        ...(status     && { status: status as any }),
        ...(priority   && { priority: priority as any }),
        ...(adminNotes !== undefined && { adminNotes }),
        ...(status === 'RESOLVED' && { resolvedAt: new Date() }),
      },
    });
    res.json(ticket);
  } catch (err) { next(err); }
});

// GET /support/admin/pending-orgs â€” organizations awaiting approval
router.get('/admin/pending-orgs', authorize('SUPER_ADMIN') as any, async (_req, res, next) => {
  try {
    const orgs = await prisma.organization.findMany({
      where: { status: 'PENDING' },
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(orgs);
  } catch (err) { next(err); }
});

// POST /support/admin/orgs/:id/approve â€” approve a pending organization
router.post('/admin/orgs/:id/approve', authorize('SUPER_ADMIN') as any, async (req: any, res, next) => {
  try {
    const { planId, notes } = req.body;

    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) throw new AppError(404, 'Organization not found');
    if (org.status === 'ACTIVE') throw new AppError(409, 'Organization is already active');

    // Activate the org
    await prisma.organization.update({
      where: { id: req.params.id },
      data:  { status: 'ACTIVE', rejectionReason: null },
    });

    // If a plan was specified, activate it
    if (planId) {
      const { activateSubscription } = await import('../services/membership.service');
      await activateSubscription({
        organizationId: req.params.id,
        planId,
        actorUserId: req.user.userId,
        notes,
      });
    }

    // Send welcome email to the org's admin users
    const admins = await prisma.user.findMany({
      where: { organizationId: req.params.id, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { email: true, firstName: true },
    });
    for (const admin of admins) {
      sendWelcomeEmail(admin.email, admin.firstName).catch(() => {});
    }

    logger.info(`[APPROVAL] Organization "${org.name}" approved by ${req.user.userId}`);
    res.json({ message: `Organization "${org.name}" approved successfully` });
  } catch (err) { next(err); }
});

// POST /support/admin/orgs/:id/reject â€” reject a pending organization
router.post('/admin/orgs/:id/reject', authorize('SUPER_ADMIN') as any, async (req: any, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) throw new AppError(400, 'Rejection reason is required');

    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) throw new AppError(404, 'Organization not found');

    await prisma.organization.update({
      where: { id: req.params.id },
      data:  { status: 'REJECTED', rejectionReason: reason },
    });

    logger.info(`[APPROVAL] Organization "${org.name}" rejected: ${reason}`);
    res.json({ message: `Organization "${org.name}" rejected` });
  } catch (err) { next(err); }
});

// â”€â”€ Support contacts management (Super Admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// PUT /support/admin/contacts â€” replace all contacts
router.put('/admin/contacts', authorize('SUPER_ADMIN') as any, async (req: any, res, next) => {
  try {
    const contacts: Array<{
      platform: string; value: string; label?: string;
      icon?: string; url?: string; sortOrder?: number;
    }> = req.body;

    if (!Array.isArray(contacts)) throw new AppError(400, 'contacts must be an array');

    // Replace all contacts
    await prisma.$transaction([
      prisma.supportContact.deleteMany({}),
      prisma.supportContact.createMany({
        data: contacts.map((c, i) => ({
          platform:  c.platform,
          value:     c.value,
          label:     c.label,
          icon:      c.icon,
          url:       c.url,
          sortOrder: c.sortOrder ?? i,
        })),
      }),
    ]);

    const updated = await prisma.supportContact.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH /support/admin/contacts/:id â€” update one contact
router.patch('/admin/contacts/:id', authorize('SUPER_ADMIN') as any, async (req: any, res, next) => {
  try {
    const contact = await prisma.supportContact.update({
      where: { id: req.params.id },
      data:  req.body,
    });
    res.json(contact);
  } catch (err) { next(err); }
});

export default router;

