/**
 * offlineService.js
 * IndexedDB-based offline cache and sync queue for Knowledge Vault.
 * Uses native browser IndexedDB API — no extra libraries.
 */

const DB_NAME = "KnowledgeVaultOffline";
const DB_VERSION = 1;
const STORE_KNOWLEDGE = "knowledge";
const STORE_SYNC_QUEUE = "syncQueue";


// ---- Open DB ----

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains(STORE_KNOWLEDGE)) {
        db.createObjectStore(STORE_KNOWLEDGE, { keyPath: "_id" });
      }

      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        const store = db.createObjectStore(STORE_SYNC_QUEUE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("createdAt", "createdAt");
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}


// ---- Generic transaction helper ----

async function tx(storeName, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const req = callback(store);

    if (req) {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } else {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    }
  });
}


// ============================================================
// KNOWLEDGE CACHE
// ============================================================

export async function saveKnowledgeOffline(items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_KNOWLEDGE, "readwrite");
    const store = transaction.objectStore(STORE_KNOWLEDGE);

    // Clear and rewrite all items
    store.clear();
    items.forEach((item) => store.put(item));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}


export async function getKnowledgeOffline() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_KNOWLEDGE, "readonly");
    const store = transaction.objectStore(STORE_KNOWLEDGE);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}


export async function saveOneKnowledgeOffline(item) {
  return tx(STORE_KNOWLEDGE, "readwrite", (store) => store.put(item));
}


export async function deleteOneKnowledgeOffline(id) {
  return tx(STORE_KNOWLEDGE, "readwrite", (store) => store.delete(id));
}


// ============================================================
// SYNC QUEUE
// ============================================================

export async function addToSyncQueue(action, data) {
  /**
   * action: "create" | "update" | "delete"
   * data: the payload (for create/update) or { id } for delete
   */
  return tx(STORE_SYNC_QUEUE, "readwrite", (store) =>
    store.add({
      action,
      data,
      createdAt: Date.now(),
      retries: 0,
    })
  );
}


export async function getSyncQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SYNC_QUEUE, "readonly");
    const store = transaction.objectStore(STORE_SYNC_QUEUE);
    const req = store.getAll();

    req.onsuccess = () =>
      resolve(
        (req.result || []).sort((a, b) => a.createdAt - b.createdAt)
      );
    req.onerror = () => reject(req.error);
  });
}


export async function removeSyncItem(id) {
  return tx(STORE_SYNC_QUEUE, "readwrite", (store) => store.delete(id));
}


export async function clearSyncQueue() {
  return tx(STORE_SYNC_QUEUE, "readwrite", (store) => {
    store.clear();
    return null;
  });
}


// ============================================================
// PROCESS SYNC QUEUE (call when back online)
// ============================================================

let _isSyncing = false;

export async function processSyncQueue(api) {
  if (_isSyncing) return; // Prevent parallel syncs
  _isSyncing = true;

  try {
    const queue = await getSyncQueue();

    for (const item of queue) {
      try {
        if (item.action === "create") {
          const res = await api.post("/knowledge", item.data);
          // Save real ID to local cache
          if (res.data?.data?._id) {
            await saveOneKnowledgeOffline(res.data.data);
            // Remove temp local item (may have temp ID)
            if (item.data._id && item.data._id.startsWith("local-")) {
              await deleteOneKnowledgeOffline(item.data._id);
            }
          }
        } else if (item.action === "update") {
          await api.put(`/knowledge/${item.data._id}`, item.data);
        } else if (item.action === "delete") {
          await api.delete(`/knowledge/${item.data.id}`);
        }

        await removeSyncItem(item.id);

      } catch (err) {
        console.error(`Sync failed for item ${item.id}:`, err.message);
        // Leave in queue for next retry (bump retries)
        // Could add retry limit logic here
      }
    }
  } finally {
    _isSyncing = false;
  }
}
