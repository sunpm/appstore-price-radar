import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  OTP_CODE_PATTERN,
} from '../constants/auth';
import type { AppEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import {
  loginWithPassword,
  registerWithLoginCode,
  requestPasswordReset,
  resetPassword,
  revokeSession,
  sendLoginCode,
  verifyLoginCode,
} from '../services/auth';

const passwordAuthSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  code: z.string().trim().regex(OTP_CODE_PATTERN),
});

const emailSchema = z.object({
  email: z.string().trim().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(32).max(256),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

const verifyCodeSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(OTP_CODE_PATTERN),
});

const router = new Hono<AppEnv>();

router.post('/register', zValidator('json', registerSchema), async (c) => {
  const result = await registerWithLoginCode(c.get('config'), c.req.valid('json'));
  return c.json(result.body, result.status);
});

router.post('/login', zValidator('json', passwordAuthSchema), async (c) => {
  const result = await loginWithPassword(c.get('config'), c.req.valid('json'));
  return c.json(result.body, result.status);
});

router.post('/forgot-password', zValidator('json', emailSchema), async (c) => {
  const result = await requestPasswordReset(c.get('config'), c.req.valid('json'));
  return c.json(result.body, result.status);
});

router.post('/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
  const result = await resetPassword(c.get('config'), c.req.valid('json'));
  return c.json(result.body, result.status);
});

router.post('/send-login-code', zValidator('json', emailSchema), async (c) => {
  const result = await sendLoginCode(c.get('config'), c.req.valid('json'));
  return c.json(result.body, result.status);
});

router.post('/verify-login-code', zValidator('json', verifyCodeSchema), async (c) => {
  const result = await verifyLoginCode(c.get('config'), c.req.valid('json'));
  return c.json(result.body, result.status);
});

router.get('/me', requireAuth, async (c) => {
  return c.json({
    user: c.get('authUser'),
  });
});

router.post('/logout', requireAuth, async (c) => {
  const result = await revokeSession(c.get('config'), c.get('sessionId'));
  return c.json(result.body, result.status);
});

export default router;
