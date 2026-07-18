import { supabase } from "./supabase";

export interface ReferenceBook {
  id: string;
  owner_id: string;
  title: string;
  author: string;
  source_file_path: string;
  text_pdf_path: string | null;
  status: "private" | "shared";
  processing_status: "ready" | "processing" | "failed";
  processing_error: string;
  created_at: string;
  updated_at: string;
}

function client() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  return supabase;
}

export async function listReferenceBooks() {
  const { data, error } = await client().from("reference_books").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ReferenceBook[];
}

export async function createReferenceBook(ownerId: string, title: string, author: string, file: File) {
  const storagePath = `${ownerId}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
  const storage = client().storage.from("reference-books");
  const uploaded = await storage.upload(storagePath, file, { contentType: "application/pdf", upsert: false });
  if (uploaded.error) throw uploaded.error;
  const { data, error } = await client().from("reference_books").insert({ owner_id: ownerId, title: title.trim(), author: author.trim(), source_file_path: storagePath, status: "private", processing_status: "ready" }).select("*").single();
  if (error) { await storage.remove([storagePath]); throw error; }
  return data as ReferenceBook;
}

export async function deleteReferenceBook(book: ReferenceBook) {
  await client().from("reference_books").delete().eq("id", book.id).throwOnError();
  const paths = [book.source_file_path, book.text_pdf_path].filter((path): path is string => Boolean(path));
  if (paths.length) await client().storage.from("reference-books").remove(paths);
}
