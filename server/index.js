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
import clinicalCaseRouter from "./routes/clinicalCase.js";
import guidelineExtractionRouter from "./routes/guidelineExtraction.js";
import mcqImportRouter from "./routes/mcqImport.js";
import referenceBookExtractionRouter from "./routes/referenceBookExtraction.js";
import { getAiCallsRemaining } from "./services/aiUsage.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const clientDistPath = join(__dirname, "..", "client", "dist");
const canonicalHost = process.env.CANONICAL_HOST || "studyhub-ib8g.onrender.com";
const legacyHost = "hocbaithoii.onrender.com";

app.set("trust proxy", true);
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  if (req.hostname.toLowerCase() === legacyHost) {
    res.redirect(308, `https://${canonicalHost}${req.originalUrl}`);
    return;
  }
  next();
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend OK",
    version: "1.2.0-gemini",
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
app.use("/api/generate-clinical-case", clinicalCaseRouter);
app.use("/api/extract-guideline", guidelineExtractionRouter);
app.use("/api/mcq-import", mcqImportRouter);
app.use("/api/reference-books", referenceBookExtractionRouter);

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
