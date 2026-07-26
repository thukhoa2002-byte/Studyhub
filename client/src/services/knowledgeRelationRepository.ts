import { supabase } from "./supabase.ts";

export type DrugRecommendationRelationType = "recommended" | "alternative" | "contraindicated" | "caution" | "dose_adjustment" | "monitoring" | "interaction" | "mentioned" | "supporting_therapy";
export type CalculatorRecommendationRelationType = "risk_stratification" | "diagnostic_support" | "severity_assessment" | "treatment_decision" | "dose_calculation" | "prognosis" | "monitoring" | "classification" | "mentioned";
export type KnowledgeRelationStatus = "active" | "archived";

export interface RelationMetadata {
  context_text: string;
  source_location: string;
  display_order: number;
  status: KnowledgeRelationStatus;
}

export interface RecommendationDrugRelation extends RelationMetadata {
  id: string;
  recommendation_id: string;
  drug_id: string;
  relation_type: DrugRecommendationRelationType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecommendationCalculatorRelation extends RelationMetadata {
  id: string;
  recommendation_id: string;
  calculator_id: string;
  relation_type: CalculatorRecommendationRelationType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function client() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  return supabase;
}

const drugRelationColumns = "id,recommendation_id,drug_id,relation_type,context_text,source_location,display_order,status,created_by,created_at,updated_at";
const calculatorRelationColumns = "id,recommendation_id,calculator_id,relation_type,context_text,source_location,display_order,status,created_by,created_at,updated_at";

export class KnowledgeRelationRepository {
  async listDrugRelationsForRecommendation(recommendationId: string): Promise<RecommendationDrugRelation[]> {
    const { data, error } = await client().from("recommendation_drug_references").select(drugRelationColumns).eq("recommendation_id", recommendationId).order("display_order");
    if (error) throw error;
    return (data ?? []) as RecommendationDrugRelation[];
  }

  async listCalculatorRelationsForRecommendation(recommendationId: string): Promise<RecommendationCalculatorRelation[]> {
    const { data, error } = await client().from("recommendation_calculator_references").select(calculatorRelationColumns).eq("recommendation_id", recommendationId).order("display_order");
    if (error) throw error;
    return (data ?? []) as RecommendationCalculatorRelation[];
  }

  async listDrugRelationsForDrug(drugId: string): Promise<RecommendationDrugRelation[]> {
    const { data, error } = await client().from("recommendation_drug_references").select(drugRelationColumns).eq("drug_id", drugId).order("display_order");
    if (error) throw error;
    return (data ?? []) as RecommendationDrugRelation[];
  }

  async listCalculatorRelationsForCalculator(calculatorId: string): Promise<RecommendationCalculatorRelation[]> {
    const { data, error } = await client().from("recommendation_calculator_references").select(calculatorRelationColumns).eq("calculator_id", calculatorId).order("display_order");
    if (error) throw error;
    return (data ?? []) as RecommendationCalculatorRelation[];
  }

  async createDrugRelation(input: Omit<RecommendationDrugRelation, "id" | "created_at" | "updated_at">): Promise<RecommendationDrugRelation> {
    const { data, error } = await client().from("recommendation_drug_references").insert(input).select(drugRelationColumns).single();
    if (error) throw error;
    return data as RecommendationDrugRelation;
  }

  async createCalculatorRelation(input: Omit<RecommendationCalculatorRelation, "id" | "created_at" | "updated_at">): Promise<RecommendationCalculatorRelation> {
    const { data, error } = await client().from("recommendation_calculator_references").insert(input).select(calculatorRelationColumns).single();
    if (error) throw error;
    return data as RecommendationCalculatorRelation;
  }

  async updateDrugRelation(id: string, patch: Partial<RelationMetadata & Pick<RecommendationDrugRelation, "relation_type">>): Promise<RecommendationDrugRelation> {
    const { data, error } = await client().from("recommendation_drug_references").update(patch).eq("id", id).select(drugRelationColumns).single();
    if (error) throw error;
    return data as RecommendationDrugRelation;
  }

  async updateCalculatorRelation(id: string, patch: Partial<RelationMetadata & Pick<RecommendationCalculatorRelation, "relation_type">>): Promise<RecommendationCalculatorRelation> {
    const { data, error } = await client().from("recommendation_calculator_references").update(patch).eq("id", id).select(calculatorRelationColumns).single();
    if (error) throw error;
    return data as RecommendationCalculatorRelation;
  }

  async deleteDrugRelation(id: string): Promise<void> { const { error } = await client().from("recommendation_drug_references").delete().eq("id", id); if (error) throw error; }
  async deleteCalculatorRelation(id: string): Promise<void> { const { error } = await client().from("recommendation_calculator_references").delete().eq("id", id); if (error) throw error; }
}

export const knowledgeRelationRepository = new KnowledgeRelationRepository();
