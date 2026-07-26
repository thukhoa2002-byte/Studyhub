import { requireGuidelineClient } from "./guidelineRepository";
import type { GuidelineRecommendationRecord, GuidelineRecommendationStatus, GuidelineVerificationStatus, NewGuidelineRecommendation } from "./guidelineCoreTypes";

const publicRecommendationColumns = "id,guideline_id,section_id,recommendation_table_id,recommendation_group_id,title,recommendation_text_original,recommendation_text_vi,recommendation_class,evidence_level,population,conditions,source_page,verification_status,status,reviewed_by,reviewed_at,sort_order,created_at,updated_at";
const recommendationColumns = "id,guideline_id,section_id,recommendation_table_id,recommendation_group_id,owner_id,title,recommendation_text_original,recommendation_text_vi,rationale_vi,recommendation_class,evidence_level,evidence_system,population,intervention,comparator,outcome,conditions,contraindications,source_page,source_quote,source_anchor,verification_status,review_note,reviewed_by,reviewed_at,status,sort_order,created_at,updated_at";

export async function listGuidelineRecommendations(guidelineId: string, options: { publicOnly?: boolean } = {}): Promise<GuidelineRecommendationRecord[]> {
  let query = requireGuidelineClient().from("guideline_recommendations").select(recommendationColumns).eq("guideline_id", guidelineId).order("sort_order", { ascending: true }).order("created_at", { ascending: true }).limit(2000);
  if (options.publicOnly) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as GuidelineRecommendationRecord[];
}

export async function listPublishedGuidelineRecommendationsForPublic(guidelineIds: string[]): Promise<GuidelineRecommendationRecord[]> {
  if (guidelineIds.length === 0) return [];
  const { data, error } = await requireGuidelineClient()
    .from("guideline_recommendations")
    .select(publicRecommendationColumns)
    .in("guideline_id", guidelineIds)
    .eq("status", "published")
    .eq("verification_status", "verified")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as GuidelineRecommendationRecord[];
}

export async function getGuidelineRecommendation(id: string, options: { publicOnly?: boolean } = {}): Promise<GuidelineRecommendationRecord | null> {
  let query = requireGuidelineClient().from("guideline_recommendations").select(recommendationColumns).eq("id", id);
  if (options.publicOnly) query = query.eq("status", "published");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as GuidelineRecommendationRecord | null) ?? null;
}

export async function getGuidelineRecommendationsByIds(ids: string[]): Promise<GuidelineRecommendationRecord[]> {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (uniqueIds.length === 0) return [];
  const { data, error } = await requireGuidelineClient().from("guideline_recommendations").select(recommendationColumns).in("id", uniqueIds).limit(uniqueIds.length);
  if (error) throw error;
  return (data ?? []) as GuidelineRecommendationRecord[];
}

export async function createGuidelineRecommendation(ownerId: string, input: NewGuidelineRecommendation): Promise<GuidelineRecommendationRecord> {
  const { data, error } = await requireGuidelineClient().from("guideline_recommendations").insert({ ...input, owner_id: ownerId, status: "draft", verification_status: input.verification_status ?? "unverified" }).select("*").single();
  if (error) throw error;
  return data as GuidelineRecommendationRecord;
}

export async function updateGuidelineRecommendation(id: string, patch: Partial<Omit<GuidelineRecommendationRecord, "id" | "guideline_id" | "owner_id" | "created_at" | "updated_at">>): Promise<GuidelineRecommendationRecord> {
  const { data, error } = await requireGuidelineClient().from("guideline_recommendations").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw error;
  return data as GuidelineRecommendationRecord;
}

export async function reviewGuidelineRecommendation(id: string, actorId: string, verificationStatus: GuidelineVerificationStatus = "verified"): Promise<GuidelineRecommendationRecord> {
  return updateGuidelineRecommendation(id, { status: "reviewed", verification_status: verificationStatus, reviewed_by: actorId, reviewed_at: new Date().toISOString() });
}

export async function setGuidelineRecommendationStatus(id: string, status: GuidelineRecommendationStatus, actorId?: string): Promise<GuidelineRecommendationRecord> {
  return updateGuidelineRecommendation(id, {
    status,
    reviewed_by: status === "reviewed" || status === "published" ? actorId ?? null : undefined,
    reviewed_at: status === "reviewed" || status === "published" ? new Date().toISOString() : undefined,
  });
}

export async function deleteDraftGuidelineRecommendation(id: string): Promise<void> {
  const { error } = await requireGuidelineClient().from("guideline_recommendations").delete().eq("id", id).eq("status", "draft");
  if (error) throw error;
}
