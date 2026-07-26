import { supabase } from "./supabase";
import { normalizeGuidelineCoreCondition } from "./guidelineCoreTypes";
import type { GuidelineCoreDocument, GuidelineCorePreview, GuidelineCoreStatus, NewGuidelineCoreDocument } from "./guidelineCoreTypes";

export function requireGuidelineClient() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  return supabase;
}

const publicGuidelineColumns = "id,title,society,condition,publication_year,version_label,summary,topics,source_url,status,published_at,updated_at";
const guidelineColumns = "id,owner_id,title,society,condition,publication_year,version_label,summary,topics,source_url,doi,citation,file_path,supplement_file_path,provenance,visibility,status,review_note,published_at,archived_at,published_by,archived_by,created_at,updated_at";

export async function listGuidelineCoreDocuments(options: { publicOnly?: boolean } = {}): Promise<GuidelineCoreDocument[]> {
  let query = requireGuidelineClient().from("guideline_documents").select(guidelineColumns).order("publication_year", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(200);
  if (options.publicOnly) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as GuidelineCoreDocument[];
}

export async function listGuidelineCoreDocumentPreviews(): Promise<GuidelineCorePreview[]> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_documents")
    .select("id,title,society,condition,publication_year,version_label,summary,topics,status,published_at")
    .eq("status", "published")
    .order("publication_year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GuidelineCorePreview[];
}

export async function listPublishedGuidelineCoreDocumentsForPublic(): Promise<GuidelineCoreDocument[]> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_documents")
    .select(publicGuidelineColumns)
    .eq("status", "published")
    .order("publication_year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as GuidelineCoreDocument[];
}

export async function getGuidelineCoreDocument(id: string, options: { publicOnly?: boolean } = {}): Promise<GuidelineCoreDocument | null> {
  let query = requireGuidelineClient().from("guideline_documents").select(guidelineColumns).eq("id", id);
  if (options.publicOnly) query = query.eq("status", "published");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as GuidelineCoreDocument | null) ?? null;
}

export async function getGuidelineCoreDocumentsByIds(ids: string[]): Promise<GuidelineCoreDocument[]> {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (uniqueIds.length === 0) return [];
  const { data, error } = await requireGuidelineClient().from("guideline_documents").select(guidelineColumns).in("id", uniqueIds).limit(uniqueIds.length);
  if (error) throw error;
  return (data ?? []) as GuidelineCoreDocument[];
}

export async function createGuidelineCoreDocument(ownerId: string, input: NewGuidelineCoreDocument): Promise<GuidelineCoreDocument> {
  const { data, error } = await requireGuidelineClient().from("guideline_documents").insert({
    owner_id: ownerId,
    title: input.title.trim(),
    society: input.society.trim(),
    condition: normalizeGuidelineCoreCondition(input.condition),
    summary: input.summary?.trim() ?? "",
    topics: input.topics ?? [],
    publication_year: input.publication_year ?? null,
    version_label: input.version_label.trim(),
    source_url: input.source_url?.trim() || null,
    doi: input.doi?.trim() || null,
    citation: input.citation?.trim() || null,
    provenance: input.provenance ?? [],
    review_note: input.review_note?.trim() ?? "",
    visibility: input.visibility,
    status: "draft",
  }).select("*").single();
  if (error) throw error;
  return data as GuidelineCoreDocument;
}

export async function updateGuidelineCoreDocument(id: string, patch: Partial<Omit<GuidelineCoreDocument, "id" | "owner_id" | "created_at" | "updated_at">>): Promise<GuidelineCoreDocument> {
  const normalizedPatch = "condition" in patch
    ? { ...patch, condition: normalizeGuidelineCoreCondition(patch.condition) }
    : patch;
  const { data, error } = await requireGuidelineClient().from("guideline_documents").update({ ...normalizedPatch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw error;
  return data as GuidelineCoreDocument;
}

export async function setGuidelineCoreStatus(id: string, status: GuidelineCoreStatus, actorId: string, at = new Date().toISOString()): Promise<GuidelineCoreDocument> {
  return updateGuidelineCoreDocument(id, {
    status,
    published_at: status === "published" ? at : undefined,
    published_by: status === "published" ? actorId : undefined,
    archived_at: status === "archived" ? at : undefined,
    archived_by: status === "archived" ? actorId : undefined,
  });
}
