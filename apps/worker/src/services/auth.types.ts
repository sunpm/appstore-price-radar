import type {
  AuthErrorDto,
  AuthOkResponseDto,
  AuthResponseDto,
  AuthUserDto,
  SendLoginCodeResponseDto,
} from '@appstore-price-radar/contracts';

export type AuthSession = {
  token: string;
  expiresAt: Date;
};

export type AuthUserRow = AuthUserDto & {
  passwordHash: string;
  isActive: boolean;
};

export type AuthResponsePayload = AuthResponseDto;

export type AuthErrorResponse = AuthErrorDto;

export type AuthOkResponse = AuthOkResponseDto;

export type AuthCooldownResponse = SendLoginCodeResponseDto;

export type AuthHttpStatus = 200 | 400 | 401 | 409 | 429 | 500 | 503;

export type AuthServiceResponse<TBody> = {
  status: AuthHttpStatus;
  body: TBody;
};

export type AuthWithPasswordPayload = {
  email: string;
  password: string;
};

export type RegisterWithCodePayload = {
  email: string;
  password: string;
  code: string;
};

export type EmailPayload = {
  email: string;
};

export type ResetPasswordPayload = {
  token: string;
  password: string;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export type VerifyLoginCodePayload = {
  email: string;
  code: string;
};
