import { supabase } from "./supabase.ts";
import type { DatabaseCalculator, DatabaseCalculatorPreview, CalculatorGuidelineReferenceRow, GuidelineDocumentTarget, GuidelineRecommendationTarget, GuidelineSectionTarget } from "../modules/calculators/databaseTypes.ts";

function client() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  return supabase;
}

const calculatorListColumns = "id,owner_id,slug,short_name,name,description,calculator_type,specialty_id,category_id,handler_key,calculator_topic_key,default_method_key,enabled_method_keys,comparison_enabled,calculation_mode,version,calculation_version,content_revision,status,source_verified,reviewed_at,published_at,archived_at,created_at,updated_at";
const calculatorDetailColumns = `${calculatorListColumns},input_fields,scoring_rules,formula_display,formula_variables,result_definitions,when_to_use,when_not_to_use,limitations,warnings,evidence_references,reviewed_by,published_by,archived_by`;
const calculatorGuidelineReferenceColumns = "id,calculator_id,guideline_id,section_id,recommendation_id,relation_type,context,required,display_order,owner_id,created_at,updated_at";

export interface CalculatorListFilter {
  publicOnly?: boolean;
  status?: DatabaseCalculator["status"];
  query?: string;
  specialtyId?: string;
  categoryId?: string;
  limit?: number;
}

export type CalculatorInsert = Omit<DatabaseCalculator, "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
export type CalculatorUpdate = Partial<Omit<DatabaseCalculator, "id" | "created_at" | "updated_at" | "owner_id">>;

export class CalculatorRepository {
  async list(filter: CalculatorListFilter = {}): Promise<DatabaseCalculator[]> {
    let query = client().from("calculators").select(calculatorListColumns).order("updated_at", { ascending: false }).limit(filter.limit ?? 200);
    if (filter.publicOnly) query = query.eq("status", "published");
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.specialtyId) query = query.eq("specialty_id", filter.specialtyId);
    if (filter.categoryId) query = query.eq("category_id", filter.categoryId);
    if (filter.query?.trim()) {
      const value = filter.query.trim().replace(/[%(),]/g, " ");
      query = query.or(`slug.ilike.%${value}%,short_name.ilike.%${value}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as DatabaseCalculator[];
  }

  async listPublicPreviews(): Promise<DatabaseCalculatorPreview[]> {
    const { data, error } = await client().rpc("list_public_calculator_previews");
    if (!error && data) return data as DatabaseCalculatorPreview[];
    const result = await client().from("calculators").select("id,slug,short_name,name,description,specialty_id,category_id,status,version,updated_at").eq("status", "published").order("updated_at", { ascending: false });
    if (result.error) throw result.error;
    return (result.data ?? []) as DatabaseCalculatorPreview[];
  }

  async findById(id: string, publicOnly = false): Promise<DatabaseCalculator | null> {
    let query = client().from("calculators").select(calculatorDetailColumns).eq("id", id);
    if (publicOnly) query = query.eq("status", "published");
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data as DatabaseCalculator | null) ?? null;
  }

  async findBySlug(slug: string, publicOnly = false): Promise<DatabaseCalculator | null> {
    let query = client().from("calculators").select(calculatorDetailColumns).eq("slug", slug);
    if (publicOnly) query = query.eq("status", "published");
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data as DatabaseCalculator | null) ?? null;
  }

  async create(input: CalculatorInsert): Promise<DatabaseCalculator> {
    const { data, error } = await client().from("calculators").insert(input).select(calculatorDetailColumns).single();
    if (error) throw error;
    return data as DatabaseCalculator;
  }

  async update(id: string, input: CalculatorUpdate): Promise<DatabaseCalculator> {
    const { data, error } = await client().from("calculators").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id).select(calculatorDetailColumns).single();
    if (error) throw error;
    return data as DatabaseCalculator;
  }

  async deleteDraft(id: string): Promise<void> {
    const { error } = await client().from("calculators").delete().eq("id", id).eq("status", "draft").is("published_at", null);
    if (error) throw error;
  }

  async countDeleteDependencies(calculatorId: string): Promise<{ guidelineReferences: number; recommendationRelations: number }> {
    const [guideline, recommendation] = await Promise.all([
      client().from("calculator_guideline_references").select("id", { count: "exact", head: true }).eq("calculator_id", calculatorId),
      client().from("recommendation_calculator_references").select("id", { count: "exact", head: true }).eq("calculator_id", calculatorId),
    ]);
    if (guideline.error) throw guideline.error;
    if (recommendation.error) throw recommendation.error;
    return { guidelineReferences: guideline.count || 0, recommendationRelations: recommendation.count || 0 };
  }

  async deletePermanently(id: string): Promise<void> {
    const { error } = await client().from("calculators").delete().eq("id", id).in("status", ["draft", "archived"]);
    if (error) throw error;
  }

  async listGuidelineReferences(calculatorId: string, publicOnly = false): Promise<CalculatorGuidelineReferenceRow[]> {
    if (publicOnly && !(await this.findById(calculatorId, true))) return [];
    let query = client().from("calculator_guideline_references").select(calculatorGuidelineReferenceColumns).eq("calculator_id", calculatorId).order("display_order", { ascending: true });
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as CalculatorGuidelineReferenceRow[];
  }

  async listAllGuidelineReferences(): Promise<CalculatorGuidelineReferenceRow[]> {
    const { data, error } = await client().from("calculator_guideline_references").select(calculatorGuidelineReferenceColumns).order("display_order", { ascending: true }).limit(1000);
    if (error) throw error;
    return (data ?? []) as CalculatorGuidelineReferenceRow[];
  }

  async listPublishedGuidelineReferencesForGuideline(guidelineId: string): Promise<CalculatorGuidelineReferenceRow[]> {
    const { data, error } = await client()
      .from("calculator_guideline_references")
      .select(`${calculatorGuidelineReferenceColumns}, calculators!inner(status)`)
      .eq("guideline_id", guidelineId)
      .eq("calculators.status", "published")
      .order("display_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CalculatorGuidelineReferenceRow[];
  }

  async createGuidelineReference(input: Omit<CalculatorGuidelineReferenceRow, "id" | "created_at" | "updated_at">): Promise<CalculatorGuidelineReferenceRow> {
    const { data, error } = await client().from("calculator_guideline_references").insert(input).select(calculatorGuidelineReferenceColumns).single();
    if (error) throw error;
    return data as CalculatorGuidelineReferenceRow;
  }

  async updateGuidelineReference(id: string, input: Partial<Omit<CalculatorGuidelineReferenceRow, "id" | "created_at" | "updated_at" | "owner_id">>): Promise<CalculatorGuidelineReferenceRow> {
    const { data, error } = await client().from("calculator_guideline_references").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id).select(calculatorGuidelineReferenceColumns).single();
    if (error) throw error;
    return data as CalculatorGuidelineReferenceRow;
  }

  async deleteGuidelineReference(id: string): Promise<void> {
    const { error } = await client().from("calculator_guideline_references").delete().eq("id", id);
    if (error) throw error;
  }

  async findGuidelineSection(id: string): Promise<GuidelineSectionTarget | null> {
    const { data, error } = await client().from("guideline_sections").select("id, guideline_id, status, slug, title, title_vi").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as GuidelineSectionTarget | null) ?? null;
  }

  async listGuidelineDocuments(): Promise<GuidelineDocumentTarget[]> {
    const { data, error } = await client().from("guideline_documents").select("id, title, society, publication_year, visibility, status").order("title");
    if (error) throw error;
    return (data ?? []) as GuidelineDocumentTarget[];
  }

  async listGuidelineSections(): Promise<GuidelineSectionTarget[]> {
    const { data, error } = await client().from("guideline_sections").select("id, guideline_id, status, slug, title, title_vi").order("display_order");
    if (error) throw error;
    return (data ?? []) as GuidelineSectionTarget[];
  }

  async listGuidelineRecommendations(): Promise<GuidelineRecommendationTarget[]> {
    const { data, error } = await client().from("guideline_recommendations").select("id, guideline_id, section_id, status, verification_status, title, recommendation_text_vi, recommendation_text_original").order("sort_order");
    if (error) throw error;
    return (data ?? []) as GuidelineRecommendationTarget[];
  }

  async findGuidelineRecommendation(id: string): Promise<GuidelineRecommendationTarget | null> {
    const { data, error } = await client().from("guideline_recommendations").select("id, guideline_id, section_id, status, verification_status, title, recommendation_text_vi, recommendation_text_original").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as GuidelineRecommendationTarget | null) ?? null;
  }
}

export const calculatorRepository = new CalculatorRepository();
