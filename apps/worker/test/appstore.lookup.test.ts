import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAppStorePrice } from '../src/lib/appstore';

const fetchMock = vi.fn();
const EMPTY_METADATA = {
  sellerName: null,
  primaryGenreName: null,
  genres: [],
  description: null,
  averageUserRating: null,
  averageUserRatingForCurrentVersion: null,
  userRatingCount: null,
  userRatingCountForCurrentVersion: null,
  bundleId: null,
  version: null,
  minimumOsVersion: null,
  releaseNotes: null,
  fileSizeBytes: null,
  contentAdvisoryRating: null,
  trackContentRating: null,
  releaseDate: null,
  currentVersionReleaseDate: null,
  sellerUrl: null,
  artistViewUrl: null,
  supportedDevices: [],
  languageCodesISO2A: [],
  advisories: [],
  features: [],
  screenshotUrls: [],
  ipadScreenshotUrls: [],
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
              genres: ['Productivity', 'Utilities'],
              description: 'Track prices with confidence.',
              averageUserRating: 4.7,
              averageUserRatingForCurrentVersion: 4.9,
              userRatingCount: 1820,
              userRatingCountForCurrentVersion: 420,
              bundleId: 'com.example.radarpro',
              version: '3.2.1',
              minimumOsVersion: '15.0',
              releaseNotes: 'Bug fixes and chart refinements.',
              fileSizeBytes: '123456789',
              contentAdvisoryRating: '4+',
              trackContentRating: '4+',
              releaseDate: '2024-01-01T00:00:00Z',
              currentVersionReleaseDate: '2026-03-18T00:00:00Z',
              sellerUrl: 'https://example.com',
              artistViewUrl: 'https://apps.apple.com/us/developer/example/id1',
              supportedDevices: ['iPhone16-iPhone16', 'iPadAir11M3-iPadAir11M3'],
              languageCodesISO2A: ['EN', 'ZH'],
              advisories: ['Infrequent/Mild Horror/Fear Themes'],
              features: ['iosUniversal'],
              screenshotUrls: ['https://example.com/shot-1.png'],
              ipadScreenshotUrls: ['https://example.com/ipad-shot-1.png'],
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
      genres: ['Productivity', 'Utilities'],
      description: 'Track prices with confidence.',
      averageUserRating: 4.7,
      averageUserRatingForCurrentVersion: 4.9,
      userRatingCount: 1820,
      userRatingCountForCurrentVersion: 420,
      bundleId: 'com.example.radarpro',
      version: '3.2.1',
      minimumOsVersion: '15.0',
      releaseNotes: 'Bug fixes and chart refinements.',
      fileSizeBytes: '123456789',
      contentAdvisoryRating: '4+',
      trackContentRating: '4+',
      releaseDate: '2024-01-01T00:00:00Z',
      currentVersionReleaseDate: '2026-03-18T00:00:00Z',
      sellerUrl: 'https://example.com',
      artistViewUrl: 'https://apps.apple.com/us/developer/example/id1',
      supportedDevices: ['iPhone16-iPhone16', 'iPadAir11M3-iPadAir11M3'],
      languageCodesISO2A: ['EN', 'ZH'],
      advisories: ['Infrequent/Mild Horror/Fear Themes'],
      features: ['iosUniversal'],
      screenshotUrls: ['https://example.com/shot-1.png'],
      ipadScreenshotUrls: ['https://example.com/ipad-shot-1.png'],
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
