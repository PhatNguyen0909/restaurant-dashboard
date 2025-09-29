// apiClient.js
import axios from 'axios';

// Base URL: lấy từ biến môi trường Vite, nếu không có thì dùng URL fallback
const API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL ||
  'https://first-reporters-twelve-republic.trycloudflare.com/potato-api';

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

// Thêm interceptor để log lỗi (tùy chọn)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API error:', error?.response || error.message);
    return Promise.reject(error);
  }
);

export default api;
