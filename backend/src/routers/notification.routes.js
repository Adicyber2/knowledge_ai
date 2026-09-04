import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  keepKnowledgePermanent,
  deleteKnowledgeFromNotification,
  deleteNotification,
} from "../controllers/notification.controller.js";

const router = express.Router();

// All routes require authentication
router.get("/", authMiddleware, getNotifications);
router.patch("/read-all", authMiddleware, markAllNotificationsRead);
router.patch("/:id/read", authMiddleware, markNotificationRead);
router.patch("/:id/keep-permanent", authMiddleware, keepKnowledgePermanent);
router.delete("/:id/delete-knowledge", authMiddleware, deleteKnowledgeFromNotification);
router.delete("/:id", authMiddleware, deleteNotification);

export default router;
