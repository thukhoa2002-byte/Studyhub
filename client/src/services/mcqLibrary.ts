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
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

function requireSupabase() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  return supabase;
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
    owner_id: userId,
    title: input.title.trim(),
    description: input.description.trim(),
    questions: storedQuestions,
    status: input.status,
    updated_at: now,
    published_at: input.status === "published" ? now : null,
  };
  const request = bankId
    ? client.from("mcq_banks").update(payload).eq("id", bankId).select("*").single()
    : client.from("mcq_banks").insert({ id: targetId, ...payload }).select("*").single();
  const { data, error } = await request;
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
