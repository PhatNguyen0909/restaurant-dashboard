import apiClient from "./apiClient";

const merchantAPI = {
  // Lấy thực đơn của nhà hàng theo id
  getMenuByRestaurant: async (MerchantId) => {
    const res = await apiClient.get(`/menu/${MerchantId}`);
    return res.data?.data;
  },
};

export default merchantAPI;
