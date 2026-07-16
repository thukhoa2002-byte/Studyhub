import express from "express";
import multer from "multer";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { importAnkiPackage, MAX_APKG_BYTES } from "../services/anki.js";

const router = express.Router();

const upload = multer({
  dest: tmpdir(),
  limits: {
    fileSize: MAX_APKG_BYTES,
  },
});

router.post("/", upload.single("deck"), async (req, res) => {
  try {
    const result = await importAnkiPackage(req.file);

    res.json({
      success: true,
      title: result.title,
      data: result.questions,
      importSummary: result.summary,
    });
  } catch (error) {
    console.error(error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    if (req.file?.path) await rm(req.file.path, { force: true }).catch(() => undefined);
  }
});

export default router;
