interface Props {
  mode: "study" | "review";
  setMode: (mode: "study" | "review") => void;
}

export default function Navbar({
  mode,
  setMode,
}: Props) {
  return (
    <div className="mx-auto mt-8 mb-8 flex max-w-5xl justify-center gap-4">

      <button
        onClick={() => setMode("study")}
        className={`rounded-xl px-6 py-3 text-lg font-semibold transition ${
          mode === "study"
            ? "bg-blue-600 text-white shadow"
            : "bg-white hover:bg-gray-100"
        }`}
      >
        📖 Học
      </button>

      <button
        onClick={() => setMode("review")}
        className={`rounded-xl px-6 py-3 text-lg font-semibold transition ${
          mode === "review"
            ? "bg-blue-600 text-white shadow"
            : "bg-white hover:bg-gray-100"
        }`}
      >
        🔄 Ôn tập
      </button>

    </div>
  );
}