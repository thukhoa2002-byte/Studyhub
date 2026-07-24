import { supabase } from "./supabase";
import type { GuidelineCoreDocument, GuidelineCoreStatus, NewGuidelineCoreDocument } from "./guidelineCoreTypes";

export function requireGuidelineClient() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  return supabase;
}

export async function listGuidelineCoreDocuments(options: { publicOnly?: boolean } = {}): Promise<GuidelineCoreDocument[]> {
  let query = requireGuidelineClient().from("guideline_documents").select("*").order("publication_year", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  if (options.publicOnly) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as GuidelineCoreDocument[];
}

export async function getGuidelineCoreDocument(id: string, options: { publicOnly?: boolean } = {}): Promise<GuidelineCoreDocument | null> {
  let query = requireGuidelineClient().from("guideline_documents").select("*").eq("id", id);
  if (options.publicOnly) query = query.eq("status", "published");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as GuidelineCoreDocument | null) ?? null;
}

export async function createGuidelineCoreDocument(ownerId: string, input: NewGuidelineCoreDocument): Promise<GuidelineCoreDocument> {
  const { data, error } = await requireGuidelineClient().from("guideline_documents").insert({
    owner_id: ownerId,
    title: input.title.trim(),
    society: input.society.trim(),
    condition: input.condition,
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
  const { data, error } = await requireGuidelineClient().from("guideline_documents").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
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
