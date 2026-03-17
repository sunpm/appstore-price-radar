import { z } from 'zod';

import {
  DEFAULT_LOGIN_CODE_RESEND_COOLDOWN_SECONDS,
  DEFAULT_LOGIN_CODE_TTL_MINUTES,
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
});

export type EnvConfig = z.infer<typeof envSchema>;

export const parseEnv = (raw: Record<string, unknown>): EnvConfig => {
  return envSchema.parse(raw);
};
