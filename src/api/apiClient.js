// apiClient.js
import axios from 'axios';
import { getToken } from '../utils/tokenUtils';

// Base URL
// - DEV: dùng proxy "/api" của Vite để né CORS
// - PROD: đọc từ biến môi trường Vite `VITE_API_BASE_URL` (ví dụ: https://domain.tld/potato-api)
let API_BASE_URL = import.meta?.env?.DEV
  ? '/api'
  : (import.meta?.env?.VITE_API_BASE_URL || 'https://cruise-silk-licence-shed.trycloudflare.com/potato-api');

// Fallback: nếu đang chạy ở localhost (kể cả build preview) thì ưu tiên dùng proxy /api
try {
  const isLocalhost = typeof window !== 'undefined' && /^(http:\/\/)?localhost:\d+/.test(window.location.origin);
  if (isLocalhost) {
    API_BASE_URL = '/api';
  }
} catch {}

// Debug: log baseURL một lần để kiểm tra
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('[apiClient] baseURL =', API_BASE_URL, 'env.DEV =', import.meta?.env?.DEV);
}

// Tạo instance axios chung
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // timeout 15s
});

// Hàm gắn / xóa token (cho login, auth)
export const attachToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Always attach token from cookie if available
api.interceptors.request.use((config) => {
  try {
    const url = String(config?.url || '');
    const isPublic = /\/auth\/login|\/merchant\/register|\/auth\/refresh/i.test(url);
    const t = getToken();
    config.headers = config.headers || {};
    if (!isPublic && t) {
      config.headers['Authorization'] = `Bearer ${t}`;
    } else {
      // Đảm bảo không gửi token cho các endpoint public
      if (config.headers['Authorization']) delete config.headers['Authorization'];
    }
  } catch {}
  return config;
});

// Thêm interceptor để log lỗi (tùy chọn)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    // eslint-disable-next-line no-console
    console.error('API error:', { status, data, message: error?.message, url: error?.config?.url });
    return Promise.reject(error);
  }
);

export default api;
