import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { DEFAULT_COUNTRY_CODE } from '../constants/routes';
import { requireAuth } from '../middleware/auth';
import {
  createUserSubscription,
  deleteUserSubscription,
  listUserSubscriptions,
} from '../services/subscriptions';
import type { AppEnv } from '../types';
import { createOptionalPositiveNumberOrNull } from '../lib/zod';

const createSubscriptionSchema = z.object({
  appId: z.string().trim().min(1),
  country: z.string().trim().length(2).optional().default(DEFAULT_COUNTRY_CODE),
  targetPrice: createOptionalPositiveNumberOrNull(),
});

const deleteParamsSchema = z.object({
  id: z.string().uuid(),
});

const router = new Hono<AppEnv>();
router.use('*', requireAuth);

router.post('/', zValidator('json', createSubscriptionSchema), async (c) => {
  const result = await createUserSubscription(
    c.get('config'),
    c.get('authUser'),
    c.req.valid('json'),
  );
  return c.json(result.body, result.status);
});

router.get('/', async (c) => {
  const result = await listUserSubscriptions(c.get('config'), c.get('authUser').id);
  return c.json(result.body, result.status);
});

router.delete('/:id', zValidator('param', deleteParamsSchema), async (c) => {
  const result = await deleteUserSubscription(c.get('config'), c.get('authUser').id, c.req.valid('param'));
  return c.json(result.body, result.status);
});

export default router;
