import { useCallback, useEffect, useRef, useState } from "react";
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
import PandaAssistant from "./components/PandaAssistant";
import SiteAnalytics from "./components/SiteAnalytics";
import SharedDeckNotification from "./components/SharedDeckNotification";
import WorkspaceTabs, { type WorkspaceTab } from "./components/WorkspaceTabs";
import DrugsPage from "./components/DrugsPage";
import GuidelinesPage from "./components/GuidelinesPage";
import Footer, { getDailyQuote } from "./components/Footer";
import { isAnalyticsAdmin, isSpecialUser } from "./config/access";
import { appendCardsToDeck, deleteDeck, dismissDeckActivityNotification, getDeckNotificationsEnabled, listDeckActivityNotifications, listDecks, listDueCards, saveDeck, saveReview, setDeckNotificationsEnabled, shareDeckWithEmails, supabase, updateDeck, type DeckActivityNotification, type SavedDeck } from "./services/supabase";

import {
  generateQuestions,
  generateMultipleChoice,
  generateClinicalCase,
  importAnkiPackage,
  getAiCallsRemaining,
  type GeneratedQuestion,
} from "./services/api";

export default function App() {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("flashcards");
  const [mode, setMode] = useState<"study" | "review">("study");
  const [studyCurrentId, setStudyCurrentId] = useState<string | null>(null);

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
  const setupDeckRef = useRef<SavedDeck | null>(null);
  const setupSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [sharingDeck, setSharingDeck] = useState<SavedDeck | null>(null);
  const [pendingImport, setPendingImport] = useState<{ title: string; cards: GeneratedQuestion[] } | null>(null);
  const [noDueNotice, setNoDueNotice] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<SavedDeck | null>(null);
  const [pendingGenerated, setPendingGenerated] = useState<{ title: string; cards: GeneratedQuestion[] } | null>(null);
  const [generatedForAppend, setGeneratedForAppend] = useState<{ title: string; cards: GeneratedQuestion[] } | null>(null);
  const [appendingDeckId, setAppendingDeckId] = useState<string | null>(null);
  const [appendScopeDeck, setAppendScopeDeck] = useState<SavedDeck | null>(null);
  const [appendScope, setAppendScope] = useState<"shared" | "personal">(() => localStorage.getItem("shared-deck-card-scope") === "shared" ? "shared" : "personal");
  const [showWelcome, setShowWelcome] = useState(true);
  const [loginRequiredOpen, setLoginRequiredOpen] = useState(false);
  const [welcomeClosing, setWelcomeClosing] = useState(false);
  const [aiCallsRemaining, setAiCallsRemaining] = useState(850);
  const [theme, setTheme] = useState<"color" | "basic" | "anki">(() => {
    const savedTheme = localStorage.getItem("hocbai-theme");
    return savedTheme === "basic" || savedTheme === "anki" ? savedTheme : "color";
  });
  const [sharedDeckNotificationsEnabled, setSharedDeckNotificationsEnabled] = useState(true);
  const [deckActivityNotifications, setDeckActivityNotifications] = useState<DeckActivityNotification[]>([]);
  const specialUser = isSpecialUser(user?.email);
  const analyticsAdmin = isAnalyticsAdmin(user?.email);
  const [dailyQuote, dailyAuthor] = getDailyQuote();

  useEffect(() => {
    localStorage.setItem("hocbai-theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    setupDeckRef.current = currentSavedDeck;
  }, [currentSavedDeck]);

  useEffect(() => {
    if (!user) {
      setSharedDeckNotificationsEnabled(true);
      setDeckActivityNotifications([]);
      return;
    }
    let active = true;
    const refreshNotifications = async () => {
      try {
        const enabled = await getDeckNotificationsEnabled(user.id);
        const notifications = enabled ? await listDeckActivityNotifications(user.id) : [];
        if (!active) return;
        setSharedDeckNotificationsEnabled(enabled);
        setDeckActivityNotifications(notifications);
      } catch (error) { console.warn("Shared deck notifications are not available yet", error); }
    };
    void refreshNotifications();
    const timer = window.setInterval(() => void refreshNotifications(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user]);

  async function changeSharedDeckNotifications(enabled: boolean) {
    setSharedDeckNotificationsEnabled(enabled);
    if (!user) return;
    try {
      await setDeckNotificationsEnabled(user.id, enabled);
      setDeckActivityNotifications(enabled ? await listDeckActivityNotifications(user.id) : []);
    } catch (error) { console.error(error); }
  }

  async function dismissSharedDeckNotification(notificationId: string) {
    setDeckActivityNotifications((items) => items.filter((item) => item.id !== notificationId));
    if (!user) return;
    try { await dismissDeckActivityNotification(user.id, notificationId); } catch (error) { console.error(error); }
  }

  useEffect(() => {
    const closeTimer = window.setTimeout(() => setWelcomeClosing(true), 4500);
    const removeTimer = window.setTimeout(() => setShowWelcome(false), 5100);
    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(removeTimer);
    };
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
      const nextDecks = await listDecks(nextUser.id);
      setSavedDecks(nextDecks);
      // Keep an already-open editor in sync when an owner/admin changes this
      // account's access from another session.
      setCurrentSavedDeck((current) => {
        if (!current) return current;
        const fresh = nextDecks.find((deck) => deck.id === current.id);
        return fresh ? { ...current, visibility: fresh.visibility, member_role: fresh.member_role, member_access: fresh.member_access } : current;
      });
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => refreshDecks(data.user));
  }, [refreshDecks]);

  useEffect(() => {
    void getAiCallsRemaining().then((remaining) => {
      if (remaining !== null) setAiCallsRemaining(remaining);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    const refresh = () => void refreshDecks(user);
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    const onVisibilityChange = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user, refreshDecks]);

  async function persistDeck(title: string, cards: GeneratedQuestion[], shareEmails: string[] = []) {
    if (!user || !supabase) return;
    try {
      const saved = await saveDeck(user.id, title, cards, shareEmails);
      if (saved) setCurrentSavedDeck({ ...saved, visibility: "private", cards, review_stats: { new: cards.length, learning: 0, due: 0 } });
      setSavedDecks(await listDecks(user.id));
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? error.message : JSON.stringify(error);
      alert(`Chưa lưu được bộ thẻ: ${detail}`);
    }
  }

  function requireLogin() {
    if (user) return true;
    setLoginRequiredOpen(true);
    return false;
  }

  function continueWithGoogle() {
    setLoginRequiredOpen(false);
    window.dispatchEvent(new Event("hocbai:google-sign-in"));
  }

  function onImageChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!requireLogin()) { event.target.value = ""; return; }
    const file = event.target.files?.[0];

    if (!file) return;

    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  async function onGenerate() {
    if (!requireLogin()) return;
    if (!image) return;

    try {
      setLoading(true);
      setLoadingTitle("AI đang đọc ảnh...");
      setLoadingDescription("Mình đang nhận diện nội dung và chọn những ý quan trọng để tạo thẻ.");

      const response = await generateQuestions(image);
      if (typeof response.aiCallsRemaining === "number") setAiCallsRemaining(response.aiCallsRemaining);

      finishGenerated(response.title || image.name, response.data);
    } catch (error) {
      console.error(error);
      alert("Không thể tạo câu hỏi.");
    } finally {
      setLoading(false);
    }
  }

  async function onGenerateMcq() {
    if (!requireLogin()) return;
    if (!image) return;
    try {
      setLoading(true); setLoadingTitle("Đang tạo trắc nghiệm..."); setLoadingDescription("Mình đang đọc ảnh và chọn từng kiến thức quan trọng để tạo câu hỏi.\n\nĐây là công cụ AI để tạo câu hỏi từ hình ảnh, nhưng do hạn hẹp kinh phí nên chất lượng bị hạn chế. Vui lòng không chửi bậy khi làm trắc nghiệm nhé :)))");
      const response = await generateMultipleChoice(image);
      if (typeof response.aiCallsRemaining === "number") setAiCallsRemaining(response.aiCallsRemaining);
      finishGenerated(response.title || "Trắc nghiệm", response.data);
    } catch (error) { console.error(error); alert("Không thể tạo câu trắc nghiệm."); }
    finally { setLoading(false); }
  }

  async function onGenerateClinicalCase() {
    if (!requireLogin()) return;
    if (!image) return;
    try {
      setLoading(true);
      setLoadingTitle("Đang tạo case lâm sàng...");
      setLoadingDescription("Mình đang chuyển kiến thức trong ảnh thành tình huống lâm sàng theo phong cách USMLE.");
      const response = await generateClinicalCase(image);
      if (typeof response.aiCallsRemaining === "number") setAiCallsRemaining(response.aiCallsRemaining);
      finishGenerated(response.title || "Case lâm sàng", response.data);
    } catch (error) {
      console.error(error);
      alert("Không thể tạo case lâm sàng.");
    } finally {
      setLoading(false);
    }
  }

  function finishGenerated(title: string, cards: GeneratedQuestion[]) {
    setQuestions(cards); setDeckTitle(title); setMode("study");
    setGeneratedForAppend({ title, cards });
  }

  function chooseGeneratedAppendScope(scope: "shared" | "personal") {
    setAppendScope(scope);
    localStorage.setItem("shared-deck-card-scope", scope);
  }

  function requestAppendGeneratedToDeck(deck: SavedDeck) {
    if (deck.visibility === "shared") {
      setAppendScopeDeck(deck);
      return;
    }
    void appendGeneratedToDeck(deck, "shared");
  }

  async function appendGeneratedToDeck(deck: SavedDeck, scope: "shared" | "personal") {
    if (!user || !pendingGenerated || appendingDeckId) return;
    setAppendingDeckId(deck.id);
    try {
      const cardsWithScope = pendingGenerated.cards.map((card) => ({ ...card, scope }));
      const appendedCards = await appendCardsToDeck(user.id, deck.id, cardsWithScope);
      const appendedById = new Map(appendedCards.map((card) => [card.id, card]));
      const localDeck = { ...deck, cards: [...deck.cards, ...appendedCards] };
      let nextDecks: SavedDeck[];
      try {
        nextDecks = await listDecks(user.id);
      } catch (refreshError) {
        console.warn("Cards were appended, but refreshing decks failed", refreshError);
        nextDecks = savedDecks.map((item) => item.id === deck.id ? localDeck : item);
      }
      const refreshedDeck = nextDecks.find((item) => item.id === deck.id);
      const freshDeck = refreshedDeck
        ? { ...refreshedDeck, cards: refreshedDeck.cards.map((card) => appendedById.has(card.id) ? { ...card, ...appendedById.get(card.id)! } : card) }
        : localDeck;
      nextDecks = nextDecks.map((item) => item.id === deck.id ? freshDeck : item);
      setQuestions(freshDeck.cards); setDeckTitle(deck.title); setCurrentSavedDeck(freshDeck); setPendingGenerated(null); setGeneratedForAppend(null); setAppendScopeDeck(null); setMode("study");
      setSavedDecks(nextDecks);
    } catch (error) {
      console.error(error);
      alert(`Không thể thêm vào bộ thẻ: ${formatUnknownError(error)}`);
    } finally {
      setAppendingDeckId(null);
    }
  }

  async function onImportDeck(file: File) {
    if (!requireLogin()) return;
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

  function persistSetupDeck(title: string, cards: GeneratedQuestion[]) {
    if (!user || !supabase) return Promise.resolve();
    setupSaveQueueRef.current = setupSaveQueueRef.current.catch(() => undefined).then(async () => {
      try {
        const existingDeck = setupDeckRef.current;
        if (!existingDeck) {
          const saved = await saveDeck(user.id, title, cards);
          if (saved) {
            const nextDeck = { ...saved, visibility: saved.visibility ?? "private", cards } as SavedDeck;
            setupDeckRef.current = nextDeck;
            setCurrentSavedDeck(nextDeck);
          }
        } else {
          await updateDeck(user.id, existingDeck.id, title, cards, existingDeck.visibility);
          const nextDeck = { ...existingDeck, title, cards };
          setupDeckRef.current = nextDeck;
          setCurrentSavedDeck(nextDeck);
        }
        const nextDecks = await listDecks(user.id);
        const freshDeck = nextDecks.find((deck) => deck.id === setupDeckRef.current?.id);
        if (freshDeck) {
          setupDeckRef.current = freshDeck;
          setCurrentSavedDeck(freshDeck);
        }
        setSavedDecks(nextDecks);
      } catch (error) {
        console.error(error);
        const detail = error instanceof Error ? error.message : JSON.stringify(error);
        alert(`Chưa tự động lưu được bộ thẻ: ${detail}`);
      }
    });
    return setupSaveQueueRef.current;
  }

  function onCreateDeck(title: string, createdQuestions: GeneratedQuestion[]) {
    if (!requireLogin()) return;
    setQuestions(createdQuestions);
    setDeckTitle(title);
    setMode("study");
    void persistSetupDeck(title, createdQuestions);
  }

  function onSaveDeck(title: string, cards: GeneratedQuestion[]) {
    if (!requireLogin()) return;
    void persistSetupDeck(title, cards);
  }

  async function shareSavedDeck(emails: string[]) {
    if (!sharingDeck) return;
    const canManageMembers = sharingDeck.owner_id === user?.id || sharingDeck.member_role === "admin";
    if (!canManageMembers) {
      setSharingDeck(null);
      alert("Chỉ chủ sở hữu hoặc quản trị viên mới được thêm thành viên vào bộ thẻ.");
      return;
    }
    try {
      await shareDeckWithEmails(sharingDeck.id, emails);
      setCurrentSavedDeck((current) => current && current.id === sharingDeck.id ? { ...current, visibility: "shared" } : current);
      setSavedDecks((decks) => decks.map((deck) => deck.id === sharingDeck.id ? { ...deck, visibility: "shared" } : deck));
      setSharingDeck((current) => current ? { ...current, visibility: "shared" } : current);
    }
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
      const nextDecks = await listDecks(user.id);
      const freshDeck = nextDecks.find((deck) => deck.id === currentSavedDeck.id) ?? { ...currentSavedDeck, title, visibility, cards };
      setQuestions(freshDeck.cards); setDeckTitle(title); setEditing(!startStudy); setCurrentSavedDeck(freshDeck);
      if (startStudy) setMode("study");
      setSavedDecks(nextDecks);
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

  function goHome() {
    setWorkspaceTab("flashcards");
    setEditing(false);
    setCurrentSavedDeck(null);
    setSharingDeck(null);
    setPendingImport(null);
    setPendingGenerated(null);
    setGeneratedForAppend(null);
    setDeleteCandidate(null);
    setNoDueNotice(false);
    resetDeck();
  }

  function editCurrentCard() {
    if (!currentSavedDeck) {
      alert("Hãy lưu bộ thẻ trước khi chỉnh sửa.");
      return;
    }
    setEditing(true);
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
      {showWelcome && <div className={`welcome-screen${welcomeClosing ? " welcome-screen--closing" : ""}`} role="status" aria-live="polite">
        <div className="welcome-card">
          <div className="welcome-icon"><img src="/brain-learning-icon.png" alt="Não bộ đang học" /></div>
          <p className="welcome-kicker">Học bài thoiii 🌸</p>
          <h1>Chào bạn!</h1>
          <p className="welcome-message">Mình cùng học một chút nhé.<br />Mỗi ngày tiến bộ một xíu là giỏi lắm rồi! 😊</p>
          <div className="welcome-quote" aria-label="Lời nhắc hôm nay">
            <p>“{dailyQuote}”</p>
            <cite>— {dailyAuthor}</cite>
          </div>
          <div className="welcome-progress" aria-hidden="true"><span /></div>
          <p className="welcome-loading-label">Đang chuẩn bị góc học tập…</p>
          <div className="welcome-dots" aria-hidden="true"><span /><span /><span /></div>
        </div>
      </div>}
      {loading && <LoadingOverlay title={loadingTitle} description={loadingDescription} imageSrc={preview || undefined} />}

      <main data-special-user={specialUser ? "true" : "false"} className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ffe4ef_0,#fff7fb_34%,#eefcf6_100%)]">

        <Header onHome={goHome} onUserChange={refreshDecks} specialUser={specialUser} theme={theme} onThemeChange={setTheme} sharedDeckNotificationsEnabled={sharedDeckNotificationsEnabled} onSharedDeckNotificationsChange={changeSharedDeckNotifications} />

        <WorkspaceTabs activeTab={workspaceTab} onChange={setWorkspaceTab} />

        {workspaceTab === "flashcards" && questions.length > 0 && (
          <Navbar
            mode={mode}
            setMode={setMode}
            deckTitle={deckTitle}
            onExport={exportDeck}
            onEdit={editCurrentCard}
          />
        )}

        <SiteAnalytics userId={user?.id} visible={workspaceTab === "flashcards" && analyticsAdmin && !editing && questions.length === 0} />

        {workspaceTab === "guidelines" ? (
          <GuidelinesPage user={user} onAiCallsRemaining={setAiCallsRemaining} />
        ) : workspaceTab === "drugs" ? (
          <DrugsPage />
        ) : editing && currentSavedDeck ? (
          <DeckEditor title={deckTitle} questions={questions} visibility={currentSavedDeck.visibility} focusQuestionId={studyCurrentId} titleSuggestions={savedDecks.map((deck) => deck.title)} decks={savedDecks} currentDeckId={currentSavedDeck.id} onSwitchDeck={switchEditingDeck} onCancel={cancelEditing} onHome={cancelEditing} onSave={saveEditedDeck} onSaveAndStudy={saveEditedDeckAndStudy} currentUserLabel={(user?.user_metadata?.full_name as string | undefined) || user?.email || "Thành viên"} />
        ) : questions.length === 0 ? (
          <DeckSetup
            preview={preview}
            loading={loading}
            onImageChange={onImageChange}
            onGenerate={onGenerate}
            onGenerateMcq={onGenerateMcq}
            onGenerateClinicalCase={onGenerateClinicalCase}
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
            authenticated={Boolean(user)}
            onRequireLogin={() => setLoginRequiredOpen(true)}
          />
        ) : mode === "study" ? (
          <Study
            questions={questions}
            toggleBookmark={toggleBookmark}
            onRate={(question: GeneratedQuestion, rating: number) => { if (user) return saveReview(user.id, question, rating); }}
            onAddToDeck={generatedForAppend ? () => setPendingGenerated(generatedForAppend) : undefined}
            onHome={leaveStudy}
            onCurrentChange={setStudyCurrentId}
            progressId={`${user?.id ?? "guest"}:${currentSavedDeck?.id ?? deckTitle}`}
          />
        ) : (
          <Review
            questions={questions}
            toggleBookmark={toggleBookmark}
          />
        )}

      </main>
      {!showWelcome && deckActivityNotifications.length > 0 && <SharedDeckNotification notifications={deckActivityNotifications} onDismiss={(notificationId) => void dismissSharedDeckNotification(notificationId)} onDisable={() => void changeSharedDeckNotifications(false)} />}
      <Footer />
      <PandaAssistant />
        {loginRequiredOpen && <div className="fixed inset-0 z-[160] flex items-center justify-center bg-rose-950/25 px-4 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-labelledby="login-required-title">
          <div className="w-full max-w-md rounded-3xl border border-white/80 bg-gradient-to-br from-white via-rose-50/95 to-teal-50/90 p-7 text-center shadow-[0_28px_80px_rgba(136,19,55,.22)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-rose-100"><span className="font-black text-blue-600">G</span></div>
            <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-rose-500">Cần đăng nhập</p>
            <h2 id="login-required-title" className="mt-2 text-2xl font-bold text-rose-950">Đăng nhập để tạo bộ thẻ</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">Bạn cần đăng nhập Google trước khi nhập file, tạo thẻ mới hoặc sử dụng AI từ ảnh.</p>
            <div className="mt-7 flex gap-3"><button type="button" onClick={() => setLoginRequiredOpen(false)} className="flex-1 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50">Để sau</button><button type="button" onClick={continueWithGoogle} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-500"><span className="font-black">G</span> Đăng nhập Google</button></div>
          </div>
        </div>}
        {sharingDeck && (sharingDeck.owner_id === user?.id || sharingDeck.member_role === "admin") && <ShareDeckDialog deckId={sharingDeck.id} title={sharingDeck.title} onClose={() => setSharingDeck(null)} onShare={shareSavedDeck} />}
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
            {!appendScopeDeck ? <>
              <div className="mt-5 max-h-44 space-y-2 overflow-y-auto">
                {savedDecks.filter((deck) => deck.owner_id === user?.id || deck.member_access === "edit").map((deck) => <button key={deck.id} type="button" disabled={appendingDeckId !== null} onClick={() => requestAppendGeneratedToDeck(deck)} className="flex w-full items-center justify-between rounded-xl border border-teal-100 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-teal-50 disabled:cursor-wait disabled:opacity-60"><span>{appendingDeckId === deck.id ? "Đang thêm..." : deck.title}</span><span className="flex items-center gap-2 text-xs text-slate-400">{deck.visibility === "shared" && <span className="rounded-full bg-rose-50 px-2 py-1 font-bold text-rose-500">Chia sẻ</span>}{deck.cards.length} thẻ</span></button>)}
                {savedDecks.every((deck) => deck.owner_id !== user?.id && deck.member_access !== "edit") && <p className="rounded-xl bg-white/70 px-4 py-3 text-center text-sm text-slate-500">Bạn chưa có bộ thẻ nào được phép chỉnh sửa.</p>}
              </div>
              <button type="button" disabled={appendingDeckId !== null} onClick={() => { setQuestions(pendingGenerated.cards); setDeckTitle(pendingGenerated.title); setGeneratedForAppend(pendingGenerated); setPendingGenerated(null); setAppendScopeDeck(null); setMode("study"); }} className="mt-5 w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60">Học riêng bộ mới</button>
            </> : <div className="mt-5">
              <div className="rounded-2xl border border-teal-100 bg-white/80 p-4">
                <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-teal-600">Bộ thẻ đang được chia sẻ</p>
                <p className="mt-1 text-center text-sm font-bold text-rose-950">Thêm {pendingGenerated.cards.length} câu vào “{appendScopeDeck.title}”</p>
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-1.5">
                  <button type="button" onClick={() => chooseGeneratedAppendScope("personal")} aria-pressed={appendScope === "personal"} className={`rounded-xl px-3 py-3 text-sm font-bold transition ${appendScope === "personal" ? "bg-white text-teal-700 shadow-sm ring-1 ring-teal-100" : "text-slate-500 hover:bg-white/70"}`}>👤 Mình tôi</button>
                  <button type="button" onClick={() => chooseGeneratedAppendScope("shared")} aria-pressed={appendScope === "shared"} className={`rounded-xl px-3 py-3 text-sm font-bold transition ${appendScope === "shared" ? "bg-white text-rose-600 shadow-sm ring-1 ring-rose-100" : "text-slate-500 hover:bg-white/70"}`}>👥 Chia sẻ</button>
                </div>
                <p className="mt-3 text-center text-xs leading-5 text-slate-500">{appendScope === "personal" ? "Chỉ tài khoản của bạn nhìn thấy và học các câu mới." : "Các câu mới sẽ xuất hiện với mọi thành viên trong bộ thẻ."}</p>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="button" disabled={appendingDeckId !== null} onClick={() => setAppendScopeDeck(null)} className="flex-1 rounded-xl border border-rose-100 bg-white px-4 py-3 text-sm font-bold text-slate-500 hover:bg-rose-50 disabled:opacity-60">Quay lại</button>
                <button type="button" disabled={appendingDeckId !== null} onClick={() => void appendGeneratedToDeck(appendScopeDeck, appendScope)} className="flex-1 rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-500 disabled:cursor-wait disabled:opacity-60">{appendingDeckId === appendScopeDeck.id ? "Đang thêm..." : "Xác nhận thêm"}</button>
              </div>
            </div>}
          </div>
        </div>}
    </>
  );
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [value.message, value.details, value.hint]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    if (parts.length > 0) return `${parts.join(" — ")}${value.code ? ` (mã ${String(value.code)})` : ""}`;
    try { return JSON.stringify(error); } catch { return "Lỗi không xác định."; }
  }
  return String(error);
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
