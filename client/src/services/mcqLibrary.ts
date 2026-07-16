import { supabase } from "./supabase";

export type McqOption = { id: "A" | "B" | "C" | "D"; text: string };
export type McqLibraryQuestion = {
  id: string;
  source_number: number;
  question: string;
  options: McqOption[];
  correct_answer?: string;
  image_url?: string;
  image_alt?: string;
  review_note?: string;
};

export interface McqLibraryBank {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  questions: McqLibraryQuestion[];
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export type McqBankState = Pick<McqLibraryBank, "id" | "status">;
export type McqAdminAccess = { email: string; is_owner: boolean; created_at: string | null };

export function mcqLibraryErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const candidate = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [candidate.message, candidate.details, candidate.hint]
      .filter((part): part is string => typeof part === "string" && Boolean(part.trim()));
    if (parts.length) return parts.join(" — ");
    if (typeof candidate.code === "string") return `${fallback} (mã ${candidate.code})`;
  }
  return fallback;
}

function requireSupabase() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  return supabase;
}

export async function hasMcqAdminAccess(): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc("is_mcq_admin");
  if (error) {
    if (/is_mcq_admin|schema cache/i.test(error.message)) return false;
    throw error;
  }
  return data === true;
}

export async function listMcqAdmins(): Promise<McqAdminAccess[]> {
  const { data, error } = await requireSupabase().rpc("list_mcq_admins");
  if (error) throw error;
  return (data ?? []) as McqAdminAccess[];
}

export async function addMcqAdmin(email: string): Promise<void> {
  const { error } = await requireSupabase().rpc("add_mcq_admin", { p_email: email });
  if (error) throw error;
}

export async function removeMcqAdmin(email: string): Promise<void> {
  const { error } = await requireSupabase().rpc("remove_mcq_admin", { p_email: email });
  if (error) throw error;
}

export async function listMcqBanks(): Promise<McqLibraryBank[]> {
  const { data, error } = await requireSupabase()
    .from("mcq_banks")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    if (/mcq_banks|schema cache/i.test(error.message)) return [];
    throw error;
  }
  return (data ?? []) as McqLibraryBank[];
}

export async function listMcqBankStates(): Promise<McqBankState[]> {
  const { data, error } = await requireSupabase().rpc("list_mcq_bank_states");
  if (error) {
    if (/list_mcq_bank_states|schema cache/i.test(error.message)) return [];
    throw error;
  }
  return (data ?? []) as McqBankState[];
}

export async function saveMcqBank(
  userId: string,
  input: Pick<McqLibraryBank, "title" | "description" | "questions" | "status">,
  bankId?: string,
): Promise<McqLibraryBank> {
  const client = requireSupabase();
  const now = new Date().toISOString();
  const targetId = bankId || crypto.randomUUID();
  const storedQuestions: McqLibraryQuestion[] = [];
  for (const question of input.questions) {
    if (!question.image_url?.startsWith("data:image/")) {
      storedQuestions.push(question);
      continue;
    }
    const imageBlob = await fetch(question.image_url).then((response) => response.blob());
    const extension = imageBlob.type === "image/jpeg" ? "jpg" : imageBlob.type === "image/webp" ? "webp" : "png";
    const imagePath = `${userId}/${targetId}/${question.id}.${extension}`;
    const { error: uploadError } = await client.storage.from("mcq-assets").upload(imagePath, imageBlob, {
      contentType: imageBlob.type || `image/${extension}`,
      upsert: true,
    });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = client.storage.from("mcq-assets").getPublicUrl(imagePath);
    storedQuestions.push({ ...question, image_url: publicUrl.publicUrl });
  }
  const payload = {
    title: input.title.trim(),
    description: input.description.trim(),
    questions: storedQuestions,
    status: input.status,
    updated_at: now,
    published_at: input.status === "published" ? now : null,
  };
  if (bankId) {
    // Updating first avoids PostgREST upsert requiring both INSERT and UPDATE
    // policies for a bank that already exists.
    const { data: updated, error: updateError } = await client
      .from("mcq_banks")
      .update(payload)
      .eq("id", targetId)
      .select("*")
      .maybeSingle();
    if (updateError) throw updateError;
    if (updated) return updated as McqLibraryBank;
  }

  const { data, error } = await client
    .from("mcq_banks")
    .insert({ id: targetId, owner_id: userId, ...payload })
    .select("*")
    .single();
  if (error) throw error;
  return data as McqLibraryBank;
}

export async function deleteMcqBank(bankId: string): Promise<void> {
  const client = requireSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (user) {
    const folder = `${user.id}/${bankId}`;
    const { data: files } = await client.storage.from("mcq-assets").list(folder);
    if (files?.length) await client.storage.from("mcq-assets").remove(files.map((file) => `${folder}/${file.name}`));
  }
  const { error } = await client.from("mcq_banks").delete().eq("id", bankId);
  if (error) throw error;
}

export async function archiveMcqBank(userId: string, bankId: string, title: string): Promise<void> {
  const now = new Date().toISOString();
  const client = requireSupabase();
  const archived = {
    title: title.trim() || "Bộ MCQ đã xóa",
    description: "",
    questions: [],
    status: "archived",
    updated_at: now,
    published_at: null,
  };
  const { data: updated, error: updateError } = await client
    .from("mcq_banks")
    .update(archived)
    .eq("id", bankId)
    .select("id")
    .maybeSingle();
  if (updateError) throw updateError;
  if (updated) return;

  const { error: insertError } = await client.from("mcq_banks").insert({
    id: bankId,
    owner_id: userId,
    ...archived,
  });
  if (insertError) throw insertError;
}
