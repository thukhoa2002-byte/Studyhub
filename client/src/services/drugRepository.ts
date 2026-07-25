import { supabase } from "./supabase.ts";
import type { Drug, DrugStatus } from "../types/drug.ts";

export interface DatabaseDrug {
  id: string;
  owner_id: string | null;
  slug: string;
  generic_name: string;
  title_vi: string;
  content: Partial<Drug>;
  drug_class: string;
  specialties: string[];
  status: DrugStatus;
  source_verified: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_by: string | null;
  published_at: string | null;
  archived_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseDrugPreview {
  id: string;
  slug: string;
  generic_name: string;
  title_vi: string;
  drug_class: string;
  specialties: string[];
  status: "published";
  published_at: string | null;
}

function client() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  return supabase;
}

export class DrugRepository {
  async list(options: { query?: string; status?: DrugStatus; publishedOnly?: boolean } = {}): Promise<DatabaseDrug[]> {
    let query = client().from("drugs").select("*").order("updated_at", { ascending: false });
    if (options.publishedOnly) query = query.eq("status", "published");
    if (options.status) query = query.eq("status", options.status);
    if (options.query?.trim()) {
      const value = options.query.trim().replace(/[%(),]/g, " ");
      query = query.or(`slug.ilike.%${value}%,generic_name.ilike.%${value}%,title_vi.ilike.%${value}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as DatabaseDrug[];
  }

  async listPublicPreviews(): Promise<DatabaseDrugPreview[]> {
    const { data, error } = await client().rpc("list_public_drug_previews");
    if (error) throw error;
    return (data ?? []) as DatabaseDrugPreview[];
  }

  async findById(id: string): Promise<DatabaseDrug | null> {
    const { data, error } = await client().from("drugs").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as DatabaseDrug | null;
  }

  async findBySlug(slug: string, publishedOnly = false): Promise<DatabaseDrug | null> {
    let query = client().from("drugs").select("*").eq("slug", slug);
    if (publishedOnly) query = query.eq("status", "published");
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data as DatabaseDrug | null;
  }

  async create(input: Omit<DatabaseDrug, "id" | "created_at" | "updated_at">): Promise<DatabaseDrug> {
    const { data, error } = await client().from("drugs").insert(input).select("*").single();
    if (error) throw error;
    return data as DatabaseDrug;
  }

  async update(id: string, input: Partial<Omit<DatabaseDrug, "id" | "owner_id" | "created_at" | "updated_at">>): Promise<DatabaseDrug> {
    const { data, error } = await client().from("drugs").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (error) throw error;
    return data as DatabaseDrug;
  }

  async deleteDraft(id: string): Promise<void> {
    const { error } = await client().from("drugs").delete().eq("id", id).eq("status", "draft").is("published_at", null);
    if (error) throw error;
  }

  async countRecommendationRelations(drugId: string): Promise<number> {
    const { count, error } = await client().from("recommendation_drug_references").select("id", { count: "exact", head: true }).eq("drug_id", drugId);
    if (error) throw error;
    return count || 0;
  }

  async deletePermanently(id: string): Promise<void> {
    const { error } = await client().from("drugs").delete().eq("id", id).in("status", ["draft", "archived"]);
    if (error) throw error;
  }
}

export const drugRepository = new DrugRepository();
