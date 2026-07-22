import { supabase } from "./supabase";

export interface ReferenceFormula {
  id: string;
  owner_id: string;
  title: string;
  usage: string;
  formula_html: string;
  status: "private" | "shared";
  created_at: string;
  updated_at: string;
}

function client() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  return supabase;
}

export async function listReferenceFormulas(): Promise<ReferenceFormula[]> {
  const { data, error } = await client().from("reference_formulas").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ReferenceFormula[];
}

export async function saveReferenceFormula(
  ownerId: string,
  input: Pick<ReferenceFormula, "title" | "usage" | "formula_html" | "status">,
  formulaId?: string,
): Promise<ReferenceFormula> {
  const payload = {
    title: input.title.trim(),
    usage: input.usage.trim(),
    formula_html: input.formula_html,
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  const query = client();
  if (formulaId) {
    const { data, error } = await query.from("reference_formulas").update(payload).eq("id", formulaId).select("*").single();
    if (error) throw error;
    return data as ReferenceFormula;
  }
  const { data, error } = await query.from("reference_formulas").insert({ owner_id: ownerId, ...payload }).select("*").single();
  if (error) throw error;
  return data as ReferenceFormula;
}

export async function deleteReferenceFormula(formulaId: string): Promise<void> {
  const { error } = await client().from("reference_formulas").delete().eq("id", formulaId);
  if (error) throw error;
}
