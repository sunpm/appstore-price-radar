import { describe, expect, it } from 'vitest'
import { formatMoneyParts } from '../src/lib/format'

describe('formatMoneyParts', () => {
  it('splits currency label, major amount, and decimals for CNY', () => {
    expect(formatMoneyParts(38, 'CNY')).toEqual({
      currencyLabel: '¥',
      major: '38',
      minor: '.00',
      value: '¥38.00',
    })
  })

  it('keeps grouping and decimals for larger values', () => {
    expect(formatMoneyParts(1234.5, 'USD')).toEqual({
      currencyLabel: '$',
      major: '1,234',
      minor: '.50',
      value: '$1,234.50',
    })
  })

  it('returns null for empty values', () => {
    expect(formatMoneyParts(null, 'USD')).toBeNull()
  })
})
