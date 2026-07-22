import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Check, ClipboardPaste, Crop, Download, FileSearch, FileText, Globe2, Image as ImageIcon, ImagePlus, LoaderCircle, LockKeyhole, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { extractMcqFiles } from "../services/api";
import { deleteMcqBank, mcqLibraryErrorMessage, saveMcqBank, type McqLibraryBank, type McqLibraryQuestion } from "../services/mcqLibrary";
import FileDropZone from "./FileDropZone";
import RichTextEditor from "./RichTextEditor";

type Props = {
  userId: string;
  drafts: McqLibraryBank[];
  onChanged: () => Promise<void> | void;
  onAiCallsRemaining?: (remaining: number) => void;
  requestedBank?: McqLibraryBank | null;
  showDrafts?: boolean;
};

const requiredOptionIds = ["A", "B", "C", "D"] as const;
const optionIds = ["A", "B", "C", "D", "E"] as const;
type CropEditor = { questionIndex: number; source: string; x: number; y: number; width: number; height: number };
type CropHandle = "nw" | "ne" | "sw" | "se";
type CropDrag = { mode: "create" | "move" | "resize"; handle?: CropHandle; pointerId: number; startX: number; startY: number; startCrop: CropEditor };
const cropHandleClasses: Record<CropHandle, string> = {
  nw: "-left-2 -top-2 cursor-nwse-resize",
  ne: "-right-2 -top-2 cursor-nesw-resize",
  sw: "-bottom-2 -left-2 cursor-nesw-resize",
  se: "-bottom-2 -right-2 cursor-nwse-resize",
};

function cleanLine(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Không thể đọc ảnh."));
    reader.readAsDataURL(file);
  });
}

async function imageBytes(source: string): Promise<Uint8Array> {
  if (!source.startsWith("data:")) {
    const response = await fetch(source);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
  const encoded = source.split(",")[1] || "";
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function imageType(dataUrl: string): "png" | "jpg" | "gif" | "bmp" {
  if (dataUrl.startsWith("data:image/jpeg") || /\.jpe?g(?:\?|$)/i.test(dataUrl)) return "jpg";
  if (dataUrl.startsWith("data:image/gif")) return "gif";
  if (dataUrl.startsWith("data:image/bmp")) return "bmp";
  return "png";
}

function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(520 / image.naturalWidth, 360 / image.naturalHeight, 1);
      resolve({ width: Math.round(image.naturalWidth * scale), height: Math.round(image.naturalHeight * scale) });
    };
    image.onerror = () => resolve({ width: 480, height: 320 });
    image.src = dataUrl;
  });
}

function normalizeCrop(editor: CropEditor): CropEditor {
  const width = Math.max(1, Math.min(100, editor.width));
  const height = Math.max(1, Math.min(100, editor.height));
  return {
    ...editor,
    x: Math.max(0, Math.min(100 - width, editor.x)),
    y: Math.max(0, Math.min(100 - height, editor.y)),
    width,
    height,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "bo-mcq";
}

function jsonText(value: unknown) {
  if (typeof value === "string") return cleanLine(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function isJsonFile(file: File | undefined) {
  return Boolean(file && (file.type === "application/json" || file.name.toLowerCase().endsWith(".json")));
}

function isDocxFile(file: File | undefined) {
  return Boolean(file && (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith(".docx")));
}

function normalizeMcqJson(payload: unknown): { title: string; description: string; questions: McqLibraryQuestion[] } {
  const root = Array.isArray(payload) ? {} : (payload && typeof payload === "object" ? payload as Record<string, unknown> : {});
  const rawQuestions = Array.isArray(payload) ? payload : root.questions;
  if (!Array.isArray(rawQuestions) || !rawQuestions.length) {
    throw new Error("JSON không có danh sách questions hoặc danh sách đang rỗng.");
  }

  const questions = rawQuestions.map((rawQuestion, questionIndex) => {
    if (!rawQuestion || typeof rawQuestion !== "object") {
      throw new Error(`Câu ${questionIndex + 1} trong JSON không hợp lệ.`);
    }
    const source = rawQuestion as Record<string, unknown>;
    const question = jsonText(source.question ?? source.prompt ?? source.stem ?? source.text);
    const rawOptions = source.options ?? source.choices;
    const optionEntries = Array.isArray(rawOptions)
      ? rawOptions.map((option, optionIndex) => {
        if (typeof option === "string") return { id: optionIds[optionIndex], text: option };
        const item = option && typeof option === "object" ? option as Record<string, unknown> : {};
        return { id: jsonText(item.id ?? item.label).toUpperCase(), text: jsonText(item.text ?? item.content ?? item.value) };
      })
      : rawOptions && typeof rawOptions === "object"
        ? Object.entries(rawOptions as Record<string, unknown>).map(([id, text]) => ({ id: id.toUpperCase(), text: jsonText(text) }))
        : [];
    const options = optionIds
      .map((id) => optionEntries.find((option) => option.id === id && option.text))
      .filter((option): option is { id: typeof optionIds[number]; text: string } => Boolean(option))
      .map((option) => ({ id: option.id, text: option.text }));
    if (!question) throw new Error(`Câu ${questionIndex + 1} chưa có nội dung question.`);
    if (options.length < requiredOptionIds.length) throw new Error(`Câu ${questionIndex + 1} phải có đủ lựa chọn A, B, C và D.`);
    const correctAnswer = jsonText(source.correct_answer ?? source.correctAnswer ?? source.answer ?? source.correct_option).toUpperCase();
    if (correctAnswer && !options.some((option) => option.id === correctAnswer)) {
      throw new Error(`Câu ${questionIndex + 1} có correct_answer không trùng với các lựa chọn.`);
    }
    const sourceNumber = Number(source.source_number ?? source.sourceNumber ?? questionIndex + 1);
    return {
      id: crypto.randomUUID(),
      source_number: Number.isFinite(sourceNumber) && sourceNumber > 0 ? sourceNumber : questionIndex + 1,
      question,
      options,
      correct_answer: correctAnswer,
      explanation: jsonText(source.explanation ?? source.explain ?? source.solution),
      image_url: jsonText(source.image_url ?? source.imageUrl ?? source.image_data ?? source.image) || undefined,
      image_alt: jsonText(source.image_alt ?? source.imageAlt ?? source.image_caption),
      review_note: jsonText(source.review_note ?? source.reviewNote),
      source_page: Number(source.source_page ?? source.sourcePage) > 0 ? Number(source.source_page ?? source.sourcePage) : undefined,
      image_page: Number(source.image_page ?? source.imagePage) > 0 ? Number(source.image_page ?? source.imagePage) : undefined,
      shared_context: jsonText(source.shared_context ?? source.sharedContext ?? source.case_context),
    };
  });

  return {
    title: jsonText(root.title) || "Bộ trắc nghiệm mới",
    description: jsonText(root.description),
    questions,
  };
}

function exportJson(title: string, description: string, questions: McqLibraryQuestion[]) {
  const payload = {
    format: "mcq-v1",
    version: 1,
    title: title.trim(),
    description: description.trim(),
    questions: questions.map(({ id: _id, ...question }) => question),
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }), `${safeFilename(title)}.mcq.json`);
}

async function exportWord(title: string, questions: McqLibraryQuestion[]) {
  const { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } = await import("docx");
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 },
      children: [new TextRun({ text: title, bold: true, color: "2E74B5", size: 32, font: "Calibri" })],
    }),
  ];
  for (const [index, question] of questions.entries()) {
    const previousContext = questions[index - 1]?.shared_context?.trim();
    const sharedContext = question.shared_context?.trim();
    if (sharedContext && sharedContext !== previousContext) {
      children.push(new Paragraph({
        spacing: { before: index === 0 ? 0 : 160, after: 100, line: 300 },
        children: [new TextRun({ text: `Tình huống chung: ${sharedContext}`, bold: true, size: 21, font: "Calibri", color: "4B5563" })],
      }));
    }
    children.push(new Paragraph({
      spacing: { before: index === 0 ? 0 : 180, after: 100, line: 300 },
      children: [new TextRun({ text: `Câu ${question.source_number || index + 1}. ${cleanLine(question.question)}`, bold: true, size: 22, font: "Calibri" })],
    }));
    for (const option of question.options) {
      children.push(new Paragraph({
        spacing: { after: 80, line: 300 },
        indent: { left: 360, hanging: 0 },
        children: [new TextRun({ text: `${option.id}. ${cleanLine(option.text)}`, size: 22, font: "Calibri" })],
      }));
    }
    if (question.image_url) {
      const dimensions = await imageDimensions(question.image_url);
      children.push(new Paragraph({
        spacing: { before: 80, after: 140 },
        children: [new ImageRun({
          data: await imageBytes(question.image_url),
          type: imageType(question.image_url),
          transformation: dimensions,
          altText: { title: question.image_alt || "Hình X-quang", description: question.image_alt || "Hình X-quang", name: `xray-${index + 1}` },
        })],
      }));
    }
  }
  const document = new Document({
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { after: 120, line: 300 } } } },
    },
    sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
  });
  downloadBlob(await Packer.toBlob(document), `${safeFilename(title)}.docx`);
}

export default function McqAdminStudio({ userId, drafts, onChanged, onAiCallsRemaining, requestedBank, showDrafts = true }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [bankId, setBankId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<McqLibraryQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [visibility, setVisibility] = useState<"draft" | "published">("draft");
  const [, setReviewed] = useState(false);
  const [cropEditor, setCropEditor] = useState<CropEditor | null>(null);
  const [recentBanks, setRecentBanks] = useState<McqLibraryBank[]>([]);
  const cropStageRef = useRef<HTMLDivElement | null>(null);
  const cropDragRef = useRef<CropDrag | null>(null);

  useEffect(() => {
    if (!requestedBank) return;
    setBankId(requestedBank.id);
    setTitle(requestedBank.title);
    setDescription(requestedBank.description);
    setQuestions(requestedBank.questions);
    setVisibility(requestedBank.status === "published" ? "published" : "draft");
    setError("");
    setNotice("Đang chỉnh sửa bộ trắc nghiệm đã chọn. Chỉ tài khoản của bạn có quyền lưu thay đổi.");
  }, [requestedBank]);

  const invalidCount = useMemo(() => questions.filter((question) => !cleanLine(question.question) || question.options.length < 4 || question.options.length > 5 || question.options.some((option) => !cleanLine(option.text))).length, [questions]);

  async function extract(sourceFiles = files) {
    if (!sourceFiles.length) return;
    setBusy(true); setError(""); setNotice("Đang xử lý ở chế độ nền. Bạn có thể chuyển tab, kết quả sẽ được giữ lại.");
    try {
      if (sourceFiles.length === 1 && isJsonFile(sourceFiles[0])) {
        const payload = JSON.parse(await sourceFiles[0].text()) as unknown;
        const normalized = normalizeMcqJson(payload);
        setBankId(undefined);
        setVisibility("draft");
        setTitle(normalized.title);
        setDescription(normalized.description);
        setQuestions(normalized.questions);
        setNotice("Đã nạp JSON chuẩn trắc nghiệm trực tiếp, không gọi Gemini. Hãy kiểm tra trước khi lưu hoặc xuất Word.");
        return;
      }
      const result = await extractMcqFiles(sourceFiles);
      const imageFiles = new Map(sourceFiles.filter((file) => file.type.startsWith("image/")).map((file) => [file.name, file]));
      const imageUrls = new Map<string, string>();
      for (const [name, file] of imageFiles) imageUrls.set(name, await fileToDataUrl(file));
      setBankId(undefined);
      setVisibility("draft");
      setTitle(cleanLine(result.data.title) || "Bộ trắc nghiệm mới");
      setQuestions(result.data.questions.map((question, index) => ({
        id: crypto.randomUUID(),
        source_number: question.source_number || index + 1,
        question: cleanLine(question.question),
        options: requiredOptionIds.map((id) => ({ id, text: cleanLine(question.options.find((option) => option.id === id)?.text || "") })),
        correct_answer: question.correct_answer || "",
        explanation: cleanLine(question.explanation),
        image_url: question.image_url || (question.image_source_name ? imageUrls.get(question.image_source_name) : undefined),
        image_alt: cleanLine(question.image_alt),
        review_note: cleanLine(question.review_note),
        source_page: question.source_page,
        image_page: question.image_page,
        shared_context: cleanLine(question.shared_context || ""),
      })));
      if (typeof result.aiCallsRemaining === "number") onAiCallsRemaining?.(result.aiCallsRemaining);
      setNotice("Gemini đã trích xong. Hãy kiểm tra và sửa trước khi xuất Word hoặc đăng.");
    } catch (extractError) {
      setError(extractError instanceof Error ? extractError.message : "Không thể đọc file.");
    } finally { setBusy(false); }
  }

  function editQuestion(index: number, patch: Partial<McqLibraryQuestion>) {
    setQuestions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function editOption(questionIndex: number, optionIndex: number, text: string) {
    setQuestions((items) => items.map((item, itemIndex) => itemIndex === questionIndex ? {
      ...item,
      options: item.options.map((option, currentOptionIndex) => currentOptionIndex === optionIndex ? { ...option, text } : option),
    } : item));
    setReviewed(false);
  }

  async function attachQuestionImage(questionIndex: number, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Ảnh câu hỏi phải là PNG, JPEG hoặc WebP."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Ảnh câu hỏi không được vượt quá 10 MB."); return; }
    try {
      editQuestion(questionIndex, { image_url: await fileToDataUrl(file), image_alt: file.name });
      setError("");
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "Không thể đọc ảnh câu hỏi.");
    }
  }

  async function attachQuestionImageFromClipboard(questionIndex: number) {
    if (!navigator.clipboard?.read) {
      setError("Trình duyệt này chưa hỗ trợ dán ảnh. Hãy lưu ảnh rồi chọn từ máy.");
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      const imageItem = clipboardItems.find((item) => item.types.some((type) => type.startsWith("image/")));
      const imageType = imageItem?.types.find((type) => type.startsWith("image/"));
      if (!imageItem || !imageType) {
        setError("Clipboard chưa có hình ảnh. Hãy sao chép ảnh trước rồi thử lại.");
        return;
      }
      const image = await imageItem.getType(imageType);
      const extension = imageType.split("/")[1]?.replace("jpeg", "jpg") || "png";
      await attachQuestionImage(questionIndex, new File([image], `anh-da-dan.${extension}`, { type: imageType }));
    } catch (clipboardError) {
      setError(clipboardError instanceof Error ? `Không thể dán ảnh: ${clipboardError.message}` : "Không thể dán ảnh từ clipboard.");
    }
  }

  function openCropEditor(questionIndex: number, source: string | undefined) {
    if (!source) return;
    setCropEditor({ questionIndex, source, x: 0, y: 0, width: 100, height: 100 });
    setError("");
  }

  function cropPoint(event: PointerEvent<HTMLDivElement>) {
    const stage = cropStageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  }

  function handleCropPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!cropEditor || event.button !== 0) return;
    const point = cropPoint(event);
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-crop-handle]")?.dataset.cropHandle as CropHandle | undefined;
    const fullCrop = cropEditor.x === 0 && cropEditor.y === 0 && cropEditor.width === 100 && cropEditor.height === 100;
    const inside = point.x >= cropEditor.x && point.x <= cropEditor.x + cropEditor.width && point.y >= cropEditor.y && point.y <= cropEditor.y + cropEditor.height;
    cropDragRef.current = {
      mode: handle ? "resize" : (!fullCrop && inside ? "move" : "create"),
      handle,
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      startCrop: cropEditor,
    };
    cropStageRef.current?.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handleCropPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = cropDragRef.current;
    if (!drag || !cropEditor || drag.pointerId !== event.pointerId) return;
    const point = cropPoint(event);
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    const base = drag.startCrop;
    let next = base;

    if (drag.mode === "create") {
      next = { ...base, x: Math.min(drag.startX, point.x), y: Math.min(drag.startY, point.y), width: Math.abs(dx), height: Math.abs(dy) };
    } else if (drag.mode === "move") {
      next = { ...base, x: base.x + dx, y: base.y + dy };
    } else if (drag.handle) {
      let left = base.x;
      let top = base.y;
      let right = base.x + base.width;
      let bottom = base.y + base.height;
      if (drag.handle.includes("w")) left = Math.min(Math.max(0, point.x), right - 1);
      if (drag.handle.includes("e")) right = Math.max(Math.min(100, point.x), left + 1);
      if (drag.handle.includes("n")) top = Math.min(Math.max(0, point.y), bottom - 1);
      if (drag.handle.includes("s")) bottom = Math.max(Math.min(100, point.y), top + 1);
      next = { ...base, x: left, y: top, width: right - left, height: bottom - top };
    }
    setCropEditor(normalizeCrop(next));
  }

  function handleCropPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (cropDragRef.current?.pointerId === event.pointerId) {
      cropStageRef.current?.releasePointerCapture(event.pointerId);
      cropDragRef.current = null;
    }
  }

  async function applyImageCrop() {
    if (!cropEditor) return;
    const editor = cropEditor;
    setBusy(true);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.crossOrigin = "anonymous";
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Không thể đọc ảnh để cắt."));
        element.src = editor.source;
      });
      const sourceX = image.naturalWidth * editor.x / 100;
      const sourceY = image.naturalHeight * editor.y / 100;
      const sourceWidth = image.naturalWidth * editor.width / 100;
      const sourceHeight = image.naturalHeight * editor.height / 100;
      const scale = Math.min(1, 1800 / sourceWidth, 1800 / sourceHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      editQuestion(editor.questionIndex, { image_url: canvas.toDataURL("image/png") });
      setCropEditor(null);
      setError("");
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "Không thể cắt ảnh.");
    } finally {
      setBusy(false);
    }
  }

  async function persist(status: "draft" | "published") {
    const saveStatus = status === "published" && invalidCount > 0 ? "draft" : status;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await saveMcqBank(userId, { title, description, questions, status: saveStatus }, bankId);
      setBankId(saved.id);
      setQuestions(saved.questions);
      setVisibility(saved.status === "published" ? "published" : "draft");
      setRecentBanks((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setNotice(saveStatus === "published"
        ? "Đã đăng công khai vào thư viện trắc nghiệm."
        : status === "published"
          ? "Đã lưu bản nháp riêng tư. Hãy kiểm tra lại rồi đăng công khai khi sẵn sàng."
          : "Đã lưu bản nháp riêng tư.");
      await onChanged();
    } catch (saveError) {
      setError(mcqLibraryErrorMessage(saveError, "Không thể lưu bộ trắc nghiệm."));
    } finally { setBusy(false); }
  }

  function handleSaveShortcut(event: KeyboardEvent<HTMLElement>) {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
    event.preventDefault();
    if (!busy) void persist(visibility);
  }

  function loadDraft(bank: McqLibraryBank) {
    setBankId(bank.id); setTitle(bank.title); setDescription(bank.description); setQuestions(bank.questions); setVisibility(bank.status === "published" ? "published" : "draft"); setError(""); setNotice("");
  }

  const visibleDrafts = [...recentBanks, ...drafts.filter((draft) => !recentBanks.some((recent) => recent.id === draft.id))];
  const publishBlocked = visibility === "published" && invalidCount > 0;

  return <section onKeyDown={handleSaveShortcut} className="mb-8 overflow-visible rounded-[2rem] border border-violet-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:p-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><FileSearch size={23} /></span><div><p className="text-xs font-extrabold uppercase tracking-[.15em] text-rose-500">Xưởng trắc nghiệm riêng</p><h2 className="mt-1 text-2xl font-black text-rose-950">Tạo ngân hàng câu hỏi từ tài liệu</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Tải PDF hoặc ảnh, duyệt lại nội dung rồi xuất Word và/hoặc đăng thành bộ trắc nghiệm trên web.</p></div></div>
      <span className="w-fit rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">Chỉ bạn được đổi tên và sửa nội dung</span>
    </div>

    <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 shadow-sm">
      <div className="grid lg:grid-cols-2">
        <div className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Upload size={18} /></span><div><p className="text-sm font-extrabold text-slate-800">PDF, ảnh hoặc JSON</p><p className="text-xs font-medium text-slate-500">Trích câu hỏi bằng Gemini</p></div></div>
          <FileDropZone id="mcq-source-files" multiple accept="application/pdf,image/png,image/jpeg,application/json,.json" onFiles={setFiles} className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 px-5 text-center transition hover:bg-violet-50">
            <span><strong className="block text-sm text-slate-800">Chọn file nguồn</strong><small className="mt-1 block text-xs text-slate-500">PDF, ảnh hoặc JSON chuẩn trắc nghiệm</small></span>
          </FileDropZone>
          <button type="button" disabled={!files.length || busy} onClick={() => void extract()} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 font-bold text-white disabled:opacity-40">{busy ? <LoaderCircle className="animate-spin" /> : isJsonFile(files[0]) ? <FileText /> : <FileSearch />}{isJsonFile(files[0]) ? "Nạp JSON chuẩn" : "Trích bằng Gemini"}</button>
        </div>
        <div className="border-t border-slate-200/80 p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="mb-3 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><FileText size={18} /></span><div><p className="text-sm font-extrabold text-slate-800">File Word câu hỏi</p><p className="text-xs font-medium text-slate-500">Tách câu hỏi và đáp án bằng Gemini</p></div></div>
          <FileDropZone id="mcq-word-source-file" accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" onFiles={(selected) => { const selectedFile = selected[0]; if (!isDocxFile(selectedFile)) { setWordFile(null); setError("Ô Đọc Word chỉ nhận file .docx. File PDF hãy đưa vào ngăn PDF phía bên trái."); return; } setError(""); setWordFile(selectedFile); }} className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/45 px-5 text-center transition hover:bg-emerald-50">
            <span><strong className="block text-sm text-slate-800">Chọn file .docx</strong><small className="mt-1 block text-xs text-slate-500">Word có thể chứa câu hỏi, đáp án và hình minh họa</small>{wordFile && <small className="mt-2 block truncate text-xs font-semibold text-emerald-700">{wordFile.name}</small>}</span>
          </FileDropZone>
          <button type="button" disabled={!wordFile || busy} onClick={() => wordFile && void extract([wordFile])} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-40">{busy ? <LoaderCircle className="animate-spin" /> : <FileSearch />}Đọc Word bằng Gemini</button>
        </div>
      </div>
    </div>
    {files.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{files.map((file) => <span key={`${file.name}-${file.size}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{file.type.startsWith("image/") && <ImageIcon size={13} />}{file.name}</span>)}</div>}
    {error && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
    {notice && <p className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700">{notice}</p>}

    {showDrafts && visibleDrafts.some((draft) => draft.status !== "archived") && <div className="mt-6"><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Bộ trắc nghiệm của bạn</p><div className="mt-2 flex flex-wrap gap-2">{visibleDrafts.filter((draft) => draft.status !== "archived").map((draft) => <span key={draft.id} className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white"><button type="button" onClick={() => loadDraft(draft)} className="px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{draft.title} · {draft.status === "draft" ? "Riêng tư" : "Công khai"}</button><button type="button" aria-label={`Xóa bộ ${draft.title}`} title="Xóa cả bộ trắc nghiệm" onClick={async () => { if (!confirm(`Xóa toàn bộ “${draft.title}”? Hành động này không thể hoàn tác.`)) return; await deleteMcqBank(draft.id); setRecentBanks((items) => items.filter((item) => item.id !== draft.id)); if (bankId === draft.id) { setBankId(undefined); setQuestions([]); setTitle(""); } await onChanged(); }} className="border-l border-slate-200 p-2 text-rose-500 hover:bg-rose-50"><Trash2 size={15} /></button></span>)}</div></div>}

    {questions.length > 0 && <div className="mt-7 border-t border-violet-100 pt-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-bold text-slate-700">Tên bộ trắc nghiệm<input value={title} onChange={(event) => { setTitle(event.target.value); setReviewed(false); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-violet-400" /></label><label className="text-sm font-bold text-slate-700">Mô tả ngắn<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Chủ đề, nguồn hoặc phạm vi câu hỏi" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-violet-400" /></label><label className="text-sm font-bold text-slate-700">Quyền xem<select value={visibility} onChange={(event) => setVisibility(event.target.value as "draft" | "published")} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-violet-400"><option value="draft">Riêng tư</option><option value="published">Công khai</option></select></label></div>
      <div className="mt-5 space-y-4">{questions.map((question, questionIndex) => <article key={question.id} className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3"><label className="text-xs font-black uppercase tracking-wider text-violet-600">Câu nguồn<input type="number" min={1} value={question.source_number} onChange={(event) => editQuestion(questionIndex, { source_number: Number(event.target.value) })} className="ml-2 w-20 rounded-lg border border-slate-200 px-2 py-1 text-slate-700" /></label><div className="flex shrink-0 items-center gap-1"><FileDropZone id={`mcq-image-${question.id}`} accept="image/png,image/jpeg,image/webp" onFiles={(files) => { void attachQuestionImage(questionIndex, files[0]); }} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-violet-600 hover:bg-violet-50" ariaLabel={question.image_url ? "Đổi hình câu hỏi" : "Thêm hình câu hỏi"} title={question.image_url ? "Đổi hình câu hỏi" : "Thêm hình câu hỏi"}><ImagePlus size={17} /></FileDropZone><button type="button" title="Dán hình từ clipboard" aria-label="Dán hình từ clipboard" onClick={() => void attachQuestionImageFromClipboard(questionIndex)} className="flex h-8 w-8 items-center justify-center rounded-lg text-violet-600 hover:bg-violet-50"><ClipboardPaste size={16} /></button>{question.image_url && <button type="button" title="Bỏ hình câu hỏi" aria-label="Bỏ hình câu hỏi" onClick={() => editQuestion(questionIndex, { image_url: undefined, image_alt: "" })} className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"><X size={17} /></button>}<button type="button" aria-label={`Xóa câu ${questionIndex + 1}`} title={`Xóa câu ${questionIndex + 1}`} onClick={() => { if (!confirm(`Xóa câu ${questionIndex + 1}?`)) return; setQuestions((items) => items.filter((_, index) => index !== questionIndex)); setReviewed(false); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 size={16} /></button></div></div>
        {question.shared_context !== undefined ? <label className="mt-3 block text-xs font-black uppercase tracking-wider text-amber-700">Tình huống chung cho nhóm câu<textarea value={question.shared_context} onChange={(event) => editQuestion(questionIndex, { shared_context: event.target.value })} rows={4} placeholder="Dữ kiện/bệnh cảnh dùng chung cho các câu phía dưới" className="mt-1.5 w-full resize-y rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2.5 text-sm font-normal normal-case tracking-normal leading-6 text-slate-700 outline-none focus:border-amber-400" /></label> : <button type="button" onClick={() => editQuestion(questionIndex, { shared_context: "" })} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50"><Plus size={14} />Thêm tình huống chung</button>}
        <textarea value={question.question} onChange={(event) => editQuestion(questionIndex, { question: event.target.value })} rows={2} className="mt-3 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 font-bold leading-6 outline-none focus:border-violet-400" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => {
          const isCorrect = question.correct_answer === option.id;
          return <div key={option.id} className={`flex items-center gap-2 rounded-xl border p-2 ${isCorrect ? "border-teal-300 bg-teal-50/70" : "border-slate-200 bg-slate-50/60"}`}><button type="button" title={`Chọn ${option.id} là đáp án đúng`} aria-label={`Chọn ${option.id} là đáp án đúng`} onClick={() => editQuestion(questionIndex, { correct_answer: option.id })} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black transition ${isCorrect ? "bg-teal-500 text-white" : "bg-violet-100 text-violet-700 hover:bg-violet-200"}`}>{option.id}</button><textarea value={option.text} onChange={(event) => editOption(questionIndex, optionIndex, event.target.value)} rows={2} className="min-w-0 flex-1 resize-y bg-transparent text-sm leading-5 outline-none" />{isCorrect && <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-teal-700">Đúng</span>}</div>;
        })}</div>
        {question.options.length < optionIds.length && <button type="button" title="Thêm lựa chọn" aria-label="Thêm lựa chọn" onClick={() => { const nextId = optionIds[question.options.length]; if (!nextId) return; editQuestion(questionIndex, { options: [...question.options, { id: nextId, text: "" }] }); }} className="mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-violet-200 bg-white text-violet-700 hover:bg-violet-50"><Plus size={16} /></button>}
        <div className="mt-3">
          <label className="text-sm font-bold normal-case tracking-normal text-slate-900">Giải thích / ghi chú sau khi hiện đáp án<RichTextEditor value={question.explanation || ""} onChange={(value) => editQuestion(questionIndex, { explanation: value })} placeholder="Giữ nguyên lời giải, ghi chú, căn cứ hoặc ngoại lệ trong tài liệu nguồn." /></label>
        </div>
        {question.image_url && <figure className="mt-3"><img src={question.image_url} alt={question.image_alt || "Hình kèm câu hỏi"} className="max-h-72 rounded-2xl border border-slate-200 object-contain" /><div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={() => openCropEditor(questionIndex, question.image_url)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50"><Crop size={15} />Cắt hình</button><input value={question.image_alt || ""} onChange={(event) => editQuestion(questionIndex, { image_alt: event.target.value })} placeholder="Chú thích trung tính cho ảnh" className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div></figure>}
        {question.review_note && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Cần kiểm tra: {question.review_note}</p>}
      </article>)}</div>
      <button type="button" onClick={() => { setQuestions((items) => [...items, { id: crypto.randomUUID(), source_number: items.length + 1, question: "", options: requiredOptionIds.map((id) => ({ id, text: "" })) }]); setReviewed(false); }} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-bold text-violet-700"><Plus size={17} />Thêm câu thủ công</button>
      <p className="mt-4 text-right text-xs font-semibold text-slate-500">Bản Word gồm toàn bộ câu hỏi trong một file, chỉ tải về máy của bạn và không xuất hiện trong thư viện trắc nghiệm.</p>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" disabled={busy || !title.trim() || invalidCount > 0} onClick={() => void exportWord(title, questions)} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold text-violet-700 disabled:opacity-40"><Download size={17} />Xuất toàn bộ thành 1 file Word</button>
        <button type="button" disabled={busy || !title.trim() || !questions.length} onClick={() => exportJson(title, description, questions)} className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-bold text-sky-700 disabled:opacity-40"><FileText size={17} />Xuất JSON chuẩn</button>
        <span className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${visibility === "published" ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{visibility === "published" ? <Globe2 size={17} /> : <LockKeyhole size={17} />}{visibility === "published" ? "Mọi người sẽ thấy" : "Chỉ mình bạn thấy"}</span>
        <button type="button" disabled={busy} onClick={() => void persist(visibility)} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-40"><Save size={17} />{bankId ? (publishBlocked ? "Lưu bản nháp" : "Lưu thay đổi") : "Lưu bộ trắc nghiệm"}</button>
      </div>
    </div>}
    {cropEditor && <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Cắt hình câu hỏi"><div className="flex min-h-full items-center justify-center"><div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-violet-600">Chỉnh hình câu hỏi</p><h3 className="mt-1 text-lg font-black text-slate-900">Cắt phần cần giữ lại</h3></div><button type="button" title="Đóng" aria-label="Đóng trình cắt hình" onClick={() => setCropEditor(null)} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X size={19} /></button></div><div className="mt-5 flex justify-center"><div ref={cropStageRef} onPointerDown={handleCropPointerDown} onPointerMove={handleCropPointerMove} onPointerUp={handleCropPointerUp} onPointerCancel={handleCropPointerUp} className="relative inline-block max-w-full touch-none select-none overflow-hidden rounded-2xl bg-slate-100 shadow-inner"><img src={cropEditor.source} alt="Xem trước hình cần cắt" draggable={false} className="block max-h-[68vh] max-w-[min(90vw,900px)] object-contain" /><div className="absolute border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.5)]" style={{ left: `${cropEditor.x}%`, top: `${cropEditor.y}%`, width: `${cropEditor.width}%`, height: `${cropEditor.height}%` }}><span data-crop-handle="nw" className={`pointer-events-auto absolute h-4 w-4 rounded-sm border-2 border-white bg-violet-600 shadow ${cropHandleClasses.nw}`} /><span data-crop-handle="ne" className={`pointer-events-auto absolute h-4 w-4 rounded-sm border-2 border-white bg-violet-600 shadow ${cropHandleClasses.ne}`} /><span data-crop-handle="sw" className={`pointer-events-auto absolute h-4 w-4 rounded-sm border-2 border-white bg-violet-600 shadow ${cropHandleClasses.sw}`} /><span data-crop-handle="se" className={`pointer-events-auto absolute h-4 w-4 rounded-sm border-2 border-white bg-violet-600 shadow ${cropHandleClasses.se}`} /></div></div></div><p className="mt-3 text-center text-xs font-semibold text-slate-500">Kéo trực tiếp trên ảnh để tạo hoặc di chuyển vùng cắt. Kéo các góc để chỉnh kích thước.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCropEditor(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Hủy</button><button type="button" disabled={busy} onClick={() => void applyImageCrop()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Check size={17} />Áp dụng</button></div></div></div></div>}
  </section>;
}
