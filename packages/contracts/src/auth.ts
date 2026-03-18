export interface AuthUserDto {
  id: string
  email: string
}

export interface AuthSessionDto {
  token: string
  expiresAt: string
}

export interface AuthResponseDto extends AuthSessionDto {
  user: AuthUserDto
}

export interface AuthMeResponseDto {
  user: AuthUserDto
}

export interface AuthOkResponseDto {
  ok: true
}

export interface AuthErrorDto {
  error: string
  retryAfterSeconds?: number
}

export interface SendLoginCodeResponseDto extends AuthOkResponseDto {
  cooldownSeconds: number
}
