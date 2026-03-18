interface ApiErrorPayload {
  error?: unknown
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '')

export function buildApiUrl(path: string): string {
  return `${API_BASE ?? ''}${path}`
}

export function normalizeApiErrorText(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const message = (payload as ApiErrorPayload).error

    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  return `Request failed with status ${status}`
}

export async function parseApiErrorText(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return normalizeApiErrorText(data, res.status)
  }
  catch {
    return `Request failed with status ${res.status}`
  }
}
