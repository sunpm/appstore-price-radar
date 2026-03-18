import type {
  AuthErrorDto,
  AuthResponseDto,
  AuthUserDto,
  SendLoginCodeResponseDto,
} from '@appstore-price-radar/contracts'

export type AuthMode = 'login' | 'register'
export type LoginMethod = 'password' | 'code'
export type AuthViewMode = 'page' | 'modal'

export type AuthUser = AuthUserDto
export type AuthResponse = AuthResponseDto
export type SendCodeResponse = SendLoginCodeResponseDto | AuthErrorDto
