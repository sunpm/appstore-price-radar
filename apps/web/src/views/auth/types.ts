export type AuthMode = 'login' | 'register'
export type LoginMethod = 'password' | 'code'
export type AuthViewMode = 'page' | 'modal'

export interface AuthUser {
  id: string
  email: string
}

export interface AuthResponse {
  token: string
  expiresAt: string
  user: AuthUser
}

export interface SendCodeResponse {
  ok: boolean
  cooldownSeconds?: number
  retryAfterSeconds?: number
  error?: string
}
