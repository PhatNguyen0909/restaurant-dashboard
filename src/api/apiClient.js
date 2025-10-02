// apiClient.js
import axios from 'axios';
import { getToken } from '../utils/tokenUtils';

// Base URL: ưu tiên biến môi trường. Nếu không có, dùng proxy /api của Vite (tránh CORS khi dev)
//  - Vite server đã cấu hình proxy '/api' -> 'https://.../potato-api' trong vite.config.js
//  - Khi build/production, set VITE_API_BASE_URL để trỏ thẳng server public nếu cần.
const isDev = !!(import.meta?.env?.DEV);
const API_BASE_URL = isDev
  ? '/api' // luôn dùng proxy khi dev để tránh CORS
  : ((import.meta?.env?.VITE_API_BASE_URL) || '/api');

// Debug: log baseURL một lần để kiểm tra
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('[apiClient] baseURL =', API_BASE_URL, 'env.DEV =', import.meta?.env?.DEV);
}

// Tạo instance axios chung
export const api = axios.create({
  baseURL: API_BASE_URL,
  // Không set Content-Type mặc định để axios tự gán phù hợp (JSON vs FormData)
  withCredentials: false,
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
    const url = error?.config?.url;
    const method = error?.config?.method;
    // eslint-disable-next-line no-console
    console.error('API error:', { status, data, message: error?.message, url, method });
    return Promise.reject(error);
  }
);

export default api;
