import { requireGuidelineClient } from "./guidelineRepository";
import type { GuidelineRecommendationRecord, GuidelineRecommendationStatus, GuidelineVerificationStatus, NewGuidelineRecommendation } from "./guidelineCoreTypes";

export async function listGuidelineRecommendations(guidelineId: string, options: { publicOnly?: boolean } = {}): Promise<GuidelineRecommendationRecord[]> {
  let query = requireGuidelineClient().from("guideline_recommendations").select("*").eq("guideline_id", guidelineId).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (options.publicOnly) query = query.eq("status", "published").eq("verification_status", "verified");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as GuidelineRecommendationRecord[];
}

export async function getGuidelineRecommendation(id: string, options: { publicOnly?: boolean } = {}): Promise<GuidelineRecommendationRecord | null> {
  let query = requireGuidelineClient().from("guideline_recommendations").select("*").eq("id", id);
  if (options.publicOnly) query = query.eq("status", "published").eq("verification_status", "verified");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as GuidelineRecommendationRecord | null) ?? null;
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
