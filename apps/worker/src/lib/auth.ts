import { DEFAULT_SESSION_TTL_DAYS } from '../constants/env';

const encoder = new TextEncoder();

const HASH_ALGO = 'SHA-256';
const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_HASH_BYTES = 32;
const SALT_BYTES = 16;
const PASSWORD_SCHEME = 'pbkdf2_sha256_v1';
const BEARER_TOKEN_RE = /^Bearer\s+(.+)$/i;

const toHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
};

const fromHex = (value: string): Uint8Array => {
  if (value.length % 2 !== 0) {
    throw new Error('invalid hex string');
  }

  const bytes = new Uint8Array(value.length / 2);

  for (let i = 0; i < value.length; i += 2) {
    bytes[i / 2] = Number.parseInt(value.slice(i, i + 2), 16);
  }

  return bytes;
};

const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
};

const derivePasswordHash = async (
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> => {
  const normalizedSalt = Uint8Array.from(salt);

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: normalizedSalt,
      iterations,
      hash: HASH_ALGO,
    },
    key,
    PBKDF2_HASH_BYTES * 8,
  );

  return new Uint8Array(derivedBits);
};

export const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hashBytes = await derivePasswordHash(password, salt, PBKDF2_ITERATIONS);

  return [
    PASSWORD_SCHEME,
    String(PBKDF2_ITERATIONS),
    toHex(salt),
    toHex(hashBytes),
  ].join('$');
};

export const verifyPassword = async (
  password: string,
  storedHash: string,
): Promise<boolean> => {
  const [scheme, iterationsRaw, saltHex, hashHex] = storedHash.split('$');

  if (!scheme || !iterationsRaw || !saltHex || !hashHex) {
    return false;
  }

  if (scheme !== PASSWORD_SCHEME) {
    return false;
  }

  const iterations = Number.parseInt(iterationsRaw, 10);

  if (!Number.isInteger(iterations) || iterations < 1) {
    return false;
  }

  const salt = fromHex(saltHex);
  const targetHash = fromHex(hashHex);
  const actualHash = await derivePasswordHash(password, salt, iterations);

  return constantTimeEqual(targetHash, actualHash);
};

export const generateSessionToken = (): string => {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(tokenBytes);
};

export const hashSessionToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest(HASH_ALGO, encoder.encode(token));
  return toHex(new Uint8Array(digest));
};

export const parseBearerToken = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const match = value.match(BEARER_TOKEN_RE);
  return match?.[1]?.trim() || null;
};

export const buildSessionExpiry = (days = DEFAULT_SESSION_TTL_DAYS): Date => {
  const safeDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_SESSION_TTL_DAYS;
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + safeDays);
  return expiresAt;
};
