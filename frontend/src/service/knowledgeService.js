import api from "./api";
import {
  saveKnowledgeOffline,
  getKnowledgeOffline,
  saveOneKnowledgeOffline,
  deleteOneKnowledgeOffline,
  addToSyncQueue,
  processSyncQueue,
} from "./offlineService";


// ---- GET all knowledge (offline-first) ----

export const getKnowledge = async () => {
  if (!navigator.onLine) {
    // Return cached data from IndexedDB
    return getKnowledgeOffline();
  }

  try {
    const response = await api.get("/knowledge");
    const items = response.data.knowledge || [];

    // Cache to IndexedDB
    await saveKnowledgeOffline(items).catch(() => {});

    return items;
  } catch (err) {
    // If network fails, fall back to cache
    console.warn("Network failed, using offline cache:", err.message);
    return getKnowledgeOffline();
  }
};


// ---- CREATE ----

export const createKnowledge = async (data) => {
  if (!navigator.onLine) {
    // Save locally with temp ID
    const tempItem = {
      ...data,
      _id: `local-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiProcessed: false,
      tags: [],
      summary: "",
      topics: [],
    };
    await saveOneKnowledgeOffline(tempItem);
    await addToSyncQueue("create", data);
    return tempItem;
  }

  const response = await api.post("/knowledge", data);
  const saved = response.data.data;

  if (saved) {
    await saveOneKnowledgeOffline(saved).catch(() => {});
  }

  return saved;
};


// ---- UPDATE ----

export const updateKnowledge = async (id, data) => {
  if (!navigator.onLine) {
    const updated = { ...data, _id: id, updatedAt: new Date().toISOString() };
    await saveOneKnowledgeOffline(updated);
    await addToSyncQueue("update", { ...data, _id: id });
    return { success: true, data: updated };
  }

  const response = await api.put(`/knowledge/${id}`, data);
  const updated = response.data?.data;

  if (updated) {
    await saveOneKnowledgeOffline(updated).catch(() => {});
  }

  return response.data;
};


// ---- DELETE ----

export const deleteKnowledge = async (id) => {
  if (!navigator.onLine) {
    await deleteOneKnowledgeOffline(id);
    await addToSyncQueue("delete", { id });
    return { success: true };
  }

  const response = await api.delete(`/knowledge/${id}`);

  await deleteOneKnowledgeOffline(id).catch(() => {});

  return response.data;
};


// ---- RE-ANALYZE (manual trigger) ----

export const analyzeKnowledge = async (id) => {
  const response = await api.post(`/knowledge/${id}/analyze`);
  return response.data;
};


// ---- IMPORT: URL / Article ----

export const importFromUrl = async (url) => {
  const response = await api.post("/knowledge/import/url", { url }, {
    timeout: 30000,
  });
  return response.data.data;
};


// ---- IMPORT: YouTube ----

export const importFromYoutube = async (url) => {
  const response = await api.post("/knowledge/import/youtube", { url }, {
    timeout: 30000,
  });
  return response.data.data;
};


// ---- IMPORT: PDF ----

export const importFromPdf = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/knowledge/import/pdf", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });

  return response.data.data;
};


// ---- IMPORT: Image OCR ----

export const importFromImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/knowledge/import/image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });

  return response.data.data;
};


// ---- SEMANTIC SEARCH ----

export const semanticSearch = async (query, limit = 8) => {
  const response = await api.post("/knowledge/search/semantic", {
    query,
    limit,
  });
  return response.data.results;
};


// ---- KNOWLEDGE GRAPH ----

export const getKnowledgeGraph = async () => {
  const response = await api.get("/knowledge/graph");
  return response.data;
};


// ---- SYNC (call when back online) ----

export const syncOfflineQueue = async () => {
  await processSyncQueue(api);
};