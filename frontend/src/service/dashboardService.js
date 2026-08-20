import api from "./api";

export const getDashboardData = async () => {
  const response = await api.get("/knowledge");

  return response.data.knowledge || [];
};