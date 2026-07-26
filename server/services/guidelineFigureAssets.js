import { createHash } from "node:crypto";

function boundedNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeFigureCropBox(value) {
  const x = Math.max(0, Math.min(1, boundedNumber(value?.x, 0)));
  const y = Math.max(0, Math.min(1, boundedNumber(value?.y, 0)));
  const width = Math.max(0.01, Math.min(1 - x, boundedNumber(value?.width, 1)));
  const height = Math.max(0.01, Math.min(1 - y, boundedNumber(value?.height, 1)));
  return { x, y, width, height };
}

export async function renderOriginalFigureCrop(pdfBytes, pageNumber, cropBox) {
  const [{ getDocument }, { createCanvas }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("@napi-rs/canvas"),
  ]);
  const document = await getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true, useSystemFonts: true }).promise;
  const targetPage = Math.max(1, Math.min(document.numPages, Number(pageNumber) || 1));
  const page = await document.getPage(targetPage);
  const viewport = page.getViewport({ scale: 2 });
  const pageCanvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: pageCanvas.getContext("2d"), viewport }).promise;
  const normalized = normalizeFigureCropBox(cropBox);
  const sx = Math.round(normalized.x * viewport.width);
  const sy = Math.round(normalized.y * viewport.height);
  const width = Math.max(1, Math.round(normalized.width * viewport.width));
  const height = Math.max(1, Math.round(normalized.height * viewport.height));
  const crop = createCanvas(width, height);
  crop.getContext("2d").drawImage(pageCanvas, sx, sy, width, height, 0, 0, width, height);
  const png = crop.toBuffer("image/png");
  return {
    png,
    width,
    height,
    pageNumber: targetPage,
    cropBox: normalized,
    checksum: createHash("sha256").update(png).digest("hex"),
  };
}
