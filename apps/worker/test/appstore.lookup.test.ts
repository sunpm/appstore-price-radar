import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAppStorePrice } from '../src/lib/appstore';

const fetchMock = vi.fn();

describe('fetchAppStorePrice', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns found when App Store includes a numeric price', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          resultCount: 1,
          results: [
            {
              trackId: 123456789,
              trackName: 'Radar Pro',
              price: 9.99,
              currency: 'USD',
              trackViewUrl: 'https://apps.apple.com/us/app/id123456789',
              artworkUrl100: 'https://example.com/icon.png',
              formattedPrice: '$9.99',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    const result = await fetchAppStorePrice('123456789', 'us');

    expect(result).toEqual({
      kind: 'found',
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      price: 9.99,
      currency: 'USD',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: 'https://example.com/icon.png',
      formattedPrice: '$9.99',
    });
  });

  it('returns invalid-price when App Store omits numeric price', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          resultCount: 1,
          results: [
            {
              trackId: 123456789,
              trackName: 'Radar Pro',
              currency: 'USD',
              trackViewUrl: 'https://apps.apple.com/us/app/id123456789',
              artworkUrl100: 'https://example.com/icon.png',
              formattedPrice: '$9.99',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    const result = await fetchAppStorePrice('123456789', 'us');

    expect(result).toEqual({
      kind: 'invalid-price',
      reason: 'missing-price',
      appId: '123456789',
      country: 'US',
      appName: 'Radar Pro',
      currency: 'USD',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      iconUrl: 'https://example.com/icon.png',
      formattedPrice: '$9.99',
    });
  });
});
