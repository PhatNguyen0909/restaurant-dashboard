// tokenUtils.js: Quản lý token cho app

const TOKEN_KEY = 'token';

export function setToken(token, days = 7) {
  if (token) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; expires=${expires}; path=/`;
  }
}

export function getToken() {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${TOKEN_KEY}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export function removeToken() {
  document.cookie = `${TOKEN_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
