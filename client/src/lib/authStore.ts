const TOKEN_KEY = "access_token";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  if (accessToken) {
    return accessToken;
  }
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) {
    accessToken = stored;
  }
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
}

export function initAuthStore(): void {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) {
    accessToken = stored;
  }
}
