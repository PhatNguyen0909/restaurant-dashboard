import apiClient from "./apiClient";
import { getToken } from "../utils/tokenUtils";

const merchantAPI = {
  // Tạo menu item mới (multipart/form-data)
  createMenuItem: async (payload) => {
    // Chỉ gửi 1 lần đúng endpoint tài liệu để tránh tạo trùng khi server 500 nhưng đã lưu
    let form;
    if (payload instanceof FormData) {
      form = payload;
    } else {
      form = new FormData();
      const name = payload?.name ?? '';
      const description = payload?.description ?? '';
      const categoryId = payload?.categoryId ?? payload?.category ?? '';
      const basePrice = payload?.basePrice ?? payload?.price ?? '';
      const imgFile = payload?.imgFile ?? payload?.image ?? payload?.file ?? null;
      if (imgFile) form.append('imgFile', imgFile);
      if (name) form.append('name', String(name));
      if (description) form.append('description', String(description));
      if (categoryId !== undefined && categoryId !== null) form.append('categoryId', String(categoryId));
      if (basePrice !== undefined && basePrice !== null) form.append('basePrice', String(basePrice));
    }

    // Thêm header idempotency nếu server hỗ trợ (không gây lỗi nếu bỏ qua)
    const key = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const res = await apiClient.post('/merchant/menu-items', form, {
      headers: {
        Accept: 'application/json',
        'X-Idempotency-Key': key,
      },
    });
    return res?.data?.data ?? res?.data;
  },

  // Lấy tất cả menu items (để fallback xác nhận sau khi tạo)
  getMenuItems: async () => {
    const res = await apiClient.get('/merchant/menu-items');
    const body = res?.data?.data ?? res?.data;
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.items)) return body.items;
    return [];
  },
  // CATEGORY: CRUD
  getCategories: async () => {
    const res = await apiClient.get('/merchant/categories');
    const body = res?.data?.data ?? res?.data;
    // Normalize to array
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.items)) return body.items;
    return [];
  },
  createCategory: async (nameOrPayload) => {
    const name = typeof nameOrPayload === 'string'
      ? nameOrPayload
      : (nameOrPayload?.name || nameOrPayload?.categoryName || nameOrPayload?.title || '');
    const candidates = [
      { name },
      { categoryName: name },
      { title: name },
    ];
    let lastErr;
    for (const body of candidates) {
      try {
        const res = await apiClient.post('/merchant/categories', body);
        return res?.data?.data ?? res?.data;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Create category failed');
  },
  updateCategory: async (id, nameOrPayload) => {
    const name = typeof nameOrPayload === 'string'
      ? nameOrPayload
      : (nameOrPayload?.name || nameOrPayload?.categoryName || nameOrPayload?.title || '');
    const candidates = [
      { name },
      { categoryName: name },
      { title: name },
    ];
    let lastErr;
    for (const body of candidates) {
      try {
        const res = await apiClient.put(`/merchant/categories/${id}`, body);
        return res?.data?.data ?? res?.data ?? true;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Update category failed');
  },
  deleteCategory: async (id) => {
    const res = await apiClient.delete(`/merchant/categories/${id}`);
    return res?.data?.data ?? true;
  },
  // Lấy thông tin nhà hàng hiện tại (dựa vào token)
  getMyMerchant: async () => {
    const res = await apiClient.get('/merchant/my-merchant');
    return res.data?.data;
  },
  // Cập nhật thông tin merchant hiện tại (thử nhiều endpoint/phương thức/phân phối key)
  updateMyInfo: async (payload = {}) => {
    const hasKey = (obj, key) => Object.prototype.hasOwnProperty.call(obj ?? {}, key);

    const token = getToken();
    if (!token) {
      throw new Error('Bạn cần đăng nhập lại trước khi cập nhật thông tin.');
    }
    const baseHeaders = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      Role: 'MERCHANT_ADMIN',
      'X-Role': 'MERCHANT_ADMIN',
    };

    const camel = {};
    if (hasKey(payload, 'introduction')) {
      camel.introduction = String(payload?.introduction ?? '').trim();
    }
    if (hasKey(payload, 'address')) {
      camel.address = String(payload?.address ?? '').trim();
    }

    const rawOpening = hasKey(payload, 'openingHours')
      ? payload?.openingHours
      : (hasKey(payload, 'opening_hours') ? payload?.opening_hours : undefined);
    if (rawOpening !== undefined) {
      if (rawOpening && typeof rawOpening === 'object') {
        const normalized = {};
        Object.entries(rawOpening).forEach(([day, value]) => {
          if (value != null && value !== '') {
            normalized[day] = String(value);
          }
        });
        camel.openingHours = normalized;
      } else {
        camel.openingHours = {};
      }
    }

    const rawCuisine = hasKey(payload, 'cuisineTypes')
      ? payload?.cuisineTypes
      : (hasKey(payload, 'cuisine_types') ? payload?.cuisine_types : undefined);
    if (rawCuisine !== undefined) {
      const cuisineArr = Array.isArray(rawCuisine)
        ? rawCuisine
        : (typeof rawCuisine === 'string'
            ? rawCuisine.split(',')
            : []);
      camel.cuisineTypes = cuisineArr
        .map((s) => String(s).trim())
        .filter((s) => s.length > 0);
    }

    const snake = {};
    if ('introduction' in camel) snake.introduction = camel.introduction;
    if ('address' in camel) snake.address = camel.address;
    if ('openingHours' in camel) snake.opening_hours = camel.openingHours;
    if ('cuisineTypes' in camel) snake.cuisine_types = camel.cuisineTypes;

    const bodies = [camel, snake].filter((obj) => Object.keys(obj).length > 0);
    if (!bodies.length) throw new Error('No update payload provided');

    // Env override cho path (mặc định vẫn PUT /merchant/my-merchant)
    const envPath = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_MERCHANT_UPDATE_PATH) || '';
    const candidates = [envPath || '/merchant/my-merchant'];
    let lastErr;
    for (const path of candidates) {
      for (const b of bodies) {
        try {
          const headers = { ...baseHeaders };
          const res = await apiClient.put(path, b, { headers });
          return res?.data?.data ?? res?.data ?? true;
        } catch (e) {
          lastErr = e;
          // thử biến thể tiếp theo
        }
      }
    }
    // Ném lỗi chi tiết nếu có
    if (lastErr) throw lastErr;
    throw new Error('Failed to update merchant info');
  },

  // Lấy danh sách món ăn của nhà hàng theo id
  getDish: async (merchantId) => {
    const res = await apiClient.get(`/merchant/getdish/${merchantId}`);
    return res.data?.data;
  },
  // Lấy option groups của 1 món ăn (thử nhiều endpoint phổ biến)
  getDishOptionGroups: async (dishId) => {
    const paths = [
      `/merchant/dish/${dishId}/option-groups`,
      `/merchant/dishes/${dishId}/option-groups`,
      `/dish/${dishId}/option-groups`,
      `/option-groups/${dishId}`,
      `/option-group/${dishId}`,
    ];
    for (const p of paths) {
      try {
        const res = await apiClient.get(p);
        const body = res?.data?.data ?? res?.data;
        if (Array.isArray(body)) return body;
        if (Array.isArray(body?.items)) return body.items;
      } catch (e) {
        // thử endpoint kế tiếp
      }
    }
    throw new Error('Option groups API not found');
  },
  // Lưu option groups cho 1 món ăn (PUT/POST với fallback)
  setDishOptionGroups: async (dishId, groups) => {
    const candidates = [
      { method: 'put', path: `/merchant/dish/${dishId}/option-groups` },
      { method: 'put', path: `/dish/${dishId}/option-groups` },
      { method: 'post', path: `/merchant/dish/${dishId}/option-groups` },
      { method: 'post', path: `/option-groups/${dishId}` },
    ];
    let lastErr;
    for (const c of candidates) {
      try {
        const res = await apiClient[c.method](c.path, { optionGroups: groups });
        return res?.data?.data ?? true;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Failed to save option groups');
  },
};

export default merchantAPI;
