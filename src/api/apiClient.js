import axios from 'axios';

// Base URL ưu tiên từ biến môi trường Vite, fallback sang URL tạm thời (thay bằng của bạn)
const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || 'https://cruise-silk-licence-shed.trycloudflare.com/potato-api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// Interceptor có thể thêm token nếu cần
export const attachToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export default api;

