// apiClient.js
import axios from 'axios';
import { getToken } from '../utils/tokenUtils';


// Luôn dùng backend thật, không dùng proxy hay biến môi trường
const API_BASE_URL = 'https://cruise-silk-licence-shed.trycloudflare.com/potato-api';

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
    
    // Log request details cho update options
    if (url.includes('/merchant/options/') && (config.method === 'put' || config.method === 'PUT')) {
      console.log('🔍 Request Details:', {
        url: config.url,
        method: config.method,
        headers: config.headers,
        data: config.data,
        params: config.params
      });
    }
  } catch {}
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
