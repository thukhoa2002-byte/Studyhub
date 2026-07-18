import { BookOpenCheck, ExternalLink, FileText, FileUp, Globe2, LibraryBig, Loader2, LockKeyhole, Trash2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import GuidelinesPage from "./GuidelinesPage";
import { createReferenceBook, createReferenceBookTextPdf, deleteReferenceBook, extractReferenceBook, generateReferenceBookTextPdf, getReferenceBookUrl, listReferenceBooks, updateReferenceBookStatus, type ReferenceBook, type ReferenceBookExtraction } from "../services/referenceBooks";

type ReferenceSection = "guidelines" | "books";
const REFERENCE_BOOK_OWNER_EMAIL = "thukhoa2002@gmail.com";

export default function ReferenceLibraryPage({ user, onAiCallsRemaining }: { user: User | null; onAiCallsRemaining?: (remaining: number) => void }) {
  const [section, setSection] = useState<ReferenceSection>("guidelines");
  const [books, setBooks] = useState<ReferenceBook[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publicationYear, setPublicationYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [extraction, setExtraction] = useState<ReferenceBookExtraction | null>(null);
  const [ocrBookId, setOcrBookId] = useState<string | null>(null);
  const isOwner = user?.email?.trim().toLowerCase() === REFERENCE_BOOK_OWNER_EMAIL;
  const visibleBooks = isOwner ? books : books.filter((book) => book.status === "shared");

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
      const textPdf = await createReferenceBookTextPdf(file, extraction || undefined);
      await createReferenceBook(user.id, title, author, Number(publicationYear) || null, file, textPdf);
      setTitle("");
      setAuthor("");
      setPublicationYear("");
      setFile(null);
      setExtraction(null);
      await refreshBooks();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể OCR/lưu sách.");
    } finally {
      setBusy(false);
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
      const url = await getReferenceBookUrl(book.text_pdf_path || book.source_file_path);
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
    return ({ header: "Header", footer: "Footer", page_number: "Số trang", metadata: "Thông tin phụ", diagram_label: "Nhãn sơ đồ", diagram_caption: "Chú thích sơ đồ", heading: "Tiêu đề", table: "Bảng", caption: "Chú thích", text: "Nội dung" })[role];
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

        {isOwner ? <form onSubmit={addBook} className="mt-5 grid gap-3 rounded-2xl border border-dashed border-teal-200 bg-teal-50/40 p-4 sm:grid-cols-[1fr_1fr_140px_auto]">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tên sách (AI sẽ tự điền)" className="rounded-xl border border-teal-100 bg-white px-3 py-2.5" />
          <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Tác giả (AI sẽ tự điền)" className="rounded-xl border border-teal-100 bg-white px-3 py-2.5" />
          <input type="number" value={publicationYear} onChange={(event) => setPublicationYear(event.target.value)} placeholder="Năm" className="rounded-xl border border-teal-100 bg-white px-3 py-2.5" />
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-bold text-teal-700"><FileUp size={17} />{file ? file.name : "Chọn PDF"}<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
          <button disabled={busy || !file} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-4">{busy && <Loader2 className="animate-spin" size={17} />}{busy ? "Đang đọc bằng Gemini..." : extraction ? "Lưu sách riêng tư" : "Đọc bằng Gemini"}</button>
        </form> : <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Kho tải sách dành riêng cho chủ sở hữu. Bạn có thể xem các sách đã được đăng công khai bên dưới.</div>}

        {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {extraction && isOwner && <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50/40 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-teal-800">Gemini đã đọc {extraction.pages.length} trang · {extraction.pages.reduce((sum, page) => sum + page.blocks.length, 0)} khối text</p><button type="button" onClick={removeNonLearningBlocks} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">Ẩn header, footer, số trang</button></div><div className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto">{extraction.pages.map((page, pageIndex) => page.blocks.map((block, blockIndex) => <div key={`${page.pageNumber}-${blockIndex}`} className={`rounded-lg px-3 py-2 ${["header", "footer", "page_number", "metadata"].includes(block.role) ? "bg-amber-50" : "bg-white"}`}><div className="mb-1 flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-rose-500">Trang {page.pageNumber} · {roleLabel(block.role)}</span><button type="button" title="Xóa block" aria-label="Xóa block" onClick={() => removeBlock(pageIndex, blockIndex)} className="rounded-md p-1 text-rose-500 hover:bg-rose-100"><Trash2 size={14} /></button></div><textarea value={block.text} onChange={(event) => updateBlockText(pageIndex, blockIndex, event.target.value)} className="min-h-10 w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs leading-5 text-slate-600 outline-none focus:border-teal-300" /></div>))}</div></div>}

        <div className="mt-5 grid gap-2">{visibleBooks.map((book) => <div key={book.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"><div className="min-w-0"><p className="truncate font-bold text-slate-700">{book.title}</p><p className="text-xs text-slate-400">{book.author || "Chưa ghi tác giả"}{book.publication_year ? ` · ${book.publication_year}` : ""} · {book.status === "private" ? "Riêng tư" : "Đã đăng công khai"}{book.text_pdf_path ? " · Có PDF chữ" : " · Chưa tạo PDF chữ"}</p></div><div className="flex shrink-0 items-center gap-1">{isOwner && !book.text_pdf_path && <button type="button" title="Tạo PDF chữ" disabled={ocrBookId === book.id} onClick={() => void rebuildBook(book)} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50 disabled:opacity-50">{ocrBookId === book.id ? <Loader2 className="animate-spin" size={17} /> : <FileText size={17} />}</button>}<button type="button" title="Xem PDF chữ hoặc PDF gốc" onClick={() => void openBook(book)} className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"><ExternalLink size={17} /> </button>{isOwner && <><button type="button" title={book.status === "shared" ? "Gỡ công khai" : "Đăng công khai"} onClick={() => void toggleBookStatus(book)} className={`rounded-lg p-2 ${book.status === "shared" ? "text-amber-600 hover:bg-amber-50" : "text-blue-600 hover:bg-blue-50"}`}>{book.status === "shared" ? <LockKeyhole size={17} /> : <Globe2 size={17} />}</button><button type="button" title="Xóa sách" onClick={() => void removeBook(book)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 size={17} /></button></>}</div></div>)}</div>
      </div>
    </section>}
  </>;
}
