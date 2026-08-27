import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import connectDB from "./src/config/database.js";
import authRoutes from "./src/routers/auth.routes.js";
import knowledgeRoutes from "./src/routers/knowledge.routes.js";
import aiRoutes from "./src/routers/ai.routes.js";
import chatRoutes from "./src/routers/chat.routes.js";

dotenv.config();

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
    "http://localhost:3000",
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
});