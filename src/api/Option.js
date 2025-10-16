import apiClient from "./apiClient";
const OptionAPI = {
   // Lấy tất cả option group của merchant hiện tại
   getAll: async () => {
      const res = await apiClient.get('/merchant/options');
      return res?.data?.data ?? res?.data;
   },

   // Tạo mới option group và các option value
   create: async (payload) => {
      const res = await apiClient.post('/merchant/options', payload);
      return res?.data?.data ?? res?.data;
   },

   // Thêm option value vào group
   addOptionValue: async (optionId, value) => {
      const res = await apiClient.post(`/merchant/options/${optionId}/`, value);
      return res?.data?.data ?? res?.data;
   },

   // Gán danh sách món vào option group
   assignMenuItems: async (optionId, menuItemIds) => {
      const res = await apiClient.post('/merchant/options/menu-items', {
		   optionId,
		   menuItemIds,
      });
      return res?.data?.data ?? res?.data;
   },

   // Đổi trạng thái option (status query: active|inactive)
   updateStatus: async (optionId, status) => {
     if (!optionId) throw new Error('optionId is required');
     let normalized = 'inactive';
     if (typeof status === 'boolean') {
       normalized = status ? 'active' : 'inactive';
     } else {
       const raw = String(status ?? '').trim().toLowerCase();
       if (raw === 'active' || raw === '1' || raw === 'enabled' || raw === 'available' || raw === 'true') {
         normalized = 'active';
       }
     }
     const res = await apiClient.patch(`/merchant/options/${optionId}/status`, null, {
        params: { status: normalized },
        headers: { Accept: 'application/json' },
     });
     return res?.data?.data ?? res?.data;
   },

   // Lấy tất cả option group của merchant theo id
   getByMerchant: async (merchantId) => {
	   const res = await apiClient.get(`/${merchantId}/options`);
	   return res.data;
   },

   // Lấy danh sách món đã gán vào option group
   getMenuItems: async (optionId) => {
      const res = await apiClient.get(`/merchant/options/menu-items/${optionId}`);
      return res?.data?.data ?? res?.data;
   },
};

export default OptionAPI;
