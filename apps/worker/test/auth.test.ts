import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { describe, expect, it } from 'vitest';

import {
  LEGACY_PASSWORD_HASH_ITERATIONS,
  hashPassword,
  verifyPassword,
} from '../src/lib/auth';
import { toAuthSessionDto, toAuthUserDto } from '../src/services/auth';

const encoder = new TextEncoder();
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const toHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
};

describe('password hashing', () => {
  it('uses worker-compatible PBKDF2 iterations for new hashes', async () => {
    const storedHash = await hashPassword('new-password-123');
    const [scheme, iterations, saltHex, hashHex] = storedHash.split('$');

    expect(scheme).toBe('pbkdf2_sha256_v1');
    expect(iterations).toBe('100000');
    expect(saltHex).toMatch(/^[0-9a-f]{32}$/);
    expect(hashHex).toMatch(/^[0-9a-f]{64}$/);
    await expect(verifyPassword('new-password-123', storedHash)).resolves.toBe(true);
  });

  it('verifies legacy PBKDF2 hashes with 120000 iterations', async () => {
    const password = 'legacy-password-123';
    const salt = new Uint8Array([
      0x00,
      0x11,
      0x22,
      0x33,
      0x44,
      0x55,
      0x66,
      0x77,
      0x88,
      0x99,
      0xaa,
      0xbb,
      0xcc,
      0xdd,
      0xee,
      0xff,
    ]);

    const legacyHashBytes = pbkdf2(sha256, encoder.encode(password), salt, {
      c: LEGACY_PASSWORD_HASH_ITERATIONS,
      dkLen: 32,
    });

    const storedHash = [
      'pbkdf2_sha256_v1',
      String(LEGACY_PASSWORD_HASH_ITERATIONS),
      toHex(salt),
      toHex(legacyHashBytes),
    ].join('$');

    await expect(verifyPassword(password, storedHash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', storedHash)).resolves.toBe(false);
  });
});

describe('auth dto mappers', () => {
  it('maps auth user dto keys exactly', () => {
    const dto = toAuthUserDto({
      id: 'user-1',
      email: 'radar@example.com',
    });

    expect(dto).toStrictEqual({
      id: 'user-1',
      email: 'radar@example.com',
    });
    expect(Object.keys(dto)).toStrictEqual(['id', 'email']);
  });

  it('maps auth session dto with ISO expiresAt', () => {
    const dto = toAuthSessionDto({
      token: 'session-token',
      expiresAt: new Date('2026-03-18T02:00:00.000Z'),
    });

    expect(dto).toStrictEqual({
      token: 'session-token',
      expiresAt: '2026-03-18T02:00:00.000Z',
    });
    expect(dto.expiresAt).toMatch(ISO_DATE_RE);
  });
});
