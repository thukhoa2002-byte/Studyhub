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
  visibility: "private" | "shared" = "private"
) {
  if (!supabase) return null;

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({ title, owner_id: userId, visibility, source: "web" })
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
  return deck;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function listDecks(userId: string): Promise<SavedDeck[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("decks")
    .select("id, title, visibility, owner_id, cards(id, front, back, category, position)")
    .or(`owner_id.eq.${userId},visibility.eq.shared`)
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

  await supabase.from("card_reviews").upsert({
    user_id: userId,
    card_id: card.id,
    rating,
    last_reviewed_at: new Date().toISOString(),
    due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
