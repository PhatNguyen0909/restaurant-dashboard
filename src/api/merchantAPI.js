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

const MERCHANT_WEEK_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MERCHANT_DAY_LABELS = {
	monday: "Thứ 2",
	tuesday: "Thứ 3",
	wednesday: "Thứ 4",
	thursday: "Thứ 5",
	friday: "Thứ 6",
	saturday: "Thứ 7",
	sunday: "Chủ nhật",
};

const stripDiacritics = (value = "") => {
	try {
		return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
	} catch {
		return String(value);
	}
};

const normalizeWeekdayToken = (value = "") => stripDiacritics(String(value).toLowerCase()).replace(/[^a-z0-9]/g, "");

const MERCHANT_DAY_KEY_ALIASES = {
	monday: ["monday", "mon", "thu2", "thuhai", "t2"],
	tuesday: ["tuesday", "tue", "thu3", "thuba", "t3"],
	wednesday: ["wednesday", "wed", "thu4", "thutu", "t4"],
	thursday: ["thursday", "thu5", "thunam", "t5"],
	friday: ["friday", "fri", "thu6", "thusau", "t6"],
	saturday: ["saturday", "sat", "thu7", "thubay", "t7"],
	sunday: ["sunday", "sun", "chunhat", "chunhat", "cn"],
};

const resolveMerchantWeekday = (value) => {
	const normalized = normalizeWeekdayToken(value);
	if (!normalized) return null;
	return MERCHANT_WEEK_ORDER.find((day) => MERCHANT_DAY_KEY_ALIASES[day].includes(normalized)) || null;
};

const toNumberOrNull = (value) => {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
};

const normalizeMerchantCoordinates = (merchant) => {
	if (!merchant || typeof merchant !== 'object') return merchant;
	const latitude = toNumberOrNull(
		merchant.latitude
		?? merchant.lat
		?? merchant.merchantLatitude
		?? merchant.location?.latitude
	);
	const longitude = toNumberOrNull(
		merchant.longitude
		?? merchant.lng
		?? merchant.long
		?? merchant.merchantLongitude
		?? merchant.location?.longitude
	);
	if (latitude == null && longitude == null) {
		return merchant;
	}
	return {
		...merchant,
		latitude,
		longitude,
		coordinates: {
			latitude,
			longitude,
		},
	};
};

const normalizeOpeningHoursForState = (source) => {
	if (!source || typeof source !== "object") return {};
	const normalized = {};
	Object.entries(source).forEach(([rawKey, rawValue]) => {
		if (rawValue == null) return;
		const dayKey = resolveMerchantWeekday(rawKey) || (MERCHANT_WEEK_ORDER.includes(rawKey) ? rawKey : null);
		if (!dayKey) return;
		if (normalized[dayKey] !== undefined) return;
		normalized[dayKey] = String(rawValue).trim();
	});
	return normalized;
};

const buildBackendOpeningHours = (source = {}) => {
	const normalized = normalizeOpeningHoursForState(source);
	const backend = {};
	MERCHANT_WEEK_ORDER.forEach((day) => {
		const rawValue = normalized[day];
		const value = rawValue == null ? "" : String(rawValue).trim();
		if (!value) return;
		const label = MERCHANT_DAY_LABELS[day] || day;
		backend[label] = value;
	});
	return backend;
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
			if (description !== undefined && description !== null) form.append("description", String(description));
			if (categoryId !== undefined && categoryId !== null) form.append("categoryId", String(categoryId));
			if (basePrice !== undefined && basePrice !== null) form.append("basePrice", String(basePrice));
		}

		// Thêm header idempotency nếu server hỗ trợ (không gây lỗi nếu bỏ qua)
		const key = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
		const res = await apiClient.post("/merchant/menu-items", form, {
			headers: {
				// Không set Content-Type - để axios tự động set multipart/form-data với boundary
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
						// Fetch through proxy to avoid CORS
						const imageUrl = existingImageUrl.trim();
						const proxyUrl = imageUrl.startsWith('http') 
							? imageUrl.replace(/^https?:\/\/[^\/]+/, '') 
							: imageUrl;
						
						const resp = await fetch(proxyUrl);
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

		try {
			const res = await apiClient.put(`/merchant/menu-items/${id}`, form, {
				headers: {
					Accept: "application/json",
				},
			});
			return res?.data?.data ?? res?.data ?? true;
		} catch (networkError) {
			const message = networkError?.response?.data?.message || networkError?.response?.data?.error || networkError?.message || "Không cập nhật được món ăn";
			throw new Error(message);
		}
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
	// Xóa menu item
	deleteMenuItem: async (menuItemId) => {
		if (!menuItemId) throw new Error("Thiếu mã món ăn để xóa");
		const res = await apiClient.delete(`/merchant/menu-items/${menuItemId}`, {
			headers: buildMerchantRoleHeaders(),
		});
		return res?.data?.data ?? res?.data ?? true;
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
		let merchant = body ?? null;
		if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "data")) {
			const inner = body.data;
			merchant = inner && typeof inner === "object" ? inner : inner ?? body;
		}
		return normalizeMerchantCoordinates(merchant);
	},
	// Cập nhật thông tin merchant hiện tại (thử nhiều endpoint/phương thức/phân phối key)
	updateMyInfo: async (payload) => {
		const token = getToken();
		if (!token) {
			throw new Error("Bạn cần đăng nhập lại trước khi cập nhật thông tin.");
		}

		// Nếu payload đã là FormData (từ Info.jsx), sử dụng trực tiếp
		let form;
		if (payload instanceof FormData) {
			form = payload;
		} else {
			// Legacy support: convert từ object sang FormData
			const normalizeString = (value) => (value == null ? "" : String(value).trim());
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
			const normalizedOpeningHours = normalizeOpeningHoursForState(payload?.openingHours ?? payload?.opening_hours);
			const backendOpeningHours = buildBackendOpeningHours(normalizedOpeningHours);
			const cuisineTypes = normalizeCuisine(payload?.cuisineTypes ?? payload?.cuisine_types);
			const latitudeValue = toNumberOrNull(payload?.latitude ?? payload?.lat);
			const longitudeValue = toNumberOrNull(payload?.longitude ?? payload?.lng);
			const imgFile = payload?.imgFile || payload?.image || payload?.imageFile || null;

			form = new FormData();
			const dataPart = {};
			if (introduction !== "") dataPart.introduction = introduction;
			if (address !== "") dataPart.address = address;
			if (Object.keys(backendOpeningHours).length) {
				dataPart.openingHours = backendOpeningHours;
			}
			if (cuisineTypes.length) dataPart.cuisineTypes = cuisineTypes;
			if (latitudeValue !== null) dataPart.latitude = latitudeValue;
			if (longitudeValue !== null) dataPart.longitude = longitudeValue;
			
			if (!Object.keys(dataPart).length && !imgFile) {
				throw new Error("Không có thông tin nào để cập nhật.");
			}

			form.append("data", new Blob([JSON.stringify(dataPart)], { type: "application/json" }));
			
			if (imgFile instanceof File || imgFile instanceof Blob) {
				form.append("img", imgFile);
			} else if (typeof imgFile === "string" && imgFile.trim()) {
				// User hasn't changed image - fetch existing image through proxy
				try {
					// If URL is from backend, it should be accessible via proxy
					const imageUrl = imgFile.trim();
					const fileName = imageUrl.split("/").pop()?.split("?")[0] || "merchant-image";
					
					// Fetch through same-origin to avoid CORS
					const proxyUrl = imageUrl.startsWith('http') 
						? imageUrl.replace(/^https?:\/\/[^\/]+/, '') // Remove domain, keep path
						: imageUrl;
					
					const resp = await fetch(proxyUrl);
					if (resp.ok) {
						const blob = await resp.blob();
						form.append("img", blob, fileName);
					} else {
						throw new Error("Không tải được ảnh hiện tại");
					}
				} catch (err) {
					throw new Error("Không tải được ảnh hiện tại. Vui lòng chọn ảnh mới để cập nhật.");
				}
			}

			if (!form.has("img")) {
				throw new Error("Vui lòng chọn ảnh để cập nhật thông tin nhà hàng.");
			}
		}

		try {
			const res = await apiClient.put("/merchant/my-merchant", form, {
				headers: {
					Accept: "application/json",
					Role: "MERCHANT_ADMIN",
					"X-Role": "MERCHANT_ADMIN",
				},
			});
			return res?.data?.data ?? res?.data ?? true;
		} catch (error) {
			const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Không thể cập nhật thông tin nhà hàng.";
			throw new Error(message);
		}
	},
	updateMerchantOpenStatus: async (isOpen) => {
		const token = getToken();
		if (!token) {
			throw new Error("Bạn cần đăng nhập lại trước khi cập nhật trạng thái mở cửa.");
		}

		const queryValue = isOpen ? "true" : "false";
		try {
			const res = await apiClient.patch(`/merchant/my-merchant/isOpen?isOpen=${queryValue}`, {}, {
				headers: {
					Accept: "application/json",
					Role: "MERCHANT_ADMIN",
					"X-Role": "MERCHANT_ADMIN",
				},
			});
			const body = res?.data;
			if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "data")) {
				return body.data;
			}
			return body ?? true;
		} catch (error) {
			const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Không thể cập nhật trạng thái mở cửa.";
			throw new Error(message);
		}
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
			// Use the merchant/my-orders endpoint as requested
			const endpoint = "/merchant/my-orders";
			try {
				const res = await apiClient.get(endpoint, { headers: { ...baseHeaders } });
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
				throw err;
			}
			return [];
		},

		getOrderDetail: async (orderId) => {
			if (orderId === undefined || orderId === null) {
				throw new Error("orderId is required");
			}
			const baseHeaders = buildMerchantRoleHeaders();
			const endpoint = `/merchant/orders/${orderId}`;
			try {
				const res = await apiClient.get(endpoint, { headers: { ...baseHeaders } });
				return res?.data?.data ?? res?.data;
			} catch (err) {
				throw err;
			}
		},


	// Update order status
	updateOrderStatus: async (orderId, status, cancelReason = undefined) => {
		if (!orderId) throw new Error('orderId is required');
		const cleanStatus = String(status ?? '').trim();
		if (!cleanStatus) throw new Error('status is required');
		const payload = { status: cleanStatus };
		if (/^cancel/i.test(cleanStatus) && cancelReason !== undefined) {
			payload.cancelReason = String(cancelReason ?? '');
		}
		const res = await apiClient.patch(`/merchant/orders/${orderId}`, payload, {
			headers: { ...buildMerchantRoleHeaders() },
		});
		return res?.data?.data ?? res?.data;
	},

	// Get all feedbacks
	getFeedbacks: async () => {
		const res = await apiClient.get('/merchant/feedbacks', {
			headers: { ...buildMerchantRoleHeaders() },
		});
		return res?.data?.data ?? res?.data ?? [];
	},

	// Reply to a feedback
	replyFeedback: async (feedbackId, comment) => {
		if (!feedbackId) throw new Error('feedbackId is required');
		if (!comment || !String(comment).trim()) throw new Error('comment is required');
		const payload = { comment: String(comment).trim() };
		const res = await apiClient.post(`/merchant/feedbacks/${feedbackId}/reply`, payload, {
			headers: { ...buildMerchantRoleHeaders() },
		});
		return res?.data?.data ?? res?.data;
	},

	// Upload transaction proof for registration payment
	uploadTransactionProof: async (merchantName, imgFile) => {
		if (!merchantName || !String(merchantName).trim()) {
			throw new Error('merchantName is required');
		}
		if (!imgFile) {
			throw new Error('imgFile is required');
		}
		
		const formData = new FormData();
		formData.append('merchantName', String(merchantName).trim());
		formData.append('imgFile', imgFile);
		
		// Thử endpoint public trước, nếu không tồn tại/không hỗ trợ thì fallback sang endpoint merchant
		const candidates = [
			// Nếu backend không có public, sẽ fallback sang merchant; cả hai đều yêu cầu bỏ gắn Authorization
			{ path: '/public/upload-transaction-proof' },
			{ path: '/merchant/upload-transaction-proof' },
		];
		let lastErr;
		for (const c of candidates) {
			try {
				const res = await apiClient.post(c.path, formData, {
					headers: {
						// Không set Content-Type để axios tự gán boundary multipart
						Accept: 'application/json',
						'X-Skip-Auth': 'true',
					},
					// Đặt cờ skipAuth để interceptor không gắn Authorization
					skipAuth: true,
				});
				return res?.data?.data ?? res?.data;
			} catch (e) {
				lastErr = e;
			}
		}
		throw lastErr || new Error('Upload transaction proof failed');
	},

	// Update drone location
	updateDroneLocation: async (droneId, latitude, longitude) => {
		if (!droneId) return null;
		try {
			// Use the admin endpoint as requested: PUT /admin/drones/{id}/update-location?latitude=...&longitude=...
			const res = await apiClient.put(`/admin/drones/${droneId}/update-location`, null, {
				params: {
					latitude,
					longitude
				}
			});
			const body = res?.data?.data ?? res?.data ?? null;
			return body;
		} catch (err) {
			console.error('Failed to update drone location', err);
			return null;
		}
	},
};

export default merchantAPI;

