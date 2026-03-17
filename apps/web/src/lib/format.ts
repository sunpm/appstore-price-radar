export function formatMoney(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined) {
    return '-'
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  }
  catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}
