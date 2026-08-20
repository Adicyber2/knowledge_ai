import api from "./api";


export const getKnowledge = async () => {
  const response = await api.get("/knowledge");

  console.log("Knowledge API response:", response.data);

  return response.data.knowledge;
};


export const createKnowledge = async (
  data
) => {

  const response =
    await api.post(
      "/knowledge",
      data
    );

 return response.data.knowledge;
};


export const updateKnowledge = async (
  id,
  data
) => {

  const response =
    await api.put(
      `/knowledge/${id}`,
      data
    );

 return response.data;
};


export const deleteKnowledge = async (
  id
) => {

  const response =
    await api.delete(
      `/knowledge/${id}`
    );

  return response.data;
};

export const analyzeKnowledge = async (id) => {
  const response = await api.post(`/knowledge/${id}/analyze`);
  return response.data;
};