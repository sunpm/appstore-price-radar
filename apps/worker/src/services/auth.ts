import { and, count, desc, eq, gt, isNull, like, ne } from 'drizzle-orm';

import {
  OTP_CODE_LENGTH,
  OTP_CODE_MODULO,
  OTP_ONLY_PASSWORD_PREFIX,
} from '../constants/auth';
import {
  DEFAULT_LOGIN_CODE_RESEND_COOLDOWN_SECONDS,
  DEFAULT_LOGIN_CODE_TTL_MINUTES,
  DEFAULT_RESET_PASSWORD_TTL_MINUTES,
  DEFAULT_SESSION_TTL_DAYS,
} from '../constants/env';
import type { EnvConfig } from '../env';
import { getDb } from '../db/client';
import { loginCodes, passwordResetTokens, userSessions, users } from '../db/schema';
import {
  LEGACY_PASSWORD_HASH_PREFIX,
  buildSessionExpiry,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  verifyPassword,
} from '../lib/auth';
import { sendLoginCodeEmail, sendPasswordResetEmail } from '../lib/auth-emails';
import type {
  AuthCooldownResponse,
  ChangePasswordPayload,
  AuthErrorResponse,
  AuthHttpStatus,
  AuthOkResponse,
  AuthResponsePayload,
  AuthServiceResponse,
  AuthSession,
  AuthUserRow,
  AuthWithPasswordPayload,
  EmailPayload,
  RegisterWithCodePayload,
  ResetPasswordPayload,
  VerifyLoginCodePayload,
} from './auth.types';
import {
  assertAuthRateLimit,
  clearAuthRateLimit,
  recordAuthRateLimitFailure,
  type AuthRateLimitInput,
} from './auth-rate-limit';

type AuthOrErrorBody = AuthResponsePayload | AuthErrorResponse;
type OkOrErrorBody = AuthOkResponse | AuthErrorResponse;
type CooldownOrErrorBody = AuthCooldownResponse | AuthErrorResponse;
const LEGACY_PASSWORD_HASH_LIKE = `${LEGACY_PASSWORD_HASH_PREFIX}%`;

const buildOtpOnlyPasswordHash = (): string => {
  return `${OTP_ONLY_PASSWORD_PREFIX}$${generateSessionToken()}`;
};

const isOtpOnlyPasswordHash = (value: string): boolean => {
  return value.startsWith(`${OTP_ONLY_PASSWORD_PREFIX}$`);
};

const buildServiceResponse = <TBody>(
  status: AuthHttpStatus,
  body: TBody,
): AuthServiceResponse<TBody> => {
  return { status, body };
};

const buildRateLimitErrorBody = (retryAfterSeconds: number): AuthErrorResponse => {
  return {
    error: `Too many attempts. Please wait ${retryAfterSeconds}s before retrying`,
    retryAfterSeconds,
  };
};

const assertRateLimitOrBuildResponse = async (
  config: EnvConfig,
  input: AuthRateLimitInput,
): Promise<AuthServiceResponse<AuthErrorResponse> | null> => {
  const assertion = await assertAuthRateLimit(config, input);

  if (!assertion.limited) {
    return null;
  }

  return buildServiceResponse(429, buildRateLimitErrorBody(assertion.retryAfterSeconds));
};

const recordFailureOrBuildRateLimitResponse = async (
  config: EnvConfig,
  input: AuthRateLimitInput,
): Promise<AuthServiceResponse<AuthErrorResponse> | null> => {
  const assertion = await recordAuthRateLimitFailure(config, input);

  if (!assertion.limited) {
    return null;
  }

  return buildServiceResponse(429, buildRateLimitErrorBody(assertion.retryAfterSeconds));
};

const isEmailServiceConfigured = (config: EnvConfig): boolean => {
  return Boolean(config.RESEND_API_KEY && config.RESEND_FROM_EMAIL);
};

export const countLegacyPasswordHashUsers = async (config: EnvConfig): Promise<number> => {
  const db = getDb(config);

  const [row] = await db
    .select({ total: count() })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        like(users.passwordHash, LEGACY_PASSWORD_HASH_LIKE),
      ),
    );

  return Number(row?.total ?? 0);
};

const createSession = async (
  config: EnvConfig,
  userId: string,
): Promise<AuthSession> => {
  const db = getDb(config);
  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = buildSessionExpiry(config.SESSION_TTL_DAYS ?? DEFAULT_SESSION_TTL_DAYS);

  await db.insert(userSessions).values({
    userId,
    tokenHash,
    expiresAt,
    lastUsedAt: new Date(),
  });

  return { token, expiresAt };
};

const buildAuthResponse = (
  user: Pick<AuthUserRow, 'id' | 'email'>,
  session: AuthSession,
): AuthResponsePayload => {
  return {
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
    },
  };
};

const findUserByEmail = async (
  config: EnvConfig,
  email: string,
): Promise<AuthUserRow | null> => {
  const db = getDb(config);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user ?? null;
};

const findActiveUserByEmail = async (
  config: EnvConfig,
  email: string,
): Promise<AuthUserRow | null> => {
  const db = getDb(config);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.email, email), eq(users.isActive, true)))
    .limit(1);

  return user ?? null;
};

const findActiveUserById = async (
  config: EnvConfig,
  userId: string,
): Promise<AuthUserRow | null> => {
  const db = getDb(config);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1);

  return user ?? null;
};

const ensureLoginCodeUserByEmail = async (
  config: EnvConfig,
  email: string,
): Promise<AuthUserRow> => {
  const db = getDb(config);
  const now = new Date();

  const existing = await findUserByEmail(config, email);

  if (existing) {
    if (!existing.isActive) {
      await db
        .update(users)
        .set({
          isActive: true,
          updatedAt: now,
        })
        .where(eq(users.id, existing.id));

      return { ...existing, isActive: true };
    }

    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash: buildOtpOnlyPasswordHash(),
      isActive: true,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: users.email,
    })
    .returning({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    });

  if (created) {
    return created;
  }

  const raced = await findUserByEmail(config, email);

  if (!raced) {
    throw new Error('Failed to create login-code user');
  }

  if (!raced.isActive) {
    await db
      .update(users)
      .set({
        isActive: true,
        updatedAt: now,
      })
      .where(eq(users.id, raced.id));

    return { ...raced, isActive: true };
  }

  return raced;
};

const consumeLoginCode = async (
  config: EnvConfig,
  userId: string,
  code: string,
): Promise<boolean> => {
  const db = getDb(config);
  const codeHash = await hashSessionToken(`${userId}:${code}`);
  const now = new Date();

  const [match] = await db
    .select({
      id: loginCodes.id,
    })
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.userId, userId),
        eq(loginCodes.codeHash, codeHash),
        isNull(loginCodes.usedAt),
        gt(loginCodes.expiresAt, now),
      ),
    )
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);

  if (!match) {
    return false;
  }

  const [consumed] = await db
    .update(loginCodes)
    .set({
      usedAt: now,
    })
    .where(and(eq(loginCodes.id, match.id), isNull(loginCodes.usedAt)))
    .returning({
      id: loginCodes.id,
    });

  return Boolean(consumed);
};

const generateOtpCode = (): string => {
  const bucket = new Uint32Array(1);
  crypto.getRandomValues(bucket);
  const code = bucket[0] % OTP_CODE_MODULO;
  return String(code).padStart(OTP_CODE_LENGTH, '0');
};

export const registerWithLoginCode = async (
  config: EnvConfig,
  payload: RegisterWithCodePayload,
): Promise<AuthServiceResponse<AuthOrErrorBody>> => {
  const db = getDb(config);
  const email = normalizeEmail(payload.email);
  const verifyScopeInput: AuthRateLimitInput = {
    scope: 'verify-login-code',
    subjectKey: email,
  };
  const rateLimitResponse = await assertRateLimitOrBuildResponse(config, verifyScopeInput);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const exists = await findUserByEmail(config, email);

  if (!exists) {
    const blocked = await recordFailureOrBuildRateLimitResponse(config, verifyScopeInput);

    if (blocked) {
      return blocked;
    }

    return buildServiceResponse(400, { error: 'Please request a login code first' });
  }

  if (!isOtpOnlyPasswordHash(exists.passwordHash)) {
    return buildServiceResponse(409, { error: 'Email already registered' });
  }

  const codeMatched = await consumeLoginCode(config, exists.id, payload.code);

  if (!codeMatched) {
    const blocked = await recordFailureOrBuildRateLimitResponse(config, verifyScopeInput);

    if (blocked) {
      return blocked;
    }

    return buildServiceResponse(401, { error: 'Invalid code' });
  }

  const now = new Date();
  const passwordHash = await hashPassword(payload.password);

  await db
    .update(users)
    .set({
      passwordHash,
      isActive: true,
      updatedAt: now,
    })
    .where(eq(users.id, exists.id));

  await clearAuthRateLimit(config, verifyScopeInput);

  const session = await createSession(config, exists.id);
  return buildServiceResponse(200, buildAuthResponse(exists, session));
};

export const loginWithPassword = async (
  config: EnvConfig,
  payload: AuthWithPasswordPayload,
): Promise<AuthServiceResponse<AuthOrErrorBody>> => {
  const email = normalizeEmail(payload.email);
  const loginScopeInput: AuthRateLimitInput = {
    scope: 'login-password',
    subjectKey: email,
  };
  const rateLimitResponse = await assertRateLimitOrBuildResponse(config, loginScopeInput);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await findActiveUserByEmail(config, email);

  if (!user) {
    const blocked = await recordFailureOrBuildRateLimitResponse(config, loginScopeInput);

    if (blocked) {
      return blocked;
    }

    return buildServiceResponse(401, { error: 'Invalid credentials' });
  }

  const valid = await verifyPassword(payload.password, user.passwordHash);

  if (!valid) {
    const blocked = await recordFailureOrBuildRateLimitResponse(config, loginScopeInput);

    if (blocked) {
      return blocked;
    }

    return buildServiceResponse(401, { error: 'Invalid credentials' });
  }

  await clearAuthRateLimit(config, loginScopeInput);

  const session = await createSession(config, user.id);
  return buildServiceResponse(200, buildAuthResponse(user, session));
};

export const requestPasswordReset = async (
  config: EnvConfig,
  payload: EmailPayload,
): Promise<AuthServiceResponse<OkOrErrorBody>> => {
  if (!isEmailServiceConfigured(config)) {
    return buildServiceResponse(503, { error: 'Email service is not configured' });
  }

  const email = normalizeEmail(payload.email);
  const forgotScopeInput: AuthRateLimitInput = {
    scope: 'forgot-password',
    subjectKey: email,
  };
  const rateLimitResponse = await assertRateLimitOrBuildResponse(config, forgotScopeInput);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await findActiveUserByEmail(config, email);

  if (!user) {
    await recordAuthRateLimitFailure(config, forgotScopeInput);
    return buildServiceResponse(200, { ok: true });
  }

  const now = new Date();
  const resetToken = generateSessionToken();
  const tokenHash = await hashSessionToken(resetToken);
  const ttlMinutes = config.RESET_PASSWORD_TTL_MINUTES ?? DEFAULT_RESET_PASSWORD_TTL_MINUTES;
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
  const db = getDb(config);

  await db
    .update(passwordResetTokens)
    .set({
      usedAt: now,
    })
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    );

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const result = await sendPasswordResetEmail(config, user.email, resetToken, ttlMinutes);

  if (!result.sent) {
    console.error('sendPasswordResetEmail failed', result.reason);
    return buildServiceResponse(503, { error: 'Failed to send reset email' });
  }

  await recordAuthRateLimitFailure(config, forgotScopeInput);

  return buildServiceResponse(200, { ok: true });
};

export const resetPassword = async (
  config: EnvConfig,
  payload: ResetPasswordPayload,
): Promise<AuthServiceResponse<OkOrErrorBody>> => {
  const db = getDb(config);
  const tokenHash = await hashSessionToken(payload.token);
  const resetScopeInput: AuthRateLimitInput = {
    scope: 'reset-password',
    subjectKey: tokenHash,
  };
  const rateLimitResponse = await assertRateLimitOrBuildResponse(config, resetScopeInput);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const now = new Date();

  const [tokenRow] = await db
    .select({
      id: passwordResetTokens.id,
      userId: users.id,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(passwordResetTokens.userId, users.id))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  if (!tokenRow) {
    const blocked = await recordFailureOrBuildRateLimitResponse(config, resetScopeInput);

    if (blocked) {
      return blocked;
    }

    return buildServiceResponse(400, { error: 'Invalid or expired reset token' });
  }

  const passwordHash = await hashPassword(payload.password);

  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: now,
    })
    .where(eq(users.id, tokenRow.userId));

  await db
    .update(passwordResetTokens)
    .set({
      usedAt: now,
    })
    .where(eq(passwordResetTokens.id, tokenRow.id));

  await db.delete(userSessions).where(eq(userSessions.userId, tokenRow.userId));
  await clearAuthRateLimit(config, resetScopeInput);

  return buildServiceResponse(200, { ok: true });
};

export const changePassword = async (
  config: EnvConfig,
  userId: string,
  currentSessionId: string,
  payload: ChangePasswordPayload,
): Promise<AuthServiceResponse<OkOrErrorBody>> => {
  const user = await findActiveUserById(config, userId);

  if (!user) {
    return buildServiceResponse(401, { error: 'Unauthorized' });
  }

  const otpOnlyAccount = isOtpOnlyPasswordHash(user.passwordHash);
  const currentPasswordMatched = otpOnlyAccount
    ? true
    : await verifyPassword(payload.currentPassword, user.passwordHash);

  if (!currentPasswordMatched) {
    return buildServiceResponse(401, { error: 'Current password is incorrect' });
  }

  if (!otpOnlyAccount && payload.currentPassword === payload.newPassword) {
    return buildServiceResponse(400, {
      error: 'New password must be different from current password',
    });
  }

  const db = getDb(config);
  const passwordHash = await hashPassword(payload.newPassword);
  const now = new Date();

  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  await db
    .delete(userSessions)
    .where(and(eq(userSessions.userId, user.id), ne(userSessions.id, currentSessionId)));

  return buildServiceResponse(200, { ok: true });
};

export const sendLoginCode = async (
  config: EnvConfig,
  payload: EmailPayload,
): Promise<AuthServiceResponse<CooldownOrErrorBody>> => {
  if (!isEmailServiceConfigured(config)) {
    return buildServiceResponse(503, { error: 'Email service is not configured' });
  }

  const email = normalizeEmail(payload.email);
  const sendCodeScopeInput: AuthRateLimitInput = {
    scope: 'send-login-code',
    subjectKey: email,
  };
  const rateLimitResponse = await assertRateLimitOrBuildResponse(config, sendCodeScopeInput);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const loginCodeCooldownSeconds = config.LOGIN_CODE_RESEND_COOLDOWN_SECONDS
    ?? DEFAULT_LOGIN_CODE_RESEND_COOLDOWN_SECONDS;

  let user: AuthUserRow;

  try {
    user = await ensureLoginCodeUserByEmail(config, email);
  } catch (error) {
    console.error('ensureLoginCodeUserByEmail failed', error);
    return buildServiceResponse(500, { error: 'Failed to prepare login code user' });
  }

  const db = getDb(config);
  const [latestCode] = await db
    .select({
      createdAt: loginCodes.createdAt,
    })
    .from(loginCodes)
    .where(eq(loginCodes.userId, user.id))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);

  if (latestCode?.createdAt) {
    const elapsedSeconds = Math.floor((Date.now() - latestCode.createdAt.getTime()) / 1000);
    const retryAfterSeconds = loginCodeCooldownSeconds - elapsedSeconds;

    if (retryAfterSeconds > 0) {
      return buildServiceResponse(429, {
        error: `Please wait ${retryAfterSeconds}s before requesting another code`,
        retryAfterSeconds,
      });
    }
  }

  const code = generateOtpCode();
  const codeHash = await hashSessionToken(`${user.id}:${code}`);
  const ttlMinutes = config.LOGIN_CODE_TTL_MINUTES ?? DEFAULT_LOGIN_CODE_TTL_MINUTES;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

  await db
    .update(loginCodes)
    .set({
      usedAt: now,
    })
    .where(
      and(
        eq(loginCodes.userId, user.id),
        isNull(loginCodes.usedAt),
        gt(loginCodes.expiresAt, now),
      ),
    );

  const [createdCode] = await db
    .insert(loginCodes)
    .values({
      userId: user.id,
      codeHash,
      expiresAt,
    })
    .returning({
      id: loginCodes.id,
    });

  const result = await sendLoginCodeEmail(config, user.email, code, ttlMinutes);

  if (!result.sent) {
    if (createdCode?.id) {
      try {
        await db.delete(loginCodes).where(eq(loginCodes.id, createdCode.id));
      } catch (cleanupError) {
        console.error('login code rollback failed', cleanupError);
      }
    }

    console.error('sendLoginCodeEmail failed', result.reason);
    return buildServiceResponse(503, { error: 'Failed to send login code email' });
  }

  await recordAuthRateLimitFailure(config, sendCodeScopeInput);

  return buildServiceResponse(200, {
    ok: true,
    cooldownSeconds: loginCodeCooldownSeconds,
  });
};

export const verifyLoginCode = async (
  config: EnvConfig,
  payload: VerifyLoginCodePayload,
): Promise<AuthServiceResponse<AuthOrErrorBody>> => {
  const email = normalizeEmail(payload.email);
  const verifyScopeInput: AuthRateLimitInput = {
    scope: 'verify-login-code',
    subjectKey: email,
  };
  const rateLimitResponse = await assertRateLimitOrBuildResponse(config, verifyScopeInput);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await findActiveUserByEmail(config, email);

  if (!user) {
    const blocked = await recordFailureOrBuildRateLimitResponse(config, verifyScopeInput);

    if (blocked) {
      return blocked;
    }

    return buildServiceResponse(401, { error: 'Invalid code' });
  }

  const codeMatched = await consumeLoginCode(config, user.id, payload.code);

  if (!codeMatched) {
    const blocked = await recordFailureOrBuildRateLimitResponse(config, verifyScopeInput);

    if (blocked) {
      return blocked;
    }

    return buildServiceResponse(401, { error: 'Invalid code' });
  }

  await clearAuthRateLimit(config, verifyScopeInput);

  const session = await createSession(config, user.id);
  return buildServiceResponse(200, buildAuthResponse(user, session));
};

export const revokeSession = async (
  config: EnvConfig,
  sessionId: string,
): Promise<AuthServiceResponse<AuthOkResponse>> => {
  const db = getDb(config);

  await db.delete(userSessions).where(eq(userSessions.id, sessionId));

  return buildServiceResponse(200, { ok: true });
};
