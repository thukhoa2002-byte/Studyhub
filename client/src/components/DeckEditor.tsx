import { useEffect, useState } from "react";
import { Check, ChevronDown, Home, Plus, Save, Trash2, X } from "lucide-react";
import type { GeneratedQuestion } from "../services/api";
import type { SavedDeck } from "../services/supabase";
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
  onShareRequest: () => void;
  focusQuestionId?: string | null;
}

export default function DeckEditor({ title: initialTitle, questions: initialQuestions, visibility: initialVisibility, onCancel, onHome, onSave, onSaveAndStudy, titleSuggestions = [], decks, currentDeckId, onSwitchDeck, onShareRequest, focusQuestionId }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [questions, setQuestions] = useState(initialQuestions);
  const [showDeckList, setShowDeckList] = useState(false);
  const [pendingDeck, setPendingDeck] = useState<SavedDeck | null>(null);
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);

  useEffect(() => {
    setTitle(initialTitle);
    setQuestions(initialQuestions);
    setVisibility(initialVisibility);
    setShowDeckList(false);
  }, [initialTitle, initialQuestions, initialVisibility]);

  useEffect(() => {
    if (!focusQuestionId) return;
    window.setTimeout(() => document.querySelector(`[data-card-id="${focusQuestionId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }, [focusQuestionId]);

  function update(id: string, field: "question" | "answer", value: string) {
    setQuestions((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function addCard() {
    setQuestions((current) => [...current, { id: crypto.randomUUID(), question: "", answer: "", category: "Tự tạo", importance: 1, bookmarked: false }]);
  }

  function save(saveAndStudy = false) {
    const valid = questions.filter((item) => item.question.trim() && item.answer.trim());
    if (!title.trim() || valid.length === 0) return;
    void (saveAndStudy ? onSaveAndStudy(title.trim(), valid, visibility) : onSave(title.trim(), valid, visibility));
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

  function chooseVisibility(next: "private" | "shared") {
    setVisibility(next);
    setShowVisibilityMenu(false);
    if (next === "shared") onShareRequest();
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div><p className="text-sm font-semibold text-rose-500">Chỉnh sửa</p><h1 className="text-3xl font-bold text-rose-950">Sửa bộ thẻ</h1></div>
        <button onClick={onCancel} className="inline-flex items-center gap-2 rounded-lg border border-rose-100 bg-white px-4 py-2 text-sm font-semibold text-slate-600"><X size={17} /> Hủy</button>
      </div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
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
        <div className="relative">
          <button type="button" onClick={() => setShowVisibilityMenu((open) => !open)} className="inline-flex items-center gap-2 rounded-lg border border-rose-100 bg-white px-3 py-3 text-sm font-semibold text-slate-700">
            <img src={visibility === "private" ? "/privacy-user-final.png" : "/privacy-group-final.png"} alt="" className="h-5 w-5 object-contain" />
            {visibility === "private" ? "Chỉ mình tôi" : "Chia sẻ"}<ChevronDown size={15} />
          </button>
          {showVisibilityMenu && <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-rose-100 bg-white p-1 shadow-lg">
            <button type="button" onClick={() => chooseVisibility("private")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-rose-50"><img src="/privacy-user-final.png" alt="" className="h-5 w-5 object-contain" /> Chỉ mình tôi</button>
            <button type="button" onClick={() => chooseVisibility("shared")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-teal-700 hover:bg-teal-50"><img src="/privacy-group-final.png" alt="" className="h-5 w-5 object-contain" /> Chia sẻ</button>
          </div>}
        </div>
      </div>
      <div className="space-y-3">
        <div className="hidden grid-cols-[1fr_1fr_auto] gap-3 px-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-400 sm:grid"><span>Front</span><span>Back</span><span /></div>
        {questions.map((item, index) => <div key={item.id} data-card-id={item.id} className="glass-card grid gap-3 rounded-lg border border-dashed border-rose-200 bg-white/85 p-4 sm:grid-cols-[1fr_1fr_auto]">
          <div><p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:hidden">Front</p><RichTextEditor value={item.question} onChange={(value) => update(item.id, "question", value)} onClozeCreated={(text) => update(item.id, "answer", text)} placeholder={`Mặt trước thẻ ${index + 1}`} capitalizeFirst /></div>
          <div><p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:hidden">Back</p><RichTextEditor value={item.answer} onChange={(value) => update(item.id, "answer", value)} placeholder="Mặt sau" /></div>
          <button onClick={() => setQuestions((current) => current.filter((card) => card.id !== item.id))} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Xóa thẻ"><Trash2 size={18} /></button>
        </div>)}
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button onClick={addCard} title="Thêm thẻ" aria-label="Thêm thẻ" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-rose-100 bg-white text-slate-700 hover:bg-rose-50"><Plus size={20} /></button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={onHome} title="Về màn hình chính" aria-label="Về màn hình chính" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><Home size={19} /></button>
          <button onClick={() => save(false)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-white px-5 py-3 text-sm font-bold text-teal-700 hover:bg-teal-50"><Save size={18} /> Lưu</button>
          <button onClick={() => save(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-5 py-3 text-sm font-bold text-white hover:bg-teal-500"><Check size={18} /> Lưu &amp; học ngay</button>
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
    </section>
  );
}
