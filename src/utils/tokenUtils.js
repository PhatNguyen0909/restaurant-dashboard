// tokenUtils.js: Quản lý token cho app (ưu tiên localStorage, fallback cookie cũ)

const TOKEN_KEY = 'token';

export function setToken(token) {
  try {
    if (token != null) {
      // Lưu ở localStorage để tránh gửi Cookie qua proxy /api
      localStorage.setItem(TOKEN_KEY, String(token));
      // Xóa cookie cũ nếu tồn tại để không bị forward lên backend qua proxy
      document.cookie = `${TOKEN_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  } catch {}
}

export function getToken() {
  try {
    const ls = localStorage.getItem(TOKEN_KEY);
    if (ls) return ls;
  } catch {}
  // fallback legacy cookie (để tương thích nếu user chưa refresh)
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${TOKEN_KEY}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  } catch {}
  return null;
}

export function removeToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  try { document.cookie = `${TOKEN_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`; } catch {}
}
