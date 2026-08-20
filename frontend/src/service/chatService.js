import api from "./api";

// Create new chat
export const createChat = async (
  title = "New Chat",
  knowledgeIds = []
) => {
  const response = await api.post("/chats", {
    title,
    knowledgeIds,
  });

  return response.data;
};

// Get all chats
export const getChats = async () => {
  const response = await api.get("/chats");

  return response.data;
};

// Get single chat
export const getChat = async (chatId) => {
  const response = await api.get(`/chats/${chatId}`);

  return response.data;
};

// Save message
export const addChatMessage = async (
  chatId,
  role,
  content
) => {
  const response = await api.post(
    `/chats/${chatId}/messages`,
    {
      role,
      content,
    }
  );

  return response.data;
};

// Delete chat
export const deleteChat = async (chatId) => {
  const response = await api.delete(
    `/chats/${chatId}`
  );

  return response.data;
};