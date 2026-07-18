import { BookOpenCheck, Check, Download, FileDown, FileText, FilePenLine, FileUp, FolderPlus, Globe2, LibraryBig, Loader2, LockKeyhole, Pencil, Save, Trash2, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import GuidelinesPage from "./GuidelinesPage";
import { createReferenceBook, createReferenceBookFolder, deleteReferenceBook, extractReferenceBook, generateReferenceBookTextPdf, getReferenceBookUrl, listReferenceBooks, updateReferenceBookDetails, updateReferenceBookLayout, updateReferenceBookStatus, type ReferenceBook, type ReferenceBookBlock, type ReferenceBookDiagramCrop, type ReferenceBookExtraction, type ReferenceBookPage } from "../services/referenceBooks";

type ReferenceSection = "guidelines" | "books";
const REFERENCE_BOOK_OWNER_EMAIL = "thukhoa2002@gmail.com";

function defaultDiagramCrop(page: ReferenceBookPage): ReferenceBookDiagramCrop {
  const blocks = page.blocks.filter((block) => ["diagram_label", "diagram_caption"].includes(block.role));
  if (!blocks.length) return { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };
  const minX = Math.max(0, Math.min(...blocks.map((block) => block.x)) - 0.1);
  const minY = Math.max(0, Math.min(...blocks.map((block) => block.y)) - 0.1);
  const maxX = Math.min(1, Math.max(...blocks.map((block) => block.x + block.width)) + 0.1);
  const maxY = Math.min(1, Math.max(...blocks.map((block) => block.y + block.height)) + 0.1);
  return { x: minX, y: minY, width: Math.max(0.05, maxX - minX), height: Math.max(0.05, maxY - minY) };
}

export default function ReferenceLibraryPage({ user, onAiCallsRemaining }: { user: User | null; onAiCallsRemaining?: (remaining: number) => void }) {
  const [section, setSection] = useState<ReferenceSection>("guidelines");
  const [books, setBooks] = useState<ReferenceBook[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publicationYear, setPublicationYear] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [extraction, setExtraction] = useState<ReferenceBookExtraction | null>(null);
  const [ocrBookId, setOcrBookId] = useState<string | null>(null);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingAuthor, setEditingAuthor] = useState("");
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [contentBookId, setContentBookId] = useState<string | null>(null);
  const [contentLayout, setContentLayout] = useState<ReferenceBookExtraction | null>(null);
  const [contentBusy, setContentBusy] = useState(false);
  const isOwner = user?.email?.trim().toLowerCase() === REFERENCE_BOOK_OWNER_EMAIL;
  const visibleBooks = isOwner ? books : books.filter((book) => book.status === "shared");
  const folders = visibleBooks.filter((book) => book.item_type === "folder");

  const refreshBooks = useCallback(async () => {
    try {
      setBooks(await listReferenceBooks());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải kho sách.");
    }
  }, []);

  useEffect(() => { void refreshBooks(); }, [refreshBooks, user]);

  async function addBook(event: FormEvent) {
    event.preventDefault();
    if (!isOwner || !user || !file) return;
    setBusy(true);
    setError("");
    try {
      if (!extraction) {
        const layout = await extractReferenceBook(file);
        setExtraction(layout);
        setTitle((current) => current.trim() || layout.title);
        setAuthor((current) => current.trim() || layout.author);
        setPublicationYear((current) => current || (layout.publicationYear ? String(layout.publicationYear) : ""));
        return;
      }
      await createReferenceBook(user.id, title, author, Number(publicationYear) || null, file, undefined, parentId, extraction);
      setTitle("");
      setAuthor("");
      setPublicationYear("");
      setParentId(null);
      setFile(null);
      setExtraction(null);
      await refreshBooks();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể OCR/lưu sách.");
    } finally {
      setBusy(false);
    }
  }

  async function addFolder(event: FormEvent) {
    event.preventDefault();
    if (!isOwner || !user || !newFolderTitle.trim()) return;
    setBusy(true);
    setError("");
    try {
      const folder = await createReferenceBookFolder(user.id, newFolderTitle, newFolderParentId);
      setBooks((items) => [...items, folder]);
      setNewFolderTitle("");
      setNewFolderParentId(null);
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : "Không thể tạo thư mục.");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(book: ReferenceBook) {
    setEditingBookId(book.id);
    setEditingTitle(book.title);
    setEditingAuthor(book.author || "");
    setEditingParentId(book.parent_id || null);
  }

  async function saveEdit(book: ReferenceBook) {
    if (!isOwner || !editingTitle.trim()) return;
    try {
      const updated = await updateReferenceBookDetails(book.id, { title: editingTitle, author: book.item_type === "folder" ? "" : editingAuthor, parentId: editingParentId });
      setBooks((items) => items.map((item) => item.id === updated.id ? updated : item));
      setEditingBookId(null);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Không thể sửa mục sách.");
    }
  }

  async function toggleBookStatus(book: ReferenceBook) {
    if (!isOwner) return;
    setError("");
    try {
      const updated = await updateReferenceBookStatus(book.id, book.status === "shared" ? "private" : "shared");
      setBooks((items) => items.map((item) => item.id === updated.id ? updated : item));
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Không thể đổi trạng thái sách.");
    }
  }

  async function openBook(book: ReferenceBook) {
    setError("");
    try {
      const filePath = book.text_pdf_path || book.source_file_path;
      if (!filePath) throw new Error("Mục này là thư mục, không có file PDF để mở.");
      const url = await getReferenceBookUrl(filePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Không thể mở sách.");
    }
  }

  async function rebuildBook(book: ReferenceBook) {
    if (!isOwner) return;
    setOcrBookId(book.id);
    setError("");
    try {
      const updated = await generateReferenceBookTextPdf(book);
      setBooks((items) => items.map((item) => item.id === updated.id ? updated : item));
    } catch (ocrError) {
      setError(ocrError instanceof Error ? ocrError.message : "Không thể tạo PDF OCR.");
    } finally {
      setOcrBookId(null);
    }
  }

  async function beginContentEdit(book: ReferenceBook) {
    if (!isOwner || book.item_type === "folder") return;
    setContentBusy(true);
    setError("");
    try {
      let layout = book.ocr_layout;
      if (!layout) {
        if (!book.source_file_path) throw new Error("Sách chưa có PDF gốc để tạo nội dung sửa.");
        const sourceUrl = await getReferenceBookUrl(book.source_file_path);
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error("Không thể tải PDF gốc để tạo nội dung sửa.");
        layout = await extractReferenceBook(new File([await response.blob()], `${book.title || "reference-book"}.pdf`, { type: "application/pdf" }));
      }
      setContentBookId(book.id);
      setContentLayout(layout);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Không thể mở nội dung để sửa.");
    } finally {
      setContentBusy(false);
    }
  }

  function updateContentBlockText(pageIndex: number, blockIndex: number, text: string) {
    setContentLayout((current) => current ? { ...current, pages: current.pages.map((page, currentPageIndex) => currentPageIndex === pageIndex ? { ...page, blocks: page.blocks.map((block, currentBlockIndex) => currentBlockIndex === blockIndex ? { ...block, text } : block) } : page) } : current);
  }

  function removeContentBlock(pageIndex: number, blockIndex: number) {
    setContentLayout((current) => current ? { ...current, pages: current.pages.map((page, currentPageIndex) => currentPageIndex === pageIndex ? { ...page, blocks: page.blocks.filter((_block, currentBlockIndex) => currentBlockIndex !== blockIndex) } : page) } : current);
  }

  function updateDiagramCrop(pageIndex: number, field: keyof ReferenceBookDiagramCrop, value: number) {
    setContentLayout((current) => current ? { ...current, pages: current.pages.map((page, currentPageIndex) => {
      if (currentPageIndex !== pageIndex) return page;
      const crop = { ...(page.diagram_crop || defaultDiagramCrop(page)), [field]: Math.max(0, Math.min(1, value)) };
      return { ...page, diagram_crop: crop };
    }) } : current);
  }

  async function saveContentEdit() {
    if (!isOwner || !contentBookId || !contentLayout) return;
    const book = books.find((item) => item.id === contentBookId);
    if (!book) return;
    setContentBusy(true);
    setError("");
    try {
      const updated = await updateReferenceBookLayout(book.id, contentLayout);
      setBooks((items) => items.map((item) => item.id === updated.id ? updated : item));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu nội dung sửa.");
    } finally {
      setContentBusy(false);
    }
  }

  async function exportEditedPdf(book: ReferenceBook) {
    if (!isOwner || !contentLayout || contentBookId !== book.id) return;
    setContentBusy(true);
    setError("");
    try {
      const saved = await updateReferenceBookLayout(book.id, contentLayout);
      const generated = await generateReferenceBookTextPdf(saved, contentLayout);
      setBooks((items) => items.map((item) => item.id === generated.id ? generated : item));
      await openBook(generated);
    } catch (pdfError) {
      setError(pdfError instanceof Error ? pdfError.message : "Không thể xuất PDF.");
    } finally {
      setContentBusy(false);
    }
  }

  async function exportWord(book: ReferenceBook) {
    if (!isOwner || book.item_type === "folder") return;
    const layout = contentBookId === book.id ? contentLayout : book.ocr_layout;
    if (!layout) {
      setError("Hãy bấm Sửa nội dung và lưu layout trước khi xuất Word.");
      return;
    }
    setContentBusy(true);
    setError("");
    try {
      const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
      let firstHeading = true;
      const paragraphs = layout.pages.flatMap((page) => page.blocks.filter((block) => !["header", "footer", "page_number", "metadata", "diagram_label"].includes(block.role)).map((block) => {
        const text = block.text.replace(/\s+/g, " ").trim();
        if (!text) return null;
        const isHeading = block.role === "heading";
        const isTitle = isHeading && firstHeading;
        if (isTitle) firstHeading = false;
        return new Paragraph({
          alignment: isHeading ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
          heading: isHeading ? (isTitle ? HeadingLevel.TITLE : HeadingLevel.HEADING_2) : undefined,
          indent: !isHeading ? { firstLine: 360 } : undefined,
          spacing: { before: 0, after: 0, line: 360 },
          children: [new TextRun({ text, bold: isHeading || block.fontWeight === "bold", italics: block.italic, font: "Times New Roman", size: isTitle ? 34 : 24 })],
        });
      }).filter((paragraph): paragraph is InstanceType<typeof Paragraph> => Boolean(paragraph)));
      const document = new Document({ sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: paragraphs }] });
      const blob = await Packer.toBlob(document);
      const anchor = window.document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `${book.title.replace(/[^a-zA-Z0-9._-]+/g, "-")}.docx`;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
    } catch (wordError) {
      setError(wordError instanceof Error ? wordError.message : "Không thể xuất file Word.");
    } finally {
      setContentBusy(false);
    }
  }

  async function removeBook(book: ReferenceBook) {
    if (!isOwner) return;
    try {
      await deleteReferenceBook(book);
      setBooks((items) => items.filter((item) => item.id !== book.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa sách.");
    }
  }

  function updateBlockText(pageIndex: number, blockIndex: number, text: string) {
    setExtraction((current) => current ? { ...current, pages: current.pages.map((page, currentPageIndex) => currentPageIndex === pageIndex ? { ...page, blocks: page.blocks.map((block, currentBlockIndex) => currentBlockIndex === blockIndex ? { ...block, text } : block) } : page) } : current);
  }

  function removeBlock(pageIndex: number, blockIndex: number) {
    setExtraction((current) => current ? { ...current, pages: current.pages.map((page, currentPageIndex) => currentPageIndex === pageIndex ? { ...page, blocks: page.blocks.filter((_block, currentBlockIndex) => currentBlockIndex !== blockIndex) } : page) } : current);
  }

  function removeNonLearningBlocks() {
    setExtraction((current) => current ? { ...current, pages: current.pages.map((page) => ({ ...page, blocks: page.blocks.filter((block) => !["header", "footer", "page_number", "metadata"].includes(block.role)) })) } : current);
  }

  function roleLabel(role: ReferenceBookBlock["role"]) {
    const labels: Record<ReferenceBookBlock["role"], string> = { header: "Header", footer: "Footer", page_number: "Số trang", metadata: "Thông tin phụ", diagram_label: "Nhãn sơ đồ", diagram_caption: "Chú thích sơ đồ", heading: "Tiêu đề", table: "Bảng", caption: "Chú thích", text: "Nội dung" };
    return labels[role];
  }

  function renderDiagramCropEditor(page: ReferenceBookPage, pageIndex: number): ReactNode {
    if (!page.blocks.some((block) => ["diagram_label", "diagram_caption"].includes(block.role))) return null;
    const crop = page.diagram_crop || defaultDiagramCrop(page);
    const fields: Array<[keyof ReferenceBookDiagramCrop, string]> = [["x", "Trái"], ["y", "Trên"], ["width", "Rộng"], ["height", "Cao"]];
    return <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2"><div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-700">Vùng sơ đồ · chỉnh theo % trang</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{fields.map(([field, label]) => <label key={field} className="text-[10px] font-semibold text-slate-600">{label}<input type="number" min="0" max="100" step="1" value={Math.round(crop[field] * 100)} onChange={(event) => updateDiagramCrop(pageIndex, field, Number(event.target.value || 0) / 100)} className="mt-1 w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-slate-700" /></label>)}</div></div>;
  }

  const contentBook = contentBookId ? books.find((book) => book.id === contentBookId) || null : null;

  function renderTree(parent: string | null = null, depth = 0): ReactNode {
    return visibleBooks.filter((book) => (book.parent_id || null) === parent).map((book) => {
      const folder = book.item_type === "folder";
      const editing = editingBookId === book.id;
      return <div key={book.id} className="space-y-1" style={{ marginLeft: depth ? `${depth * 24}px` : undefined }}><div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"><div className="min-w-0 flex-1">{editing ? <div className="grid gap-2 sm:grid-cols-[1fr_1fr_180px]"><input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} className="rounded-lg border border-teal-200 px-2 py-1 text-sm" /><input value={editingAuthor} onChange={(event) => setEditingAuthor(event.target.value)} disabled={folder} placeholder="Tác giả" className="rounded-lg border border-teal-200 px-2 py-1 text-sm disabled:bg-slate-50" /><select value={editingParentId || ""} onChange={(event) => setEditingParentId(event.target.value || null)} className="rounded-lg border border-teal-200 px-2 py-1 text-sm"><option value="">Thư mục gốc</option>{folders.filter((item) => item.id !== book.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div> : <><p className="truncate font-bold text-slate-700">{folder ? "📁 " : "📖 "}{book.title}</p><p className="text-xs text-slate-400">{folder ? "Thư mục" : `${book.author || "Chưa ghi tác giả"}${book.publication_year ? ` · ${book.publication_year}` : ""}`}{book.status === "private" ? " · Riêng tư" : " · Đã đăng công khai"}{!folder && (book.text_pdf_path ? " · Có PDF chữ" : " · Chưa tạo PDF chữ")}</p></>}</div><div className="flex shrink-0 items-center gap-1">{isOwner && editing ? <><button type="button" title="Lưu sửa" onClick={() => void saveEdit(book)} className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"><Check size={17} /></button><button type="button" title="Hủy sửa" onClick={() => setEditingBookId(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-50"><X size={17} /></button></> : <>{isOwner && <button type="button" title="Sửa mục" onClick={() => beginEdit(book)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-50"><Pencil size={17} /></button>}{isOwner && !folder && <button type="button" title="Sửa nội dung" disabled={contentBusy} onClick={() => void beginContentEdit(book)} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"><FilePenLine size={17} /></button>}{isOwner && !folder && <button type="button" title="Xuất Word" disabled={contentBusy} onClick={() => void exportWord(book)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50"><Download size={17} /></button>}{isOwner && folder === false && !book.text_pdf_path && <button type="button" title="Tạo PDF chữ" disabled={ocrBookId === book.id} onClick={() => void rebuildBook(book)} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50 disabled:opacity-50">{ocrBookId === book.id ? <Loader2 className="animate-spin" size={17} /> : <FileText size={17} />}</button>}{!folder && <button type="button" title="Xuất hoặc mở PDF" onClick={() => book.text_pdf_path ? void openBook(book) : void rebuildBook(book)} className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"><FileDown size={17} /></button>}{isOwner && <><button type="button" title={book.status === "shared" ? "Gỡ công khai" : "Đăng công khai"} onClick={() => void toggleBookStatus(book)} className={`rounded-lg p-2 ${book.status === "shared" ? "text-amber-600 hover:bg-amber-50" : "text-blue-600 hover:bg-blue-50"}`}>{book.status === "shared" ? <LockKeyhole size={17} /> : <Globe2 size={17} />}</button><button type="button" title="Xóa mục" onClick={() => void removeBook(book)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 size={17} /></button></>}</>}</div></div>{renderTree(book.id, depth + 1)}</div>;
    });
  }

  return <>
    <div className="mx-auto flex w-full max-w-[1600px] px-4 pt-6 sm:px-6 xl:px-8">
      <div className="inline-flex rounded-lg border border-teal-100 bg-white/75 p-1 shadow-sm">
        <button type="button" onClick={() => setSection("guidelines")} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold ${section === "guidelines" ? "bg-teal-500 text-white" : "text-slate-600 hover:bg-teal-50"}`}><BookOpenCheck size={17} />Guideline</button>
        <button type="button" onClick={() => setSection("books")} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold ${section === "books" ? "bg-rose-500 text-white" : "text-slate-600 hover:bg-rose-50"}`}><LibraryBig size={17} />Sách</button>
      </div>
    </div>

    {section === "guidelines" ? <GuidelinesPage user={user} onAiCallsRemaining={onAiCallsRemaining} /> : <section className="mode-panel mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 xl:px-8">
      <div className="glass-panel border border-rose-100 bg-white/75 p-5">
        <div className="flex items-center gap-3"><LibraryBig className="text-rose-500" size={28} /><div><h1 className="text-xl font-extrabold text-rose-950">Sách tham khảo</h1><p className="text-sm text-slate-500">Sách đã đăng công khai mới hiển thị cho mọi tài khoản.</p></div></div>

        {isOwner && <form onSubmit={addFolder} className="mt-5 grid gap-3 rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-4 sm:grid-cols-[1fr_220px_auto]">
          <input value={newFolderTitle} onChange={(event) => setNewFolderTitle(event.target.value)} placeholder="Tên thư mục mới" className="rounded-xl border border-violet-100 bg-white px-3 py-2.5" />
          <select value={newFolderParentId || ""} onChange={(event) => setNewFolderParentId(event.target.value || null)} className="rounded-xl border border-violet-100 bg-white px-3 py-2.5"><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.title}</option>)}</select>
          <button disabled={busy || !newFolderTitle.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><FolderPlus size={17} />Tạo thư mục</button>
        </form>}

        {isOwner ? <form onSubmit={addBook} className="mt-3 grid gap-3 rounded-2xl border border-dashed border-teal-200 bg-teal-50/40 p-4 sm:grid-cols-[1fr_1fr_140px_220px_auto]">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tên sách (AI sẽ tự điền)" className="rounded-xl border border-teal-100 bg-white px-3 py-2.5" />
          <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Tác giả (AI sẽ tự điền)" className="rounded-xl border border-teal-100 bg-white px-3 py-2.5" />
          <input type="number" value={publicationYear} onChange={(event) => setPublicationYear(event.target.value)} placeholder="Năm" className="rounded-xl border border-teal-100 bg-white px-3 py-2.5" />
          <select value={parentId || ""} onChange={(event) => setParentId(event.target.value || null)} className="rounded-xl border border-teal-100 bg-white px-3 py-2.5"><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.title}</option>)}</select>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-bold text-teal-700"><FileUp size={17} />{file ? file.name : "Chọn PDF"}<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
          <button disabled={busy || !file} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-5">{busy && <Loader2 className="animate-spin" size={17} />}{busy ? "Đang đọc bằng Gemini..." : extraction ? "Lưu sách riêng tư" : "Đọc bằng Gemini"}</button>
        </form> : <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Kho tải sách dành riêng cho chủ sở hữu. Bạn có thể xem các sách đã được đăng công khai bên dưới.</div>}

        {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {extraction && isOwner && <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50/40 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-teal-800">Gemini đã đọc {extraction.pages.length} trang · {extraction.pages.reduce((sum, page) => sum + page.blocks.length, 0)} khối text</p><button type="button" onClick={removeNonLearningBlocks} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">Ẩn header, footer, số trang</button></div><div className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto">{extraction.pages.map((page, pageIndex) => page.blocks.map((block, blockIndex) => <div key={`${page.pageNumber}-${blockIndex}`} className={`rounded-lg px-3 py-2 ${["header", "footer", "page_number", "metadata"].includes(block.role) ? "bg-amber-50" : "bg-white"}`}><div className="mb-1 flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-rose-500">Trang {page.pageNumber} · {roleLabel(block.role)}</span><button type="button" title="Xóa block" aria-label="Xóa block" onClick={() => removeBlock(pageIndex, blockIndex)} className="rounded-md p-1 text-rose-500 hover:bg-rose-100"><Trash2 size={14} /></button></div><textarea value={block.text} onChange={(event) => updateBlockText(pageIndex, blockIndex, event.target.value)} className="min-h-10 w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs leading-5 text-slate-600 outline-none focus:border-teal-300" /></div>))}</div></div>}

        {contentLayout && contentBook && isOwner && <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[.14em] text-indigo-600">Chỉnh sửa nội dung</p><p className="mt-1 font-bold text-slate-800">{contentBook.title}</p><p className="text-xs text-slate-500">Sửa trực tiếp từng đoạn trước khi xuất Word hoặc PDF.</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={contentBusy} onClick={() => void saveContentEdit()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Save size={15} />Lưu nội dung</button>
              <button type="button" disabled={contentBusy} onClick={() => void exportWord(contentBook)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50"><Download size={15} />Xuất Word</button>
              <button type="button" disabled={contentBusy} onClick={() => void exportEditedPdf(contentBook)} className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-bold text-teal-700 disabled:opacity-50"><FileDown size={15} />Xuất PDF</button>
              <button type="button" title="Đóng trình sửa" onClick={() => { setContentBookId(null); setContentLayout(null); }} className="rounded-lg p-2 text-slate-500 hover:bg-white"><X size={17} /></button>
            </div>
          </div>
          <div className="mt-4 max-h-[75vh] overflow-y-auto rounded-xl bg-slate-100 p-3 sm:p-6">
            {contentLayout.pages.map((page, pageIndex) => <div key={`editor-page-${page.pageNumber}`} className="mx-auto mb-6 max-w-[760px] last:mb-0"><div className="mb-2 text-center text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Trang {page.pageNumber}</div>{renderDiagramCropEditor(page, pageIndex)}<div className="min-h-[900px] bg-white px-8 py-10 shadow-[0_2px_12px_rgba(15,23,42,.08)] sm:px-16 sm:py-14">{page.blocks.map((block, blockIndex) => { const heading = block.role === "heading"; const normalizedText = block.text.replace(/\s+/g, " ").trim(); const rows = Math.max(1, Math.min(12, Math.ceil(normalizedText.length / 88))); return <div key={`content-${page.pageNumber}-${blockIndex}`} className="group relative"><textarea value={block.text} rows={rows} onChange={(event) => updateContentBlockText(pageIndex, blockIndex, event.target.value)} aria-label={`Nội dung trang ${page.pageNumber}, ${roleLabel(block.role)}`} className={`block min-h-0 w-full resize-y overflow-hidden border-0 bg-transparent px-0 py-0.5 leading-[1.5] text-slate-800 outline-none transition-colors focus:bg-indigo-50/40 ${heading ? "font-bold text-sm" : "text-[13px]"}`} /><span className="pointer-events-none absolute -left-5 top-1 hidden text-[9px] font-bold uppercase tracking-wide text-indigo-400 group-focus-within:block">{roleLabel(block.role)}</span><button type="button" title="Xóa block" aria-label="Xóa block" onClick={() => removeContentBlock(pageIndex, blockIndex)} className="absolute -right-7 top-1 hidden rounded-md p-1 text-rose-500 hover:bg-rose-50 group-hover:block"><Trash2 size={14} /></button></div>; })}</div></div>)}
          </div>
        </div>}

        <div className="mt-5 grid gap-2">{renderTree()}</div>
      </div>
    </section>}
  </>;
}
