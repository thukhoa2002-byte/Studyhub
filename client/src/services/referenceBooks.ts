import { supabase } from "./supabase";

export interface ReferenceBook {
  id: string;
  owner_id: string;
  title: string;
  author: string;
  publication_year: number | null;
  source_file_path: string | null;
  text_pdf_path: string | null;
  ocr_layout: ReferenceBookExtraction | null;
  parent_id: string | null;
  item_type: "book" | "folder";
  status: "private" | "shared";
  processing_status: "ready" | "processing" | "failed";
  processing_error: string;
  created_at: string;
  updated_at: string;
}

export interface ReferenceBookBlock { text: string; x: number; y: number; width: number; height: number; fontSize: number; fontWeight: "normal" | "bold"; italic: boolean; role: "text" | "heading" | "table" | "caption" | "header" | "footer" | "page_number" | "metadata" | "diagram_label" | "diagram_caption" }
export interface ReferenceBookPage { pageNumber: number; width: number; height: number; blocks: ReferenceBookBlock[] }
export interface ReferenceBookExtraction { title: string; author: string; publicationYear: number; pages: ReferenceBookPage[] }

function client() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  return supabase;
}

export async function listReferenceBooks() {
  const { data, error } = await client().from("reference_books").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ReferenceBook[];
}

export async function createReferenceBook(ownerId: string, title: string, author: string, publicationYear: number | null, file: File, textPdf?: Blob, parentId: string | null = null, ocrLayout: ReferenceBookExtraction | null = null) {
  const storagePath = `${ownerId}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
  const storage = client().storage.from("reference-books");
  const uploaded = await storage.upload(storagePath, file, { contentType: "application/pdf", upsert: false });
  if (uploaded.error) throw uploaded.error;
  const textPdfPath = textPdf ? `${ownerId}/${crypto.randomUUID()}/ocr-${file.name.replace(/[^a-zA-Z0-9._-]+/g, "-")}` : null;
  if (textPdf && textPdfPath) {
    const ocrUpload = await storage.upload(textPdfPath, textPdf, { contentType: "application/pdf", upsert: false });
    if (ocrUpload.error) { await storage.remove([storagePath]); throw ocrUpload.error; }
  }
  const { data, error } = await client().from("reference_books").insert({ owner_id: ownerId, title: title.trim(), author: author.trim(), publication_year: publicationYear, source_file_path: storagePath, text_pdf_path: textPdfPath, ocr_layout: ocrLayout, parent_id: parentId, item_type: "book", status: "private", processing_status: "ready" }).select("*").single();
  if (error) { await storage.remove([storagePath, ...(textPdfPath ? [textPdfPath] : [])]); throw error; }
  return data as ReferenceBook;
}

export async function createReferenceBookFolder(ownerId: string, title: string, parentId: string | null = null) {
  const { data, error } = await client().from("reference_books").insert({ owner_id: ownerId, title: title.trim(), author: "", publication_year: null, source_file_path: null, text_pdf_path: null, parent_id: parentId, item_type: "folder", status: "private", processing_status: "ready" }).select("*").single();
  if (error) throw error;
  return data as ReferenceBook;
}

export async function updateReferenceBookDetails(bookId: string, changes: { title: string; author?: string; parentId?: string | null }) {
  const { data, error } = await client().from("reference_books").update({ title: changes.title.trim(), ...(changes.author !== undefined ? { author: changes.author.trim() } : {}), ...(changes.parentId !== undefined ? { parent_id: changes.parentId } : {}), updated_at: new Date().toISOString() }).eq("id", bookId).select("*").single();
  if (error) throw error;
  return data as ReferenceBook;
}

export async function updateReferenceBookLayout(bookId: string, layout: ReferenceBookExtraction) {
  const { data, error } = await client().from("reference_books").update({ ocr_layout: layout, updated_at: new Date().toISOString() }).eq("id", bookId).select("*").single();
  if (error) throw error;
  return data as ReferenceBook;
}

export async function createReferenceBookTextPdf(file: File, layout?: ReferenceBookExtraction): Promise<Blob> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Bạn cần đăng nhập để tạo PDF OCR.");
  const form = new FormData();
  form.append("file", file);
  form.append("format", "reflow");
  if (layout) form.append("layout", JSON.stringify(layout));
  const response = await fetch("/api/reference-books/ocr-pdf", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || "Không thể tạo PDF OCR.");
  }
  return response.blob();
}

export async function generateReferenceBookTextPdf(book: ReferenceBook, layout: ReferenceBookExtraction | null = book.ocr_layout): Promise<ReferenceBook> {
  if (!book.source_file_path) throw new Error("Mục này là thư mục, không có PDF gốc để tạo bản PDF chữ.");
  const sourceUrl = await getReferenceBookUrl(book.source_file_path);
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) throw new Error("Không thể tải PDF gốc để tạo bản OCR.");
  const sourceBlob = await sourceResponse.blob();
  const sourceFile = new File([sourceBlob], `${book.title || "reference-book"}.pdf`, { type: "application/pdf" });
  const textPdf = await createReferenceBookTextPdf(sourceFile, layout || undefined);
  const path = `${book.owner_id}/${crypto.randomUUID()}/ocr-${book.title.replace(/[^a-zA-Z0-9._-]+/g, "-")}.pdf`;
  const storage = client().storage.from("reference-books");
  const uploaded = await storage.upload(path, textPdf, { contentType: "application/pdf", upsert: false });
  if (uploaded.error) throw uploaded.error;
  const { data, error } = await client().from("reference_books").update({ text_pdf_path: path, updated_at: new Date().toISOString() }).eq("id", book.id).select("*").single();
  if (error) { await storage.remove([path]); throw error; }
  return data as ReferenceBook;
}

export async function deleteReferenceBook(book: ReferenceBook) {
  await client().from("reference_books").delete().eq("id", book.id).throwOnError();
  const paths = [book.source_file_path, book.text_pdf_path].filter((path): path is string => Boolean(path));
  if (paths.length) await client().storage.from("reference-books").remove(paths);
}

export async function updateReferenceBookStatus(bookId: string, status: ReferenceBook["status"]) {
  const { data, error } = await client().from("reference_books").update({ status, updated_at: new Date().toISOString() }).eq("id", bookId).select("*").single();
  if (error) throw error;
  return data as ReferenceBook;
}

export async function getReferenceBookUrl(path: string) {
  const { data, error } = await client().storage.from("reference-books").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw error || new Error("Không thể mở sách.");
  return data.signedUrl;
}

export async function extractReferenceBook(file: File): Promise<ReferenceBookExtraction> {
  const client = await import("./supabase");
  if (!client.supabase) throw new Error("Supabase chưa được cấu hình.");
  const { data: { session } } = await client.supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Bạn cần đăng nhập để OCR sách.");
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/reference-books/extract", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
  const body = await response.json().catch(() => null) as { success?: boolean; data?: ReferenceBookExtraction; message?: string } | null;
  if (!response.ok || !body?.data) throw new Error(body?.message || "Không thể OCR sách bằng Gemini.");
  return body.data;
}
