import { z } from 'zod';

import {
  DEFAULT_LOGIN_CODE_RESEND_COOLDOWN_SECONDS,
  DEFAULT_LOGIN_CODE_TTL_MINUTES,
  DEFAULT_PRICE_CHECK_MAX_CALLS_PER_MINUTE,
  DEFAULT_PRICE_CHECK_LOCK_TTL_SECONDS,
  DEFAULT_PRICE_CHECK_MAX_RETRIES,
  DEFAULT_PRICE_CHECK_RETRY_BASE_SECONDS,
  DEFAULT_PRICE_CHECK_RETRY_JITTER_SECONDS,
  DEFAULT_PRICE_CHECK_RETRY_MAX_SECONDS,
  DEFAULT_RESET_PASSWORD_TTL_MINUTES,
  DEFAULT_SESSION_TTL_DAYS,
} from './constants/env';
import { createOptionalIntWithDefault } from './lib/zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  CRON_SECRET: z.string().min(8).optional(),
  APP_BASE_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().optional(),
  SESSION_TTL_DAYS: createOptionalIntWithDefault({
    defaultValue: DEFAULT_SESSION_TTL_DAYS,
    min: 1,
    max: 90,
  }),
  RESET_PASSWORD_TTL_MINUTES: createOptionalIntWithDefault({
    defaultValue: DEFAULT_RESET_PASSWORD_TTL_MINUTES,
    min: 5,
    max: 120,
  }),
  LOGIN_CODE_TTL_MINUTES: createOptionalIntWithDefault({
    defaultValue: DEFAULT_LOGIN_CODE_TTL_MINUTES,
    min: 2,
    max: 60,
  }),
  LOGIN_CODE_RESEND_COOLDOWN_SECONDS: createOptionalIntWithDefault({
    defaultValue: DEFAULT_LOGIN_CODE_RESEND_COOLDOWN_SECONDS,
    min: 10,
    max: 600,
  }),
  PRICE_CHECK_MAX_CALLS_PER_MINUTE: createOptionalIntWithDefault({
    defaultValue: DEFAULT_PRICE_CHECK_MAX_CALLS_PER_MINUTE,
    min: 1,
    max: 60,
  }),
  PRICE_CHECK_RETRY_BASE_SECONDS: createOptionalIntWithDefault({
    defaultValue: DEFAULT_PRICE_CHECK_RETRY_BASE_SECONDS,
    min: 1,
    max: 300,
  }),
  PRICE_CHECK_RETRY_MAX_SECONDS: createOptionalIntWithDefault({
    defaultValue: DEFAULT_PRICE_CHECK_RETRY_MAX_SECONDS,
    min: 1,
    max: 900,
  }),
  PRICE_CHECK_RETRY_JITTER_SECONDS: createOptionalIntWithDefault({
    defaultValue: DEFAULT_PRICE_CHECK_RETRY_JITTER_SECONDS,
    min: 0,
    max: 180,
  }),
  PRICE_CHECK_MAX_RETRIES: createOptionalIntWithDefault({
    defaultValue: DEFAULT_PRICE_CHECK_MAX_RETRIES,
    min: 0,
    max: 8,
  }),
  PRICE_CHECK_LOCK_TTL_SECONDS: createOptionalIntWithDefault({
    defaultValue: DEFAULT_PRICE_CHECK_LOCK_TTL_SECONDS,
    min: 30,
    max: 7200,
  }),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const parseEnv = (raw: Record<string, unknown>): EnvConfig => {
  return envSchema.parse(raw);
};
