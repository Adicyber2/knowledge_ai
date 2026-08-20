import express from "express";

import {
  createChat,
  getChats,
  getChat,
  addMessage,
  deleteChat,
} from "../controllers/chat.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createChat);

router.get("/", authMiddleware, getChats);

router.get("/:id", authMiddleware, getChat);

router.post("/:id/messages", authMiddleware, addMessage);

router.delete("/:id", authMiddleware, deleteChat);

export default router;