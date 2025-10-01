import apiClient from "./apiClient";

const merchantAPI = {
  // Lấy thông tin nhà hàng hiện tại (dựa vào token)
  getMyMerchant: async () => {
    const res = await apiClient.get('/merchant/my-merchant');
    return res.data?.data;
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
