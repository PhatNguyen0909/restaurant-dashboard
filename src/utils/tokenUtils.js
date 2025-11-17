// tokenUtils.js: Quản lý token cho app (ưu tiên localStorage, fallback cookie cũ)

const TOKEN_KEY = 'token';

function setCookie(name, value, days = 7) {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    const isSecure = typeof location !== 'undefined' && location.protocol === 'https:';
    const secure = isSecure ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(String(value))}; expires=${expires}; path=/; SameSite=Lax${secure}`;
  } catch {}
}

export function setToken(token) {
  try {
    if (token != null) {
      // Lưu ở localStorage (primary)
      try { localStorage.setItem(TOKEN_KEY, String(token)); } catch {}
      // Lưu thêm Cookie (fallback cho các môi trường hạn chế localStorage)
      setCookie(TOKEN_KEY, token, 7);
    }
  } catch {}
}

export function getToken() {
  // Ưu tiên Cookie trước (ổn định hơn trên một số môi trường production/PWA)
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${TOKEN_KEY}=`);
    if (parts.length === 2) {
      const cookieToken = parts.pop().split(';').shift();
      if (cookieToken) return cookieToken;
    }
  } catch {}
  // Fallback: localStorage
  try {
    const ls = localStorage.getItem(TOKEN_KEY);
    if (ls) return ls;
  } catch {}
  return null;
}

export function removeToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  try { document.cookie = `${TOKEN_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`; } catch {}
}
