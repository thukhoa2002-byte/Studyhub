import React, { useState } from "react";
import {
  ArrowRight,
  FileText,
  Plus,
  Pencil,
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
  onImportDeck: (file: File) => Promise<void>;
  onCreateDeck: (title: string, questions: GeneratedQuestion[]) => void;
  savedDecks: SavedDeck[];
  onOpenDeck: (deck: SavedDeck) => void;
  onEditDeck: (deck: SavedDeck) => void;
  onDeleteDeck: (deck: SavedDeck) => void;
  onShareDeck: (deck: SavedDeck) => void;
  currentUserId?: string;
}

type SetupMode = "import" | "create" | "ai";

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

export default function DeckSetup({
  preview,
  loading,
  onImageChange,
  onGenerate,
  onImportDeck,
  onCreateDeck,
  savedDecks,
  onOpenDeck,
  onEditDeck,
  onDeleteDeck,
  onShareDeck,
  currentUserId,
}: Props) {
  const [mode, setMode] = useState<SetupMode>("import");
  const [title, setTitle] = useState("Bộ thẻ mới");
  const [cards, setCards] = useState<DraftCard[]>([
    newDraftCard(),
    newDraftCard(),
    newDraftCard(),
  ]);

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

  function createDeck() {
    if (validCards.length === 0) return;

    onCreateDeck(
      title.trim() || "Bộ thẻ mới",
      validCards.map((card, index) => ({
        id: card.id,
        question: card.question.trim(),
        answer: card.answer.trim(),
        category: "Tự tạo",
        importance: index + 1,
        bookmarked: false,
      })),
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      <div className="mb-7">
        <p className="text-sm font-semibold text-rose-500">
          Chọn cách tạo bộ thẻ
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-rose-950 sm:text-4xl">
          Học từ file Anki hoặc tạo thẻ mới
        </h1>
      </div>

      <div className="mb-6 grid gap-2 rounded-lg border border-rose-100 bg-white/80 p-1 shadow-sm sm:grid-cols-3">
        <button
          onClick={() => setMode("import")}
          className={`flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold ${
            mode === "import"
              ? "bg-rose-300 text-rose-950"
              : "text-slate-600 hover:bg-rose-50 hover:text-rose-700"
          }`}
        >
          <FileText size={18} />
          Nhập file
        </button>
        <button
          onClick={() => setMode("create")}
          className={`flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold ${
            mode === "create"
              ? "bg-rose-300 text-rose-950"
              : "text-slate-600 hover:bg-rose-50 hover:text-rose-700"
          }`}
        >
          <Plus size={18} />
          Tạo mới
        </button>
        <button
          onClick={() => setMode("ai")}
          className={`flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold ${
            mode === "ai"
              ? "bg-rose-300 text-rose-950"
              : "text-slate-600 hover:bg-rose-50 hover:text-rose-700"
          }`}
        >
          <Sparkles size={18} />
          Từ ảnh
        </button>
      </div>


      {savedDecks.length > 0 && (
        <div className="mb-6 rounded-lg border border-teal-100 bg-teal-50/60 p-4">
          <p className="mb-3 text-sm font-bold text-teal-900">Bộ thẻ đã lưu</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {savedDecks.map((deck) => (
              <div key={deck.id} className="flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm hover:bg-teal-100">
                <button onClick={() => onOpenDeck(deck)} className="flex min-w-0 flex-1 items-center justify-between text-left">
                <span className="truncate">{deck.visibility === "shared" ? "🌸" : "🔒"} {deck.title}</span>
                <span className="ml-3 text-xs text-slate-400">{deck.cards.length} thẻ</span>
                </button>
                {deck.owner_id === currentUserId && <>
                  <button onClick={() => onShareDeck(deck)} title="Chia sẻ bộ thẻ" aria-label="Chia sẻ bộ thẻ" className="rounded-md p-2 text-sky-600 hover:bg-sky-50"><Share2 size={16} /></button>
                  <button onClick={() => onEditDeck(deck)} title="Sửa bộ thẻ" aria-label="Sửa bộ thẻ" className="rounded-md p-2 text-teal-600 hover:bg-teal-50"><Pencil size={16} /></button>
                  <button onClick={() => onDeleteDeck(deck)} title="Xóa bộ thẻ" aria-label="Xóa bộ thẻ" className="rounded-md p-2 text-rose-500 hover:bg-rose-50"><Trash2 size={16} /></button>
                </>}
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "import" && (
        <div className="rounded-lg border border-rose-100 bg-white/85 p-6 shadow-sm sm:p-8">
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
        <div className="rounded-lg border border-rose-100 bg-white/85 p-6 shadow-sm sm:p-8">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-rose-100 bg-white/90 px-4 py-3 text-lg font-semibold text-rose-950 outline-none focus:border-rose-300"
            placeholder="Tên bộ thẻ"
          />

          <div className="mt-6 space-y-4">
            {cards.map((card, index) => (
              <div
                key={card.id}
                className="grid gap-3 rounded-lg border border-rose-100 bg-rose-50/30 p-4 sm:grid-cols-[1fr_1fr_auto]"
              >
                <RichTextEditor value={card.question} onChange={(value) => updateCard(card.id, "question", value)} placeholder={`Mặt trước thẻ ${index + 1}`} />
                <RichTextEditor value={card.answer} onChange={(value) => updateCard(card.id, "answer", value)} placeholder="Mặt sau" />
                <button
                  onClick={() => removeCard(card.id)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Xóa thẻ"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={() => setCards((previous) => [...previous, newDraftCard()])}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-100 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700"
            >
              <Plus size={18} />
              Thêm thẻ
            </button>
            <button
              disabled={validCards.length === 0}
              onClick={createDeck}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-5 py-3 text-sm font-bold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Lưu & bắt đầu học
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {mode === "ai" && (
        <div className="rounded-lg border border-rose-100 bg-white/85 p-6 shadow-sm sm:p-8">
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

          <button
            disabled={!preview || loading}
            onClick={onGenerate}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-400 px-5 py-4 font-bold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "AI đang tạo thẻ..." : "Tạo thẻ và học"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </div>
      )}
    </section>
  );
}
