export type AuthUserRow = {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
};

export type AuthSession = {
  token: string;
  expiresAt: Date;
};

export type AuthResponsePayload = {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
  };
};

export type AuthErrorResponse = {
  error: string;
  retryAfterSeconds?: number;
};

export type AuthOkResponse = {
  ok: true;
};

export type AuthCooldownResponse = {
  ok: true;
  cooldownSeconds: number;
};

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
