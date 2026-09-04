import express from "express";
import multer from "multer";

import {
  getKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  getKnowledgeActivity,
  importFromUrl,
  importFromYoutube,
  importFromPdf,
  importFromImage,
  semanticSearch,
  getKnowledgeGraph,
  analyzeKnowledgeById,
  bulkAnalyzeKnowledge,
  rebuildGraphRelationships,
} from "../controllers/knowledge.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

// ---- File Upload (memory storage — no temp files) ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
});


// ---- IMPORTANT: Static routes must be BEFORE /:id ----

router.get(
  "/activity",
  authMiddleware,
  getKnowledgeActivity
);

router.get(
  "/graph",
  authMiddleware,
  getKnowledgeGraph
);

// ---- Semantic Search ----

router.post(
  "/search/semantic",
  authMiddleware,
  semanticSearch
);

// ---- Import routes ----

router.post(
  "/import/url",
  authMiddleware,
  importFromUrl
);

router.post(
  "/import/youtube",
  authMiddleware,
  importFromYoutube
);

router.post(
  "/import/pdf",
  authMiddleware,
  upload.single("file"),
  importFromPdf
);

router.post(
  "/import/image",
  authMiddleware,
  upload.single("file"),
  importFromImage
);

// ---- Bulk AI Analysis (must be before /:id) ----

router.post(
  "/bulk-analyze",
  authMiddleware,
  bulkAnalyzeKnowledge
);

// ---- Graph Rebuild (clear stale relationships + regenerate) ----

router.post(
  "/graph/rebuild",
  authMiddleware,
  rebuildGraphRelationships
);

// ---- CRUD ----

router.get(
  "/",
  authMiddleware,
  getKnowledge
);

router.post(
  "/",
  authMiddleware,
  createKnowledge
);

router.put(
  "/:id",
  authMiddleware,
  updateKnowledge
);

router.delete(
  "/:id",
  authMiddleware,
  deleteKnowledge
);

// ---- AI Re-analysis for single item (must be after static routes, before generic /:id) ----

router.post(
  "/:id/analyze",
  authMiddleware,
  analyzeKnowledgeById
);


export default router;