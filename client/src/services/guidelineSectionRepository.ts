import { requireGuidelineClient } from "./guidelineRepository";
import { validateGuidelineStatusTransition } from "./guidelineValidation";
import type { GuidelineSectionRecord, NewGuidelineSection, GuidelineSectionStatus } from "./guidelineCoreTypes";

export async function listGuidelineSections(guidelineId: string, options: { publicOnly?: boolean } = {}): Promise<GuidelineSectionRecord[]> {
  let query = requireGuidelineClient().from("guideline_sections").select("*").eq("guideline_id", guidelineId).order("display_order", { ascending: true });
  if (options.publicOnly) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as GuidelineSectionRecord[];
}

export async function getGuidelineSection(id: string, options: { publicOnly?: boolean } = {}): Promise<GuidelineSectionRecord | null> {
  let query = requireGuidelineClient().from("guideline_sections").select("*").eq("id", id);
  if (options.publicOnly) query = query.eq("status", "published");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as GuidelineSectionRecord | null) ?? null;
}

export async function createGuidelineSection(ownerId: string, input: NewGuidelineSection): Promise<GuidelineSectionRecord> {
  const { data, error } = await requireGuidelineClient().from("guideline_sections").insert({
    ...input,
    owner_id: ownerId,
    parent_section_id: input.parent_section_id ?? null,
    section_number: input.section_number ?? null,
    status: input.status ?? "draft",
  }).select("*").single();
  if (error) throw error;
  return data as GuidelineSectionRecord;
}

export async function updateGuidelineSection(id: string, patch: Partial<Omit<GuidelineSectionRecord, "id" | "guideline_id" | "owner_id" | "created_at" | "updated_at">>): Promise<GuidelineSectionRecord> {
  const { data, error } = await requireGuidelineClient().from("guideline_sections").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw error;
  return data as GuidelineSectionRecord;
}

export async function setGuidelineSectionStatus(id: string, status: GuidelineSectionStatus): Promise<GuidelineSectionRecord> {
  const current = await getGuidelineSection(id);
  if (!current) throw new Error("Section không tồn tại.");
  const errors = validateGuidelineStatusTransition(current.status, status);
  if (errors.length) throw new Error(errors.join(" "));
  return updateGuidelineSection(id, { status });
}

export async function deleteDraftGuidelineSection(id: string): Promise<void> {
  const { error } = await requireGuidelineClient().from("guideline_sections").delete().eq("id", id).eq("status", "draft");
  if (error) throw error;
}
