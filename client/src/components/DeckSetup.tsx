import React, { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  FileText,
  ListChecks,
  Plus,
  Pencil,
  Save,
  Share2,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { GeneratedQuestion } from "../services/api";
import type { SavedDeck } from "../services/supabase";
import RichTextEditor from "./RichTextEditor";

interface Props {
  preview: string;
  loading: boolean;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerate: () => void;
  onGenerateMcq: () => void;
  onImportDeck: (file: File) => Promise<void>;
  onCreateDeck: (title: string, questions: GeneratedQuestion[]) => void;
  onSaveDeck: (title: string, questions: GeneratedQuestion[]) => void | Promise<void>;
  savedDecks: SavedDeck[];
  onOpenDeck: (deck: SavedDeck) => void;
  onEditDeck: (deck: SavedDeck) => void;
  onDeleteDeck: (deck: SavedDeck) => void;
  onShareDeck: (deck: SavedDeck) => void;
  onCreateMcqFromDeck: (deck: SavedDeck) => void;
  aiCallsRemaining: number;
  onStudyDue: (beforeStudy?: () => void) => void | Promise<void>;
  currentUserId?: string;
}

type SetupMode = "import" | "create" | "ai";

const deckIconOptions = [
  ["🫁", "Hô hấp"], ["❤️", "Tim mạch"], ["🩺", "Thận niệu"], ["🍽️", "Tiêu hoá"],
  ["🩸", "Huyết học"], ["🥗", "Dinh dưỡng"], ["🧸", "Nhi khoa"], ["🤰", "Sản khoa"],
  ["🦴", "Giải phẫu"], ["💓", "Sinh lý"], ["🧪", "Hoá sinh"], ["🧬", "Di truyền"],
  ["🎋", "Học tập"], ["📚", "Mặc định"],
] as const;

interface DraftCard {
  id: string;
  question: string;
  answer: string;
}

function newDraftCard(): DraftCard {
  return {
    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : String(Date.now()),
    question: "",
    answer: "",
  };
}

function deckIcon(title: string) {
  const name = title.toLowerCase();
  if (name.includes("ngoại") || name.includes("ngoai")) return "🩺";
  if (name.includes("sản") || name.includes("san")) return "🤰";
  if (name.includes("nhi")) return "🧸";
  if (name.includes("nội") || name.includes("noi")) return "🫁";
  if (name.includes("giải phẫu") || name.includes("giai phau")) return "🦴";
  if (name.includes("sinh lý") || name.includes("sinh ly")) return "💓";
  if (name.includes("hóa sinh") || name.includes("hoa sinh")) return "🧪";
  if (name.includes("di truyền") || name.includes("di truyen") || name.includes("sinh học") || name.includes("sinh hoc")) return "🧬";
  return "📚";
}

function DeckIconPicker({ title, value, onChange }: { title: string; value: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="relative shrink-0">
    <button type="button" title="Đổi icon bộ thẻ" aria-label={`Đổi icon cho ${title}`} onClick={() => setOpen((current) => !current)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent bg-white/70 text-xl shadow-sm hover:border-teal-200 hover:bg-teal-50">{value}</button>
    {open && <div className="absolute left-0 top-full z-[80] mt-2 grid w-64 grid-cols-7 gap-1.5 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-[0_18px_45px_rgba(15,118,110,.18)] backdrop-blur-xl" role="menu" aria-label="Bộ sưu tập icon">
      {deckIconOptions.map(([icon, label]) => <button key={icon} type="button" title={label} aria-label={label} onClick={() => { onChange(icon); setOpen(false); }} className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:scale-110 hover:bg-teal-50 ${value === icon ? "bg-teal-100 ring-2 ring-teal-300" : ""}`}>{icon}</button>)}
    </div>}
  </div>;
}

export default function DeckSetup({
  preview,
  loading,
  onImageChange,
  onGenerate,
  onGenerateMcq,
  onImportDeck,
  onCreateDeck,
  onSaveDeck,
  savedDecks,
  onOpenDeck,
  onEditDeck,
  onDeleteDeck,
  onShareDeck,
  onCreateMcqFromDeck,
  aiCallsRemaining,
  onStudyDue,
  currentUserId,
}: Props) {
  const [mode, setMode] = useState<SetupMode>("import");
  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<DraftCard[]>([newDraftCard()]);
  const [startingReview, setStartingReview] = useState(false);
  const [showAddedCards, setShowAddedCards] = useState(false);
  const [deckIcons, setDeckIcons] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("hocbai-deck-icons") || "{}"); } catch { return {}; }
  });

  const validCards = cards.filter(
    (card) => card.question.trim() && card.answer.trim()
  );

  function updateCard(
    id: string,
    field: "question" | "answer",
    value: string
  ) {
    setCards((previous) =>
      previous.map((card) =>
        card.id === id ? { ...card, [field]: value } : card
      )
    );
  }

  function removeCard(id: string) {
    setCards((previous) =>
      previous.length === 1
        ? previous
        : previous.filter((card) => card.id !== id)
    );
  }

  function startNewDeck() {
    setMode("create");
    setTitle("");
    setCards([newDraftCard()]);
    setShowAddedCards(false);
  }

  function updateDeckIcon(deckId: string, icon: string) {
    setDeckIcons((current) => {
      const next = { ...current, [deckId]: icon };
      localStorage.setItem("hocbai-deck-icons", JSON.stringify(next));
      return next;
    });
  }

  function createDeck() {
    if (validCards.length === 0) return;
    onCreateDeck(title.trim() || "Bộ thẻ mới", buildQuestions());
  }

  function startDueReview() {
    if (startingReview) return;
    void onStudyDue(() => setStartingReview(true));
  }

  function buildQuestions(): GeneratedQuestion[] {
    return validCards.map((card, index) => ({
        id: card.id,
        question: card.question.trim(),
        answer: card.answer.trim(),
        category: "Tự tạo",
        importance: index + 1,
        bookmarked: false,
      }));
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      <div className="mb-7">
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold tracking-tight text-rose-950 sm:text-4xl">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-fuchsia-100 p-1"><img src="/brain-learning-icon.png" alt="Não bộ" className="h-full w-full object-contain" /></span>
          Nạp kiến thức vào bộ nhớ
        </h1>
      </div>

      <div className={`setup-mode-tabs setup-mode-tabs--${mode} mb-6 grid gap-2 rounded-lg border border-rose-100 bg-white/70 p-1 shadow-sm sm:grid-cols-3`}>
        <span className="setup-mode-tabs__glider" aria-hidden="true" />
        <button
          onClick={() => setMode("import")}
          className={`setup-mode-tab flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold ${mode === "import" ? "setup-mode-tab--active" : "text-slate-600 hover:text-rose-700"}`}
        >
          <FileText size={18} />
          Nhập file
        </button>
        <button
          onClick={() => setMode("create")}
          className={`setup-mode-tab flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold ${mode === "create" ? "setup-mode-tab--active" : "text-slate-600 hover:text-rose-700"}`}
        >
          <Plus size={18} />
          Tạo mới
        </button>
        <button
          onClick={() => setMode("ai")}
          className={`setup-mode-tab flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold ${mode === "ai" ? "setup-mode-tab--active" : "text-slate-600 hover:text-rose-700"}`}
        >
          <Sparkles size={18} />
          Từ ảnh
        </button>
      </div>


      {savedDecks.length > 0 && (
        <div className="relative mb-6">
          {startingReview && <span className="study-runner" aria-hidden="true">🏃‍♂️</span>}
          <div className={`glass-panel flex flex-col gap-5 rounded-2xl border border-teal-100 bg-gradient-to-r from-rose-50 via-white to-teal-50 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8 ${startingReview ? "study-box-exit" : ""}`}>
          <div><p className="text-sm font-semibold text-teal-600">🌸 Ôn tập thông minh</p><h2 className="mt-1 text-2xl font-bold text-rose-950 sm:text-3xl">Hôm nay ôn gì nhỉ?</h2><p className="mt-2 text-sm text-slate-500">Ôn bài lẹ đi, Thầy sắp díiiii rồi!!!</p></div>
          <button disabled={startingReview} onClick={startDueReview} className="inline-flex items-center justify-center rounded-xl bg-teal-400 px-6 py-4 text-sm font-bold text-white shadow-sm hover:bg-teal-500 disabled:cursor-wait sm:min-w-44">Ôn lẹ <ArrowRight size={18} className="ml-2" /></button>
          </div>
        </div>
      )}

      {savedDecks.length > 0 && (
        <div className="glass-panel deck-library-panel mb-6 rounded-lg border border-teal-100 bg-teal-50/60 p-4">
          <p className="mb-3 text-sm font-bold text-teal-900">Bộ thẻ đã lưu</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {savedDecks.map((deck) => (
              <div key={deck.id} className="glass-card deck-library-card relative flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm hover:bg-teal-100">
                <DeckIconPicker title={deck.title} value={deckIcons[deck.id] || deckIcon(deck.title)} onChange={(icon) => updateDeckIcon(deck.id, icon)} />
                <button onClick={() => onOpenDeck(deck)} className="flex min-w-0 flex-1 items-center justify-between text-left">
                <span className="truncate">{deck.title}</span>
                <span className="ml-3 text-xs text-slate-400">{deck.cards.length} thẻ</span>
                </button>
                {(deck.owner_id === currentUserId || deck.member_role === "admin" || deck.member_access === "edit") && <>
                  <button onClick={() => onShareDeck(deck)} title="Chia sẻ bộ thẻ" aria-label="Chia sẻ bộ thẻ" className="rounded-md p-2 text-sky-600 hover:bg-sky-50"><Share2 size={16} /></button>
                  <button onClick={() => onCreateMcqFromDeck(deck)} title="Tạo trắc nghiệm từ bộ thẻ" aria-label="Tạo trắc nghiệm từ bộ thẻ" className="rounded-md p-2 text-violet-600 hover:bg-violet-50"><ListChecks size={16} /></button>
                  <button onClick={startNewDeck} title="Tạo bộ thẻ mới cùng cấp" aria-label="Tạo bộ thẻ mới cùng cấp" className="rounded-md p-2 text-violet-600 hover:bg-violet-50"><Plus size={16} /></button>
                  <button onClick={() => onEditDeck(deck)} title="Sửa bộ thẻ" aria-label="Sửa bộ thẻ" className="rounded-md p-2 text-teal-600 hover:bg-teal-50"><Pencil size={16} /></button>
                  <button onClick={() => onDeleteDeck(deck)} title="Xóa bộ thẻ" aria-label="Xóa bộ thẻ" className="rounded-md p-2 text-rose-500 hover:bg-rose-50"><Trash2 size={16} /></button>
                </>}
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "import" && (
        <div className="glass-panel mode-panel rounded-lg border border-rose-100 bg-white/85 p-6 shadow-sm sm:p-8">
          <label
            htmlFor="anki-file"
            className="flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-rose-200 bg-rose-50/60 px-6 text-center hover:border-teal-300 hover:bg-teal-50/60"
          >
            <UploadCloud size={42} className="text-rose-400" />
            <p className="mt-5 text-xl font-bold text-slate-900">
              Chọn file thẻ
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Hỗ trợ file Anki .apkg, hoặc file export dạng plain text, CSV,
              TSV. Với file text, mỗi dòng nên có mặt trước và mặt sau.
            </p>
            <span className="mt-5 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              .apkg .txt .csv .tsv
            </span>
          </label>
          <input
            id="anki-file"
            hidden
            type="file"
            accept=".apkg,.txt,.csv,.tsv,text/plain,text/csv"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              await onImportDeck(file);
              event.target.value = "";
            }}
          />
        </div>
      )}

      {mode === "create" && (
        <div className="glass-panel mode-panel rounded-lg border border-rose-100 bg-white/85 p-6 shadow-sm sm:p-8">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-rose-100 bg-white/90 px-4 py-3 text-lg font-semibold text-rose-950 outline-none focus:border-rose-300"
            placeholder="Bộ thẻ mới"
          />

          {validCards.length > 0 && <div className="mt-6 overflow-hidden rounded-2xl border border-teal-100 bg-teal-50/50">
            <button type="button" onClick={() => setShowAddedCards((open) => !open)} aria-expanded={showAddedCards} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.16em] text-teal-700 hover:bg-teal-50">
              <span>Đã thêm {validCards.length} thẻ</span>
              <ChevronDown size={17} className={`shrink-0 transition-transform duration-200 ${showAddedCards ? "rotate-180" : ""}`} />
            </button>
            {showAddedCards && <div className="space-y-2 border-t border-teal-100 p-3">
              {validCards.map((card, index) => <div key={card.id} className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/85 px-3 py-2 text-sm text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate" dangerouslySetInnerHTML={{ __html: card.question }} />
                <button type="button" onClick={() => removeCard(card.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Xóa thẻ ${index + 1}`}><Trash2 size={16} /></button>
              </div>)}
            </div>}
          </div>}

          {cards.slice(-1).map((card) => <div key={card.id} className="mt-6 rounded-2xl border border-dashed border-rose-200 bg-rose-50/30 p-4">
            <div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-500">Thẻ mới</p><span className="text-xs text-slate-400">Front + Back</span></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Front</p><RichTextEditor value={card.question} onChange={(value) => updateCard(card.id, "question", value)} onClozeCreated={(text) => updateCard(card.id, "answer", text)} placeholder="Mặt trước" capitalizeFirst /></div>
              <div><p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Back</p><RichTextEditor value={card.answer} onChange={(value) => updateCard(card.id, "answer", value)} placeholder="Mặt sau" /></div>
            </div>
          </div>)}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              disabled={!cards[cards.length - 1]?.question.trim() || !cards[cards.length - 1]?.answer.trim()}
              onClick={() => setCards((previous) => [...previous, newDraftCard()])}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-100 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={18} />
              Thêm thẻ
            </button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button disabled={validCards.length === 0} onClick={() => void onSaveDeck(title.trim() || "Bộ thẻ mới", buildQuestions())} className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-white px-5 py-3 text-sm font-bold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"><Save size={18} /> Lưu</button>
              <button disabled={validCards.length === 0} onClick={createDeck} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-5 py-3 text-sm font-bold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40">Lưu &amp; học ngay <ArrowRight size={18} /></button>
            </div>
          </div>
        </div>
      )}

      {mode === "ai" && (
        <div className="glass-panel rounded-lg border border-rose-100 bg-white/85 p-6 shadow-sm sm:p-8">
          <label
            htmlFor="upload"
            className="flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-rose-200 bg-rose-50/60 px-6 text-center hover:border-teal-300 hover:bg-teal-50/60"
          >
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="max-h-[260px] rounded-lg border border-slate-200 object-contain"
              />
            ) : (
              <>
                <UploadCloud size={42} className="text-rose-400" />
                <p className="mt-5 text-xl font-bold text-slate-900">
                  Chọn ảnh bài học
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Dùng ảnh từ sách, slide hoặc ghi chú để AI tạo thẻ.
                </p>
              </>
            )}
          </label>

          <input
            id="upload"
            hidden
            type="file"
            accept="image/*"
            onChange={onImageChange}
          />

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button disabled={!preview || loading} onClick={onGenerate} className="flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-5 py-4 font-bold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "AI đang tạo..." : "Tạo Cloze"}{!loading && <ArrowRight size={18} />}</button>
            <div>
              <button disabled={!preview || loading} onClick={onGenerateMcq} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-400 px-5 py-4 font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "AI đang tạo..." : "Tạo trắc nghiệm"}{!loading && <ArrowRight size={18} />}</button>
            </div>
          </div>
          <p className="mt-2 text-right text-[10px] font-medium text-slate-300" title="Số lượt AI ước tính còn lại">{aiCallsRemaining}</p>
        </div>
      )}
    </section>
  );
}
