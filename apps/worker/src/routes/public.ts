import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  PUBLIC_DROPS_DEFAULT_LIMIT,
  PUBLIC_DROPS_MAX_LIMIT,
} from '../constants/routes';
import { getPublicDrops } from '../services/public';
import type { AppEnv } from '../types';

const dedupeQuerySchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return true;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
      return true;
    }

    if (normalized === '0' || normalized === 'false' || normalized === 'no') {
      return false;
    }
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return true;
}, z.boolean());

const limitQuerySchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return PUBLIC_DROPS_DEFAULT_LIMIT;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  return value;
}, z.number().int().min(1))
  .transform(value => Math.min(value, PUBLIC_DROPS_MAX_LIMIT));

const querySchema = z.object({
  country: z.string().trim().length(2).optional(),
  dedupe: dedupeQuerySchema,
  limit: limitQuerySchema,
});

const router = new Hono<AppEnv>();

router.get('/drops', zValidator('query', querySchema), async (c) => {
  const result = await getPublicDrops(c.get('config'), c.req.valid('query'));
  return c.json(result.body, result.status);
});

export default router;
