import { BookOpen, Bookmark, Download, Library } from "lucide-react";

interface Props {
  mode: "study" | "review";
  setMode: (mode: "study" | "review") => void;
  deckTitle: string;
  onReset: () => void;
  onExport: () => void;
}

export default function Navbar({
  mode,
  setMode,
  deckTitle,
  onReset,
  onExport,
}: Props) {
  return (
    <nav className="border-b border-rose-100 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-rose-950">
            {deckTitle || "Bộ thẻ đang học"}
          </p>
          <p className="text-xs font-medium text-rose-400">Bộ thẻ hiện tại</p>
        </div>

        <div className="flex items-center gap-5">
          <button
            onClick={() => setMode("study")}
            className={`flex items-center gap-2 border-b-2 py-2 text-sm font-semibold ${
              mode === "study"
                ? "border-rose-300 text-rose-600"
                : "border-transparent text-slate-500 hover:text-rose-700"
            }`}
          >
            <BookOpen size={18} />
            Học thẻ
          </button>
          <button
            onClick={() => setMode("review")}
            className={`flex items-center gap-2 border-b-2 py-2 text-sm font-semibold ${
              mode === "review"
                ? "border-rose-300 text-rose-600"
                : "border-transparent text-slate-500 hover:text-rose-700"
            }`}
          >
            <Bookmark size={18} />
            Đã lưu
          </button>
          <button
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-100 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <Download size={17} />
            Xuất file
          </button>
          <button
            onClick={onReset}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-rose-100 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <Library size={17} />
            Đổi bộ
          </button>
        </div>
      </div>
    </nav>
  );
}
