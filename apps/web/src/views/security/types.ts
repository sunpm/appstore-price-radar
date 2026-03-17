import type { AuthUser } from '../auth/types'

export type { AuthUser }

export interface SecurityPasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
