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

const buildMerchantRoleHeaders = () => ({
	Accept: "application/json",
	Role: "MERCHANT_ADMIN",
	"X-Role": "MERCHANT_ADMIN",
});

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
			if (description !== undefined && description !== null) form.append("description", String(description));
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

		updateMenuItem: async (id, payload = {}) => {
			if (!id) throw new Error("Thiếu mã món ăn để cập nhật");

			const rawFile = payload?.imageFile || payload?.imgFile || payload?.image;
			const existingImageUrl = payload?.existingImageUrl ?? payload?.imgUrl ?? payload?.imageUrl;
			const basePrice = payload?.basePrice ?? payload?.price;
			const categoryId = payload?.categoryId ?? payload?.category;
			const name = payload?.name;
			const description = payload?.description;

			const toFile = async () => {
				if (typeof File !== "undefined" && rawFile instanceof File) {
					return rawFile;
				}
				if (typeof Blob !== "undefined" && rawFile instanceof Blob) {
					const inferredExt = (() => {
						const type = rawFile.type || "";
						if (!type.includes("/")) return "";
						const ext = type.split("/")[1];
						return ext ? `.${ext}` : "";
					})();
					return new File([rawFile], `image${inferredExt}`, { type: rawFile.type || "application/octet-stream" });
				}
				if (typeof rawFile === "string" && rawFile.startsWith("blob:")) {
					const resp = await fetch(rawFile);
					if (!resp.ok) return null;
					const blob = await resp.blob();
					return new File([blob], "image", { type: blob.type || "application/octet-stream" });
				}
				if (existingImageUrl) {
					try {
						const resp = await fetch(existingImageUrl, { mode: "cors" });
						if (!resp.ok) throw new Error(`Không tải được ảnh hiện tại (HTTP ${resp.status})`);
						const blob = await resp.blob();
						const urlPart = existingImageUrl.split("/").pop() || "image";
						const cleanName = (urlPart || "image").split("?")[0] || "image";
						return new File([blob], cleanName, { type: blob.type || "application/octet-stream" });
					} catch (err) {
						throw new Error("Không tải được ảnh hiện tại, vui lòng chọn ảnh mới trước khi lưu.");
					}
				}
				return null;
			};

			const imageFile = await toFile();
			if (!imageFile) {
				throw new Error("Vui lòng chọn ảnh món ăn trước khi lưu thay đổi.");
			}

			const form = new FormData();
			form.append("imgFile", imageFile, imageFile.name || "image");
			if (name !== undefined) form.append("name", String(name));
			if (description !== undefined && description !== null) form.append("description", String(description));
			if (categoryId !== undefined && categoryId !== null) form.append("categoryId", String(categoryId));
			if (basePrice !== undefined && basePrice !== null) form.append("basePrice", String(basePrice));

			const baseURL = (apiClient?.defaults?.baseURL || "").replace(/\/$/, "");
			const url = `${baseURL}/merchant/menu-items/${id}`;
			const token = getToken();
			const headers = new Headers();
			headers.set("Accept", "application/json");
			if (token) headers.set("Authorization", `Bearer ${token}`);

			let response;
			try {
				response = await fetch(url, {
					method: "PUT",
					headers,
					body: form,
					credentials: "same-origin",
				});
			} catch (networkError) {
				throw new Error(networkError?.message || "Không thể kết nối đến máy chủ.");
			}

			if (!response) {
				throw new Error("Server không phản hồi.");
			}

			if (!response.ok) {
				let message = "Không cập nhật được món ăn";
				try {
					const data = await response.json();
					message = data?.message || data?.error || message;
				} catch {
					try {
						const text = await response.text();
						if (text) message = text;
					} catch {}
				}
				throw new Error(message);
			}

			const contentType = response.headers.get("content-type") || "";
			if (contentType.includes("application/json")) {
				const data = await response.json();
				return data?.data ?? data ?? true;
			}
			return true;
		},

		updateDishStatus: async (id, status) => {
			if (!id) throw new Error("Thiếu mã món ăn để đổi trạng thái");
			if (status === undefined || status === null) throw new Error("Thiếu trạng thái mới");
			const desiredVisible = (() => {
				if (typeof status === "boolean") return status;
				const raw = String(status).trim().toLowerCase();
				if (["available", "active", "on", "true", "1"].includes(raw)) return true;
				if (["unavailable", "inactive", "off", "false", "0"].includes(raw)) return false;
				return Boolean(status);
			})();

			const headers = { Accept: "application/json" };
			const normalizedStatus = desiredVisible ? "ACTIVE" : "INACTIVE";
			const candidates = [
				{ method: "patch", path: `/merchant/menu-items/${id}/isVisible`, body: {}, params: { isVisible: desiredVisible } },
				{ method: "patch", path: `/merchant/menu-items/${id}/status`, body: { status: normalizedStatus }, params: { status: normalizedStatus } },
				{ method: "patch", path: `/merchant/menu-items/${id}`, body: { status: normalizedStatus } },
				{ method: "put", path: `/merchant/menu-items/${id}`, body: { status: normalizedStatus } },
			];
			let lastError;
			for (const candidate of candidates) {
				try {
					const config = { headers };
					if (candidate.params) config.params = candidate.params;
					const res = await apiClient[candidate.method](candidate.path, candidate.body, config);
					return res?.data?.data ?? res?.data ?? true;
				} catch (error) {
					lastError = error;
				}
			}
			throw lastError || new Error("Không đổi được trạng thái món ăn");
		},

	// Lấy tất cả menu items (để fallback xác nhận sau khi tạo)
	getMenuItems: async () => {
		const res = await apiClient.get("/merchant/menu-items");
		const body = res?.data?.data ?? res?.data;
		if (Array.isArray(body)) return body;
		if (Array.isArray(body?.items)) return body.items;
		return [];
	},
	getMenuItemById: async (menuItemId) => {
		if (!menuItemId) throw new Error("Thiếu mã món ăn");
		const res = await apiClient.get(`/merchant/menu-items/${menuItemId}`, {
			headers: buildMerchantRoleHeaders(),
		});
		return res?.data?.data ?? res?.data ?? null;
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
		const body = res?.data;
		if (body && typeof body === "object") {
			if (Object.prototype.hasOwnProperty.call(body, "data")) {
				const inner = body.data;
				if (inner && typeof inner === "object") return inner;
				if (inner !== undefined) return inner;
			}
		}
		return body ?? null;
	},
	// Cập nhật thông tin merchant hiện tại (thử nhiều endpoint/phương thức/phân phối key)
	updateMyInfo: async (payload = {}) => {
		const token = getToken();
		if (!token) {
			throw new Error("Bạn cần đăng nhập lại trước khi cập nhật thông tin.");
		}

		const normalizeString = (value) => (value == null ? "" : String(value).trim());
		const normalizeOpeningHours = (source) => {
			if (!source || typeof source !== "object") return {};
			const cleaned = {};
			Object.entries(source).forEach(([key, val]) => {
				if (val != null && val !== "") cleaned[key] = String(val);
			});
			return cleaned;
		};
		const normalizeCuisine = (source) => {
			if (Array.isArray(source)) {
				return source.map((item) => normalizeString(item)).filter(Boolean);
			}
			if (typeof source === "string") {
				return source.split(",").map((item) => normalizeString(item)).filter(Boolean);
			}
			return [];
		};

		const introduction = normalizeString(payload?.introduction ?? payload?.description);
		const address = normalizeString(payload?.address);
		const openingHours = normalizeOpeningHours(payload?.openingHours ?? payload?.opening_hours);
		const cuisineTypes = normalizeCuisine(payload?.cuisineTypes ?? payload?.cuisine_types);
		const imgFile = payload?.imgFile || payload?.image || payload?.imageFile || null;

		const form = new FormData();
		const dataPart = {};
		if (introduction !== "") dataPart.introduction = introduction;
		if (address !== "") dataPart.address = address;
		if (Object.keys(openingHours).length) dataPart.openingHours = openingHours;
		if (cuisineTypes.length) dataPart.cuisineTypes = cuisineTypes;
		if (!Object.keys(dataPart).length && !imgFile) {
			throw new Error("Không có thông tin nào để cập nhật.");
		}

		form.append("data", new Blob([JSON.stringify(dataPart)], { type: "application/json" }));
		if (imgFile instanceof File || imgFile instanceof Blob) {
			form.append("img", imgFile);
		} else if (typeof imgFile === "string" && imgFile) {
			const sanitize = (url) => {
				const trimmed = url.trim();
				if (!trimmed) return "";
				return trimmed.split("?")[0] || trimmed;
			};
			const candidates = Array.from(new Set([imgFile, sanitize(imgFile)].filter(Boolean)));
			for (const candidate of candidates) {
				try {
					const resp = await fetch(candidate, { mode: "cors" });
					if (!resp.ok) continue;
					const blob = await resp.blob();
					const fileName = candidate.split("/").pop()?.split("?")[0] || "merchant-image";
					form.append("img", blob, fileName);
					break;
				} catch {
					// ignore; thử candidate kế tiếp hoặc bỏ qua
				}
			}
		}
		if (!form.has("img")) {
			throw new Error("Không tải được ảnh hiện tại, vui lòng chọn ảnh mới trước khi lưu.");
		}

		const baseURL = (apiClient?.defaults?.baseURL || "").replace(/\/$/, "");
		const url = `${baseURL}/merchant/my-merchant`;
		const headers = new Headers();
		headers.set("Accept", "application/json");
		headers.set("Authorization", `Bearer ${token}`);
		headers.set("Role", "MERCHANT_ADMIN");
		headers.set("X-Role", "MERCHANT_ADMIN");

		const response = await fetch(url, {
			method: "PUT",
			headers,
			body: form,
			credentials: "same-origin",
		});

		if (!response.ok) {
			let message = "Không thể cập nhật thông tin nhà hàng.";
			try {
				const data = await response.json();
				message = data?.message || data?.error || message;
			} catch {
				const text = await response.text();
				if (text) message = text;
			}
			throw new Error(message);
		}

		const contentType = response.headers.get("content-type") || "";
		if (contentType.includes("application/json")) {
			const body = await response.json();
			return body?.data ?? body ?? true;
		}
		return true;
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
			const baseHeaders = buildMerchantRoleHeaders();
			const endpoints = [
				"/merchant/my-orders",
				"/merchant/orders",
				"/merchant/order",
				"/merchant/order/list",
			];
			let lastErr;
			for (const path of endpoints) {
				try {
					const res = await apiClient.get(path, { headers: { ...baseHeaders } });
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
				} catch (err) {
					lastErr = err;
				}
			}
			if (lastErr) throw lastErr;
			return [];
		},

		getOrderDetail: async (orderId) => {
			if (orderId === undefined || orderId === null) {
				throw new Error("orderId is required");
			}
			const endpoints = [
				`/merchant/my-orders/${orderId}`,
				`/merchant/orders/${orderId}`,
				`/merchant/order/${orderId}`,
				`/customer/merchant/order/${orderId}`,
			];
			const baseHeaders = buildMerchantRoleHeaders();
			let lastErr;
			for (const path of endpoints) {
				try {
					const res = await apiClient.get(path, { headers: { ...baseHeaders } });
					return res?.data?.data ?? res?.data;
				} catch (err) {
					lastErr = err;
				}
			}
			if (lastErr) throw lastErr;
			throw new Error("Không lấy được chi tiết đơn hàng");
		},

		// Update order status
		updateOrderStatus: async (orderId, status, cancelReason = undefined) => {
			if (!orderId) throw new Error('orderId is required');
			const payloads = [
				{ status, cancelReason },
				{ status, reason: cancelReason },
				{ status, note: cancelReason },
			];
			const endpoints = [
				{ method: "patch", path: `/merchant/my-orders/${orderId}` },
				{ method: "patch", path: `/merchant/my-orders/${orderId}/status` },
				{ method: "put", path: `/merchant/my-orders/${orderId}/status` },
				{ method: "patch", path: `/merchant/order/${orderId}` },
				{ method: "patch", path: `/merchant/orders/${orderId}` },
				{ method: "patch", path: `/customer/merchant/order/${orderId}` },
			];
			let lastErr;
			const baseHeaders = buildMerchantRoleHeaders();
			for (const endpoint of endpoints) {
				for (const payload of payloads) {
					try {
						const body = { ...payload };
						if (!cancelReason) {
							delete body.cancelReason;
							delete body.reason;
							delete body.note;
						}
						const res = await apiClient[endpoint.method](endpoint.path, body, {
							headers: { ...baseHeaders },
						});
						return res?.data?.data ?? res?.data;
					} catch (err) {
						lastErr = err;
					}
				}
			}
			if (lastErr) throw lastErr;
			throw new Error('Không thể cập nhật trạng thái đơn hàng');
		},
	
};

export default merchantAPI;

