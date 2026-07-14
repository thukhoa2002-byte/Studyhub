import { createClient } from "@supabase/supabase-js";
import type { GeneratedQuestion } from "./api";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export interface SavedDeck {
  id: string;
  title: string;
  visibility: "private" | "shared";
  owner_id: string;
  cards: GeneratedQuestion[];
}

export async function saveDeck(
  userId: string,
  title: string,
  questions: GeneratedQuestion[],
  shareEmails: string[] = []
) {
  if (!supabase) return null;

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({ title, owner_id: userId, visibility: "private", source: "web" })
    .select("id, title, visibility, owner_id")
    .single();

  if (deckError) throw deckError;

  const { error: cardsError } = await supabase.from("cards").insert(
    questions.map((question, position) => ({
      ...(isUuid(question.id) ? { id: question.id } : {}),
      deck_id: deck.id,
      front: question.question,
      back: question.answer,
      category: question.category,
      position,
    }))
  );

  if (cardsError) throw cardsError;
  for (const email of shareEmails) {
    const { error } = await supabase.rpc("share_deck_with_email", { p_deck_id: deck.id, p_email: email });
    if (error) throw error;
  }
  return deck;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function listDecks(_userId: string): Promise<SavedDeck[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("decks")
    .select("id, title, visibility, owner_id, cards(id, front, back, category, position)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((deck) => ({
    id: deck.id,
    title: deck.title,
    visibility: deck.visibility,
    owner_id: deck.owner_id,
    cards: [...(deck.cards ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((card) => ({
        id: card.id,
        question: card.front,
        answer: card.back,
        category: card.category ?? "Anki",
        importance: 1,
        bookmarked: false,
      })),
  }));
}

export async function saveReview(
  userId: string,
  question: GeneratedQuestion,
  rating: number
) {
  if (!supabase) return;
  const { data: card } = await supabase
    .from("cards")
    .select("id")
    .eq("id", question.id)
    .maybeSingle();
  if (!card) return;

  const intervalMs = { 1: 10 * 60 * 1000, 2: 24 * 60 * 60 * 1000, 3: 3 * 24 * 60 * 60 * 1000, 4: 7 * 24 * 60 * 60 * 1000 }[rating] ?? 24 * 60 * 60 * 1000;
  await supabase.from("card_reviews").upsert({
    user_id: userId,
    card_id: card.id,
    rating,
    last_reviewed_at: new Date().toISOString(),
    due_at: new Date(Date.now() + intervalMs).toISOString(),
  });
}

export async function shareDeckWithEmails(deckId: string, emails: string[]) {
  if (!supabase) return;
  for (const email of emails) {
    const { error } = await supabase.rpc("share_deck_with_email", { p_deck_id: deckId, p_email: email });
    if (error) throw error;
  }
}

export async function listDueCards(userId: string): Promise<GeneratedQuestion[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("card_reviews")
    .select("card_id, cards(id, front, back, category)")
    .eq("user_id", userId)
    .lte("due_at", new Date().toISOString());
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const card = Array.isArray(row.cards) ? row.cards[0] : row.cards;
    if (!card) return [];
    return [{ id: card.id, question: card.front, answer: card.back, category: card.category ?? "Ôn tập", importance: 1, bookmarked: false }];
  });
}

export async function updateDeck(
  userId: string,
  deckId: string,
  title: string,
  questions: GeneratedQuestion[],
  visibility: "private" | "shared"
) {
  if (!supabase) return;
  const { error: deckError } = await supabase.from("decks").update({ title, visibility, updated_at: new Date().toISOString() }).eq("id", deckId).eq("owner_id", userId);
  if (deckError) throw deckError;
  const { error: deleteError } = await supabase.from("cards").delete().eq("deck_id", deckId);
  if (deleteError) throw deleteError;
  const { error: cardsError } = await supabase.from("cards").insert(questions.map((question, position) => ({ ...(isUuid(question.id) ? { id: question.id } : {}), deck_id: deckId, front: question.question, back: question.answer, category: question.category, position })));
  if (cardsError) throw cardsError;
}

export async function deleteDeck(userId: string, deckId: string) {
  if (!supabase) return;
  const { error } = await supabase.from("decks").delete().eq("id", deckId).eq("owner_id", userId);
  if (error) throw error;
}
