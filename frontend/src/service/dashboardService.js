import api from "./api";

export const getDashboardData = async () => {
  const response = await api.get("/knowledge");

  return response.data.knowledge || [];
};


export const getKnowledgeActivity = async () => {
  const response =
    await api.get("/knowledge/activity");

  // Backend returns the array directly (not wrapped in {activity: []})
  return Array.isArray(response.data) ? response.data : [];
};