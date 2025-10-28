import apiClient from "./apiClient";

const ensureNumber = (value, fallback = 0) => {
   const num = Number(value);
   return Number.isFinite(num) ? num : fallback;
};

const normalizeIdsForApi = (ids) => {
   if (!Array.isArray(ids)) return [];
   return ids
      .map((value) => {
         const num = Number(value);
         if (Number.isFinite(num)) return num;
         if (typeof value === 'string' && value.trim().length) return value.trim();
         return undefined;
      })
      .filter((value) => value !== undefined && value !== null && value !== '');
};

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
      const attempts = [
         '/merchant/options',
         '/merchant/options/list',
         '/merchant/option-groups',
         '/merchant/option/groups',
         '/merchant/options/all',
      ];

      let lastError;
      for (const path of attempts) {
         try {
            // Thêm timestamp để tránh cache
            const timestamp = Date.now();
            const url = `${path}?_t=${timestamp}`;
            const res = await apiClient.get(url, { 
               headers: { 
                  'Accept': 'application/json',
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
               } 
            });
            const payload = res?.data ?? {};
            const core = payload?.data !== undefined ? payload.data : payload;
            const list = extractList(core);
            console.log(`getAll success from ${path}:`, list);
            return Array.isArray(list) ? list : core;
         } catch (error) {
            lastError = error;
         }
      }

      throw lastError ?? new Error('Failed to load option groups');
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

      const jsonBody = {
         name: rawName,
         required,
         selectionType: normalizedType,
         optionValues: optionValues.map(({ name, extraPrice }) => ({ name, extraPrice })),
      };

      const legacyBody = {
         optionGroupName: rawName,
         required,
         type: normalizedType,
         options: optionValues.map(({ name, extraPrice, order }) => ({
            name,
            price: extraPrice,
            extraPrice,
            extra_price: extraPrice,
            order,
         })),
      };

      const attempts = [
         { url: '/merchant/options', body: jsonBody },
         { url: '/merchant/options', body: { ...jsonBody, type: normalizedType } },
         { url: '/merchant/option-groups', body: legacyBody },
         { url: '/merchant/option/group', body: legacyBody },
         { url: '/merchant/option-groups', body: { ...jsonBody, options: legacyBody.options } },
      ];

      let lastError;
      for (const attempt of attempts) {
         try {
            const res = await apiClient.post(attempt.url, attempt.body, {
               headers: { Accept: 'application/json' },
            });
            return res?.data?.data ?? res?.data;
         } catch (error) {
            lastError = error;
         }
      }

      throw lastError ?? new Error('Failed to create option group');
   },

   // Cập nhật thông tin option group
   updateGroup: async (optionId, payload = {}) => {
      if (!optionId) throw new Error('Option id is required');
      const safeTrim = (value) => (typeof value === 'string' ? value.trim() : value);

      const name = safeTrim(payload.name ?? payload.title ?? payload.optionGroupName);
      if (!name) throw new Error('Option group name is required');

      // Optional fields
      const selectionType = payload.selectionType ?? (payload.type === 'multi' ? 'MULTI' : (payload.type === 'single' ? 'SINGLE' : undefined));
      const required = payload.required === undefined ? undefined : !!payload.required;

      const params = { name };
      if (selectionType) params.selectionType = selectionType;
      if (required !== undefined) params.required = required;

      console.log('OptionAPI.updateGroup - optionId:', optionId, 'params:', params);

      // According to Swagger this endpoint expects query params (e.g. ?name=...)
      try {
         const res = await apiClient.put(`/merchant/options/${optionId}`, null, {
            params,
            headers: { Accept: 'application/json' },
         });
         console.log('OptionAPI.updateGroup - response:', res?.status, res?.data);
         return res?.data?.data ?? res?.data ?? true;
      } catch (error) {
         console.error('OptionAPI.updateGroup failed:', error?.response?.status, error?.response?.data || error?.message);
         throw error;
      }
   },

   // Thêm option value vào group
   addOptionValue: async (optionId, value = {}) => {
      if (!optionId) throw new Error('Option id is required');
      const safeTrim = (text) => (typeof text === 'string' ? text.trim() : text);
      const name = safeTrim(value.name ?? value.label ?? value.title);
      if (!name) throw new Error('Option value name is required');

      const extraPrice = ensureNumber(value.extraPrice ?? value.extra_price ?? value.priceDelta ?? value.price, 0);
      const body = { name, extraPrice };

      const attempts = [
         { method: 'post', url: `/merchant/options/${optionId}/values`, body },
         { method: 'post', url: `/merchant/options/${optionId}/value`, body },
         { method: 'post', url: `/merchant/options/${optionId}/`, body },
      ];

      let lastError;
      for (const attempt of attempts) {
         try {
            const res = await apiClient[attempt.method](attempt.url, attempt.body, {
               headers: { Accept: 'application/json' },
            });
            return res?.data?.data ?? res?.data;
         } catch (error) {
            lastError = error;
         }
      }

      throw lastError ?? new Error('Failed to add option value');
   },

   // Cập nhật option value
   updateOptionValue: async (valueId, value = {}) => {
      if (!valueId) throw new Error('Option value id is required');
      const safeTrim = (text) => (typeof text === 'string' ? text.trim() : text);
      const name = safeTrim(value.name ?? value.label ?? value.title);
      if (!name) throw new Error('Option value name is required');

      const extraPrice = ensureNumber(value.extraPrice ?? value.extra_price ?? value.priceDelta ?? value.price, 0);
      
      console.log('🔵 updateOptionValue - valueId:', valueId);
      console.log('🔵 updateOptionValue - params:', { name, extraPrice });

      // Backend expects query parameters, NOT body!
      // Dựa vào Swagger UI: /merchant/options/values/27?name=...&extraPrice=0
      try {
         const res = await apiClient.put(`/merchant/options/values/${valueId}`, null, {
            params: { name, extraPrice }, // Gửi qua query params
            headers: { 
               'Accept': 'application/json'
            },
         });
         
         console.log('🟢 updateOptionValue SUCCESS');
         console.log('🟢 Response:', res?.data);
         
         return res?.data?.data ?? res?.data ?? true;
      } catch (error) {
         console.error('🔴 updateOptionValue failed:', error?.response?.status, error?.response?.data);
         throw error;
      }
   },

   // Gán danh sách món vào option group
   assignMenuItems: async (optionId, menuItemIds) => {
      if (!optionId) throw new Error('Option id is required');
      const normalized = normalizeIdsForApi(menuItemIds);
      
      console.log('🔵 assignMenuItems - optionId:', optionId);
      console.log('🔵 assignMenuItems - menuItemIds (raw):', menuItemIds);
      console.log('🔵 assignMenuItems - normalized:', normalized);
      console.log('🔵 assignMenuItems - body:', { menuItemIds: normalized });

      const body = { menuItemIds: normalized };

      const attempts = [
         { method: 'post', url: `/merchant/options/${optionId}/assign-menu-items`, body },
         { method: 'post', url: `/merchant/options/${optionId}/menu-items`, body },
         { method: 'post', url: '/merchant/options/menu-items', body: { optionId, menuItemIds: normalized } },
      ];

      let lastError;
      for (const attempt of attempts) {
         try {
            console.log(`🔵 Trying POST ${attempt.url}`, attempt.body);
            const res = await apiClient[attempt.method](attempt.url, attempt.body, {
               headers: { Accept: 'application/json' },
            });
            console.log(`🟢 assignMenuItems SUCCESS with ${attempt.url}`, res?.data);
            return res?.data?.data ?? res?.data ?? true;
         } catch (error) {
            console.log(`🔴 POST ${attempt.url} failed:`, error?.response?.status, error?.response?.data);
            lastError = error;
         }
      }

      throw lastError ?? new Error('Failed to assign menu items');
   },

   // Đổi trạng thái option (status query: active|inactive)
   updateStatus: async (optionId, status) => {
      if (!optionId) throw new Error('Option id is required');
      const attempts = [
         { method: 'patch', url: `/merchant/options/${optionId}/status`, body: { status } },
         { method: 'put', url: `/merchant/options/${optionId}/status`, body: { status } },
      ];

      let lastError;
      for (const attempt of attempts) {
         try {
            const res = await apiClient[attempt.method](attempt.url, attempt.body, {
               headers: { Accept: 'application/json' },
            });
            return res?.data?.data ?? res?.data ?? true;
         } catch (error) {
            lastError = error;
         }
      }

      throw lastError ?? new Error('Failed to update option group status');
   },

   // Lấy tất cả option group của merchant theo id
   getByMerchant: async (merchantId) => {
      const res = await apiClient.get(`/${merchantId}/options`);
      return res.data;
   },

   // Lấy danh sách món đã gán vào option group
   getMenuItems: async (optionId) => {
      if (!optionId) throw new Error('optionId is required');
      const paths = [
         `/merchant/options/${optionId}/menu-items`,
         `/merchant/options/menu-items/${optionId}`,
         `/merchant/options/${optionId}/assignments`,
      ];

      let lastError;
      for (const path of paths) {
         try {
            const res = await apiClient.get(path);
            return res?.data?.data ?? res?.data;
         } catch (error) {
            lastError = error;
         }
      }

      throw lastError ?? new Error('Failed to fetch option group assignments');
   },
};

export default OptionAPI;
