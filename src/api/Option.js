import apiClient from "./apiClient";

const ensureNumber = (value, fallback = 0) => {
   const num = Number.parseFloat(value);
   return Number.isFinite(num) ? num : fallback;
};

const normalizeIdsForApi = (ids) => {
   if (!Array.isArray(ids)) return [];
   return ids
      .map((value) => {
         const num = Number.parseInt(value, 10);
         if (Number.isFinite(num)) return num;
         if (typeof value === 'string' && value.trim().length) return value.trim();
         return undefined;
      })
      .filter((value) => value !== undefined && value !== null && value !== '');
};

const buildMerchantRoleHeaders = () => ({
   Accept: 'application/json',
   Role: 'MERCHANT_ADMIN',
   'X-Role': 'MERCHANT_ADMIN',
});

const extractList = (payload) => {
   if (!payload) return [];
   if (Array.isArray(payload)) return payload;
   if (typeof payload !== 'object') return [];

   const candidateKeys = [
      'items',
      'data',
   'result',
   'results',
   'rows',
   'records',
      'options',
      'optionValues',
      'optionGroups',
      'option_groups',
      'groups',
      'list',
   'docs',
   'content',
   'optionList',
   ];

   for (const key of candidateKeys) {
      const value = payload?.[key];
      if (Array.isArray(value)) {
         return value;
      }
   }

   for (const value of Object.values(payload)) {
      const nested = extractList(value);
      if (Array.isArray(nested) && nested.length) {
         return nested;
      }
   }

   return [];
};

const OptionAPI = {
   // Lấy tất cả option group của merchant hiện tại
   getAll: async () => {
      const res = await apiClient.get('/merchant/options', {
         headers: buildMerchantRoleHeaders(),
         params: { _t: Date.now() },
      });
      const payload = res?.data?.data ?? res?.data ?? [];
      const list = extractList(payload);
      if (Array.isArray(list) && list.length) return list;
      return Array.isArray(payload) ? payload : list;
   },

   // Tạo mới option group và các option value
   create: async (payload = {}) => {
      const safeTrim = (value) => (typeof value === 'string' ? value.trim() : value);
      const rawName = safeTrim(payload.name ?? payload.title ?? payload.optionGroupName);
      if (!rawName) {
         throw new Error('Option group name is required');
      }

      const rawType = payload.selectionType ?? payload.type ?? payload.groupType;
      const typeToken = typeof rawType === 'string' ? rawType : '';
      const normalizedType = /multi/i.test(typeToken) ? 'MULTI' : 'SINGLE';

      const rawRequired = payload.required ?? payload.isRequired ?? payload.mandatory;
      const required = !!rawRequired;

      const sourceValues = Array.isArray(payload.optionValues)
         ? payload.optionValues
         : (Array.isArray(payload.options) ? payload.options : []);
      const optionValues = sourceValues
         .map((item, index) => {
            const valueName = safeTrim(item?.name ?? item?.label ?? item?.title);
            if (!valueName) return null;
            const priceRaw = item?.extraPrice ?? item?.extra_price ?? item?.priceDelta ?? item?.price ?? 0;
            const extraPrice = ensureNumber(priceRaw, 0);
            return {
               name: valueName,
               extraPrice,
               order: index,
            };
         })
         .filter(Boolean);

      if (!optionValues.length) {
         throw new Error('Option group requires at least one option value');
      }

      const body = {
         name: rawName,
         required,
         selectionType: normalizedType,
         optionValues: optionValues.map(({ name, extraPrice }) => ({ name, extraPrice })),
      };

      const res = await apiClient.post('/merchant/options', body, {
         headers: buildMerchantRoleHeaders(),
      });
      return res?.data?.data ?? res?.data;
   },

   // Cập nhật thông tin option group
   updateGroup: async (optionId, payload = {}) => {
      if (!optionId) throw new Error('Option group id is required');
      const safeTrim = (value) => (typeof value === 'string' ? value.trim() : value);

      const name = safeTrim(payload.name ?? payload.title ?? payload.optionGroupName);
      if (!name) throw new Error('Option group name is required');

      // Optional fields
      const selectionType = payload.selectionType ?? (payload.type === 'multi' ? 'MULTI' : (payload.type === 'single' ? 'SINGLE' : undefined));
      const required = payload.required === undefined ? undefined : !!payload.required;

   const body = { name };
   if (selectionType) body.selectionType = selectionType;
   if (required !== undefined) body.required = required;

      try {
         const res = await apiClient.put(`/merchant/options/${optionId}`, null, {
            params: body,
            headers: buildMerchantRoleHeaders(),
         });
         return res?.data?.data ?? res?.data ?? true;
      } catch (error) {
         throw error;
      }
   },

   // Thêm option value vào group
   addOptionValue: async (optionId, value = {}) => {
      if (!optionId) throw new Error('Option group id is required');
      const safeTrim = (text) => (typeof text === 'string' ? text.trim() : text);
      const name = safeTrim(value.name ?? value.label ?? value.title);
      if (!name) throw new Error('Option value name is required');

      const extraPrice = ensureNumber(value.extraPrice ?? value.extra_price ?? value.priceDelta ?? value.price, 0);
      const body = { name, extraPrice };

      const res = await apiClient.post(`/merchant/options/${optionId}/values`, body, {
         headers: buildMerchantRoleHeaders(),
      });
      return res?.data?.data ?? res?.data;
   },

   // Cập nhật option value
   updateOptionValue: async (valueId, value = {}) => {
      if (!valueId) throw new Error('Option value id is required');
      const safeTrim = (text) => (typeof text === 'string' ? text.trim() : text);
      const name = safeTrim(value.name ?? value.label ?? value.title);
      if (!name) throw new Error('Option value name is required');

   const extraPrice = ensureNumber(value.extraPrice ?? value.extra_price ?? value.priceDelta ?? value.price, 0);

      try {
         const res = await apiClient.put(`/merchant/options/values/${valueId}`, null, {
            params: { name, extraPrice },
            headers: buildMerchantRoleHeaders(),
         });
         return res?.data?.data ?? res?.data ?? true;
      } catch (error) {
         throw error;
      }
   },

   // Xóa option group
   deleteGroup: async (optionId) => {
      if (!optionId) throw new Error('Option group id is required');

      try {
         const res = await apiClient.delete(`/merchant/options/${optionId}`, {
            headers: buildMerchantRoleHeaders(),
         });
         return res?.data?.data ?? res?.data ?? true;
      } catch (error) {
         throw error;
      }
   },

   // Xóa option value
   deleteOptionValue: async (valueId) => {
      if (!valueId) throw new Error('Option value id is required');

      try {
         const res = await apiClient.delete(`/merchant/options/values/${valueId}`, {
            headers: buildMerchantRoleHeaders(),
         });
         return res?.data?.data ?? res?.data ?? true;
      } catch (error) {
         throw error;
      }
   },

   // Gán danh sách món vào option group
   assignMenuItems: async (optionId, menuItemIds) => {
      if (!optionId) throw new Error('Option group id is required');
   const normalized = normalizeIdsForApi(menuItemIds);

      const body = { menuItemIds: normalized };

      const res = await apiClient.post(`/merchant/options/${optionId}/assign-menu-items`, body, {
         headers: buildMerchantRoleHeaders(),
      });
      return res?.data?.data ?? res?.data ?? true;
   },

   // Đổi trạng thái option (status query: active|inactive)
   updateStatus: async (optionValueId, status) => {
      if (!optionValueId) throw new Error('Option value id is required');
      const normalized = (() => {
         if (typeof status === 'boolean') return status;
         if (typeof status === 'string') {
            const value = status.trim().toLowerCase();
            if ([ 'true', 'visible', 'active', '1' ].includes(value)) return true;
            if ([ 'false', 'hidden', 'inactive', '0' ].includes(value)) return false;
         }
         return Boolean(status);
      })();

      const res = await apiClient.patch(`/merchant/options/values/${optionValueId}/isVisible`, null, {
         params: { isVisible: normalized },
         headers: buildMerchantRoleHeaders(),
      });
      return res?.data?.data ?? res?.data ?? true;
   },

   // Lấy tất cả option group của merchant theo id
   getByMerchant: async (merchantId) => {
      const res = await apiClient.get(`/${merchantId}/options`);
      return res.data;
   },

   // Lấy danh sách món đã gán vào option group
   getMenuItems: async (optionId) => {
      if (!optionId) throw new Error('optionId is required');

      try {
         const res = await apiClient.get(`/merchant/options/${optionId}`, {
            headers: buildMerchantRoleHeaders(),
         });
         const payload = res?.data?.data ?? res?.data ?? {};
         const arr = (() => {
            if (Array.isArray(payload?.menuItems)) return payload.menuItems;
            if (Array.isArray(payload?.menuItemIds)) return payload.menuItemIds;
            if (Array.isArray(payload?.menu_item_ids)) return payload.menu_item_ids;
            if (Array.isArray(payload?.items)) return payload.items;
            return Array.isArray(payload) ? payload : [];
         })();
         const normalized = arr
            .map((item) => {
               if (item && typeof item === 'object') {
                  const id = item.menuItemId ?? item.menu_item_id ?? item.id ?? item._id;
                  if (id != null) return { ...item, id: String(id) };
                  return item;
               }
               if (item == null) return null;
               return { id: String(item) };
            })
            .filter((entry) => entry && entry.id != null);
         return normalized;
      } catch (error) {
         if (error?.response?.status === 404) return [];
         throw error;
      }
   },
};

export default OptionAPI;
