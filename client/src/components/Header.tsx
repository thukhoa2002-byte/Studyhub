import { BookOpen } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">

      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">

        {/* Logo */}

        <div className="flex items-center gap-5">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-sm">

            <BookOpen
              size={22}
              className="text-white"
              strokeWidth={2.5}
            />

          </div>

          <div>

            <h1 className="text-lg font-bold tracking-tight text-slate-900">

              Học bài thôi

            </h1>

            <p className="text-xs font-medium text-slate-500">Học đều, nhớ lâu</p>

          </div>

        </div>

        {/* Right */}

        <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">AI cards</div>

      </div>

    </header>
  );
}
