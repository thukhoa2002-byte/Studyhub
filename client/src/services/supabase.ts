import { createClient } from "@supabase/supabase-js";
import type { GeneratedQuestion } from "./api";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const CARD_METADATA_PREFIX = "__hocbai_card_v1__:";

function encodeCardCategory(question: GeneratedQuestion): string {
  if (!question.options?.length && !question.correctOption && !question.explanation) {
    return question.category || "Anki";
  }
  return `${CARD_METADATA_PREFIX}${JSON.stringify({
    category: question.category || "Trắc nghiệm",
    importance: question.importance || 1,
    options: question.options || [],
    correctOption: question.correctOption || question.answer,
    explanation: question.explanation || "",
  })}`;
}

function decodeCardCategory(value: string | null | undefined): Partial<GeneratedQuestion> & { category: string } {
  if (!value?.startsWith(CARD_METADATA_PREFIX)) return { category: value || "Anki" };
  try {
    const metadata = JSON.parse(value.slice(CARD_METADATA_PREFIX.length)) as {
      category?: string;
      importance?: number;
      options?: string[];
      correctOption?: string;
      explanation?: string;
    };
    return {
      category: metadata.category || "Trắc nghiệm",
      importance: metadata.importance || 1,
      options: Array.isArray(metadata.options) ? metadata.options : undefined,
      correctOption: metadata.correctOption,
      explanation: metadata.explanation,
    };
  } catch {
    return { category: "Trắc nghiệm" };
  }
}

export interface SavedDeck {
  id: string;
  title: string;
  visibility: "private" | "shared";
  owner_id: string;
  cards: GeneratedQuestion[];
  member_role?: "admin" | "member";
  member_access?: "edit" | "view";
  review_stats: {
    new: number;
    learning: number;
    due: number;
  };
}

export interface DeckMember {
  user_id: string | null;
  email: string;
  role: "admin" | "member";
  access: "edit" | "view";
  is_owner: boolean;
}

export interface DeckActivityNotification {
  id: string;
  deck_id: string;
  deck_title: string;
  actor_label: string;
  created_at: string;
}

export async function getDeckNotificationsEnabled(userId: string): Promise<boolean> {
  if (!supabase) return true;
  const { data, error } = await supabase.from("deck_notification_preferences").select("enabled").eq("user_id", userId).maybeSingle();
  if (error) {
    if (/deck_notification_preferences|schema cache/i.test(error.message)) return true;
    throw error;
  }
  return data?.enabled !== false;
}

export async function setDeckNotificationsEnabled(userId: string, enabled: boolean) {
  if (!supabase) return;
  const { error } = await supabase.from("deck_notification_preferences").upsert({ user_id: userId, enabled, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function listDeckActivityNotifications(userId: string): Promise<DeckActivityNotification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("deck_activity_notifications")
    .select("id, deck_id, actor_label, created_at, decks(title)")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    if (/deck_activity_notifications|schema cache/i.test(error.message)) return [];
    throw error;
  }
  const ids = (data ?? []).map((item) => item.id);
  if (ids.length === 0) return [];
  const { data: reads, error: readsError } = await supabase.from("deck_activity_notification_reads").select("notification_id").eq("user_id", userId).in("notification_id", ids);
  if (readsError) throw readsError;
  const readIds = new Set((reads ?? []).map((item) => item.notification_id));
  return (data ?? []).filter((item) => !readIds.has(item.id)).map((item) => ({
    id: item.id,
    deck_id: item.deck_id,
    deck_title: Array.isArray(item.decks) ? item.decks[0]?.title ?? "Bộ thẻ chung" : (item.decks as { title?: string } | null)?.title ?? "Bộ thẻ chung",
    actor_label: item.actor_label || "Một thành viên",
    created_at: item.created_at,
  }));
}

export async function dismissDeckActivityNotification(userId: string, notificationId: string) {
  if (!supabase) return;
  const { error } = await supabase.from("deck_activity_notification_reads").upsert({ user_id: userId, notification_id: notificationId, read_at: new Date().toISOString() });
  if (error) throw error;
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
    .insert({ title, owner_id: userId, visibility: shareEmails.length > 0 ? "shared" : "private", source: "web" })
    .select("id, title, visibility, owner_id")
    .single();

  if (deckError) throw deckError;

  const { error: cardsError } = await supabase.from("cards").insert(
    questions.map((question, position) => ({
      deck_id: deck.id,
      front: question.question,
      back: question.answer,
      category: encodeCardCategory(question),
      position,
    }))
  );

  if (cardsError) {
    // Do not leave an empty/orphaned deck behind when card insertion fails.
    await supabase.from("decks").delete().eq("id", deck.id).eq("owner_id", userId);
    throw cardsError;
  }
  for (const email of shareEmails) {
    const { error } = await supabase.rpc("share_deck_with_email", { p_deck_id: deck.id, p_email: email });
    if (error) throw error;
  }
  return deck;
}

export async function listDecks(_userId: string): Promise<SavedDeck[]> {
  if (!supabase) return [];

  // Nhận các lời mời đã được gửi trước khi tài khoản này đăng nhập.
  const { error: claimError } = await supabase.rpc("claim_pending_deck_shares");
  if (claimError) console.warn("Pending deck shares are not available yet", claimError.message);

  let { data, error } = await supabase
    .from("decks")
    .select("id, title, visibility, owner_id, cards(id, front, back, category, position, scope, personal_owner_id, creator_label)")
    .order("created_at", { ascending: false });

  // The creator label was added after personal cards. Keep existing projects
  // usable while either migration is still being applied.
  if (error && /creator_label/i.test(error.message)) {
    const fallback = await supabase
      .from("decks")
      .select("id, title, visibility, owner_id, cards(id, front, back, category, position, scope, personal_owner_id)")
      .order("created_at", { ascending: false });
    data = fallback.data?.map((deck) => ({
      ...deck,
      cards: (deck.cards ?? []).map((card) => ({ ...card, creator_label: null })),
    })) ?? null;
    error = fallback.error;
  }
  if (error && /scope|personal_owner_id/i.test(error.message)) {
    const fallback = await supabase
      .from("decks")
      .select("id, title, visibility, owner_id, cards(id, front, back, category, position)")
      .order("created_at", { ascending: false });
    data = fallback.data?.map((deck) => ({
      ...deck,
      cards: (deck.cards ?? []).map((card) => ({
        ...card,
        scope: "shared",
        personal_owner_id: null,
        creator_label: null,
      })),
    })) ?? null;
    error = fallback.error;
  }
  if (error) throw error;

  // Members can read their own membership row through RLS. Owners receive
  // edit access implicitly, while shared members use the stored access mode.
  const { data: memberships } = await supabase
    .from("deck_members")
    .select("deck_id, role, access")
    .eq("user_id", _userId);
  const membershipByDeck = new Map((memberships ?? []).map((item) => [item.deck_id, item]));

  const { data: reviews, error: reviewsError } = await supabase
    .from("card_reviews")
    .select("card_id, due_at")
    .eq("user_id", _userId);
  if (reviewsError) console.warn("Card review status is not available yet", reviewsError.message);
  const reviewByCard = new Map((reviews ?? []).map((review) => [review.card_id, review]));
  const now = Date.now();

  return (data ?? []).map((deck) => {
    const deckCards = [...(deck.cards ?? [])].sort((a, b) => a.position - b.position);
    const reviewStats = deckCards.reduce((stats, card) => {
      const review = reviewByCard.get(card.id);
      if (!review) stats.new += 1;
      else if (new Date(review.due_at).getTime() <= now) stats.due += 1;
      else stats.learning += 1;
      return stats;
    }, { new: 0, learning: 0, due: 0 });

    return {
      id: deck.id,
      title: deck.title,
      visibility: deck.visibility,
      owner_id: deck.owner_id,
      member_role: membershipByDeck.get(deck.id)?.role === "admin" ? "admin" : "member",
      member_access: membershipByDeck.get(deck.id)?.role === "admin" || membershipByDeck.get(deck.id)?.access === "edit" ? "edit" : "view",
      review_stats: reviewStats,
      cards: deckCards.map((card) => {
        const metadata = decodeCardCategory(card.category);
        return {
          id: card.id,
          scope: (card as { scope?: string }).scope === "personal" ? "personal" : "shared",
          creatorLabel: (card as { creator_label?: string | null }).creator_label || undefined,
          question: card.front,
          answer: card.back,
          importance: 1,
          bookmarked: false,
          ...metadata,
        };
      }),
    };
  });
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
  // Sharing is also the deck's visibility state. Keep it in sync so the
  // editor immediately shows "Chia sẻ" after the first invitation.
  const { error: visibilityError } = await supabase
    .from("decks")
    .update({ visibility: "shared", updated_at: new Date().toISOString() })
    .eq("id", deckId);
  if (visibilityError) throw visibilityError;
}

export async function listDeckMembers(deckId: string): Promise<DeckMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("list_deck_members", { p_deck_id: deckId });
  if (error) throw error;
  return (data ?? []).map((member: { user_id?: string | null; email: string; role?: string | null }) => ({
    user_id: member.user_id ?? null,
    email: member.email,
    role: member.role === "admin" ? "admin" : "member",
    access: member.role === "admin" || (member as { access?: string | null }).access === "edit" ? "edit" : "view",
    is_owner: Boolean((member as { is_owner?: boolean }).is_owner),
  }));
}

export async function removeDeckMember(deckId: string, memberId: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc("remove_deck_share", { p_deck_id: deckId, p_email: memberId });
  if (error) throw error;
}

export async function setDeckMemberRole(deckId: string, memberId: string, role: "admin" | "member") {
  if (!supabase) return;
  const { error } = await supabase.rpc("set_deck_member_role", {
    p_deck_id: deckId,
    p_user_id: memberId,
    p_role: role,
  });
  if (error) throw error;
}

export async function setDeckMemberAccess(deckId: string, memberId: string, access: "edit" | "view") {
  if (!supabase) return;
  const { error } = await supabase.rpc("set_deck_member_access", {
    p_deck_id: deckId,
    p_user_id: memberId,
    p_access: access,
  });
  if (error) throw error;
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
    const metadata = decodeCardCategory(card.category);
    return [{ id: card.id, question: card.front, answer: card.back, importance: 1, bookmarked: false, ...metadata }];
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
  const { error: deckError } = await supabase.from("decks").update({ title, visibility, updated_at: new Date().toISOString() }).eq("id", deckId);
  if (deckError) throw deckError;

  // Keep existing card IDs stable. Review schedules belong to (user_id,
  // card_id), so replacing every card here would erase every member's
  // personal learning history whenever a shared deck is edited.
  const { data: existingCards, error: existingCardsError } = await supabase
    .from("cards")
    .select("id")
    .eq("deck_id", deckId);
  if (existingCardsError) throw existingCardsError;

  const existingIds = new Set((existingCards ?? []).map((card) => card.id));
  const retainedIds = new Set<string>();
  const newCards: Array<{ id?: string; deck_id: string; front: string; back: string; category: string; position: number; scope?: "personal"; personal_owner_id?: string; creator_label?: string }> = [];

  for (const [position, question] of questions.entries()) {
    const card = { front: question.question, back: question.answer, category: encodeCardCategory(question), position };
    if (existingIds.has(question.id)) {
      retainedIds.add(question.id);
      const { error } = await supabase.from("cards").update(card).eq("deck_id", deckId).eq("id", question.id);
      if (error) throw error;
    } else {
      newCards.push({
        ...(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(question.id) ? { id: question.id } : {}),
        deck_id: deckId,
        ...card,
        ...(question.creatorLabel ? { creator_label: question.creatorLabel } : {}),
        ...(question.scope === "personal" ? { scope: "personal" as const, personal_owner_id: userId } : {}),
      });
    }
  }

  const removedIds = [...existingIds].filter((id) => !retainedIds.has(id));
  if (removedIds.length > 0) {
    const { error } = await supabase.from("cards").delete().eq("deck_id", deckId).in("id", removedIds);
    if (error) throw error;
  }
  if (newCards.length > 0) {
    const { error } = await supabase.from("cards").insert(newCards);
    if (error) throw error;
  }
}

export async function appendCardsToDeck(
  userId: string,
  deckId: string,
  questions: GeneratedQuestion[]
): Promise<GeneratedQuestion[]> {
  if (!supabase) return questions;

  const validQuestions = questions.filter((question) => question.question.trim() && question.answer.trim());
  if (validQuestions.length === 0) throw new Error("Không có câu hỏi hợp lệ để thêm.");

  const { data: lastCards, error: positionError } = await supabase
    .from("cards")
    .select("position")
    .eq("deck_id", deckId)
    .order("position", { ascending: false })
    .limit(1);
  if (positionError) throw positionError;

  const firstPosition = (lastCards?.[0]?.position ?? -1) + 1;
  const cardsWithStableIds = validQuestions.map((question) => ({
    ...question,
    id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(question.id)
      ? question.id
      : crypto.randomUUID(),
  }));

  // This operation is intentionally insert-only. Reusing updateDeck here used
  // to rewrite every old card and could report a duplicate-key error after the
  // new AI cards had already been saved. Stable IDs + ignoreDuplicates also
  // make a repeated click safe.
  const { error } = await supabase.from("cards").upsert(
    cardsWithStableIds.map((question, index) => ({
      id: question.id,
      deck_id: deckId,
      front: question.question,
      back: question.answer,
      category: encodeCardCategory(question),
      position: firstPosition + index,
      ...(question.scope === "personal" ? { scope: "personal", personal_owner_id: userId } : {}),
    })),
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) throw error;

  return cardsWithStableIds;
}

export async function deleteDeck(userId: string, deckId: string) {
  if (!supabase) return;
  const { error } = await supabase.from("decks").delete().eq("id", deckId).eq("owner_id", userId);
  if (error) throw error;
}
