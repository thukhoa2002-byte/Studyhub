import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import Header from "./components/Header";
import Navbar from "./components/Navbar";
import DeckSetup from "./components/DeckSetup";
import Study from "./components/Study";
import Review from "./components/Review";
import DeckEditor from "./components/DeckEditor";
import ShareDeckDialog from "./components/ShareDeckDialog";
import LoadingOverlay from "./components/LoadingOverlay";
import { deleteDeck, listDecks, listDueCards, saveDeck, saveReview, shareDeckWithEmails, supabase, updateDeck, type SavedDeck } from "./services/supabase";

import {
  generateQuestions,
  importAnkiPackage,
  type GeneratedQuestion,
} from "./services/api";

export default function App() {
  const [mode, setMode] = useState<"study" | "review">("study");

  const [deckTitle, setDeckTitle] = useState("");

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [loading, setLoading] = useState(false);

  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [editing, setEditing] = useState(false);
  const [currentSavedDeck, setCurrentSavedDeck] = useState<SavedDeck | null>(null);
  const [sharingDeck, setSharingDeck] = useState<SavedDeck | null>(null);

  const refreshDecks = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    if (!nextUser || !supabase) {
      setSavedDecks([]);
      return;
    }
    try {
      setSavedDecks(await listDecks(nextUser.id));
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => refreshDecks(data.user));
  }, [refreshDecks]);

  async function persistDeck(title: string, cards: GeneratedQuestion[], shareEmails: string[] = []) {
    if (!user || !supabase) return;
    try {
      const saved = await saveDeck(user.id, title, cards, shareEmails);
      if (saved) setCurrentSavedDeck({ ...saved, visibility: "private", cards });
      setSavedDecks(await listDecks(user.id));
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? error.message : JSON.stringify(error);
      alert(`Chưa lưu được bộ thẻ: ${detail}`);
    }
  }

  function onImageChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  async function onGenerate() {
    if (!image) return;

    try {
      setLoading(true);

      const response = await generateQuestions(image);

      setQuestions(response.data);
      setDeckTitle(response.title || image.name);

      setMode("study");
    } catch (error) {
      console.error(error);
      alert("Không thể tạo câu hỏi.");
    } finally {
      setLoading(false);
    }
  }

  async function onImportDeck(file: File) {
    try {
      if (file.name.toLowerCase().endsWith(".apkg")) {
        setLoading(true);

        const response = await importAnkiPackage(file);

        if (response.data.length === 0) {
          alert("File .apkg chưa có thẻ học hợp lệ.");
          return;
        }

        setQuestions(response.data);
        setDeckTitle(response.title || file.name.replace(/\.[^.]+$/, ""));
        setMode("study");
        await persistDeck(response.title || file.name.replace(/\.[^.]+$/, ""), response.data);
        return;
      }

      const text = await file.text();
      const imported = parseDeckText(text);

      if (imported.length === 0) {
        alert("File chưa có thẻ hợp lệ. Mỗi dòng cần có mặt trước và mặt sau.");
        return;
      }

      setQuestions(imported);
      setDeckTitle(file.name.replace(/\.[^.]+$/, ""));
      setMode("study");
      await persistDeck(file.name.replace(/\.[^.]+$/, ""), imported);
    } catch (error) {
      console.error(error);
      alert("Không thể đọc file này.");
    } finally {
      setLoading(false);
    }
  }

  function onCreateDeck(title: string, createdQuestions: GeneratedQuestion[]) {
    setQuestions(createdQuestions);
    setDeckTitle(title);
    setMode("study");
    void persistDeck(title, createdQuestions);
  }

  function onSaveDeck(title: string, cards: GeneratedQuestion[]) {
    void persistDeck(title, cards);
  }

  async function shareSavedDeck(emails: string[]) {
    if (!sharingDeck) return;
    try { await shareDeckWithEmails(sharingDeck.id, emails); setSharingDeck(null); alert("Đã chia sẻ bộ thẻ."); }
    catch (error) { alert(`Không thể chia sẻ: ${error instanceof Error ? error.message : JSON.stringify(error)}`); }
  }

  async function studyDueCards() {
    if (!user) { alert("Bạn cần đăng nhập để xem thẻ đến hạn."); return; }
    try {
      const due = await listDueCards(user.id);
      if (due.length === 0) { alert("Hôm nay chưa có thẻ đến hạn 🌸"); return; }
      setQuestions(due); setDeckTitle("Hôm nay ôn gì nhỉ?"); setMode("study");
    } catch (error) { alert(`Không thể tải thẻ đến hạn: ${error instanceof Error ? error.message : JSON.stringify(error)}`); }
  }

  function openSavedDeck(deck: SavedDeck) {
    setQuestions(deck.cards);
    setDeckTitle(deck.title);
    setMode("study");
    setCurrentSavedDeck(deck);
  }

  function editSavedDeck(deck: SavedDeck) {
    openSavedDeck(deck);
    setEditing(true);
  }

  async function removeSavedDeck(deck: SavedDeck) {
    if (!user || !window.confirm(`Xóa bộ thẻ "${deck.title}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await deleteDeck(user.id, deck.id);
      setSavedDecks(await listDecks(user.id));
      if (currentSavedDeck?.id === deck.id) resetDeck();
    } catch (error) {
      console.error(error);
      alert("Không thể xóa bộ thẻ.");
    }
  }

  async function saveEditedDeck(title: string, cards: GeneratedQuestion[], visibility: "private" | "shared") {
    if (!user || !currentSavedDeck) return;
    try {
      await updateDeck(user.id, currentSavedDeck.id, title, cards, visibility);
      setQuestions(cards); setDeckTitle(title); setEditing(false); setCurrentSavedDeck({ ...currentSavedDeck, title, visibility, cards });
      setSavedDecks(await listDecks(user.id));
    } catch (error) { console.error(error); alert("Không thể lưu thay đổi bộ thẻ."); }
  }

  async function saveEditedDeckAndStudy(title: string, cards: GeneratedQuestion[], visibility: "private" | "shared") {
    await saveEditedDeck(title, cards, visibility);
    setMode("study");
  }

  function resetDeck() {
    setQuestions([]);
    setDeckTitle("");
    setImage(null);
    setPreview("");
    setMode("study");
  }

  function exportDeck() {
    if (questions.length === 0) return;

    const rows = questions
      .map((question) =>
        [question.question, question.answer, question.category]
          .map(toTsvCell)
          .join("\t")
      )
      .join("\n");

    const blob = new Blob([rows], {
      type: "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${toFileName(deckTitle || "anki-deck")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function toggleBookmark(id: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              bookmarked: !q.bookmarked,
            }
          : q
      )
    );
  }

  return (
    <>
      {loading && <LoadingOverlay />}

      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ffe4ef_0,#fff7fb_34%,#eefcf6_100%)]">

        <Header onUserChange={refreshDecks} />

        {questions.length > 0 && (
          <Navbar
            mode={mode}
            setMode={setMode}
            deckTitle={deckTitle}
            onReset={resetDeck}
            onExport={exportDeck}
            onEdit={() => setEditing(true)}
          />
        )}

        {editing && currentSavedDeck ? (
          <DeckEditor title={deckTitle} questions={questions} visibility={currentSavedDeck.visibility} onCancel={() => setEditing(false)} onSave={saveEditedDeck} onSaveAndStudy={saveEditedDeckAndStudy} />
        ) : questions.length === 0 ? (
          <DeckSetup
            preview={preview}
            loading={loading}
            onImageChange={onImageChange}
            onGenerate={onGenerate}
            onImportDeck={onImportDeck}
            onCreateDeck={onCreateDeck}
            onSaveDeck={onSaveDeck}
            savedDecks={savedDecks}
            onOpenDeck={openSavedDeck}
            onEditDeck={editSavedDeck}
            onDeleteDeck={removeSavedDeck}
            onShareDeck={setSharingDeck}
            currentUserId={user?.id}
            onStudyDue={studyDueCards}
          />
        ) : mode === "study" ? (
          <Study
            questions={questions}
            toggleBookmark={toggleBookmark}
            onRate={(question: GeneratedQuestion, rating: number) => { if (user) return saveReview(user.id, question, rating); }}
          />
        ) : (
          <Review
            questions={questions}
            toggleBookmark={toggleBookmark}
          />
        )}

      </main>
      {sharingDeck && <ShareDeckDialog title={sharingDeck.title} onClose={() => setSharingDeck(null)} onShare={shareSavedDeck} />}
    </>
  );
}

function parseDeckText(text: string): GeneratedQuestion[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseDeckLine)
    .filter((question): question is GeneratedQuestion => Boolean(question));
}

function parseDeckLine(line: string): GeneratedQuestion | null {
  const columns = line.includes("\t") ? line.split("\t") : parseCsvLine(line);
  const [front, back, category] = columns.map((column) => cleanCell(column));

  if (front && back) {
    return makeQuestion(front, back, category || "Anki");
  }

  const cloze = parseCloze(front || line);
  if (cloze) return cloze;

  return null;
}

function parseCsvLine(line: string): string[] {
  const columns: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      columns.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  columns.push(current);
  return columns;
}

function parseCloze(text: string): GeneratedQuestion | null {
  const match = text.match(/\{\{c\d+::(.+?)(?:::.*?)?\}\}/);
  if (!match) return null;

  const answer = cleanCell(match[1]);
  const question = cleanCell(text.replace(match[0], "[...]"));

  if (!question || !answer) return null;

  return makeQuestion(question, answer, "Cloze");
}

function cleanCell(value = ""): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/^"|"$/g, "")
    .trim();
}

function toTsvCell(value: string): string {
  return value.replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
}

function toFileName(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function makeQuestion(
  question: string,
  answer: string,
  category: string
): GeneratedQuestion {
  return {
    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    question,
    answer,
    category,
    importance: 1,
    bookmarked: false,
  };
}
