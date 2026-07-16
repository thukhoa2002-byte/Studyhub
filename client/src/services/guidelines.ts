import { supabase } from "./supabase";

export type GuidelineCondition = "ACS" | "HF" | "AF" | "Khác";
export type GuidelineStatus = "draft" | "reviewed";

export interface GuidelineDocument {
  id: string;
  owner_id: string;
  title: string;
  society: string;
  condition: GuidelineCondition;
  publication_year: number;
  version_label: string;
  source_url: string;
  file_path: string | null;
  supplement_file_path: string | null;
  visibility: "private" | "shared";
  created_at: string;
}

export interface GuidelineEntry {
  id: string;
  document_id: string;
  owner_id: string;
  topic: string;
  drug_name: string;
  clinical_context: string;
  recommendation_summary: string;
  dose: string;
  renal_adjustment: string;
  hepatic_adjustment: string;
  contraindications: string;
  monitoring: string;
  recommendation_class: string;
  evidence_level: string;
  page_reference: string;
  status: GuidelineStatus;
  created_at: string;
}

export interface NewGuidelineDocument {
  title: string;
  society: string;
  condition: GuidelineCondition;
  publicationYear: number;
  versionLabel: string;
  sourceUrl: string;
  visibility: "private" | "shared";
  file?: File | null;
  supplementFile?: File | null;
}

export type NewGuidelineEntry = Omit<GuidelineEntry, "id" | "owner_id" | "created_at" | "status">;

function requireSupabase() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  return supabase;
}

export async function listGuidelineDocuments(): Promise<GuidelineDocument[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("guideline_documents")
    .select("*")
    .order("publication_year", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GuidelineDocument[];
}

export async function createGuidelineDocument(userId: string, input: NewGuidelineDocument): Promise<GuidelineDocument> {
  const client = requireSupabase();
  let filePath: string | null = null;
  let supplementFilePath: string | null = null;

  if (input.file) {
    const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    filePath = `${userId}/${crypto.randomUUID()}/${safeName}`;
    const { error: uploadError } = await client.storage
      .from("guideline-files")
      .upload(filePath, input.file, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;
  }

  if (input.supplementFile) {
    const safeName = input.supplementFile.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    supplementFilePath = `${userId}/${crypto.randomUUID()}/supplement-${safeName}`;
    const { error: uploadError } = await client.storage
      .from("guideline-files")
      .upload(supplementFilePath, input.supplementFile, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      if (filePath) await client.storage.from("guideline-files").remove([filePath]);
      throw uploadError;
    }
  }

  const { data, error } = await client
    .from("guideline_documents")
    .insert({
      owner_id: userId,
      title: input.title.trim(),
      society: input.society.trim(),
      condition: input.condition,
      publication_year: input.publicationYear,
      version_label: input.versionLabel.trim(),
      source_url: input.sourceUrl.trim(),
      file_path: filePath,
      supplement_file_path: supplementFilePath,
      visibility: input.visibility,
    })
    .select("*")
    .single();

  if (error) {
    const uploadedPaths = [filePath, supplementFilePath].filter((path): path is string => Boolean(path));
    if (uploadedPaths.length) await client.storage.from("guideline-files").remove(uploadedPaths);
    throw error;
  }
  return data as GuidelineDocument;
}

export async function deleteGuidelineDocument(document: GuidelineDocument) {
  const client = requireSupabase();
  const { error } = await client.from("guideline_documents").delete().eq("id", document.id);
  if (error) throw error;
  const paths = [document.file_path, document.supplement_file_path].filter((path): path is string => Boolean(path));
  if (paths.length) await client.storage.from("guideline-files").remove(paths);
}

export async function getGuidelineFileUrl(filePath: string): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.storage.from("guideline-files").createSignedUrl(filePath, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function listGuidelineEntries(documentId: string): Promise<GuidelineEntry[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("guideline_entries")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GuidelineEntry[];
}

export async function createGuidelineEntry(userId: string, input: NewGuidelineEntry): Promise<GuidelineEntry> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("guideline_entries")
    .insert({ ...input, owner_id: userId, status: "draft" })
    .select("*")
    .single();
  if (error) throw error;
  return data as GuidelineEntry;
}

export async function createGuidelineEntries(userId: string, inputs: NewGuidelineEntry[]): Promise<GuidelineEntry[]> {
  if (inputs.length === 0) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from("guideline_entries")
    .insert(inputs.map((input) => ({ ...input, owner_id: userId, status: "draft" })))
    .select("*");
  if (error) throw error;
  return (data ?? []) as GuidelineEntry[];
}

export async function setGuidelineEntryStatus(entryId: string, status: GuidelineStatus): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("guideline_entries").update({ status }).eq("id", entryId);
  if (error) throw error;
}

export async function deleteGuidelineEntry(entryId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("guideline_entries").delete().eq("id", entryId);
  if (error) throw error;
}
