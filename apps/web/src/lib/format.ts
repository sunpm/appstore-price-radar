export function formatMoney(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined) {
    return '-'
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2,
    }).format(value)
  }
  catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

export interface MoneyDisplayParts {
  currencyLabel: string
  major: string
  minor: string
  value: string
}

export function formatMoneyParts(
  value: number | null | undefined,
  currency = 'USD',
): MoneyDisplayParts | null {
  if (value === null || value === undefined) {
    return null
  }

  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const parts = formatter.formatToParts(value)
    const currencyLabel = parts
      .filter(part => part.type === 'currency')
      .map(part => part.value)
      .join('') || currency
    const sign = parts
      .filter(part => part.type === 'minusSign')
      .map(part => part.value)
      .join('')
    const major = sign + parts
      .filter(part => part.type === 'integer' || part.type === 'group')
      .map(part => part.value)
      .join('')
    const fraction = parts.find(part => part.type === 'fraction')?.value ?? ''
    const decimal = parts.find(part => part.type === 'decimal')?.value ?? '.'

    return {
      currencyLabel,
      major,
      minor: fraction ? `${decimal}${fraction}` : '',
      value: formatter.format(value),
    }
  }
  catch {
    const [major, fraction = '00'] = value.toFixed(2).split('.')
    const valueText = `${currency} ${value.toFixed(2)}`

    return {
      currencyLabel: currency,
      major,
      minor: `.${fraction}`,
      value: valueText,
    }
  }
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export function formatFileSize(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const bytes = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '-'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const digits = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2
  return `${size.toFixed(digits)} ${units[unitIndex]}`
}
