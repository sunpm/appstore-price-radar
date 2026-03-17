interface ApiErrorPayload {
  error?: string
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '')

export function buildApiUrl(path: string): string {
  return `${API_BASE ?? ''}${path}`
}

export async function parseApiErrorText(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as ApiErrorPayload
    return data.error ?? `Request failed with status ${res.status}`
  }
  catch {
    return `Request failed with status ${res.status}`
  }
}
