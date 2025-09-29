import apiClient from "./apiClient"
const userAPI ={
  login: async(data) =>{
    const res =await apiClient.post("/auth/login",data);
    return res.data?.data;
  },
  register: async (data) => {
    const res = await apiClient.post("/merchant/register", data);
    return res.data?.data;
  },
};
export default userAPI;