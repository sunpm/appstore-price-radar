import type { CountryOption } from '../types/common'

export const ALL_COUNTRY_CODE = 'ALL'

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'US', label: '美国' },
  { code: 'CN', label: '中国大陆' },
  { code: 'HK', label: '中国香港' },
  { code: 'TW', label: '中国台湾' },
  { code: 'JP', label: '日本' },
  { code: 'KR', label: '韩国' },
  { code: 'SG', label: '新加坡' },
  { code: 'GB', label: '英国' },
  { code: 'DE', label: '德国' },
  { code: 'FR', label: '法国' },
  { code: 'CA', label: '加拿大' },
  { code: 'AU', label: '澳大利亚' },
  { code: 'IN', label: '印度' },
  { code: 'BR', label: '巴西' },
  { code: 'MX', label: '墨西哥' },
]

export const COUNTRY_OPTIONS_WITH_ALL: CountryOption[] = [
  { code: ALL_COUNTRY_CODE, label: '全部地区' },
  ...COUNTRY_OPTIONS,
]

const countryLabelMap = new Map(COUNTRY_OPTIONS_WITH_ALL.map((item): [string, string] => [item.code, item.label]))

export function resolveCountryLabel(countryCode: string): string {
  const normalized = countryCode.trim().toUpperCase()
  return countryLabelMap.get(normalized) ?? normalized
}
