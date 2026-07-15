import React, { useState } from "react";
import {
  Activity,
  Ambulance,
  ArrowRight,
  Baby,
  Bean,
  Bone,
  Brain,
  ChevronDown,
  Dna,
  Droplets,
  Ear,
  Eye,
  FileText,
  FlaskConical,
  HeartPulse,
  Hospital,
  ListChecks,
  Plus,
  Pencil,
  Ribbon,
  Salad,
  Save,
  Scissors,
  Settings2,
  Share2,
  Soup,
  Sparkles,
  Stethoscope,
  Syringe,
  Trash2,
  UploadCloud,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GeneratedQuestion } from "../services/api";
import type { SavedDeck } from "../services/supabase";
import { hasCloze, toClozeAnswerHtml } from "../utils/richText";
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

interface DeckIconOption {
  id: string;
  label: string;
  Icon: LucideIcon;
  iconClass: string;
  tileClass: string;
}

const deckIconOptions: DeckIconOption[] = [
  { id: "respiratory", label: "Hô hấp", Icon: Wind, iconClass: "text-sky-600", tileClass: "bg-sky-50" },
  { id: "cardiology", label: "Tim mạch", Icon: HeartPulse, iconClass: "text-rose-600", tileClass: "bg-rose-50" },
  { id: "nephrology", label: "Thận – tiết niệu", Icon: Bean, iconClass: "text-amber-700", tileClass: "bg-amber-50" },
  { id: "gastroenterology", label: "Tiêu hoá", Icon: Soup, iconClass: "text-orange-600", tileClass: "bg-orange-50" },
  { id: "hematology", label: "Huyết học", Icon: Droplets, iconClass: "text-red-600", tileClass: "bg-red-50" },
  { id: "nutrition", label: "Dinh dưỡng", Icon: Salad, iconClass: "text-lime-700", tileClass: "bg-lime-50" },
  { id: "pediatrics", label: "Nhi khoa", Icon: Baby, iconClass: "text-cyan-600", tileClass: "bg-cyan-50" },
  { id: "obstetrics", label: "Sản khoa", Icon: Activity, iconClass: "text-pink-600", tileClass: "bg-pink-50" },
  { id: "surgery", label: "Ngoại khoa", Icon: Scissors, iconClass: "text-indigo-600", tileClass: "bg-indigo-50" },
  { id: "orthopedics", label: "Chấn thương chỉnh hình", Icon: Bone, iconClass: "text-stone-600", tileClass: "bg-stone-100" },
  { id: "neurology", label: "Thần kinh", Icon: Brain, iconClass: "text-violet-600", tileClass: "bg-violet-50" },
  { id: "ophthalmology", label: "Mắt", Icon: Eye, iconClass: "text-blue-600", tileClass: "bg-blue-50" },
  { id: "ent", label: "Tai mũi họng", Icon: Ear, iconClass: "text-teal-600", tileClass: "bg-teal-50" },
  { id: "oncology", label: "Ung bướu", Icon: Ribbon, iconClass: "text-fuchsia-600", tileClass: "bg-fuchsia-50" },
  { id: "emergency", label: "Cấp cứu", Icon: Ambulance, iconClass: "text-red-600", tileClass: "bg-red-50" },
  { id: "laboratory", label: "Xét nghiệm", Icon: FlaskConical, iconClass: "text-purple-600", tileClass: "bg-purple-50" },
  { id: "genetics", label: "Di truyền", Icon: Dna, iconClass: "text-emerald-600", tileClass: "bg-emerald-50" },
  { id: "general", label: "Tổng quát", Icon: Stethoscope, iconClass: "text-slate-600", tileClass: "bg-slate-100" },
  { id: "hospital", label: "Bệnh viện", Icon: Hospital, iconClass: "text-teal-700", tileClass: "bg-teal-50" },
  { id: "injection", label: "Tiêm chủng", Icon: Syringe, iconClass: "text-cyan-700", tileClass: "bg-cyan-50" },
];

const legacyDeckIconIds: Record<string, string> = {
  "🫁": "respiratory", "❤️": "cardiology", "🩺": "general", "🍽️": "gastroenterology",
  "🩸": "hematology", "🥗": "nutrition", "🧸": "pediatrics", "🤰": "obstetrics",
  "🦴": "orthopedics", "💓": "cardiology", "🧪": "laboratory", "🧬": "genetics",
  "🎋": "general", "📚": "general",
};

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
  if (name.includes("hô hấp") || name.includes("ho hap") || name.includes("phổi") || name.includes("phoi")) return "respiratory";
  if (name.includes("tim") || name.includes("mạch") || name.includes("mach")) return "cardiology";
  if (name.includes("thận") || name.includes("than") || name.includes("tiết niệu") || name.includes("tiet nieu")) return "nephrology";
  if (name.includes("tiêu hoá") || name.includes("tiêu hóa") || name.includes("tieu hoa")) return "gastroenterology";
  if (name.includes("huyết") || name.includes("huyet")) return "hematology";
  if (name.includes("dinh dưỡng") || name.includes("dinh duong")) return "nutrition";
  if (name.includes("nhi")) return "pediatrics";
  if (name.includes("sản") || name.includes("san")) return "obstetrics";
  if (name.includes("ngoại") || name.includes("ngoai") || name.includes("phẫu thuật") || name.includes("phau thuat")) return "surgery";
  if (name.includes("xương") || name.includes("xuong") || name.includes("chấn thương") || name.includes("chan thuong") || name.includes("giải phẫu") || name.includes("giai phau")) return "orthopedics";
  if (name.includes("thần kinh") || name.includes("than kinh")) return "neurology";
  if (name.includes("mắt") || name.includes("mat") || name.includes("nhãn") || name.includes("nhan")) return "ophthalmology";
  if (name.includes("tai mũi họng") || name.includes("tai mui hong")) return "ent";
  if (name.includes("ung bướu") || name.includes("ung buou") || name.includes("ung thư") || name.includes("ung thu")) return "oncology";
  if (name.includes("cấp cứu") || name.includes("cap cuu")) return "emergency";
  if (name.includes("xét nghiệm") || name.includes("xet nghiem") || name.includes("hoá sinh") || name.includes("hóa sinh") || name.includes("hoa sinh")) return "laboratory";
  if (name.includes("di truyền") || name.includes("di truyen") || name.includes("sinh học") || name.includes("sinh hoc")) return "genetics";
  if (name.includes("nội") || name.includes("noi")) return "hospital";
  return "general";
}

function DeckIconPicker({ title, value, onChange }: { title: string; value: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedId = legacyDeckIconIds[value] || value || deckIcon(title);
  const selected = deckIconOptions.find((option) => option.id === selectedId) || deckIconOptions.find((option) => option.id === deckIcon(title)) || deckIconOptions[0];
  const SelectedIcon = selected.Icon;
  return <div className="relative shrink-0">
    <button type="button" title={`${selected.label} · Bấm để đổi icon`} aria-label={`Đổi icon cho ${title}`} onClick={() => setOpen((current) => !current)} className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/80 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 ${selected.tileClass}`}><SelectedIcon size={19} strokeWidth={2} className={selected.iconClass} /></button>
    {open && <div className="absolute left-0 top-full z-[100] mt-2 grid w-80 grid-cols-4 gap-2 rounded-2xl border border-white/90 bg-white/95 p-3 shadow-[0_20px_55px_rgba(15,118,110,.22)] backdrop-blur-2xl" role="menu" aria-label="Bộ sưu tập icon khoa bệnh viện">
      {deckIconOptions.map(({ id, label, Icon, iconClass, tileClass }) => <button key={id} type="button" title={label} aria-label={label} onClick={() => { onChange(id); setOpen(false); }} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-1 py-2 text-center transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-sm ${selected.id === id ? "border-teal-300 bg-teal-50 ring-2 ring-teal-200" : "bg-white/70"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tileClass}`}><Icon size={18} strokeWidth={2} className={iconClass} /></span><span className="line-clamp-2 text-[10px] font-semibold leading-tight text-slate-600">{label}</span></button>)}
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
  const [openDeckMenuId, setOpenDeckMenuId] = useState<string | null>(null);
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
    const previousCard = cards.find((card) => card.id === id);
    const syncedAnswer = field === "question" ? toClozeAnswerHtml(value) : "";
    const shouldSyncAnswer = field === "question" && (Boolean(syncedAnswer) || hasCloze(previousCard?.question ?? ""));
    const nextCards = cards.map((card) => card.id === id
      ? { ...card, [field]: value, ...(shouldSyncAnswer ? { answer: syncedAnswer } : {}) }
      : card
    );
    setCards(nextCards);
    const updatedCard = nextCards.find((card) => card.id === id);
    if (updatedCard?.question.trim() && updatedCard.answer.trim()) {
      void onSaveDeck(title.trim() || "Bộ thẻ mới", buildQuestions(nextCards));
    }
  }

  function removeCard(id: string) {
    setCards((previous) =>
      previous.length === 1
        ? previous
        : previous.filter((card) => card.id !== id)
    );
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

  function buildQuestions(sourceCards: DraftCard[] = cards): GeneratedQuestion[] {
    return sourceCards.filter((card) => card.question.trim() && card.answer.trim()).map((card, index) => ({
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
        <div className="glass-panel deck-library-panel mb-6 rounded-2xl border border-teal-100 bg-teal-50/60 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-sm font-bold text-teal-900">Bộ thẻ đã lưu</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500" aria-label="Trạng thái thẻ">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" />Mới</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" />Đang học</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Đến hạn</span>
            </div>
          </div>
          <div className="space-y-2">
            {savedDecks.map((deck) => (
              <div key={deck.id} className="glass-card deck-library-card relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 rounded-xl bg-white px-3 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-teal-50 sm:grid-cols-[minmax(0,1fr)_3.5rem_4.5rem_4rem_5.5rem]">
                <div className="flex min-w-0 items-center gap-2">
                  <DeckIconPicker title={deck.title} value={deckIcons[deck.id] || deckIcon(deck.title)} onChange={(icon) => updateDeckIcon(deck.id, icon)} />
                  <button onClick={() => onOpenDeck(deck)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate">{deck.title}</span>
                    <span className="mt-0.5 block text-[11px] font-medium text-slate-400">{deck.cards.length} thẻ</span>
                  </button>
                </div>
                <div className="col-span-2 grid grid-cols-3 rounded-lg bg-slate-50/80 px-2 py-2 sm:col-span-1 sm:contents">
                  <div className="text-center"><span className="mb-0.5 block text-[10px] text-slate-400 sm:hidden">Mới</span><span className="font-bold text-sky-500">{deck.review_stats?.new ?? deck.cards.length}</span></div>
                  <div className="text-center"><span className="mb-0.5 block text-[10px] text-slate-400 sm:hidden">Đang học</span><span className="font-bold text-rose-500">{deck.review_stats?.learning ?? 0}</span></div>
                  <div className="text-center"><span className="mb-0.5 block text-[10px] text-slate-400 sm:hidden">Đến hạn</span><span className="font-bold text-emerald-500">{deck.review_stats?.due ?? 0}</span></div>
                </div>
                <div className="absolute right-3 top-3 flex items-center gap-0.5 sm:static sm:justify-end">
                {(deck.owner_id === currentUserId || deck.member_role === "admin" || deck.member_access === "edit") && <>
                  <button onClick={() => onShareDeck(deck)} title="Chia sẻ bộ thẻ" aria-label="Chia sẻ bộ thẻ" className="rounded-md p-2 text-sky-600 hover:bg-sky-50"><Share2 size={16} /></button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDeckMenuId((current) => current === deck.id ? null : deck.id)}
                      title="Tùy chọn bộ thẻ"
                      aria-label="Tùy chọn bộ thẻ"
                      aria-expanded={openDeckMenuId === deck.id}
                      className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
                    >
                      <Settings2 size={17} />
                    </button>
                    {openDeckMenuId === deck.id && (
                      <div className="glass-panel absolute right-0 top-full z-[120] mt-2 w-56 overflow-hidden rounded-xl border border-white/70 bg-white/95 p-1.5 text-sm shadow-xl backdrop-blur-xl">
                        <button type="button" onClick={() => { setOpenDeckMenuId(null); onCreateMcqFromDeck(deck); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-violet-700 hover:bg-violet-50">
                          <ListChecks size={16} />
                          <span>Tạo trắc nghiệm</span>
                        </button>
                        <button type="button" onClick={() => { setOpenDeckMenuId(null); onEditDeck(deck); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-teal-700 hover:bg-teal-50">
                          <Pencil size={16} />
                          <span>Sửa bộ thẻ</span>
                        </button>
                        <button type="button" onClick={() => { setOpenDeckMenuId(null); onDeleteDeck(deck); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-rose-600 hover:bg-rose-50">
                          <Trash2 size={16} />
                          <span>Xóa bộ thẻ</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>}
                </div>
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
              <div><p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Front</p><RichTextEditor value={card.question} onChange={(value) => updateCard(card.id, "question", value)} placeholder="Mặt trước" capitalizeFirst /></div>
              <div><p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Back</p><RichTextEditor value={card.answer} onChange={(value) => updateCard(card.id, "answer", value)} placeholder="Mặt sau" capitalizeFirst /></div>
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
              <button disabled={validCards.length === 0} onClick={() => void onSaveDeck(title.trim() || "Bộ thẻ mới", buildQuestions())} className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-white/80 px-5 py-3 text-sm font-bold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"><Save size={18} /> Lưu</button>
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
