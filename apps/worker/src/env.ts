import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  CRON_SECRET: z.string().min(8).optional(),
  APP_BASE_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().optional(),
  SESSION_TTL_DAYS: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') {
        return 30;
      }

      if (typeof value === 'string') {
        return Number(value);
      }

      return value;
    }, z.number().int().min(1).max(90))
    .optional(),
  RESET_PASSWORD_TTL_MINUTES: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') {
        return 30;
      }

      if (typeof value === 'string') {
        return Number(value);
      }

      return value;
    }, z.number().int().min(5).max(120))
    .optional(),
  LOGIN_CODE_TTL_MINUTES: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') {
        return 10;
      }

      if (typeof value === 'string') {
        return Number(value);
      }

      return value;
    }, z.number().int().min(2).max(60))
    .optional(),
  LOGIN_CODE_RESEND_COOLDOWN_SECONDS: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') {
        return 60;
      }

      if (typeof value === 'string') {
        return Number(value);
      }

      return value;
    }, z.number().int().min(10).max(600))
    .optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const parseEnv = (raw: Record<string, unknown>): EnvConfig => {
  return envSchema.parse(raw);
};
