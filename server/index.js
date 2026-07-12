import gradingRouter from "./routes/grading.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import clozeRouter from "./routes/cloze.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend OK",
    version: "1.0.0",
  });
});

// Cloze API
app.use("/api/generate-cloze", clozeRouter);
app.use("/api/grading", gradingRouter);
// Home
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Cloze Generator API is running 🚀",
  });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});