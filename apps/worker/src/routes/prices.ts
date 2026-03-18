import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { PriceHistoryResponseDto } from '@appstore-price-radar/contracts';

import {
  DEFAULT_COUNTRY_CODE,
  PRICE_HISTORY_PAGE_SIZE_DEFAULT,
  PRICE_HISTORY_PAGE_SIZE_MAX,
  PRICE_HISTORY_WINDOW_DEFAULT,
  PRICE_HISTORY_WINDOW_VALUES,
} from '../constants/routes';
import { createOptionalIntWithDefault } from '../lib/zod';
import { getPriceHistory } from '../services/prices';
import type { PriceHistoryErrorResponse } from '../services/prices.types';
import type { AppEnv } from '../types';

const paramsSchema = z.object({
  appId: z.string().trim().min(1),
});

const querySchema = z.object({
  country: z.string().trim().length(2).optional().default(DEFAULT_COUNTRY_CODE),
  window: z.enum(PRICE_HISTORY_WINDOW_VALUES).optional().default(PRICE_HISTORY_WINDOW_DEFAULT),
  pageSize: createOptionalIntWithDefault({
    defaultValue: PRICE_HISTORY_PAGE_SIZE_DEFAULT,
    min: 1,
    max: PRICE_HISTORY_PAGE_SIZE_MAX,
  }),
  cursor: z.string().trim().min(1).optional(),
});

const router = new Hono<AppEnv>();

router.get(
  '/:appId',
  zValidator('param', paramsSchema),
  zValidator('query', querySchema),
  async (c) => {
    const { appId } = c.req.valid('param');
    const result = await getPriceHistory(c.get('config'), {
      ...c.req.valid('query'),
      appId,
    });

    const body: PriceHistoryResponseDto | PriceHistoryErrorResponse = result.body;
    return c.json(body, result.status);
  },
);

export default router;
