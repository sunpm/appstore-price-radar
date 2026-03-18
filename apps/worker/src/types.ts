import type { EnvConfig } from './env';

export type WorkerBindings = {
  DATABASE_URL: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  CRON_SECRET?: string;
  APP_BASE_URL?: string;
  CORS_ORIGIN?: string;
  SESSION_TTL_DAYS?: string;
  RESET_PASSWORD_TTL_MINUTES?: string;
  LOGIN_CODE_TTL_MINUTES?: string;
  LOGIN_CODE_RESEND_COOLDOWN_SECONDS?: string;
  PRICE_CHECK_MAX_CALLS_PER_MINUTE?: string;
  PRICE_CHECK_RETRY_BASE_SECONDS?: string;
  PRICE_CHECK_RETRY_MAX_SECONDS?: string;
  PRICE_CHECK_RETRY_JITTER_SECONDS?: string;
  PRICE_CHECK_MAX_RETRIES?: string;
  PRICE_CHECK_LOCK_TTL_SECONDS?: string;
};

export type AppEnv = {
  Bindings: WorkerBindings;
  Variables: {
    config: EnvConfig;
    authUser: {
      id: string;
      email: string;
    };
    sessionId: string;
  };
};
