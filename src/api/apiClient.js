// apiClient.js
import axios from 'axios';
import { getToken } from '../utils/tokenUtils';

// Compute base URL from env variables (similar to delivery-app pattern)
const envApi = import.meta?.env?.VITE_API_BASE_URL?.trim();
const envProxy = import.meta?.env?.VITE_PROXY_TARGET?.trim();

const normalizeProxyBase = (url) => {
  if (!url) return '';
  try {
    const u = new URL(url);
    const cleanPath = u.pathname
      .replace(/\/swagger-ui\/.*/i, '')
      .replace(/\/?index\.html\??.*$/i, '')
      .replace(/\/?$/,'');
    return `${u.origin}${cleanPath}`;
  } catch {
    return '';
  }
};

const proxyBase = normalizeProxyBase(envProxy);
const API_BASE_URL = proxyBase || envApi || '/api';

// Debug: log baseURL
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('[apiClient] baseURL =', API_BASE_URL);
}

// Tạo instance axios chung
export const api = axios.create({
  baseURL: API_BASE_URL,
  // Không set Content-Type mặc định để axios tự gán phù hợp (JSON vs FormData)
  withCredentials: false,
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
  const isPublic = /\/auth\/log-in|\/auth\/login|\/merchant\/register|\/auth\/refresh|\/cuisine-types/i.test(url);
  
  if (!isPublic) {
    const token = getToken();
    console.log('[apiClient] Debug:', { 
      url, 
      hasToken: !!token, 
      tokenPreview: token ? token.substring(0, 30) + '...' : 'NONE',
      localStorage: typeof localStorage !== 'undefined' ? 'available' : 'NOT available'
    });
    
    if (token) {
      if (!config.headers) config.headers = {};
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.error('[apiClient] ❌ NO TOKEN for protected endpoint:', url);
    }
  }
  
  return config;
});

// Thêm interceptor để log lỗi (tùy chọn)
api.interceptors.response.use(
  (response) => {
    // Log response cho update options
    const url = String(response?.config?.url || '');
    if (url.includes('/merchant/options/') && (response?.config?.method === 'put' || response?.config?.method === 'PUT')) {
      console.log('📥 Response Details:', {
        url: response.config.url,
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers
      });
    }
    return response;
  },
  (error) => {
    // Log chi tiết lỗi cho update options
    const url = String(error?.config?.url || '');
    if (url.includes('/merchant/options/') && (error?.config?.method === 'put' || error?.config?.method === 'PUT')) {
      console.error('❌ Response Error:', {
        url: error.config?.url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
    }
    
    const status = error?.response?.status;
    const data = error?.response?.data;
    const urlErr = error?.config?.url;
    const method = error?.config?.method;
    // eslint-disable-next-line no-console
    console.error('API error:', { status, data, message: error?.message, url: urlErr, method });
    return Promise.reject(error);
  }
);

export default api;
