import { requireGuidelineClient } from "./guidelineRepository";
import type { GuidelineSourceDocumentRecord } from "./guidelineCoreTypes";

export async function listGuidelineSourceDocuments(guidelineId: string): Promise<GuidelineSourceDocumentRecord[]> {
  const query = requireGuidelineClient().from("guideline_source_documents").select("*").eq("guideline_id", guidelineId).order("created_at", { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as GuidelineSourceDocumentRecord[];
}

export async function createGuidelineSourceDocument(ownerId: string, input: Omit<GuidelineSourceDocumentRecord, "id" | "owner_id" | "created_at" | "updated_at">): Promise<GuidelineSourceDocumentRecord> {
  const { data, error } = await requireGuidelineClient().from("guideline_source_documents").insert({ ...input, owner_id: ownerId }).select("*").single();
  if (error) throw error;
  return data as GuidelineSourceDocumentRecord;
}

export async function updateGuidelineSourceDocument(id: string, patch: Partial<Pick<GuidelineSourceDocumentRecord, "original_filename" | "mime_type" | "source_kind" | "checksum" | "page_count" | "extraction_status">>): Promise<GuidelineSourceDocumentRecord> {
  const { data, error } = await requireGuidelineClient().from("guideline_source_documents").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw error;
  return data as GuidelineSourceDocumentRecord;
}
