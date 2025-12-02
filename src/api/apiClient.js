// apiClient.js
import axios from 'axios';
import { getToken } from '../utils/tokenUtils';

// Compute base URL from env variables
const envApi = import.meta?.env?.VITE_API_BASE_URL?.trim();
const isProd = !!import.meta?.env?.PROD;

// Sử dụng biến môi trường để cấu hình API URL
const isDev = import.meta.env.DEV;
const API_BASE_URL = isDev 
  ? '/api'  // Sử dụng proxy trong dev mode để tránh CORS
  : import.meta.env.VITE_API_BASE_URL || 'https://trustees-logical-seed-modes.trycloudflare.com/potato-api';

// Debug: log baseURL
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('[apiClient] baseURL =', API_BASE_URL);
}

// Tạo instance axios chung
export const api = axios.create({
  baseURL: API_BASE_URL,
  // Không set Content-Type mặc định để axios tự gán phù hợp (JSON vs FormData)
  withCredentials: true, // Enable cookies for same-origin (via Vercel proxy)
  timeout: 15000, // timeout 15s
  // Không set Content-Type ở đây để axios tự động detect (JSON hoặc multipart/form-data)
});

// Hàm gắn / xóa token (cho login, auth)
export const attachToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Always attach token from localStorage if available
api.interceptors.request.use((config) => {
  const url = String(config?.url || '');
  // Các endpoint public: không gắn token để tránh backend validate token hết hạn và trả 401
  const isPublic = /\/auth\/log-in|\/auth\/login|\/merchant\/register|\/auth\/refresh|\/cuisine-types|\/public\/|\/upload-transaction-proof/i.test(url);
  // Cho phép yêu cầu bỏ qua auth theo từng request
  const skipAuth = Boolean(config?.skipAuth) || String(config?.headers?.['X-Skip-Auth'] || '').toLowerCase() === 'true';
  
  if (!isPublic && !skipAuth) {
    const token = getToken();
    console.log('[apiClient] Debug:', { 
      url, 
      hasToken: !!token, 
      tokenPreview: token ? token.substring(0, 30) + '...' : 'NONE',
      localStorage: typeof localStorage !== 'undefined' ? 'available' : 'NOT available'
    });
    
    if (token) {
      if (!config.headers) config.headers = {};
      // Set both uppercase and lowercase (some backends are case-sensitive)
      config.headers['Authorization'] = `Bearer ${token}`;
      config.headers['authorization'] = `Bearer ${token}`;
    } else {
      console.error('[apiClient] ❌ NO TOKEN for protected endpoint:', url);
    }
  }
  
  return config;
});

// Thêm interceptor để log lỗi (tùy chọn)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const urlErr = error?.config?.url;
    const method = error?.config?.method;
    const sentHeaders = error?.config?.headers;
    
    // Log chi tiết để debug
    console.error('[apiClient] ❌ API Error:', { 
      url: urlErr, 
      method,
      status, 
      data,
      sentAuthHeader: sentHeaders?.Authorization ? 'YES (Bearer ' + sentHeaders.Authorization.substring(7, 30) + '...)' : 'NO',
      message: error?.message 
    });
    
    // Nếu lỗi 1004 (auth required), có thể token hết hạn
    if (status === 401 || data?.errorCode === 1004) {
      console.error('[apiClient] 🔐 Authentication failed - token may be expired or invalid');
    }
    
    return Promise.reject(error);
  }
);

export default api;
