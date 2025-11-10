# Restaurant Dashboard - Merchant Portal

Dashboard quản lý nhà hàng cho hệ thống đặt món ăn online.

## Cấu hình API Server

### Bước 1: Tạo file `.env`

Copy file `.env.example` thành `.env`:

```bash
copy .env.example .env
```

### Bước 2: Cập nhật URL API

Mở file `.env` và cập nhật `VITE_API_BASE_URL` với URL server của bạn:

```env
VITE_API_BASE_URL=https://your-server-url.com/potato-api
```

**Lưu ý:** Khi server thay đổi URL, bạn chỉ cần cập nhật file `.env` này.

### Bước 3: Khởi động lại dev server

Sau khi thay đổi `.env`, restart dev server:

```bash
npm run dev
```

## Cài đặt và Chạy

```bash
# Cài đặt dependencies
npm install

# Chạy development server (port 5174)
npm run dev

# Build production
npm run build

# Preview production build
npm run preview
```

## Tech Stack

- React 18+ with Vite
- React Router DOM
- Axios for API calls
- CSS Modules

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
