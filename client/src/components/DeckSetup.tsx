import React, { useMemo, useState } from "react";
import {
  Activity,
  Ambulance,
  ArrowRight,
  Baby,
  Bean,
  Bone,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dna,
  Droplets,
  Ear,
  Eye,
  FileText,
  FlaskConical,
  GripVertical,
  HeartPulse,
  Hospital,
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
  TextCursorInput,
  Trash2,
  UploadCloud,
  Wind,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GeneratedQuestion } from "../services/api";
import type { SavedDeck } from "../services/supabase";
import { hasCloze, toClozeAnswerHtml } from "../utils/richText";
import { DEFAULT_SUBDECK, listSubdeckSuggestions, normalizeSubdeck } from "../utils/subdeck";
import { sanitizeHtml, toEditorHtml } from "../utils/richText";
import AnimatedDropdown from "./AnimatedDropdown";
import RichTextEditor from "./RichTextEditor";
import FileDropZone from "./FileDropZone";

interface Props {
  preview: string;
  loading: boolean;
  onImageFileChange: (file: File) => void;
  onGenerate: () => void;
  onGenerateMcq: () => void;
  onGenerateClinicalCase: () => void;
  onImportDeck: (file: File) => Promise<void>;
  onCreateDeck: (title: string, questions: GeneratedQuestion[]) => void;
  onSaveDeck: (title: string, questions: GeneratedQuestion[]) => void | Promise<void>;
  savedDecks: SavedDeck[];
  onOpenDeck: (deck: SavedDeck) => void;
  onMergeSubdecks: (deck: SavedDeck, sourcePath: string, targetPath: string) => void | Promise<void>;
  onMoveSubdeck: (sourceDeck: SavedDeck, sourcePath: string, targetDeck: SavedDeck, targetPath: string) => void | Promise<void>;
  onRenameDeck: (deck: SavedDeck, nextTitle: string) => void | Promise<void>;
  onRenameSubdeck: (deck: SavedDeck, sourcePath: string, nextName: string) => void | Promise<void>;
  onEditDeck: (deck: SavedDeck) => void;
  onEditSubdeck: (deck: SavedDeck, path: string) => void;
  onDeleteDeck: (deck: SavedDeck) => void;
  onDeleteSubdeck: (deck: SavedDeck, path: string) => void | Promise<void>;
  onShareDeck: (deck: SavedDeck) => void;
  aiCallsRemaining: number;
  onStudyDue: (beforeStudy?: () => void) => void | Promise<void>;
  currentUserId?: string;
  authenticated: boolean;
  onRequireLogin: () => void;
}

type SetupMode = "import" | "create" | "ai";
type DeckSort = "recent" | "oldest" | "title-asc" | "title-desc";

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
  category: string;
}

interface SubdeckNode {
  name: string;
  path: string;
  cards: GeneratedQuestion[];
  children: SubdeckNode[];
}

type ReviewStats = SavedDeck["review_stats"];

type RenameTarget =
  | { kind: "deck"; deck: SavedDeck; value: string }
  | { kind: "subdeck"; deck: SavedDeck; path: string; value: string };

type DraggedSubdeck = { deckId: string; path: string; canEdit: boolean };

function buildSubdeckTree(cards: GeneratedQuestion[]): SubdeckNode[] {
  const roots: SubdeckNode[] = [];
  const nodesByPath = new Map<string, SubdeckNode>();

  cards.forEach((card) => {
    const parts = normalizeSubdeck(card.category, "Chưa phân loại").split("::");
    let parent: SubdeckNode | undefined;

    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("::");
      let node = nodesByPath.get(path);
      if (!node) {
        node = { name: part, path, cards: [], children: [] };
        nodesByPath.set(path, node);
        if (parent) parent.children.push(node);
        else roots.push(node);
      }
      node.cards.push(card);
      parent = node;
    });
  });

  return roots;
}

function statsForCards(cards: GeneratedQuestion[]): ReviewStats {
  return cards.reduce<ReviewStats>((stats, card) => {
    const state = card.reviewState || "new";
    stats[state] += 1;
    return stats;
  }, { new: 0, learning: 0, due: 0 });
}

function ReviewColumns({ stats }: { stats: ReviewStats }) {
  return <div className="col-span-2 grid grid-cols-3 rounded-lg bg-slate-50/80 px-2 py-2 sm:col-span-1 sm:contents">
    <div className="text-center"><span className="mb-0.5 block text-[10px] text-slate-400 sm:hidden">Mới</span><span className="font-bold text-sky-500">{stats.new}</span></div>
    <div className="text-center"><span className="mb-0.5 block text-[10px] text-slate-400 sm:hidden">Đang học</span><span className="font-bold text-rose-500">{stats.learning}</span></div>
    <div className="text-center"><span className="mb-0.5 block text-[10px] text-slate-400 sm:hidden">Đến hạn</span><span className="font-bold text-emerald-500">{stats.due}</span></div>
  </div>;
}

function newDraftCard(category = ""): DraftCard {
  return {
    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : String(Date.now()),
    question: "",
    answer: "",
    category,
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

function DeckIconBadge({ title, value, size = 18 }: { title: string; value: string; size?: number }) {
  const selectedId = legacyDeckIconIds[value] || value || deckIcon(title);
  const selected = deckIconOptions.find((option) => option.id === selectedId) || deckIconOptions.find((option) => option.id === deckIcon(title)) || deckIconOptions[0];
  const Icon = selected.Icon;
  return <span title={selected.label} className={`flex shrink-0 items-center justify-center rounded-lg ${selected.tileClass} ${size >= 20 ? "h-9 w-9" : "h-7 w-7"}`}><Icon size={size} strokeWidth={2} className={selected.iconClass} /></span>;
}

export default function DeckSetup({
  preview,
  loading,
  onImageFileChange,
  onGenerate,
  onGenerateMcq,
  onGenerateClinicalCase,
  onImportDeck,
  onCreateDeck,
  onSaveDeck,
  savedDecks,
  onOpenDeck,
  onMergeSubdecks,
  onMoveSubdeck,
  onRenameDeck,
  onRenameSubdeck,
  onEditDeck,
  onEditSubdeck,
  onDeleteDeck,
  onDeleteSubdeck,
  onShareDeck,
  aiCallsRemaining,
  onStudyDue,
  currentUserId,
  authenticated,
  onRequireLogin,
}: Props) {
  const [mode, setMode] = useState<SetupMode>("import");
  const [title, setTitle] = useState("");
  const [subdeck, setSubdeck] = useState("");
  const [cards, setCards] = useState<DraftCard[]>([newDraftCard()]);
  const [startingReview, setStartingReview] = useState(false);
  const [showAddedCards, setShowAddedCards] = useState(false);
  const [openDeckMenuId, setOpenDeckMenuId] = useState<string | null>(null);
  const [collapsedDeckIds, setCollapsedDeckIds] = useState<Set<string>>(new Set());
  const [draggedSubdeck, setDraggedSubdeck] = useState<DraggedSubdeck | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [mergingSubdeckKey, setMergingSubdeckKey] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [deckSort, setDeckSort] = useState<DeckSort>("recent");
  const [previewDeck, setPreviewDeck] = useState<SavedDeck | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [deckIcons, setDeckIcons] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("hocbai-deck-icons") || "{}"); } catch { return {}; }
  });

  const validCards = cards.filter(
    (card) => card.question.trim() && card.answer.trim()
  );
  const sortedDecks = useMemo(() => [...savedDecks].sort((left, right) => {
    if (deckSort === "title-asc") return left.title.localeCompare(right.title, "vi");
    if (deckSort === "title-desc") return right.title.localeCompare(left.title, "vi");
    const leftDate = Date.parse(left.created_at || "") || 0;
    const rightDate = Date.parse(right.created_at || "") || 0;
    return deckSort === "oldest" ? leftDate - rightDate : rightDate - leftDate;
  }), [deckSort, savedDecks]);
  const dueCardCount = useMemo(() => savedDecks.reduce((total, deck) => total + (deck.review_stats?.due ?? statsForCards(deck.cards).due), 0), [savedDecks]);
  const previewCards = previewDeck ? previewDeck.cards.slice(previewPage * 8, previewPage * 8 + 8) : [];
  const previewPageCount = previewDeck ? Math.max(1, Math.ceil(previewDeck.cards.length / 8)) : 1;

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

  function updateSubdeck(value: string) {
    setSubdeck(value);
    setCards((previous) => previous.map((card, index) => index === previous.length - 1 ? { ...card, category: value } : card));
  }

  function commitSubdeck() {
    const normalized = normalizeSubdeck(subdeck, DEFAULT_SUBDECK);
    const nextCards = cards.map((card, index) => index === cards.length - 1 ? { ...card, category: normalized } : card);
    setSubdeck(normalized);
    setCards(nextCards);
    const currentCard = nextCards[nextCards.length - 1];
    if (currentCard?.question.trim() && currentCard.answer.trim()) {
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

  function toggleDeckChildren(deckId: string) {
    setCollapsedDeckIds((current) => {
      const next = new Set(current);
      if (next.has(deckId)) next.delete(deckId);
      else next.add(deckId);
      return next;
    });
  }

  function openDeckPreview(deck: SavedDeck) {
    setPreviewDeck(deck);
    setPreviewPage(0);
  }

  function submitRename() {
    if (!renameTarget) return;
    const target = renameTarget;
    const value = target.value.trim();
    if (!value) return;
    setRenameTarget(null);
    if (target.kind === "deck") void onRenameDeck(target.deck, value);
    else void onRenameSubdeck(target.deck, target.path, value);
  }

  function readDraggedSubdeck(event: React.DragEvent<HTMLElement>): DraggedSubdeck | null {
    const raw = event.dataTransfer.getData("application/x-hocbai-subdeck") || event.dataTransfer.getData("text/plain");
    try {
      const parsed = JSON.parse(raw) as Partial<DraggedSubdeck>;
      if (typeof parsed.deckId !== "string" || typeof parsed.path !== "string" || parsed.canEdit !== true) return null;
      return { deckId: parsed.deckId, path: parsed.path, canEdit: true };
    } catch {
      return null;
    }
  }

  function dropSubdeck(targetDeck: SavedDeck, targetPath: string, targetKey: string, dragged = draggedSubdeck) {
    if (!dragged || !dragged.canEdit) return;
    const sourceDeck = savedDecks.find((deck) => deck.id === dragged.deckId);
    if (!sourceDeck || sourceDeck.id === targetDeck.id && (!targetPath || targetPath === dragged.path || targetPath.startsWith(`${dragged.path}::`))) return;
    setDropTargetKey(null);
    setMergingSubdeckKey(targetKey);
    const operation = sourceDeck.id === targetDeck.id
      ? onMergeSubdecks(targetDeck, dragged.path, targetPath)
      : onMoveSubdeck(sourceDeck, dragged.path, targetDeck, targetPath);
    void Promise.resolve(operation).finally(() => {
      setDraggedSubdeck(null);
      setMergingSubdeckKey(null);
    });
  }

  function renderSubdeckRows(nodes: SubdeckNode[], deck: SavedDeck, canEdit: boolean, depth = 0): React.ReactNode {
    return nodes.map((node) => {
      const childDeck: SavedDeck = {
        ...deck,
        title: `${deck.title} · ${node.path.replace(/::/g, " · ")}`,
        cards: node.cards,
        review_stats: statsForCards(node.cards),
      };
      const stats = statsForCards(node.cards);
      const rowKey = `${deck.id}:${node.path}`;
      const canDrop = Boolean(
        canEdit &&
        draggedSubdeck?.canEdit &&
        (draggedSubdeck.deckId !== deck.id || (draggedSubdeck.path !== node.path && !node.path.startsWith(`${draggedSubdeck.path}::`)))
      );
      const isDropTarget = dropTargetKey === rowKey && canDrop;
      const isMerging = mergingSubdeckKey === rowKey;
      return <React.Fragment key={node.path}>
        <div className={`deck-library-subdeck relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg bg-white/75 px-3 py-2 text-sm font-semibold text-slate-700 transition sm:grid-cols-[minmax(0,1fr)_4rem_4rem_4rem_5.5rem] ${isDropTarget ? "bg-teal-50 ring-2 ring-teal-300" : "hover:bg-teal-50"} ${isMerging ? "cursor-wait opacity-60" : ""}`}>
          <button
            type="button"
            draggable={canEdit}
            onClick={() => onOpenDeck(childDeck)}
            onDragStart={(event) => {
              if (!canEdit) return;
              event.dataTransfer.effectAllowed = "move";
              const payload = JSON.stringify({ deckId: deck.id, path: node.path, canEdit });
              event.dataTransfer.setData("application/x-hocbai-subdeck", payload);
              event.dataTransfer.setData("text/plain", payload);
              setDraggedSubdeck({ deckId: deck.id, path: node.path, canEdit });
            }}
            onDragOver={(event) => {
              const dragged = readDraggedSubdeck(event);
              const canDropNow = Boolean(canEdit && dragged && (dragged.deckId !== deck.id || (dragged.path !== node.path && !node.path.startsWith(`${dragged.path}::`))));
              if (!canDropNow) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTargetKey(rowKey);
            }}
            onDragLeave={() => setDropTargetKey((current) => current === rowKey ? null : current)}
            onDrop={(event) => {
              event.preventDefault();
              if (!canEdit) return;
              const dragged = readDraggedSubdeck(event);
              if (!dragged) return;
              dropSubdeck(deck, node.path, rowKey, dragged);
            }}
            onDragEnd={() => { setDraggedSubdeck(null); setDropTargetKey(null); }}
            title={canEdit ? "Kéo mục này lên mục khác để gộp" : "Mở mục con để học"}
            aria-label={`${node.name}, ${node.cards.length} thẻ`}
            className="col-span-2 grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 pr-20 text-left sm:col-span-4 sm:grid-cols-[minmax(0,1fr)_4rem_4rem_4rem] sm:pr-0"
          >
            <span className="flex min-w-0 items-center gap-2" style={{ paddingLeft: `${depth * 1.1}rem` }}>
              {canEdit ? <GripVertical size={15} className="shrink-0 cursor-grab text-slate-400 active:cursor-grabbing" aria-hidden="true" /> : <span className="w-[15px] shrink-0" />}
              {node.children.length > 0 ? <ChevronRight size={15} className="shrink-0 text-slate-400" aria-hidden="true" /> : <span className="w-[15px] shrink-0" />}
              <span className="min-w-0 truncate">{node.name}</span>
              <span className="shrink-0 text-[11px] font-medium text-slate-400">{node.cards.length} thẻ</span>
            </span>
            <span className="text-center font-bold text-sky-500">{stats.new}</span>
            <span className="text-center font-bold text-rose-500">{stats.learning}</span>
            <span className="text-center font-bold text-emerald-500">{stats.due}</span>
          </button>
          <div className="absolute right-3 top-1 flex items-center gap-0.5">
            <button type="button" onClick={() => openDeckPreview(childDeck)} title="Xem trước mục con" aria-label={`Xem trước ${node.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-violet-600 hover:bg-violet-50"><Eye size={17} /></button>
            {(deck.owner_id === currentUserId || deck.member_role === "admin") && <button type="button" onClick={() => onShareDeck(deck)} title="Chia sẻ bộ thẻ cha" aria-label={`Chia sẻ bộ thẻ cha của ${node.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sky-600 hover:bg-sky-50"><Share2 size={16} /></button>}
            {canEdit && <div className="relative h-9 w-9 shrink-0">
              <button type="button" onClick={() => setOpenDeckMenuId((current) => current === rowKey ? null : rowKey)} title="Tùy chọn mục con" aria-label={`Tùy chọn mục con ${node.name}`} aria-expanded={openDeckMenuId === rowKey} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"><Settings2 size={17} /></button>
              {openDeckMenuId === rowKey && <div role="menu" className="absolute right-0 top-full z-[120] mt-2 w-56 overflow-hidden rounded-xl border border-white/70 bg-white/95 p-1.5 text-sm shadow-xl backdrop-blur-xl">
                <button type="button" onClick={() => { setOpenDeckMenuId(null); setRenameTarget({ kind: "subdeck", deck, path: node.path, value: node.name }); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-teal-700 hover:bg-teal-50"><TextCursorInput size={16} /><span>Đổi tên mục con</span></button>
                <button type="button" onClick={() => { setOpenDeckMenuId(null); onEditSubdeck(deck, node.path); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-teal-700 hover:bg-teal-50"><Pencil size={16} /><span>Sửa mục con</span></button>
                <button type="button" onClick={() => { setOpenDeckMenuId(null); if (confirm(`Xóa mục con “${node.name}” và ${node.cards.length} thẻ bên trong? Hành động này không thể hoàn tác.`)) void onDeleteSubdeck(deck, node.path); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-rose-600 hover:bg-rose-50"><Trash2 size={16} /><span>Xóa mục con</span></button>
              </div>}
            </div>}
          </div>
        </div>
        {node.children.length > 0 && renderSubdeckRows(node.children, deck, canEdit, depth + 1)}
      </React.Fragment>;
    });
  }

  function createDeck() {
    if (!authenticated) { onRequireLogin(); return; }
    if (validCards.length === 0) return;
    onCreateDeck(title.trim() || "Bộ thẻ mới", buildQuestions());
  }

  function selectMode(nextMode: SetupMode) {
    if (!authenticated) { onRequireLogin(); return; }
    setMode(nextMode);
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
        category: normalizeSubdeck(card.category || subdeck, DEFAULT_SUBDECK),
        importance: index + 1,
        bookmarked: false,
      }));
  }

  const subdeckSuggestions = listSubdeckSuggestions(savedDecks.flatMap((deck) => deck.cards.map((card) => card.category)));

  return (
    <section className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:py-12">
      <div className={`setup-mode-tabs setup-mode-tabs--${mode} mb-6 grid gap-2 rounded-3xl border border-rose-100 bg-white/70 p-1 shadow-sm sm:grid-cols-3`}>
        <span className="setup-mode-tabs__glider" aria-hidden="true" />
        <button
          onClick={() => selectMode("import")}
          className={`setup-mode-tab flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold ${mode === "import" ? "setup-mode-tab--active" : "text-slate-600 hover:text-rose-700"}`}
        >
          <FileText size={18} />
          Nhập file
        </button>
        <button
          onClick={() => selectMode("create")}
          className={`setup-mode-tab flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold ${mode === "create" ? "setup-mode-tab--active" : "text-slate-600 hover:text-rose-700"}`}
        >
          <Plus size={18} />
          Tạo mới
        </button>
        <button
          onClick={() => selectMode("ai")}
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
          <div><p className="text-sm font-semibold text-teal-600">🌸 Ôn tập thông minh</p><h2 className="mt-1 text-2xl font-bold text-rose-950 sm:text-3xl">Hôm nay ôn gì nhỉ?</h2><p className="mt-2 text-sm text-slate-500">Hôm nay có {dueCardCount} thẻ cần ôn</p></div>
          <button disabled={startingReview} onClick={startDueReview} className="inline-flex items-center justify-center rounded-xl bg-teal-400 px-6 py-4 text-sm font-bold text-white shadow-sm hover:bg-teal-500 disabled:cursor-wait sm:min-w-44">Ôn lẹ <ArrowRight size={18} className="ml-2" /></button>
          </div>
        </div>
      )}

      {savedDecks.length > 0 && (
        <div className="glass-panel deck-library-panel mb-6 rounded-2xl border border-teal-100 bg-teal-50/60 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-sm font-bold text-teal-900">Bộ thẻ đã lưu</p>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-500" aria-label="Trạng thái thẻ">
              <label className="flex items-center gap-1.5 text-slate-600"><span className="sr-only">Sắp xếp bộ thẻ</span><AnimatedDropdown value={deckSort} options={[{ value: "recent", label: "Gần nhất" }, { value: "oldest", label: "Xa nhất" }, { value: "title-asc", label: "A-Z" }, { value: "title-desc", label: "Z-A" }]} onChange={(value) => setDeckSort(value as DeckSort)} ariaLabel="Sắp xếp bộ thẻ" triggerClassName="h-7 rounded-lg border border-teal-100 bg-white px-2 py-1 text-[11px] font-bold text-slate-600" menuClassName="right-0 left-auto min-w-28" /></label>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" />Mới</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" />Đang học</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Đến hạn</span>
            </div>
          </div>
          <div className="space-y-2">
            {sortedDecks.map((deck) => {
              const subdeckTree = buildSubdeckTree(deck.cards);
              const canEdit = deck.owner_id === currentUserId || deck.member_role === "admin" || deck.member_access === "edit";
              const parentRowKey = `${deck.id}:`;
              const canDropParent = Boolean(canEdit && draggedSubdeck?.canEdit && draggedSubdeck.deckId !== deck.id);
              const isParentDropTarget = dropTargetKey === parentRowKey && canDropParent;
              return <React.Fragment key={deck.id}>
              <div
                onDragOver={(event) => {
                  const dragged = readDraggedSubdeck(event);
                  if (!canEdit || !dragged || dragged.deckId === deck.id) return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "move";
                  setDropTargetKey(parentRowKey);
                }}
                onDragLeave={() => setDropTargetKey((current) => current === parentRowKey ? null : current)}
                onDrop={(event) => {
                  if (!canEdit) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const dragged = readDraggedSubdeck(event);
                  if (dragged) dropSubdeck(deck, "", parentRowKey, dragged);
                }}
                className={`glass-card deck-library-card relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 rounded-xl bg-white px-3 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition sm:grid-cols-[minmax(0,1fr)_4rem_4rem_4rem_5.5rem] ${isParentDropTarget ? "bg-teal-50 ring-2 ring-teal-300" : "hover:bg-teal-50"}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {subdeckTree.length > 0 ? <button type="button" onClick={() => toggleDeckChildren(deck.id)} title={collapsedDeckIds.has(deck.id) ? "Mở mục con" : "Thu mục con"} aria-label={collapsedDeckIds.has(deck.id) ? "Mở mục con" : "Thu mục con"} aria-expanded={!collapsedDeckIds.has(deck.id)} className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-teal-50 hover:text-teal-700"><ChevronDown size={17} className={`transition-transform duration-200 ${collapsedDeckIds.has(deck.id) ? "-rotate-90" : ""}`} /></button> : <span className="w-7 shrink-0" />}
                  <DeckIconPicker title={deck.title} value={deckIcons[deck.id] || deckIcon(deck.title)} onChange={(icon) => updateDeckIcon(deck.id, icon)} />
                  <button onClick={() => onOpenDeck(deck)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate">{deck.title}</span>
                    <span className="mt-0.5 block text-[11px] font-medium text-slate-400">{deck.cards.length} thẻ</span>
                  </button>
                </div>
                <ReviewColumns stats={deck.review_stats ?? statsForCards(deck.cards)} />
                <div className="absolute right-3 top-3 flex items-center gap-0.5">
                <button type="button" onClick={() => openDeckPreview(deck)} title="Xem trước bộ thẻ" aria-label={`Xem trước ${deck.title}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-violet-600 hover:bg-violet-50"><Eye size={17} /></button>
                {(deck.owner_id === currentUserId || deck.member_role === "admin") &&
                  <button onClick={() => onShareDeck(deck)} title="Chia sẻ bộ thẻ" aria-label="Chia sẻ bộ thẻ" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sky-600 hover:bg-sky-50"><Share2 size={16} /></button>
                }
                {(deck.owner_id === currentUserId || deck.member_role === "admin" || deck.member_access === "edit") && <>
                  <div className="relative h-9 w-9 shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenDeckMenuId((current) => current === deck.id ? null : deck.id)}
                      title="Tùy chọn bộ thẻ"
                      aria-label="Tùy chọn bộ thẻ"
                      aria-expanded={openDeckMenuId === deck.id}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                    >
                      <Settings2 size={17} />
                    </button>
                    {openDeckMenuId === deck.id && (
                      <div role="menu" className="absolute right-0 top-full z-[120] mt-2 w-56 overflow-hidden rounded-xl border border-white/70 bg-white/95 p-1.5 text-sm shadow-xl backdrop-blur-xl">
                        <button type="button" onClick={() => { setOpenDeckMenuId(null); setRenameTarget({ kind: "deck", deck, value: deck.title }); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sky-700 hover:bg-sky-50">
                          <TextCursorInput size={16} />
                          <span>Đổi tên bộ thẻ</span>
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
              {!collapsedDeckIds.has(deck.id) && subdeckTree.length > 0 && <div className="ml-4 space-y-1 border-l-2 border-teal-100 pl-3 sm:ml-8">{renderSubdeckRows(subdeckTree, deck, canEdit)}</div>}
              </React.Fragment>
            })}
          </div>
        </div>
      )}

      {renameTarget && <div className="fixed inset-0 z-[140] flex items-center justify-center bg-rose-950/25 px-4 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-labelledby="rename-target-title">
        <div className="glass-dialog w-full max-w-md rounded-3xl border border-rose-100 bg-gradient-to-br from-white via-rose-50/80 to-teal-50/80 p-7 shadow-[0_24px_70px_rgba(190,24,93,0.2)]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Đổi tên</p>
          <h2 id="rename-target-title" className="mt-2 text-xl font-bold text-rose-950">{renameTarget.kind === "deck" ? "Đổi tên bộ thẻ" : "Đổi tên mục con"}</h2>
          <input
            autoFocus
            value={renameTarget.value}
            onChange={(event) => setRenameTarget((current) => current ? { ...current, value: event.target.value } : current)}
            onKeyDown={(event) => { if (event.key === "Enter") submitRename(); if (event.key === "Escape") setRenameTarget(null); }}
            className="mt-5 w-full rounded-xl border border-teal-100 bg-white px-4 py-3 font-semibold text-rose-950 outline-none focus:border-teal-300"
          />
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setRenameTarget(null)} className="flex-1 rounded-xl border border-rose-100 bg-white px-4 py-3 text-sm font-bold text-slate-500 hover:bg-rose-50">Hủy</button>
            <button type="button" onClick={submitRename} disabled={!renameTarget.value.trim()} className="flex-1 rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50">Lưu tên</button>
          </div>
        </div>
      </div>}

      {previewDeck && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/30 px-4 py-6 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="deck-preview-title">
        <div className="glass-dialog flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,.22)]">
          <header className="flex items-start justify-between gap-4 border-b border-violet-100 px-5 py-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Eye size={22} /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.15em] text-teal-600">Xem trước bộ thẻ</p><div className="mt-1 flex min-w-0 items-center gap-2"><h2 id="deck-preview-title" className="truncate text-xl font-bold text-rose-950 sm:text-2xl">{previewDeck.title}</h2><DeckIconBadge title={previewDeck.title} value={deckIcons[previewDeck.id] || deckIcon(previewDeck.title)} /></div><p className="mt-1 text-sm text-slate-500">{previewDeck.cards.length} thẻ · chỉ xem, không thay đổi dữ liệu</p></div></div>
            <button type="button" onClick={() => setPreviewDeck(null)} title="Đóng xem trước" aria-label="Đóng xem trước" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={20} /></button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {previewCards.map((card, index) => <article key={card.id} className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-black text-violet-700">{previewPage * 8 + index + 1}</span><div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Front</p><div className="rich-content mt-1 text-sm font-semibold leading-6 text-slate-800" dangerouslySetInnerHTML={{ __html: sanitizeHtml(toEditorHtml(card.question)) }} /></div><div className="border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-teal-600">Back</p><div className="rich-content mt-1 text-sm leading-6 text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizeHtml(toEditorHtml(card.answer)) }} /></div></div></div></article>)}
          </div>
          <footer className="flex items-center justify-between border-t border-violet-100 bg-slate-50/80 px-5 py-3 sm:px-7"><button type="button" disabled={previewPage === 0} onClick={() => setPreviewPage((page) => Math.max(0, page - 1))} title="Trang trước" aria-label="Trang trước" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"><ChevronLeft size={18} /></button><span className="text-xs font-bold text-slate-500">{previewPage + 1} / {previewPageCount}</span><button type="button" disabled={previewPage >= previewPageCount - 1} onClick={() => setPreviewPage((page) => Math.min(previewPageCount - 1, page + 1))} title="Trang sau" aria-label="Trang sau" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"><ChevronRight size={18} /></button></footer>
        </div>
      </div>}

      {mode === "import" && (
        <div className="glass-panel mode-panel rounded-lg border border-rose-100 bg-white/85 p-6 shadow-sm sm:p-8">
          <FileDropZone
            id="anki-file"
            accept=".apkg,.txt,.csv,.tsv,text/plain,text/csv"
            disabled={!authenticated}
            onClick={(event) => { if (!authenticated) { event.preventDefault(); onRequireLogin(); } }}
            onFiles={(files) => { if (files[0]) void onImportDeck(files[0]); }}
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
          </FileDropZone>
        </div>
      )}

      {mode === "create" && (
        <div className="glass-panel mode-panel rounded-lg border border-rose-100 bg-white/85 p-4 shadow-sm sm:p-6">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-rose-100 bg-white/90 px-4 py-3 font-semibold text-rose-950 outline-none focus:border-rose-300"
            placeholder="Bộ thẻ mới"
          />
          <div className="mt-3 ml-5 border-l-2 border-teal-100 pl-3 sm:ml-9">
            <input
              list="subdeck-suggestions"
              value={subdeck}
              onChange={(event) => updateSubdeck(event.target.value)}
              onBlur={commitSubdeck}
              className="w-full rounded-lg border border-teal-100 bg-white/90 px-4 py-3 text-sm font-semibold text-teal-800 outline-none focus:border-teal-300"
              placeholder="Viêm phổi"
              aria-label="Mục con"
            />
            <datalist id="subdeck-suggestions">
              {subdeckSuggestions.map((name) => <option key={name} value={name} />)}
            </datalist>
          </div>

          {validCards.length > 0 && <div className="mt-6 overflow-hidden rounded-2xl border border-teal-100 bg-teal-50/50">
            <button type="button" onClick={() => setShowAddedCards((open) => !open)} aria-expanded={showAddedCards} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.16em] text-teal-700 hover:bg-teal-50">
              <span>Đã thêm {validCards.length} thẻ</span>
              <ChevronDown size={17} className={`shrink-0 transition-transform duration-200 ${showAddedCards ? "rotate-180" : ""}`} />
            </button>
            {showAddedCards && <div className="space-y-2 border-t border-teal-100 p-3">
              {validCards.map((card, index) => <div key={card.id} className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/85 px-3 py-2 text-sm text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate" dangerouslySetInnerHTML={{ __html: card.question }} />
                  <span className="mt-0.5 block truncate text-[10px] font-semibold text-teal-500">Mục con: {normalizeSubdeck(card.category || subdeck, DEFAULT_SUBDECK)}</span>
                </span>
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
              onClick={() => {
                const inheritedSubdeck = normalizeSubdeck(subdeck, DEFAULT_SUBDECK);
                setSubdeck(inheritedSubdeck);
                setCards((previous) => [...previous, newDraftCard(inheritedSubdeck)]);
              }}
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
          <FileDropZone
            id="upload"
            accept="image/*"
            disabled={!authenticated}
            onClick={(event) => { if (!authenticated) { event.preventDefault(); onRequireLogin(); } }}
            onFiles={(files) => { if (files[0]) onImageFileChange(files[0]); }}
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
          </FileDropZone>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <button disabled={!preview || loading} onClick={onGenerate} className="flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-5 py-4 font-bold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "AI đang tạo..." : "Tạo Cloze"}{!loading && <ArrowRight size={18} />}</button>
            <button disabled={!preview || loading} onClick={onGenerateMcq} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-400 px-5 py-4 font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "AI đang tạo..." : "Tạo trắc nghiệm"}{!loading && <ArrowRight size={18} />}</button>
            <button disabled={!preview || loading} onClick={onGenerateClinicalCase} className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-400 px-5 py-4 font-bold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "AI đang tạo..." : "Tạo case lâm sàng"}{!loading && <ArrowRight size={18} />}</button>
          </div>
          <p className="mt-2 text-right text-[10px] font-medium text-slate-300" title="Số lượt AI ước tính còn lại">{aiCallsRemaining}</p>
        </div>
      )}
    </section>
  );
}
