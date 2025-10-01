import apiClient from "./apiClient"

const normalizeCuisineArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const userAPI ={
  login: async(data) =>{
    const res =await apiClient.post("/auth/login",data);
    return res.data?.data ?? res.data;
  },
  register: async (data) => {
    const cuisineArr = normalizeCuisineArray(data.cuisineTypes || data.cuisine_types);
    const payload = {
      fullName: data.fullName?.trim(),
      email: data.email?.trim(),
      merchantName: data.merchantName?.trim(),
      address: data.address?.trim(),
      // Backend yêu cầu mảng string (tên cuisine)
      cuisineTypes: cuisineArr.map(String),
    };
    const res = await apiClient.post("/merchant/register", payload);
    return res.data?.data ?? res.data;
  },
  // Lấy danh sách cuisine types (có thử nhiều endpoint phổ biến, lấy cái nào trả về thành công trước)
  getCuisineTypes: async () => {
    const paths = [
      '/cuisine-types',
      '/merchant/cuisine-types',
      '/cuisine-type',
      '/system/cuisine-types',
    ];
    for (const p of paths) {
      try {
        const res = await apiClient.get(p);
        const body = res?.data?.data ?? res?.data;
        const list = Array.isArray(body?.items) ? body.items : body;
        if (Array.isArray(list) && list.length) return list;
      } catch (e) {
        // thử endpoint kế tiếp
      }
    }
    return [];
  }
};
export default userAPI;