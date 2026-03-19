import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PUBLIC_DROPS_DEFAULT_LIMIT, PUBLIC_DROPS_MAX_LIMIT } from '../src/constants/routes';
import { app } from '../src/index';

const testHooks = vi.hoisted(() => ({
  getPublicDropsMock: vi.fn(),
  parseEnvMock: vi.fn(() => ({
    DATABASE_URL: 'postgres://test',
    CORS_ORIGIN: 'http://localhost:5173',
    MANUAL_PRICE_CHECKS_ENABLED: false,
  })),
}));

vi.mock('../src/env', () => ({
  parseEnv: testHooks.parseEnvMock,
}));

vi.mock('../src/services/public', () => ({
  getPublicDrops: testHooks.getPublicDropsMock,
}));

const createResponseBody = () => ({
  items: [
    {
      id: 41,
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: 'https://example.com/icon.png',
      currency: 'USD',
      oldPrice: 19.99,
      newPrice: 9.99,
      dropPercent: 50,
      detectedAt: new Date('2026-03-19T12:00:00.000Z'),
      submissionCount: 3,
    },
  ],
});

describe('/api/public/drops route', () => {
  beforeEach(() => {
    testHooks.getPublicDropsMock.mockReset();
    testHooks.parseEnvMock.mockClear();
    testHooks.getPublicDropsMock.mockResolvedValue({
      status: 200,
      body: createResponseBody(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses dedupe=true and default limit when query is omitted', async () => {
    const response = await app.request('https://example.com/api/public/drops');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(testHooks.getPublicDropsMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        dedupe: true,
        limit: PUBLIC_DROPS_DEFAULT_LIMIT,
      }),
    );
    expect(payload.items).toHaveLength(1);
    expect(Object.keys(payload.items[0]).sort()).toEqual([
      'appId',
      'appName',
      'country',
      'currency',
      'detectedAt',
      'dropPercent',
      'iconUrl',
      'id',
      'newPrice',
      'oldPrice',
      'storeUrl',
      'submissionCount',
    ].sort());
    expect(payload.items[0]).toMatchObject({
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      newPrice: 9.99,
      submissionCount: 3,
      detectedAt: '2026-03-19T12:00:00.000Z',
    });
  });

  it('passes country=US, keeps dedupe=false, and clamps limit through the schema', async () => {
    const response = await app.request(
      'https://example.com/api/public/drops?country=US&dedupe=0&limit=999',
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(testHooks.getPublicDropsMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        country: 'US',
        dedupe: false,
        limit: PUBLIC_DROPS_MAX_LIMIT,
      }),
    );
    expect(payload).toHaveProperty('items');
    expect(payload.items[0]).toHaveProperty('submissionCount', 3);
  });
});
