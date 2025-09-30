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
};

export default merchantAPI;
