import { Router } from 'express';
import {
  login, refresh, logout, me, changePassword,
  forgotPassword, resetPassword, register, registerPersonal,
  switchOrganization,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register',         register);         // public — new org + admin account
router.post('/register-personal', registerPersonal); // public — personal account (owner/driver/customer)
router.post('/login',            login);
router.post('/refresh',          refresh);
router.post('/logout',           logout);
router.post('/switch-organization', authenticate, switchOrganization);
router.get('/me',                authenticate, me);
router.post('/change-password',  authenticate, changePassword);

// Password recovery
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

export default router;
