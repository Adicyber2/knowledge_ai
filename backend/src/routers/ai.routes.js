import express from "express";

import authMiddleware from "../middlewares/auth.middleware.js";

import {
  askKnowledge
} from "../controllers/ai.controller.js";

const router = express.Router();

router.post(
  "/ask",
  authMiddleware,
  askKnowledge
);

export default router;