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
