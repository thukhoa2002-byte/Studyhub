import { BookOpen } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-rose-100 bg-white/85 backdrop-blur-xl">

      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">

        {/* Logo */}

        <div className="flex items-center gap-5">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-300 to-teal-300 shadow-sm">

            <BookOpen
              size={22}
              className="text-white"
              strokeWidth={2.5}
            />

          </div>

          <div>

            <h1 className="text-lg font-bold tracking-tight text-rose-950">

              Học bài thoiii

            </h1>

            <p className="text-xs font-medium text-rose-400">Học đều, nhớ lâu</p>

          </div>

        </div>

        {/* Right */}

        <div className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-500">AI cards</div>

      </div>

    </header>
  );
}
