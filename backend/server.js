import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./src/config/database.js";
import authRoutes from "./src/routers/auth.routes.js";
import knowledgeRoutes from "./src/routers/knowledge.routes.js";
import aiRoutes from "./src/routers/ai.routes.js";
import chatRoutes from "./src/routers/chat.routes.js";


dotenv.config();

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "AI Knowledge Vault API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/knowledge", knowledgeRoutes);

app.use("/api/ai", aiRoutes);

app.use("/api/chats", chatRoutes);


app.listen(3000, () => {
  console.log(`Server running on port 3000 `);
});