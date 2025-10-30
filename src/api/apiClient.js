// apiClient.js
import axios from 'axios';
import { getToken } from '../utils/tokenUtils';


// Sử dụng proxy /api khi dev để tránh CORS, production thì dùng backend thật
const isDev = import.meta.env.DEV;
const API_BASE_URL = isDev 
  ? '/api'  // Sử dụng proxy trong dev mode
  : 'https://cruise-silk-licence-shed.trycloudflare.com/potato-api';

// Debug: log baseURL một lần để kiểm tra
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('[apiClient] baseURL =', API_BASE_URL, 'isDev =', isDev);
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

// Always attach token from cookie if available
api.interceptors.request.use((config) => {
  try {
    const url = String(config?.url || '');
    const isPublic = /\/auth\/log-in|\/auth\/login|\/merchant\/register|\/auth\/refresh|\/cuisine-types/i.test(url);
    const t = getToken();
    console.log('[apiClient] Request:', { url, isPublic, hasToken: !!t, tokenPreview: t ? `${t.substring(0, 20)}...` : 'none' }); // DEBUG
    const headers = config.headers || {};
    const setHeader = (key, value) => {
      if (typeof headers.set === 'function') {
        headers.set(key, value);
      } else {
        headers[key] = value;
      }
    };
    const deleteHeader = (key) => {
      if (typeof headers.delete === 'function') {
        headers.delete(key);
      } else if (headers[key] !== undefined) {
        delete headers[key];
      }
    };

    if (!isPublic && t) {
      setHeader('Authorization', `Bearer ${t}`);
      console.log('[apiClient] Added Authorization header'); // DEBUG
    } else {
      deleteHeader('Authorization');
      if (isPublic) console.log('[apiClient] Public endpoint, skipping token'); // DEBUG
    }

    config.headers = headers;
  } catch (e) {
    console.error('[apiClient] Interceptor error:', e); // DEBUG
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
