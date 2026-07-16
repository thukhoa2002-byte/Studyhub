import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSearch, Globe2, Image as ImageIcon, LoaderCircle, LockKeyhole, Plus, Save, Trash2, Upload } from "lucide-react";
import { extractMcqFiles } from "../services/api";
import { deleteMcqBank, mcqLibraryErrorMessage, saveMcqBank, type McqLibraryBank, type McqLibraryQuestion } from "../services/mcqLibrary";

type Props = {
  userId: string;
  drafts: McqLibraryBank[];
  onChanged: () => Promise<void> | void;
  onAiCallsRemaining?: (remaining: number) => void;
  requestedBank?: McqLibraryBank | null;
};

const optionIds = ["A", "B", "C", "D"] as const;

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

export default function McqAdminStudio({ userId, drafts, onChanged, onAiCallsRemaining, requestedBank }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [bankId, setBankId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<McqLibraryQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [visibility, setVisibility] = useState<"draft" | "published">("draft");

  useEffect(() => {
    if (!requestedBank) return;
    setBankId(requestedBank.id);
    setTitle(requestedBank.title);
    setDescription(requestedBank.description);
    setQuestions(requestedBank.questions);
    setVisibility(requestedBank.status === "published" ? "published" : "draft");
    setReviewed(false);
    setError("");
    setNotice("Đang chỉnh sửa bộ MCQ đã chọn. Chỉ tài khoản của bạn có quyền lưu thay đổi.");
  }, [requestedBank]);

  const invalidCount = useMemo(() => questions.filter((question) => !cleanLine(question.question) || question.options.length !== 4 || question.options.some((option) => !cleanLine(option.text))).length, [questions]);

  async function extract() {
    if (!files.length) return;
    setBusy(true); setError(""); setNotice(""); setReviewed(false);
    try {
      const result = await extractMcqFiles(files);
      const imageFiles = new Map(files.filter((file) => file.type.startsWith("image/")).map((file) => [file.name, file]));
      const imageUrls = new Map<string, string>();
      for (const [name, file] of imageFiles) imageUrls.set(name, await fileToDataUrl(file));
      setBankId(undefined);
      setVisibility("draft");
      setTitle(cleanLine(result.data.title) || "Bộ MCQ mới");
      setQuestions(result.data.questions.map((question, index) => ({
        id: crypto.randomUUID(),
        source_number: question.source_number || index + 1,
        question: cleanLine(question.question),
        options: optionIds.map((id) => ({ id, text: cleanLine(question.options.find((option) => option.id === id)?.text || "") })),
        image_url: question.image_source_name ? imageUrls.get(question.image_source_name) : undefined,
        image_alt: cleanLine(question.image_alt),
        review_note: cleanLine(question.review_note),
      })));
      if (typeof result.aiCallsRemaining === "number") onAiCallsRemaining?.(result.aiCallsRemaining);
      setNotice("Gemini đã trích xong. Hãy kiểm tra và sửa trước khi xuất Word hoặc đăng.");
    } catch (extractError) {
      setError(extractError instanceof Error ? extractError.message : "Không thể đọc file.");
    } finally { setBusy(false); }
  }

  function editQuestion(index: number, patch: Partial<McqLibraryQuestion>) {
    setQuestions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
    setReviewed(false);
  }

  function editOption(questionIndex: number, optionIndex: number, text: string) {
    setQuestions((items) => items.map((item, itemIndex) => itemIndex === questionIndex ? {
      ...item,
      options: item.options.map((option, currentOptionIndex) => currentOptionIndex === optionIndex ? { ...option, text } : option),
    } : item));
    setReviewed(false);
  }

  async function persist(status: "draft" | "published") {
    if (!title.trim() || !questions.length || invalidCount) {
      setError("Hãy điền đủ tên bộ, câu hỏi và bốn lựa chọn A/B/C/D.");
      return;
    }
    if (status === "published" && !reviewed) {
      setError("Bạn cần xác nhận đã kiểm tra toàn bộ trước khi đăng công khai.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await saveMcqBank(userId, { title, description, questions, status }, bankId);
      setBankId(saved.id);
      setQuestions(saved.questions);
      setNotice(status === "published" ? "Đã đăng công khai vào thư viện MCQ." : "Đã lưu bản nháp riêng tư.");
      await onChanged();
    } catch (saveError) {
      setError(mcqLibraryErrorMessage(saveError, "Không thể lưu bộ MCQ."));
    } finally { setBusy(false); }
  }

  function loadDraft(bank: McqLibraryBank) {
    setBankId(bank.id); setTitle(bank.title); setDescription(bank.description); setQuestions(bank.questions); setVisibility(bank.status === "published" ? "published" : "draft"); setReviewed(false); setError(""); setNotice("");
  }

  return <section className="mb-8 overflow-visible rounded-[2rem] border border-violet-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:p-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><FileSearch size={23} /></span><div><p className="text-xs font-extrabold uppercase tracking-[.15em] text-rose-500">Xưởng MCQ riêng</p><h2 className="mt-1 text-2xl font-black text-rose-950">Tạo ngân hàng câu hỏi từ tài liệu</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Tải PDF hoặc ảnh, duyệt lại nội dung rồi xuất Word và/hoặc đăng thành bộ MCQ trên web.</p></div></div>
      <span className="w-fit rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">Chỉ bạn được đổi tên và sửa nội dung</span>
    </div>

    <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
      <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 items-center justify-center rounded-3xl border border-dashed border-violet-300 bg-violet-50/50 px-5 text-center transition hover:bg-violet-50">
        <span><Upload className="mx-auto text-violet-600" /><strong className="mt-2 block text-slate-800">Chọn PDF hoặc ảnh câu hỏi</strong><small className="mt-1 block text-slate-500">Tối đa 20 file, mỗi file 100 MB và tổng 120 MB. PDF note/scan sẽ được đọc cả chữ nằm trong ảnh; ảnh X-quang nên tải thành file ảnh riêng.</small></span>
      </button>
      <button type="button" disabled={!files.length || busy} onClick={() => void extract()} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 font-bold text-white disabled:opacity-40 lg:min-h-full">{busy ? <LoaderCircle className="animate-spin" /> : <FileSearch />}Trích bằng Gemini</button>
      <input ref={inputRef} className="hidden" type="file" multiple accept="application/pdf,image/png,image/jpeg" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
    </div>
    {files.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{files.map((file) => <span key={`${file.name}-${file.size}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{file.type.startsWith("image/") && <ImageIcon size={13} />}{file.name}</span>)}</div>}
    {error && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
    {notice && <p className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700">{notice}</p>}

    {drafts.some((draft) => draft.status !== "archived") && <div className="mt-6"><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Bộ MCQ của bạn</p><div className="mt-2 flex flex-wrap gap-2">{drafts.filter((draft) => draft.status !== "archived").map((draft) => <span key={draft.id} className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white"><button type="button" onClick={() => loadDraft(draft)} className="px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{draft.title} · {draft.status === "draft" ? "Riêng tư" : "Công khai"}</button><button type="button" aria-label={`Xóa bộ ${draft.title}`} title="Xóa cả bộ MCQ" onClick={async () => { if (!confirm(`Xóa toàn bộ “${draft.title}”? Hành động này không thể hoàn tác.`)) return; await deleteMcqBank(draft.id); if (bankId === draft.id) { setBankId(undefined); setQuestions([]); setTitle(""); } await onChanged(); }} className="border-l border-slate-200 p-2 text-rose-500 hover:bg-rose-50"><Trash2 size={15} /></button></span>)}</div></div>}

    {questions.length > 0 && <div className="mt-7 border-t border-violet-100 pt-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-bold text-slate-700">Tên bộ MCQ<input value={title} onChange={(event) => { setTitle(event.target.value); setReviewed(false); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-violet-400" /></label><label className="text-sm font-bold text-slate-700">Mô tả ngắn<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Chủ đề, nguồn hoặc phạm vi câu hỏi" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-violet-400" /></label><label className="text-sm font-bold text-slate-700">Quyền xem<select value={visibility} onChange={(event) => setVisibility(event.target.value as "draft" | "published")} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-violet-400"><option value="draft">Riêng tư</option><option value="published">Công khai</option></select></label></div>
      <div className="mt-5 space-y-4">{questions.map((question, questionIndex) => <article key={question.id} className="relative rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
        <button type="button" aria-label={`Xóa câu ${questionIndex + 1}`} title={`Xóa câu ${questionIndex + 1}`} onClick={() => { if (!confirm(`Xóa câu ${questionIndex + 1}?`)) return; setQuestions((items) => items.filter((_, index) => index !== questionIndex)); setReviewed(false); }} className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50"><Trash2 size={15} /><span className="hidden sm:inline">Xóa câu</span></button>
        <div className="pr-10"><label className="text-xs font-black uppercase tracking-wider text-violet-600">Câu nguồn<input type="number" min={1} value={question.source_number} onChange={(event) => editQuestion(questionIndex, { source_number: Number(event.target.value) })} className="ml-2 w-20 rounded-lg border border-slate-200 px-2 py-1 text-slate-700" /></label><textarea value={question.question} onChange={(event) => editQuestion(questionIndex, { question: event.target.value })} rows={2} className="mt-3 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 font-bold leading-6 outline-none focus:border-violet-400" /></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => <label key={option.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-black text-violet-700">{option.id}</span><textarea value={option.text} onChange={(event) => editOption(questionIndex, optionIndex, event.target.value)} rows={2} className="min-w-0 flex-1 resize-y bg-transparent text-sm leading-5 outline-none" /></label>)}</div>
        {question.image_url && <figure className="mt-4"><img src={question.image_url} alt={question.image_alt || "Hình X-quang"} className="max-h-72 rounded-2xl border border-slate-200 object-contain" /><input value={question.image_alt || ""} onChange={(event) => editQuestion(questionIndex, { image_alt: event.target.value })} placeholder="Chú thích trung tính cho ảnh" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></figure>}
        {question.review_note && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Cần kiểm tra: {question.review_note}</p>}
      </article>)}</div>
      <button type="button" onClick={() => { setQuestions((items) => [...items, { id: crypto.randomUUID(), source_number: items.length + 1, question: "", options: optionIds.map((id) => ({ id, text: "" })) }]); setReviewed(false); }} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-bold text-violet-700"><Plus size={17} />Thêm câu thủ công</button>
      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50/70 p-4 text-sm font-semibold text-teal-900"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-600" /><span><strong className="block">Tôi đã kiểm tra toàn bộ {questions.length} câu</strong>Không còn đáp án, lời giải, câu thiếu A/B/C/D hoặc ảnh gán sai.</span></label>
      <p className="mt-4 text-right text-xs font-semibold text-slate-500">Bản Word gồm toàn bộ câu hỏi trong một file, chỉ tải về máy của bạn và không xuất hiện trong thư viện MCQ.</p>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" disabled={busy || !reviewed || !title.trim() || invalidCount > 0} onClick={() => void exportWord(title, questions)} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold text-violet-700 disabled:opacity-40"><Download size={17} />Xuất toàn bộ thành 1 file Word</button>
        <span className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${visibility === "published" ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{visibility === "published" ? <Globe2 size={17} /> : <LockKeyhole size={17} />}{visibility === "published" ? "Mọi người sẽ thấy" : "Chỉ mình bạn thấy"}</span>
        <button type="button" disabled={busy || (visibility === "published" && (!reviewed || invalidCount > 0))} onClick={() => void persist(visibility)} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-40"><Save size={17} />{bankId ? "Lưu thay đổi" : "Lưu bộ MCQ"}</button>
      </div>
    </div>}
  </section>;
}
