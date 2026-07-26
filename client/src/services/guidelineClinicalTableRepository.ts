import { requireGuidelineClient } from "./guidelineRepository";
import type { GuidelineClinicalTableRecord, NewGuidelineClinicalTable } from "./guidelineCoreTypes";

const columns = "id,guideline_id,section_id,owner_id,table_number,title,title_vi,short_description,source_page_start,source_page_end,source_order,headers_original,headers_vi,rows_original,rows_vi,footnotes_original,footnotes_vi,is_complete,status,created_at,updated_at";

export async function listGuidelineClinicalTables(guidelineId: string): Promise<GuidelineClinicalTableRecord[]> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_clinical_tables")
    .select(columns)
    .eq("guideline_id", guidelineId)
    .order("source_order", { ascending: true })
    .order("source_page_start", { ascending: true, nullsFirst: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as GuidelineClinicalTableRecord[];
}

export async function listPublishedGuidelineClinicalTablesForPublic(guidelineIds: string[]): Promise<GuidelineClinicalTableRecord[]> {
  if (!guidelineIds.length) return [];
  const { data, error } = await requireGuidelineClient()
    .from("guideline_clinical_tables")
    .select(columns)
    .in("guideline_id", guidelineIds)
    .eq("status", "published")
    .eq("is_complete", true)
    .order("source_order", { ascending: true })
    .order("source_page_start", { ascending: true, nullsFirst: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as GuidelineClinicalTableRecord[];
}

export async function createGuidelineClinicalTable(ownerId: string, input: NewGuidelineClinicalTable): Promise<GuidelineClinicalTableRecord> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_clinical_tables")
    .insert({ ...input, owner_id: ownerId, status: input.status ?? "draft" })
    .select(columns)
    .single();
  if (error) throw error;
  return data as GuidelineClinicalTableRecord;
}

export async function updateGuidelineClinicalTable(id: string, patch: Partial<Omit<GuidelineClinicalTableRecord, "id" | "guideline_id" | "owner_id" | "created_at" | "updated_at">>): Promise<GuidelineClinicalTableRecord> {
  const { data, error } = await requireGuidelineClient()
    .from("guideline_clinical_tables")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(columns)
    .single();
  if (error) throw error;
  return data as GuidelineClinicalTableRecord;
}
