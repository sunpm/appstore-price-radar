export const TOKEN_STORAGE_KEY = 'price-radar-token';
export const AUTH_TOKEN_CHANGED_EVENT = 'price-radar-auth-token-changed';

const dispatchAuthChanged = (token: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_TOKEN_CHANGED_EVENT, {
      detail: { token },
    }),
  );
};

export const getStoredToken = () => {
  if (typeof localStorage === 'undefined') {
    return '';
  }

  return localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
};

export const setStoredToken = (token: string) => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  dispatchAuthChanged(token);
};

export const clearStoredToken = () => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem(TOKEN_STORAGE_KEY);
  dispatchAuthChanged('');
};
