import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { User } from "@supabase/supabase-js";

import Header from "./components/Header";
import Navbar from "./components/Navbar";
import DeckSetup from "./components/DeckSetup";
import Study from "./components/Study";
import Review from "./components/Review";
import DeckEditor from "./components/DeckEditor";
import ShareDeckDialog from "./components/ShareDeckDialog";
import LoadingOverlay from "./components/LoadingOverlay";
import { isSpecialUser } from "./config/access";
import { deleteDeck, listDecks, listDueCards, saveDeck, saveReview, shareDeckWithEmails, supabase, updateDeck, type SavedDeck } from "./services/supabase";

import {
  generateQuestions,
  generateMultipleChoice,
  importAnkiPackage,
  type GeneratedQuestion,
} from "./services/api";

export default function App() {
  const [mode, setMode] = useState<"study" | "review">("study");

  const [deckTitle, setDeckTitle] = useState("");

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingTitle, setLoadingTitle] = useState("Đang xử lý...");
  const [loadingDescription, setLoadingDescription] = useState("Một chút thôi, mình đang chuẩn bị nội dung cho bạn.");

  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [editing, setEditing] = useState(false);
  const [currentSavedDeck, setCurrentSavedDeck] = useState<SavedDeck | null>(null);
  const [sharingDeck, setSharingDeck] = useState<SavedDeck | null>(null);
  const [pendingImport, setPendingImport] = useState<{ title: string; cards: GeneratedQuestion[] } | null>(null);
  const [noDueNotice, setNoDueNotice] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<SavedDeck | null>(null);
  const [pendingGenerated, setPendingGenerated] = useState<{ title: string; cards: GeneratedQuestion[] } | null>(null);
  const [generatedForAppend, setGeneratedForAppend] = useState<{ title: string; cards: GeneratedQuestion[] } | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [aiCallsRemaining, setAiCallsRemaining] = useState(850);
  const specialUser = isSpecialUser(user?.email);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowWelcome(false), 1700);
    return () => window.clearTimeout(timer);
  }, []);

  const refreshDecks = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    if (!nextUser || !supabase) {
      setSavedDecks([]);
      setQuestions([]);
      setDeckTitle("");
      setImage(null);
      setPreview("");
      setEditing(false);
      setCurrentSavedDeck(null);
      setPendingImport(null);
      setPendingGenerated(null);
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

  useEffect(() => {
    if (!user) return;
    const refresh = () => void refreshDecks(user);
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [user, refreshDecks]);

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
    if (aiCallsRemaining < 1) { alert("Số lượt AI ước tính đã hết."); return; }

    try {
      setAiCallsRemaining((count) => count - 1);
      setLoading(true);
      setLoadingTitle("AI đang đọc ảnh...");
      setLoadingDescription("Mình đang nhận diện nội dung và chọn những ý quan trọng để tạo thẻ.");

      const response = await generateQuestions(image);

      finishGenerated(response.title || image.name, response.data);
    } catch (error) {
      console.error(error);
      alert("Không thể tạo câu hỏi.");
    } finally {
      setLoading(false);
    }
  }

  async function onGenerateMcq() {
    if (!image) return;
    if (aiCallsRemaining < 1) { alert("Số lượt AI ước tính đã hết."); return; }
    try {
      setAiCallsRemaining((count) => count - 1);
      setLoading(true); setLoadingTitle("Đang tạo trắc nghiệm..."); setLoadingDescription("Mình đang đọc ảnh và chọn từng kiến thức quan trọng để tạo câu hỏi.\n\nĐây là công cụ AI để tạo câu hỏi từ hình ảnh, nhưng do hạn hẹp kinh phí nên chất lượng bị hạn chế. Vui lòng không chửi bậy khi làm trắc nghiệm nhé :)))");
      const response = await generateMultipleChoice(image);
      finishGenerated(response.title || "Trắc nghiệm", response.data);
    } catch (error) { console.error(error); alert("Không thể tạo câu trắc nghiệm."); }
    finally { setLoading(false); }
  }

  function finishGenerated(title: string, cards: GeneratedQuestion[]) {
    setQuestions(cards); setDeckTitle(title); setMode("study");
    setGeneratedForAppend({ title, cards });
  }

  async function appendGeneratedToDeck(deck: SavedDeck) {
    if (!user || !pendingGenerated) return;
    const combined = [...deck.cards, ...pendingGenerated.cards];
    try {
      await updateDeck(user.id, deck.id, deck.title, combined, deck.visibility);
      setQuestions(combined); setDeckTitle(deck.title); setCurrentSavedDeck({ ...deck, cards: combined }); setPendingGenerated(null); setGeneratedForAppend(null); setMode("study");
      setSavedDecks(await listDecks(user.id));
    } catch (error) { alert(`Không thể thêm vào bộ thẻ: ${error instanceof Error ? error.message : String(error)}`); }
  }

  async function onImportDeck(file: File) {
    try {
      setLoading(true);
      setLoadingTitle("Đang nạp bộ thẻ...");
      setLoadingDescription("Mình đang đọc file và sắp xếp các mặt Front/Back.");
      if (file.name.toLowerCase().endsWith(".apkg")) {
        const response = await importAnkiPackage(file);

        if (response.data.length === 0) {
          alert("File .apkg chưa có thẻ học hợp lệ.");
          return;
        }

        setPendingImport({ title: response.title || file.name.replace(/\.[^.]+$/, ""), cards: response.data });
        return;
      }

      const text = await file.text();
      const imported = parseDeckText(text);

      if (imported.length === 0) {
        alert("File chưa có thẻ hợp lệ. Mỗi dòng cần có mặt trước và mặt sau.");
        return;
      }

      setPendingImport({ title: file.name.replace(/\.[^.]+$/, ""), cards: imported });
    } catch (error) {
      console.error(error);
      alert("Không thể đọc file này.");
    } finally {
      setLoading(false);
    }
  }

  async function continueImportedDeck(studyNow: boolean) {
    if (!pendingImport) return;
    const imported = pendingImport;
    setPendingImport(null);
    if (!studyNow) {
      // “Để đó” chỉ lưu bộ thẻ rồi đóng hộp thoại, giữ người dùng ở màn hình nạp thẻ.
      // Xóa dữ liệu học hiện tại ngay để giao diện không nhảy sang màn hình học trống.
      setQuestions([]);
      setDeckTitle("");
      setImage(null);
      setPreview("");
      setEditing(false);
      setCurrentSavedDeck(null);
      setMode("study");
      await persistDeck(imported.title, imported.cards);
      return;
    }

    setQuestions(imported.cards);
    setDeckTitle(imported.title);
    await persistDeck(imported.title, imported.cards);
    setMode("study");
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
    try { await shareDeckWithEmails(sharingDeck.id, emails); }
    catch (error) { alert(`Không thể chia sẻ: ${error instanceof Error ? error.message : JSON.stringify(error)}`); }
  }

  async function studyDueCards(beforeStudy?: () => void) {
    if (!user) { alert("Bạn cần đăng nhập để xem thẻ đến hạn."); return; }
    try {
      const due = await listDueCards(user.id);
      if (due.length === 0) { setNoDueNotice(true); return; }
      beforeStudy?.();
      window.setTimeout(() => { setQuestions(due); setDeckTitle("Hôm nay ôn gì nhỉ?"); setMode("study"); }, 700);
    } catch (error) { alert(`Không thể tải thẻ đến hạn: ${error instanceof Error ? error.message : JSON.stringify(error)}`); }
  }

  function openSavedDeck(deck: SavedDeck) {
    setQuestions(deck.cards);
    setDeckTitle(deck.title);
    setMode("study");
    setCurrentSavedDeck(deck);
  }

  function createMcqFromDeck(deck: SavedDeck) {
    const answers = deck.cards.map((card) => card.answer.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
    const cards = deck.cards.map((card, index) => {
      const answer = card.answer.replace(/<[^>]+>/g, "").trim();
      const distractors = answers.filter((item, answerIndex) => answerIndex !== index && item !== answer).slice(0, 3);
      const options = [answer, ...distractors].sort(() => Math.random() - 0.5);
      return { ...card, options, correctOption: answer, explanation: `Đáp án: ${answer}` };
    }).filter((card) => card.options && card.options.length >= 2);
    setQuestions(cards); setDeckTitle(`${deck.title} · Trắc nghiệm`); setCurrentSavedDeck(null); setMode("study");
  }

  function editSavedDeck(deck: SavedDeck) {
    openSavedDeck(deck);
    setEditing(true);
  }

  function switchEditingDeck(deck: SavedDeck) {
    openSavedDeck(deck);
    setEditing(true);
  }

  async function removeSavedDeck(deck: SavedDeck) {
    if (!user) return;
    setDeleteCandidate(deck);
  }

  async function confirmDeleteDeck() {
    if (!user || !deleteCandidate) return;
    const deck = deleteCandidate;
    setDeleteCandidate(null);
    try {
      await deleteDeck(user.id, deck.id);
      setSavedDecks(await listDecks(user.id));
      if (currentSavedDeck?.id === deck.id) resetDeck();
    } catch (error) {
      console.error(error);
      alert("Không thể xóa bộ thẻ.");
    }
  }

  async function saveEditedDeck(title: string, cards: GeneratedQuestion[], visibility: "private" | "shared", startStudy = false) {
    if (!user || !currentSavedDeck) return;
    try {
      await updateDeck(user.id, currentSavedDeck.id, title, cards, visibility);
      setQuestions(cards); setDeckTitle(title); setEditing(!startStudy); setCurrentSavedDeck({ ...currentSavedDeck, title, visibility, cards });
      if (startStudy) setMode("study");
      setSavedDecks(await listDecks(user.id));
    } catch (error) {
      console.error(error);
      alert(`Không thể lưu thay đổi bộ thẻ: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
      throw error;
    }
  }

  async function saveEditedDeckAndStudy(title: string, cards: GeneratedQuestion[], visibility: "private" | "shared") {
    await saveEditedDeck(title, cards, visibility, true);
  }

  function resetDeck() {
    setQuestions([]);
    setDeckTitle("");
    setImage(null);
    setPreview("");
    setMode("study");
  }

  function cancelEditing() {
    setEditing(false);
    setCurrentSavedDeck(null);
    resetDeck();
  }

  function leaveStudy() {
    setGeneratedForAppend(null);
    setCurrentSavedDeck(null);
    resetDeck();
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
      {showWelcome && <div className="welcome-screen" role="status" aria-live="polite">
        <div className="welcome-card">
          <div className="welcome-icon"><img src="/brain-learning-icon.png" alt="Não bộ đang học" /></div>
          <p className="welcome-kicker">Học bài thoiii 🌸</p>
          <h1>Chào bạn!</h1>
          <p className="welcome-message">Mình cùng học một chút nhé.<br />Mỗi ngày tiến bộ một xíu là giỏi lắm rồi! 😊</p>
          <div className="welcome-dots" aria-hidden="true"><span /><span /><span /></div>
        </div>
      </div>}
      {loading && <LoadingOverlay title={loadingTitle} description={loadingDescription} imageSrc={preview || undefined} />}

      <main data-special-user={specialUser ? "true" : "false"} className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ffe4ef_0,#fff7fb_34%,#eefcf6_100%)]">

        <Header onUserChange={refreshDecks} specialUser={specialUser} />

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
          <DeckEditor title={deckTitle} questions={questions} visibility={currentSavedDeck.visibility} titleSuggestions={savedDecks.map((deck) => deck.title)} decks={savedDecks} currentDeckId={currentSavedDeck.id} onSwitchDeck={switchEditingDeck} onShareRequest={() => setSharingDeck(currentSavedDeck)} onCancel={cancelEditing} onHome={cancelEditing} onSave={saveEditedDeck} onSaveAndStudy={saveEditedDeckAndStudy} />
        ) : questions.length === 0 ? (
          <DeckSetup
            preview={preview}
            loading={loading}
            onImageChange={onImageChange}
            onGenerate={onGenerate}
            onGenerateMcq={onGenerateMcq}
            onImportDeck={onImportDeck}
            onCreateDeck={onCreateDeck}
            onSaveDeck={onSaveDeck}
            savedDecks={savedDecks}
            onOpenDeck={openSavedDeck}
            onEditDeck={editSavedDeck}
            onDeleteDeck={removeSavedDeck}
            onShareDeck={setSharingDeck}
            onCreateMcqFromDeck={createMcqFromDeck}
            aiCallsRemaining={aiCallsRemaining}
            currentUserId={user?.id}
            onStudyDue={studyDueCards}
          />
        ) : mode === "study" ? (
          <Study
            questions={questions}
            toggleBookmark={toggleBookmark}
            onRate={(question: GeneratedQuestion, rating: number) => { if (user) return saveReview(user.id, question, rating); }}
            onAddToDeck={generatedForAppend ? () => setPendingGenerated(generatedForAppend) : undefined}
            onHome={leaveStudy}
          />
        ) : (
          <Review
            questions={questions}
            toggleBookmark={toggleBookmark}
          />
        )}

      </main>
        {sharingDeck && <ShareDeckDialog deckId={sharingDeck.id} title={sharingDeck.title} onClose={() => setSharingDeck(null)} onShare={shareSavedDeck} />}
        {pendingImport && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-rose-950/25 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="import-next-title">
          <div className="w-full max-w-md rounded-3xl border border-rose-100 bg-gradient-to-br from-white via-rose-50/70 to-teal-50/70 p-7 text-center shadow-[0_24px_70px_rgba(190,24,93,0.2)]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-500">Đã nạp bộ thẻ</p>
            <h2 id="import-next-title" className="mt-2 text-2xl font-bold text-rose-950">Bạn muốn làm gì tiếp?</h2>
            <p className="mt-2 text-sm text-slate-500">Bộ “{pendingImport.title}” có {pendingImport.cards.length} thẻ.</p>
            <div className="mt-7 flex gap-3"><button onClick={() => void continueImportedDeck(false)} className="flex-1 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50">Để đó</button><button onClick={() => void continueImportedDeck(true)} className="flex-1 rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-white hover:bg-teal-500">Học liền</button></div>
          </div>
        </div>}
        {noDueNotice && <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden bg-rose-950/25 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="no-due-title">
          <div className="celebrate-modal relative w-full max-w-md rounded-3xl border border-rose-100 bg-gradient-to-br from-white via-rose-50/90 to-teal-50/90 p-8 text-center shadow-[0_24px_70px_rgba(190,24,93,0.2)]">
            {Array.from({ length: 18 }, (_, index) => <span key={index} className="celebrate-ribbon" style={{ "--ribbon-angle": `${index * 20 - 170}deg`, "--ribbon-delay": `${(index % 6) * 70}ms`, "--ribbon-color": ["#fb7185", "#fbbf24", "#2dd4bf", "#c084fc"][index % 4] } as CSSProperties} />)}
            <div className="relative z-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-2xl">🌸</div>
              <h2 id="no-due-title" className="mt-4 text-xl font-bold text-rose-950">Hôm nay chưa có thẻ đến hạn</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Bạn đã hoàn thành lịch ôn hôm nay rồi.<br />Nghỉ một chút nhé! 😊</p>
              <button type="button" onClick={() => setNoDueNotice(false)} className="mt-6 rounded-xl bg-teal-400 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-500">Đóng</button>
            </div>
          </div>
        </div>}
        {deleteCandidate && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-rose-950/25 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="w-full max-w-md rounded-3xl border border-rose-100 bg-gradient-to-br from-white via-rose-50/90 to-teal-50/80 p-7 shadow-[0_24px_70px_rgba(190,24,93,0.2)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-2xl">🗑️</div>
            <h2 id="delete-title" className="mt-4 text-center text-xl font-bold text-rose-950">Xóa bộ thẻ?</h2>
            <p className="mt-2 text-center text-sm leading-6 text-slate-500">“{deleteCandidate.title}” sẽ bị xóa vĩnh viễn và không thể khôi phục.</p>
            <div className="mt-7 flex gap-3"><button type="button" onClick={() => setDeleteCandidate(null)} className="flex-1 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50">Hủy</button><button type="button" onClick={() => void confirmDeleteDeck()} className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white hover:bg-rose-600">Xóa bộ thẻ</button></div>
          </div>
        </div>}
        {pendingGenerated && <div className="fixed inset-0 z-[115] flex items-center justify-center bg-rose-950/25 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="append-title">
          <div className="w-full max-w-md rounded-3xl border border-rose-100 bg-gradient-to-br from-white via-rose-50/90 to-teal-50/80 p-7 shadow-[0_24px_70px_rgba(190,24,93,0.2)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-2xl">📚</div>
            <h2 id="append-title" className="mt-4 text-center text-xl font-bold text-rose-950">Thêm vào bộ thẻ hiện có?</h2>
            <p className="mt-2 text-center text-sm text-slate-500">AI vừa tạo {pendingGenerated.cards.length} câu. Chọn bộ thẻ để lưu chung:</p>
            <div className="mt-5 max-h-44 space-y-2 overflow-y-auto">{savedDecks.map((deck) => <button key={deck.id} type="button" onClick={() => void appendGeneratedToDeck(deck)} className="flex w-full items-center justify-between rounded-xl border border-teal-100 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-teal-50"><span>{deck.title}</span><span className="text-xs text-slate-400">{deck.cards.length} thẻ</span></button>)}</div>
            <button type="button" onClick={() => { setQuestions(pendingGenerated.cards); setDeckTitle(pendingGenerated.title); setGeneratedForAppend(pendingGenerated); setPendingGenerated(null); setMode("study"); }} className="mt-5 w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50">Học riêng bộ mới</button>
          </div>
        </div>}
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
