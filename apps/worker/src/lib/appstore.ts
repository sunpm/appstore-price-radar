import { z } from 'zod';

import type { AppStoreLookupResult } from './appstore.types';

const lookupResponseSchema = z.object({
  resultCount: z.number(),
  results: z
    .array(
      z.object({
        trackId: z.number().optional(),
        trackName: z.string().optional(),
        price: z.number().nullable().optional(),
        currency: z.string().optional(),
        trackViewUrl: z.string().url().optional(),
        artworkUrl100: z.string().url().optional(),
        formattedPrice: z.string().optional(),
      }),
    )
    .default([]),
});

const NUMERIC_APP_ID_RE = /^\d+$/;
const APP_STORE_URL_ID_RE = /id(\d{5,})/i;

export const extractAppId = (value: string): string | null => {
  const trimmed = value.trim();

  if (NUMERIC_APP_ID_RE.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(APP_STORE_URL_ID_RE);
  return match?.[1] ?? null;
};

export const fetchAppStorePrice = async (
  appId: string,
  country: string,
): Promise<AppStoreLookupResult | null> => {
  const countryCode = country.toUpperCase();
  const url = new URL('https://itunes.apple.com/lookup');
  url.searchParams.set('id', appId);
  url.searchParams.set('country', countryCode);

  const response = await fetch(url.toString(), {
    headers: {
      'user-agent': 'appstore-price-radar/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`App Store request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const parsed = lookupResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error('App Store response schema validation failed');
  }

  if (parsed.data.resultCount === 0) {
    return null;
  }

  const item = parsed.data.results[0];

  if (!item) {
    throw new Error('App Store lookup returned inconsistent results');
  }

  const resolvedAppId = item.trackId ? String(item.trackId) : appId;
  const appName = item.trackName ?? `App ${resolvedAppId}`;
  const currency = item.currency ?? 'USD';
  const storeUrl =
    item.trackViewUrl ??
    `https://apps.apple.com/${countryCode.toLowerCase()}/app/id${resolvedAppId}`;
  const iconUrl = item.artworkUrl100 ?? null;
  const formattedPrice = item.formattedPrice ?? null;

  if (typeof item.price !== 'number' || Number.isNaN(item.price)) {
    return {
      kind: 'invalid-price',
      reason: 'missing-price',
      appId: resolvedAppId,
      country: countryCode,
      appName,
      currency,
      storeUrl,
      iconUrl,
      formattedPrice,
    };
  }

  return {
    kind: 'found',
    appId: resolvedAppId,
    country: countryCode,
    appName,
    price: item.price,
    currency,
    storeUrl,
    iconUrl,
    formattedPrice,
  };
};
