import { requireGuidelineClient } from "./guidelineRepository";
import type {
  GuidelineRecommendationGroupRecord,
  GuidelineRecommendationTableRecord,
  NewGuidelineRecommendationGroup,
  NewGuidelineRecommendationTable,
} from "./guidelineCoreTypes";

const tableColumns = "id,guideline_id,section_id,owner_id,table_number,source_table_number,title,title_vi,short_description,source_page,source_page_start,source_page_end,source_quote,source_anchor,source_order,display_order,is_complete,translation_status,status,created_at,updated_at";
const groupColumns = "id,guideline_id,section_id,recommendation_table_id,owner_id,source_heading,title_vi,context,source_page,group_order,status,created_at,updated_at";

export async function listGuidelineRecommendationTables(guidelineId: string): Promise<GuidelineRecommendationTableRecord[]> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_recommendation_tables")
    .select(tableColumns)
    .eq("guideline_id", guidelineId)
    .order("source_order", { ascending: true })
    .order("source_page_start", { ascending: true, nullsFirst: false })
    .order("display_order", { ascending: true })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as GuidelineRecommendationTableRecord[];
}

export async function listPublishedGuidelineRecommendationTablesForPublic(guidelineIds: string[]): Promise<GuidelineRecommendationTableRecord[]> {
  if (guidelineIds.length === 0) return [];
  const { data, error } = await requireGuidelineClient()
    .from("guideline_recommendation_tables")
    .select(tableColumns)
    .in("guideline_id", guidelineIds)
    .eq("status", "published")
    .eq("is_complete", true)
    .order("source_page_start", { ascending: true, nullsFirst: false })
    .order("source_order", { ascending: true })
    .order("display_order", { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as GuidelineRecommendationTableRecord[];
}

export async function getGuidelineRecommendationTable(id: string): Promise<GuidelineRecommendationTableRecord | null> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_recommendation_tables")
    .select(tableColumns)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as GuidelineRecommendationTableRecord | null;
}

export async function getGuidelineRecommendationTablesByIds(ids: string[]): Promise<GuidelineRecommendationTableRecord[]> {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (uniqueIds.length === 0) return [];
  const { data, error } = await requireGuidelineClient()
    .from("guideline_recommendation_tables")
    .select(tableColumns)
    .in("id", uniqueIds)
    .limit(uniqueIds.length);
  if (error) throw error;
  return (data ?? []) as GuidelineRecommendationTableRecord[];
}

export async function createGuidelineRecommendationTable(ownerId: string, input: NewGuidelineRecommendationTable): Promise<GuidelineRecommendationTableRecord> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_recommendation_tables")
    .insert({ ...input, owner_id: ownerId, status: input.status ?? "draft" })
    .select(tableColumns)
    .single();
  if (error) throw error;
  return data as GuidelineRecommendationTableRecord;
}

export async function updateGuidelineRecommendationTable(id: string, patch: Partial<Omit<GuidelineRecommendationTableRecord, "id" | "guideline_id" | "section_id" | "owner_id" | "created_at" | "updated_at">>): Promise<GuidelineRecommendationTableRecord> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_recommendation_tables")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(tableColumns)
    .single();
  if (error) throw error;
  return data as GuidelineRecommendationTableRecord;
}

export async function listGuidelineRecommendationGroups(guidelineId: string): Promise<GuidelineRecommendationGroupRecord[]> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_recommendation_groups")
    .select(groupColumns)
    .eq("guideline_id", guidelineId)
    .order("group_order", { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as GuidelineRecommendationGroupRecord[];
}

export async function listPublishedGuidelineRecommendationGroupsForPublic(guidelineIds: string[]): Promise<GuidelineRecommendationGroupRecord[]> {
  if (guidelineIds.length === 0) return [];
  const { data, error } = await requireGuidelineClient()
    .from("guideline_recommendation_groups")
    .select(groupColumns)
    .in("guideline_id", guidelineIds)
    .eq("status", "published")
    .order("group_order", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as GuidelineRecommendationGroupRecord[];
}

export async function getGuidelineRecommendationGroup(id: string): Promise<GuidelineRecommendationGroupRecord | null> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_recommendation_groups")
    .select(groupColumns)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as GuidelineRecommendationGroupRecord | null;
}

export async function createGuidelineRecommendationGroup(ownerId: string, input: NewGuidelineRecommendationGroup): Promise<GuidelineRecommendationGroupRecord> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_recommendation_groups")
    .insert({ ...input, owner_id: ownerId, status: input.status ?? "draft" })
    .select(groupColumns)
    .single();
  if (error) throw error;
  return data as GuidelineRecommendationGroupRecord;
}

export async function updateGuidelineRecommendationGroup(id: string, patch: Partial<Omit<GuidelineRecommendationGroupRecord, "id" | "guideline_id" | "section_id" | "recommendation_table_id" | "owner_id" | "created_at" | "updated_at">>): Promise<GuidelineRecommendationGroupRecord> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_recommendation_groups")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(groupColumns)
    .single();
  if (error) throw error;
  return data as GuidelineRecommendationGroupRecord;
}
