import api from "./api";

// ---- Get all notifications for logged-in user ----
export const getNotifications = async () => {
  const response = await api.get("/notifications");
  return response.data;
};

// ---- Mark a single notification as read ----
export const markNotificationRead = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
};

// ---- Mark ALL notifications as read ----
export const markAllRead = async () => {
  const response = await api.patch("/notifications/read-all");
  return response.data;
};

// ---- Keep knowledge permanently (prevent auto-delete) ----
export const keepKnowledgePermanent = async (notificationId) => {
  const response = await api.patch(`/notifications/${notificationId}/keep-permanent`);
  return response.data;
};

// ---- Delete knowledge immediately ----
export const deleteKnowledgeNow = async (notificationId) => {
  const response = await api.delete(`/notifications/${notificationId}/delete-knowledge`);
  return response.data;
};

// ---- Dismiss notification (without deleting knowledge) ----
export const dismissNotification = async (notificationId) => {
  const response = await api.delete(`/notifications/${notificationId}`);
  return response.data;
};
