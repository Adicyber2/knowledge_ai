// IMPORTANT: dotenv MUST be configured before any other module reads process.env
// In ESM, imports are hoisted, so we use a dedicated env.js file approach.
// The getAiUrl() lazy pattern in aiService.js handles the timing correctly.
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import cron from "node-cron";
import { fileURLToPath } from "url";
import connectDB from "./src/config/database.js";
import authRoutes from "./src/routers/auth.routes.js";
import knowledgeRoutes from "./src/routers/knowledge.routes.js";
import aiRoutes from "./src/routers/ai.routes.js";
import chatRoutes from "./src/routers/chat.routes.js";
import notificationRoutes from "./src/routers/notification.routes.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

connectDB();

// CORS — allow frontend dev server and Chrome extension
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://knowledge-frontedn.onrender.com",
    "chrome-extension://",
  ],
  credentials: true,
}));

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Serve static uploads
app.use("/uploads", express.static(uploadsDir));

app.get("/", (req, res) => {
  res.json({
    message: "AI Knowledge Vault API is running",
    version: "2.0.0",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/knowledge", knowledgeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/notifications", notificationRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startCronJobs();
});


// ============================================================
// CRON JOBS — 30-day Expiry System
// ============================================================

async function startCronJobs() {
  // Lazy imports inside the function to avoid circular dependency issues
  const { default: Knowledge } = await import("./src/models/Knowledge.model.js");
  const { default: Notification } = await import("./src/models/Notification.model.js");
  const { default: KnowledgeRelationship } = await import("./src/models/KnowledgeRelationship.model.js");

  // ---- JOB 1: Day-25 Notification (runs daily at 08:00) ----
  // Finds knowledge expiring within 5 days → creates notification if not already sent
  cron.schedule("0 8 * * *", async () => {
    console.log("\n[CRON] Running Day-25 expiry notification check...");
    try {
      const now = new Date();
      const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      const expiringItems = await Knowledge.find({
        isPermanent: false,
        expiryNotificationSent: false,
        expiresAt: {
          $gte: now,
          $lte: in5Days,
        },
      });

      let notificationCount = 0;
      for (const item of expiringItems) {
        try {
          const daysUntilExpiry = Math.ceil(
            (new Date(item.expiresAt) - now) / (1000 * 60 * 60 * 24)
          );

          await Notification.create({
            userId: item.userId,
            knowledgeId: item._id,
            knowledgeTitle: item.title,
            type: "expiry_warning",
            expiresAt: item.expiresAt,
            daysUntilExpiry,
          });

          // Mark that we sent the notification to avoid duplicates
          item.expiryNotificationSent = true;
          await item.save();
          notificationCount++;
        } catch (err) {
          // Skip duplicates (unique index) — not an error
          if (err.code !== 11000) {
            console.error(`[CRON] Failed to create notification for ${item._id}:`, err.message);
          }
        }
      }

      console.log(`[CRON] Day-25 check complete: ${notificationCount} notification(s) created`);
    } catch (err) {
      console.error("[CRON] Day-25 notification job error:", err.message);
    }
  });


  // ---- JOB 2: Day-30 Auto-Delete (runs daily at 00:00 midnight) ----
  // Deletes non-permanent knowledge items whose expiresAt has passed
  cron.schedule("0 0 * * *", async () => {
    console.log("\n[CRON] Running Day-30 auto-delete job...");
    try {
      const now = new Date();

      const expiredItems = await Knowledge.find({
        isPermanent: false,
        expiresAt: { $lt: now },
      });

      let deletedCount = 0;
      for (const item of expiredItems) {
        try {
          // Delete knowledge
          await Knowledge.findByIdAndDelete(item._id);

          // Clean up graph relationships
          await KnowledgeRelationship.deleteMany({
            userId: item.userId,
            $or: [
              { sourceKnowledgeId: item._id },
              { targetKnowledgeId: item._id },
            ],
          }).catch(() => {});

          // Remove any pending notifications for this item
          await Notification.deleteMany({ knowledgeId: item._id }).catch(() => {});

          deletedCount++;
          console.log(`[CRON] Auto-deleted expired knowledge: "${item.title}" (${item._id})`);
        } catch (err) {
          console.error(`[CRON] Failed to delete item ${item._id}:`, err.message);
        }
      }

      console.log(`[CRON] Day-30 auto-delete complete: ${deletedCount} item(s) deleted`);
    } catch (err) {
      console.error("[CRON] Day-30 delete job error:", err.message);
    }
  });

  console.log("[CRON] Expiry jobs scheduled: Day-25 notifications (08:00), Day-30 deletion (00:00)");
}