import apiClient from "./apiClient";
import { getToken } from "../utils/tokenUtils";

const slugifyCategoryName = (value) => {
	let str = String(value ?? "");
	try {
		str = str.normalize("NFD");
	} catch {
		// ignore browsers that do not support normalize
	}
	str = str.replace(/[\u0300-\u036f]/g, "");
	const base = str
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return base || "category";
};

const buildCategoryKey = (name, providedKey) => {
	if (providedKey) return String(providedKey);
	const slug = slugifyCategoryName(name);
	const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	return `${slug}-${suffix}`;
};

const merchantAPI = {
	// Tạo menu item mới (multipart/form-data)
	createMenuItem: async (payload) => {
		// Chỉ gửi 1 lần đúng endpoint tài liệu để tránh tạo trùng khi server 500 nhưng đã lưu
		let form;
		if (payload instanceof FormData) {
			form = payload;
		} else {
			form = new FormData();
			const name = payload?.name ?? "";
			const description = payload?.description ?? "";
			const categoryId = payload?.categoryId ?? payload?.category ?? "";
			const basePrice = payload?.basePrice ?? payload?.price ?? "";
			const imgFile = payload?.imgFile ?? payload?.image ?? payload?.file ?? null;
			if (imgFile) form.append("imgFile", imgFile);
			if (name) form.append("name", String(name));
			if (description) form.append("description", String(description));
			if (categoryId !== undefined && categoryId !== null) form.append("categoryId", String(categoryId));
			if (basePrice !== undefined && basePrice !== null) form.append("basePrice", String(basePrice));
		}

		// Thêm header idempotency nếu server hỗ trợ (không gây lỗi nếu bỏ qua)
		const key = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
		const res = await apiClient.post("/merchant/menu-items", form, {
			headers: {
				Accept: "application/json",
				"X-Idempotency-Key": key,
			},
		});
		return res?.data?.data ?? res?.data;
	},

	// Lấy tất cả menu items (để fallback xác nhận sau khi tạo)
	getMenuItems: async () => {
		const res = await apiClient.get("/merchant/menu-items");
		const body = res?.data?.data ?? res?.data;
		if (Array.isArray(body)) return body;
		if (Array.isArray(body?.items)) return body.items;
		return [];
	},
	// CATEGORY: CRUD
	getCategories: async () => {
		const res = await apiClient.get("/merchant/categories");
		const body = res?.data?.data ?? res?.data;
		// Normalize to array
		if (Array.isArray(body)) return body;
		if (Array.isArray(body?.items)) return body.items;
		return [];
	},
	createCategory: async (nameOrPayload) => {
		const rawName = typeof nameOrPayload === "string"
			? nameOrPayload
			: (nameOrPayload?.name || nameOrPayload?.categoryName || nameOrPayload?.title || "");
		const name = String(rawName ?? "").trim();
		if (!name) throw new Error("Tên danh mục không được để trống");

		const rawMerchantId = typeof nameOrPayload === "object"
			? (nameOrPayload?.merchantId ?? nameOrPayload?.merchant_id ?? nameOrPayload?.merchant)
			: undefined;
		const merchantId = rawMerchantId != null ? rawMerchantId : undefined;

		const providedKey = typeof nameOrPayload === "object"
			? (nameOrPayload?.categoryKey ?? nameOrPayload?.category_name ?? nameOrPayload?.key ?? nameOrPayload?.code)
			: undefined;
		const categoryKey = buildCategoryKey(name, providedKey);

		const body = {
			name,
			title: name,
			displayName: name,
			categoryName: categoryKey,
		};
		if (merchantId !== undefined) {
			body.merchantId = merchantId;
			body.merchant_id = merchantId;
		}

		try {
			const res = await apiClient.post("/merchant/categories", body, {
				headers: { Accept: "application/json" },
			});
			return res?.data?.data ?? res?.data;
		} catch (error) {
			const msg = error?.response?.data?.message || error?.message;
			if (msg && /CATEGORY_NAME|already existed/i.test(msg)) {
				error.message = "Tên danh mục không hợp lệ hoặc đã tồn tại trong nhà hàng này.";
			}
			throw error;
		}
	},
	updateCategory: async (id, nameOrPayload) => {
		const rawName = typeof nameOrPayload === "string"
			? nameOrPayload
			: (nameOrPayload?.name || nameOrPayload?.categoryName || nameOrPayload?.title || "");
		const name = String(rawName ?? "").trim();
		if (!id) throw new Error("Thiếu mã danh mục để cập nhật");
		if (!name) throw new Error("Tên danh mục không được để trống");

		const rawMerchantId = typeof nameOrPayload === "object"
			? (nameOrPayload?.merchantId ?? nameOrPayload?.merchant_id ?? nameOrPayload?.merchant)
			: undefined;
		const merchantId = rawMerchantId != null ? rawMerchantId : undefined;

		const providedKey = typeof nameOrPayload === "object"
			? (nameOrPayload?.categoryKey ?? nameOrPayload?.category_name ?? nameOrPayload?.key ?? nameOrPayload?.code)
			: undefined;
		const categoryKey = buildCategoryKey(name, providedKey);

		const body = {
			name,
			title: name,
			displayName: name,
			categoryName: categoryKey,
		};
		if (merchantId !== undefined) {
			body.merchantId = merchantId;
			body.merchant_id = merchantId;
		}

		try {
			const res = await apiClient.put(`/merchant/categories/${id}`, body, {
				headers: { Accept: "application/json" },
			});
			return res?.data?.data ?? res?.data ?? true;
		} catch (error) {
			const msg = error?.response?.data?.message || error?.message;
			if (msg && /CATEGORY_NAME|already existed/i.test(msg)) {
				error.message = "Tên danh mục không hợp lệ hoặc đã tồn tại trong nhà hàng này.";
			}
			throw error;
		}
	},
	deleteCategory: async (id) => {
		const res = await apiClient.delete(`/merchant/categories/${id}`);
		return res?.data?.data ?? true;
	},
	// Lấy thông tin nhà hàng hiện tại (dựa vào token)
	getMyMerchant: async () => {
		const res = await apiClient.get("/merchant/my-merchant");
		return res.data?.data;
	},
	// Cập nhật thông tin merchant hiện tại (thử nhiều endpoint/phương thức/phân phối key)
	updateMyInfo: async (payload = {}) => {
		const hasKey = (obj, key) => Object.prototype.hasOwnProperty.call(obj ?? {}, key);

		const token = getToken();
		if (!token) {
			throw new Error("Bạn cần đăng nhập lại trước khi cập nhật thông tin.");
		}
		const baseHeaders = {
			Accept: "application/json",
			Authorization: `Bearer ${token}`,
			Role: "MERCHANT_ADMIN",
			"X-Role": "MERCHANT_ADMIN",
		};

		const camel = {};
		if (hasKey(payload, "introduction")) {
			camel.introduction = String(payload?.introduction ?? "").trim();
		}
		if (hasKey(payload, "address")) {
			camel.address = String(payload?.address ?? "").trim();
		}

		const rawOpening = hasKey(payload, "openingHours")
			? payload?.openingHours
			: (hasKey(payload, "opening_hours") ? payload?.opening_hours : undefined);
		if (rawOpening !== undefined) {
			if (rawOpening && typeof rawOpening === "object") {
				const normalized = {};
				Object.entries(rawOpening).forEach(([day, value]) => {
					if (value != null && value !== "") {
						normalized[day] = String(value);
					}
				});
				camel.openingHours = normalized;
			} else {
				camel.openingHours = {};
			}
		}

		const rawCuisine = hasKey(payload, "cuisineTypes")
			? payload?.cuisineTypes
			: (hasKey(payload, "cuisine_types") ? payload?.cuisine_types : undefined);
		if (rawCuisine !== undefined) {
			const cuisineArr = Array.isArray(rawCuisine)
				? rawCuisine
				: (typeof rawCuisine === "string"
						? rawCuisine.split(",")
						: []);
			camel.cuisineTypes = cuisineArr
				.map((s) => String(s).trim())
				.filter((s) => s.length > 0);
		}

		const snake = {};
		if ("introduction" in camel) snake.introduction = camel.introduction;
		if ("address" in camel) snake.address = camel.address;
		if ("openingHours" in camel) snake.opening_hours = camel.openingHours;
		if ("cuisineTypes" in camel) snake.cuisine_types = camel.cuisineTypes;

		const bodies = [camel, snake].filter((obj) => Object.keys(obj).length > 0);
		if (!bodies.length) throw new Error("No update payload provided");

		// Env override cho path (mặc định vẫn PUT /merchant/my-merchant)
		const envPath = (typeof import.meta !== "undefined" && import.meta?.env?.VITE_MERCHANT_UPDATE_PATH) || "";
		const candidates = [envPath || "/merchant/my-merchant"];
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
		throw new Error("Failed to update merchant info");
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
		throw new Error("Option groups API not found");
	},
	// Lưu option groups cho 1 món ăn (PUT/POST với fallback)
	setDishOptionGroups: async (dishId, groups) => {
		const candidates = [
			{ method: "put", path: `/merchant/dish/${dishId}/option-groups` },
			{ method: "put", path: `/dish/${dishId}/option-groups` },
			{ method: "post", path: `/merchant/dish/${dishId}/option-groups` },
			{ method: "post", path: `/option-groups/${dishId}` },
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
		throw lastErr || new Error("Failed to save option groups");
	},

	// Orders
	getOrders: async () => {
		const res = await apiClient.get("/merchant/order");
		const raw = res?.data?.data ?? res?.data;
		const candidateArrays = [
			raw,
			raw?.items,
			raw?.orders,
			raw?.data,
			raw?.results,
			raw?.content,
			raw?.records,
		];
		for (const arr of candidateArrays) {
			if (Array.isArray(arr)) return arr;
			if (Array.isArray(arr?.items)) return arr.items;
		}
		return [];
	},

	getOrderDetail: async (orderId) => {
		if (orderId === undefined || orderId === null) {
			throw new Error("orderId is required");
		}
		const res = await apiClient.get(`/customer/merchant/order/${orderId}`);
		return res?.data?.data ?? res?.data;
	},
};

export default merchantAPI;

