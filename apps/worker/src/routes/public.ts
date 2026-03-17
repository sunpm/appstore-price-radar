import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  PUBLIC_DROPS_DEFAULT_LIMIT,
  PUBLIC_DROPS_MAX_LIMIT,
} from '../constants/routes';
import {
  createOptionalBooleanWithDefault,
  createOptionalIntWithDefault,
} from '../lib/zod';
import { getPublicDrops } from '../services/public';
import type { AppEnv } from '../types';

const querySchema = z.object({
  country: z.string().trim().length(2).optional(),
  dedupe: createOptionalBooleanWithDefault(true),
  limit: createOptionalIntWithDefault({
    defaultValue: PUBLIC_DROPS_DEFAULT_LIMIT,
    min: 1,
    max: PUBLIC_DROPS_MAX_LIMIT,
  }),
});

const router = new Hono<AppEnv>();

router.get('/drops', zValidator('query', querySchema), async (c) => {
  const result = await getPublicDrops(c.get('config'), c.req.valid('query'));
  return c.json(result.body, result.status);
});

export default router;
