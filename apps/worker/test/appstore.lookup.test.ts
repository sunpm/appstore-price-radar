import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAppStorePrice } from '../src/lib/appstore';

const fetchMock = vi.fn();
const EMPTY_METADATA = {
  sellerName: null,
  primaryGenreName: null,
  description: null,
  averageUserRating: null,
  userRatingCount: null,
  bundleId: null,
  version: null,
  minimumOsVersion: null,
  releaseNotes: null,
};

describe('fetchAppStorePrice', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps metadata fields when App Store lookup succeeds', async () => {
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
              sellerName: 'Sunset Studio',
              primaryGenreName: 'Productivity',
              description: 'Track prices with confidence.',
              averageUserRating: 4.7,
              userRatingCount: 1820,
              bundleId: 'com.example.radarpro',
              version: '3.2.1',
              minimumOsVersion: '15.0',
              releaseNotes: 'Bug fixes and chart refinements.',
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
      sellerName: 'Sunset Studio',
      primaryGenreName: 'Productivity',
      description: 'Track prices with confidence.',
      averageUserRating: 4.7,
      userRatingCount: 1820,
      bundleId: 'com.example.radarpro',
      version: '3.2.1',
      minimumOsVersion: '15.0',
      releaseNotes: 'Bug fixes and chart refinements.',
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
      ...EMPTY_METADATA,
    });
  });
});
