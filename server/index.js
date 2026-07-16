import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import clozeRouter from "./routes/cloze.js";
import gradingRouter from "./routes/grading.js";
import ankiRouter from "./routes/anki.js";
import mcqRouter from "./routes/mcq.js";
import { getAiCallsRemaining } from "./services/aiUsage.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const clientDistPath = join(__dirname, "..", "client", "dist");

app.use(cors());
app.use(express.json());

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend OK",
    version: "1.1.0-gemini",
  });
});

app.get("/api/ai-usage", (req, res) => {
  res.json({ aiCallsRemaining: getAiCallsRemaining() });
});

// API
app.use("/api/generate-cloze", clozeRouter);
app.use("/api/grading", gradingRouter);
app.use("/api/import-anki", ankiRouter);
app.use("/api/generate-mcq", mcqRouter);

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(join(clientDistPath, "index.html"));
  });
} else {
  // Home
  app.get("/", (req, res) => {
    res.json({
      success: true,
      message: "AI Cloze Generator API is running 🚀",
    });
  });
}

// Render sẽ truyền PORT qua biến môi trường
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
