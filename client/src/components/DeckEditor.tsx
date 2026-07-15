import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Home, Plus, Save, Trash2, UserRound, Users, X } from "lucide-react";
import type { GeneratedQuestion } from "../services/api";
import type { SavedDeck } from "../services/supabase";
import { hasCloze, toClozeAnswerHtml } from "../utils/richText";
import RichTextEditor from "./RichTextEditor";

interface Props {
  title: string;
  questions: GeneratedQuestion[];
  visibility: "private" | "shared";
  onCancel: () => void;
  onHome: () => void;
  onSave: (title: string, questions: GeneratedQuestion[], visibility: "private" | "shared") => void | Promise<void>;
  onSaveAndStudy: (title: string, questions: GeneratedQuestion[], visibility: "private" | "shared") => void | Promise<void>;
  titleSuggestions?: string[];
  decks: SavedDeck[];
  currentDeckId: string;
  onSwitchDeck: (deck: SavedDeck) => void | Promise<void>;
  focusQuestionId?: string | null;
  currentUserLabel: string;
}

export default function DeckEditor({ title: initialTitle, questions: initialQuestions, visibility, onCancel, onHome, onSave, onSaveAndStudy, titleSuggestions = [], decks, currentDeckId, onSwitchDeck, focusQuestionId, currentUserLabel }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [questions, setQuestions] = useState(initialQuestions);
  const [activeQuestionId, setActiveQuestionId] = useState(focusQuestionId || initialQuestions[0]?.id || "");
  const [showCardList, setShowCardList] = useState(false);
  const [showDeckList, setShowDeckList] = useState(false);
  const [pendingDeck, setPendingDeck] = useState<SavedDeck | null>(null);
  const [showAddScopeDialog, setShowAddScopeDialog] = useState(false);
  const [showIncompleteCardDialog, setShowIncompleteCardDialog] = useState(false);
  const [addScope, setAddScope] = useState<"shared" | "personal">(() => localStorage.getItem("shared-deck-card-scope") === "shared" ? "shared" : "personal");
  const pendingAutoSaveRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    setTitle(initialTitle);
    setQuestions(initialQuestions);
    setActiveQuestionId(focusQuestionId || initialQuestions[0]?.id || "");
    setShowCardList(false);
    setShowDeckList(false);
  }, [currentDeckId]);

  useEffect(() => {
    if (!focusQuestionId) return;
    if (questions.some((item) => item.id === focusQuestionId)) setActiveQuestionId(focusQuestionId);
  }, [focusQuestionId, questions]);

  const activeQuestion = questions.find((item) => item.id === activeQuestionId) || questions[0];
  const activeQuestionIndex = activeQuestion ? questions.findIndex((item) => item.id === activeQuestion.id) : -1;

  function update(id: string, field: "question" | "answer", value: string) {
    const previousQuestion = questions.find((item) => item.id === id);
    const syncedAnswer = field === "question" ? toClozeAnswerHtml(value) : "";
    const shouldSyncAnswer = field === "question" && (Boolean(syncedAnswer) || hasCloze(previousQuestion?.question ?? ""));
    const nextQuestions = questions.map((item) => item.id === id
      ? { ...item, [field]: value, ...(shouldSyncAnswer ? { answer: syncedAnswer } : {}) }
      : item
    );
    setQuestions(nextQuestions);
    const updatedCard = nextQuestions.find((item) => item.id === id);
    if (title.trim() && updatedCard?.question.trim() && updatedCard.answer.trim()) {
      const valid = nextQuestions.filter((item) => item.question.trim() && item.answer.trim());
      pendingAutoSaveRef.current = pendingAutoSaveRef.current.catch(() => undefined).then(async () => {
        try { await onSave(title.trim(), valid, visibility); } catch { /* The parent already shows the save error. */ }
      });
    }
  }

  function addCard(scope: "shared" | "personal" = "shared") {
    const card = { id: crypto.randomUUID(), scope, creatorLabel: currentUserLabel, question: "", answer: "", category: "Tự tạo", importance: 1, bookmarked: false };
    setQuestions((current) => [...current, card]);
    setActiveQuestionId(card.id);
    setShowCardList(false);
    setShowAddScopeDialog(false);
  }

  function requestAddCard() {
    if (!activeQuestion?.question.trim() || !activeQuestion.answer.trim()) {
      setShowIncompleteCardDialog(true);
      return;
    }
    if (visibility === "shared") setShowAddScopeDialog(true);
    else addCard();
  }

  function confirmAddCard() {
    localStorage.setItem("shared-deck-card-scope", addScope);
    addCard(addScope);
  }

  function removeCard(id: string) {
    setQuestions((current) => {
      if (current.length <= 1) return current;
      const index = current.findIndex((item) => item.id === id);
      const next = current.filter((item) => item.id !== id);
      if (id === activeQuestionId) setActiveQuestionId(next[Math.min(Math.max(index, 0), next.length - 1)]?.id || "");
      return next;
    });
  }

  async function save(saveAndStudy = false) {
    const valid = questions.filter((item) => item.question.trim() && item.answer.trim());
    if (!title.trim() || valid.length === 0) return;
    await pendingAutoSaveRef.current.catch(() => undefined);
    await (saveAndStudy ? onSaveAndStudy(title.trim(), valid, visibility) : onSave(title.trim(), valid, visibility));
  }

  function switchDeck(deck: SavedDeck) {
    if (deck.title === title) return;
    const valid = questions.filter((item) => item.question.trim() && item.answer.trim());
    if (!title.trim() || valid.length === 0) return;
    setPendingDeck(deck);
  }

  async function confirmSwitch() {
    if (!pendingDeck) return;
    const deck = pendingDeck;
    setPendingDeck(null);
    setShowDeckList(false);
    const valid = questions.filter((item) => item.question.trim() && item.answer.trim());
    await onSave(title.trim(), valid, visibility);
    await onSwitchDeck(deck);
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div><p className="text-sm font-semibold text-rose-500">Chỉnh sửa</p><h1 className="text-3xl font-bold text-rose-950">Sửa bộ thẻ</h1></div>
        <button onClick={onCancel} className="inline-flex items-center gap-2 rounded-lg border border-rose-100 bg-white px-4 py-2 text-sm font-semibold text-slate-600"><X size={17} /> Hủy</button>
      </div>
      <div className="mb-5">
        <div className="relative flex-1">
          <input list="deck-title-suggestions" value={title} onFocus={() => setShowDeckList(true)} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-rose-100 bg-white px-4 py-3 pr-11 font-semibold text-rose-950 outline-none focus:border-rose-300" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setShowDeckList((open) => !open)} aria-label="Mở danh sách bộ thẻ cùng cấp" title="Bộ thẻ cùng cấp" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><ChevronDown size={17} className={showDeckList ? "rotate-180 transition-transform" : "transition-transform"} /></button>
          {showDeckList && <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-rose-100 bg-white p-1 shadow-lg">
            {decks.filter((deck) => deck.id !== currentDeckId).map((deck) => <button key={deck.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void switchDeck(deck)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-rose-50"><span>{deck.title}</span><span className="ml-auto text-xs text-slate-400">{deck.cards.length} thẻ</span></button>)}
            {decks.filter((deck) => deck.id !== currentDeckId).length === 0 && <p className="px-3 py-2 text-sm text-slate-400">Chưa có bộ thẻ cùng cấp khác.</p>}
          </div>}
          <datalist id="deck-title-suggestions">
            {["Nội", "Ngoại", "Sản", "Nhi", "Cấp cứu", "Hồi sức", ...titleSuggestions].filter((name, index, all) => all.indexOf(name) === index).map((name) => <option key={name} value={name} />)}
          </datalist>
        </div>
      </div>
      <div className="glass-panel mode-panel rounded-2xl border border-rose-100 bg-white/85 p-4 shadow-sm sm:p-6">
        <div className="overflow-hidden rounded-2xl border border-teal-100 bg-teal-50/50">
          <button type="button" onClick={() => setShowCardList((open) => !open)} aria-expanded={showCardList} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.16em] text-teal-700 hover:bg-teal-50">
            <span>Đã có {questions.length} thẻ · Đang sửa thẻ {activeQuestionIndex + 1}</span>
            <ChevronDown size={17} className={`shrink-0 transition-transform duration-200 ${showCardList ? "rotate-180" : ""}`} />
          </button>
          {showCardList && <div className="max-h-72 space-y-2 overflow-y-auto border-t border-teal-100 p-3">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400" aria-hidden="true">
              <span />
              <span>Front</span>
              <span className="border-l border-teal-100 pl-3">Back</span>
            </div>
            {questions.map((item, index) => <button key={item.id} type="button" onClick={() => setActiveQuestionId(item.id)} className={`grid w-full grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${item.id === activeQuestion?.id ? "border-teal-200 bg-teal-100/70 text-teal-900" : "border-white/80 bg-white/85 text-slate-700 hover:border-teal-100 hover:bg-white"}`}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-teal-700 shadow-sm">{index + 1}</span>
              <span className="min-w-0 truncate pr-2" dangerouslySetInnerHTML={{ __html: item.question || "<em>Thẻ trống</em>" }} />
              <span className="min-w-0 truncate border-l border-teal-100 pl-3" dangerouslySetInnerHTML={{ __html: item.answer || "<em>Thẻ trống</em>" }} />
            </button>)}
          </div>}
        </div>

        {activeQuestion && <div key={activeQuestion.id} data-card-id={activeQuestion.id} className="mt-5 rounded-2xl border border-dashed border-rose-200 bg-rose-50/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-500">Thẻ {activeQuestionIndex + 1}</p>
              {visibility === "shared" && <p className="mt-1 text-[11px] font-medium text-slate-400">Đã thêm bởi: <span className="font-semibold text-slate-500">{activeQuestion.creatorLabel || "Chủ bộ thẻ"}</span></p>}
            </div>
            <button disabled={questions.length <= 1} onClick={() => removeCard(activeQuestion.id)} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Xóa thẻ"><Trash2 size={18} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Front</p><RichTextEditor value={activeQuestion.question} onChange={(value) => update(activeQuestion.id, "question", value)} placeholder="Mặt trước" capitalizeFirst /></div>
            <div><p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Back</p><RichTextEditor value={activeQuestion.answer} onChange={(value) => update(activeQuestion.id, "answer", value)} placeholder="Mặt sau" capitalizeFirst /></div>
          </div>
        </div>}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button onClick={requestAddCard} title="Thêm thẻ" className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-100 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700"><Plus size={18} /> Thêm thẻ</button>
            {visibility === "shared" && <div className="inline-flex rounded-xl border border-rose-100 bg-white/75 p-1 shadow-sm" aria-label="Phạm vi thẻ mới">
              <button type="button" aria-pressed={addScope === "personal"} onClick={() => setAddScope("personal")} className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition sm:flex-none ${addScope === "personal" ? "bg-teal-100 text-teal-700 shadow-sm" : "text-slate-400 hover:bg-white hover:text-slate-600"}`}><UserRound size={14} /> Mình tôi</button>
              <button type="button" aria-pressed={addScope === "shared"} onClick={() => setAddScope("shared")} className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition sm:flex-none ${addScope === "shared" ? "bg-rose-100 text-rose-600 shadow-sm" : "text-slate-400 hover:bg-white hover:text-slate-600"}`}><Users size={14} /> Chia sẻ</button>
            </div>}
          </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={onHome} title="Về màn hình chính" aria-label="Về màn hình chính" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><Home size={19} /></button>
          <button onClick={() => void save(false)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-white/80 px-5 py-3 text-sm font-bold text-teal-700 hover:bg-teal-50"><Save size={18} /> Lưu</button>
          <button onClick={() => void save(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-5 py-3 text-sm font-bold text-white hover:bg-teal-500"><Check size={18} /> Lưu &amp; học ngay</button>
        </div>
        </div>
      </div>
      {pendingDeck && <div className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/25 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="switch-deck-title">
        <div className="glass-dialog w-full max-w-md rounded-3xl border border-rose-100 bg-gradient-to-br from-white via-rose-50/70 to-teal-50/70 p-7 shadow-[0_24px_70px_rgba(190,24,93,0.2)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-500">✦</div>
          <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.16em] text-rose-500">Chuyển bộ thẻ</p>
          <h2 id="switch-deck-title" className="mt-2 text-center text-xl font-bold text-rose-950">Lưu thay đổi trước khi chuyển?</h2>
          <p className="mt-2 text-center text-sm leading-6 text-slate-500">Bạn đang sửa “{title}”. Lưu lại trước khi mở “{pendingDeck.title}”.</p>
          <div className="mt-7 flex gap-3">
            <button onClick={() => setPendingDeck(null)} className="flex-1 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50">Hủy</button>
            <button onClick={() => void confirmSwitch()} className="flex-1 rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-500">Lưu</button>
          </div>
        </div>
      </div>}
      {showAddScopeDialog && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-rose-950/25 px-4 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-labelledby="add-card-scope-title">
        <div className="glass-dialog w-full max-w-lg rounded-3xl border border-rose-100 bg-gradient-to-br from-white via-rose-50/80 to-teal-50/80 p-7 shadow-[0_24px_70px_rgba(190,24,93,0.2)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><AlertTriangle size={23} /></div>
          <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.16em] text-rose-500">Bộ thẻ đang được chia sẻ</p>
          <h2 id="add-card-scope-title" className="mt-2 text-center text-xl font-bold text-rose-950">Bạn muốn lưu thẻ mới ở đâu?</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm leading-6 text-slate-500">Hãy chọn kỹ trước khi thêm. Thẻ chung sẽ xuất hiện với tất cả thành viên; thẻ cá nhân chỉ tài khoản của bạn nhìn thấy và học được.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setAddScope("personal")} aria-pressed={addScope === "personal"} className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${addScope === "personal" ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100" : "border-teal-100 bg-white/90 hover:bg-teal-50"}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><UserRound size={20} /></span>
              <span><strong className="block text-sm text-teal-900">Chỉ thêm cho tôi</strong><span className="mt-1 block text-xs font-medium text-slate-500">Không ảnh hưởng người khác</span></span>{addScope === "personal" && <Check className="ml-auto shrink-0 text-teal-600" size={18} />}
            </button>
            <button type="button" onClick={() => setAddScope("shared")} aria-pressed={addScope === "shared"} className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${addScope === "shared" ? "border-rose-300 bg-rose-50 ring-2 ring-rose-100" : "border-rose-100 bg-white/90 hover:bg-rose-50"}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600"><Users size={20} /></span>
              <span><strong className="block text-sm text-rose-950">Thêm vào bộ thẻ chung</strong><span className="mt-1 block text-xs font-medium text-slate-500">Mọi thành viên đều thấy</span></span>{addScope === "shared" && <Check className="ml-auto shrink-0 text-rose-500" size={18} />}
            </button>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={() => setShowAddScopeDialog(false)} className="flex-1 rounded-xl border border-rose-100 bg-white/70 px-4 py-3 text-sm font-bold text-slate-500 hover:bg-white">Hủy</button>
            <button type="button" onClick={confirmAddCard} className="flex-1 rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-500">Xác nhận thêm</button>
          </div>
        </div>
      </div>}
      {showIncompleteCardDialog && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-rose-950/25 px-4 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-labelledby="incomplete-card-title">
        <div className="glass-dialog w-full max-w-md rounded-3xl border border-rose-100 bg-gradient-to-br from-white via-rose-50/80 to-amber-50/70 p-7 text-center shadow-[0_24px_70px_rgba(190,24,93,0.2)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><AlertTriangle size={23} /></div>
          <h2 id="incomplete-card-title" className="mt-4 text-xl font-bold text-rose-950">Thẻ hiện tại chưa hoàn chỉnh</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Hãy nhập đủ Front và Back, hoặc xóa thẻ trống này trước khi thêm thẻ tiếp theo.</p>
          <button type="button" onClick={() => setShowIncompleteCardDialog(false)} className="mt-6 w-full rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-white hover:bg-teal-500">Quay lại nhập</button>
        </div>
      </div>}
    </section>
  );
}
