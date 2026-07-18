import { BookOpenCheck, FileUp, LibraryBig, Loader2, Trash2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import GuidelinesPage from "./GuidelinesPage";
import { createReferenceBook, deleteReferenceBook, extractReferenceBook, listReferenceBooks, type ReferenceBook, type ReferenceBookExtraction } from "../services/referenceBooks";

type ReferenceSection = "guidelines" | "books";

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
  async function refreshBooks() { if (!user) return; try { setBooks(await listReferenceBooks()); } catch (e) { setError(e instanceof Error ? e.message : "Không thể tải kho sách."); } }
  useEffect(() => { void refreshBooks(); }, [user]);
  async function addBook(event: React.FormEvent) { event.preventDefault(); if (!user || !file) return; setBusy(true); setError(""); try { if (!extraction) { const layout = await extractReferenceBook(file); setExtraction(layout); setTitle((current) => current.trim() || layout.title); setAuthor((current) => current.trim() || layout.author); setPublicationYear((current) => current || (layout.publicationYear ? String(layout.publicationYear) : "")); return; } await createReferenceBook(user.id, title, author, Number(publicationYear) || null, file); setTitle(""); setAuthor(""); setPublicationYear(""); setFile(null); setExtraction(null); await refreshBooks(); } catch (e) { setError(e instanceof Error ? e.message : "Không thể OCR/lưu sách."); } finally { setBusy(false); } }
  return <>
    <div className="mx-auto flex w-full max-w-[1600px] px-4 pt-6 sm:px-6 xl:px-8">
      <div className="inline-flex rounded-lg border border-teal-100 bg-white/75 p-1 shadow-sm">
        <button type="button" onClick={() => setSection("guidelines")} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold ${section === "guidelines" ? "bg-teal-500 text-white" : "text-slate-600 hover:bg-teal-50"}`}><BookOpenCheck size={17} />Guideline</button>
        <button type="button" onClick={() => setSection("books")} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold ${section === "books" ? "bg-rose-500 text-white" : "text-slate-600 hover:bg-rose-50"}`}><LibraryBig size={17} />Sách</button>
      </div>
    </div>
    {section === "books" && <div className="mx-auto w-full max-w-[1600px] px-4 pt-3 sm:px-6 xl:px-8"><label className="block max-w-xs text-xs font-bold text-slate-600">Năm xuất bản<input type="number" value={publicationYear} onChange={(e) => setPublicationYear(e.target.value)} placeholder="AI sẽ tự điền nếu đọc được" className="mt-1 w-full rounded-xl border border-teal-100 bg-white px-3 py-2.5" /></label></div>}
    {section === "guidelines" ? <GuidelinesPage user={user} onAiCallsRemaining={onAiCallsRemaining} /> : <section className="mode-panel mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 xl:px-8"><div className="glass-panel border border-rose-100 bg-white/75 p-5"><div className="flex items-center gap-3"><LibraryBig className="text-rose-500" size={28} /><h1 className="text-xl font-extrabold text-rose-950">Sách</h1></div><form onSubmit={addBook} className="mt-5 grid gap-3 rounded-2xl border border-dashed border-teal-200 bg-teal-50/40 p-4 sm:grid-cols-[1fr_1fr_auto]"><input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên sách" className="rounded-xl border border-teal-100 bg-white px-3 py-2.5" /><input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Tác giả" className="rounded-xl border border-teal-100 bg-white px-3 py-2.5" /><label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-bold text-teal-700"><FileUp size={17} />{file ? file.name : "Chọn PDF"}<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label><button disabled={busy || !file} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-3">{busy && <Loader2 className="animate-spin" size={17} />} {busy ? "Đang đọc bằng Gemini..." : "Lưu sách"}</button></form>{error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}{extraction && <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50/40 p-4"><p className="text-sm font-bold text-teal-800">Gemini đã đọc {extraction.pages.length} trang · {extraction.pages.reduce((sum, page) => sum + page.blocks.length, 0)} khối text</p><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{extraction.pages.flatMap((page) => page.blocks.slice(0, 8).map((block, index) => <p key={`${page.pageNumber}-${index}`} className="rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-600"><span className="mr-2 font-bold text-rose-500">Trang {page.pageNumber}</span>{block.text}</p>)).slice(0, 30)}</div></div>}<div className="mt-5 grid gap-2">{books.map((book) => <div key={book.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"><div><p className="font-bold text-slate-700">{book.title}</p><p className="text-xs text-slate-400">{book.author || "Chưa ghi tác giả"} · {book.status === "private" ? "Riêng tư" : "Đã chia sẻ"}</p></div><button type="button" title="Xóa sách" onClick={() => void deleteReferenceBook(book).then(refreshBooks).catch((e) => setError(e instanceof Error ? e.message : "Không thể xóa sách."))} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 size={17} /></button></div>)}</div></div></section>}
  </>;
}
