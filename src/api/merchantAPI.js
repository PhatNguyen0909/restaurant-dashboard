import apiClient from "./apiClient";

const merchantAPI = {
  // Lấy thông tin nhà hàng hiện tại (dựa vào token)
  getMyMerchant: async () => {
    const res = await apiClient.get('/merchant/my-merchant');
    return res.data?.data;
  },
  // Cập nhật thông tin merchant hiện tại (thử nhiều endpoint/phương thức/phân phối key)
  updateMyInfo: async (payload) => {
    const cuisineArr = Array.isArray(payload?.cuisineTypes)
      ? payload.cuisineTypes
      : (typeof payload?.cuisineTypes === 'string'
          ? payload.cuisineTypes.split(',').map(s=>s.trim()).filter(Boolean)
          : []);
    const camel = {
      introduction: payload?.introduction ?? '',
      address: payload?.address ?? '',
      openingHours: payload?.openingHours || {},
      cuisineTypes: cuisineArr,
    };
    const snake = {
      introduction: camel.introduction,
      address: camel.address,
      opening_hours: camel.openingHours,
      cuisine_types: camel.cuisineTypes,
    };

    // Env override cho path và method
    const envPath = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_MERCHANT_UPDATE_PATH) || '';
    const envMethod = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_MERCHANT_UPDATE_METHOD) || '';

    const candidates = [
      envPath && { method: (envMethod || 'patch').toLowerCase(), path: envPath },
      { method: 'put',   path: '/merchant/my-merchant' },
      { method: 'patch', path: '/merchant/my-merchant' },
      { method: 'put',   path: '/merchant' },
      { method: 'patch', path: '/merchant' },
      { method: 'put',   path: '/merchant/update' },
      { method: 'post',  path: '/merchant/update-my-merchant' },
      { method: 'patch', path: '/merchant/profile' },
    ].filter(Boolean);
    const bodies = [camel, snake];
    let lastErr;
    for (const c of candidates) {
      for (const b of bodies) {
        try {
          const method = (c.method || 'patch').toLowerCase();
          const headers = { Accept: 'application/json' };
          if (method === 'post') {
            const res = await apiClient.post(c.path, b, { headers });
            return res?.data?.data ?? res?.data ?? true;
          }
          if (method === 'put') {
            const res = await apiClient.put(c.path, b, { headers });
            return res?.data?.data ?? res?.data ?? true;
          }
          if (method === 'patch') {
            const res = await apiClient.patch(c.path, b, { headers });
            return res?.data?.data ?? res?.data ?? true;
          }
          // Try override header if method unsupported
          const res = await apiClient.post(c.path, b, { headers: { ...headers, 'X-HTTP-Method-Override': (method || 'PATCH').toUpperCase() } });
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
