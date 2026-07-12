import { BookOpen, Sparkles } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-pink-100 bg-white/80 backdrop-blur-xl">

      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-8">

        {/* Logo */}

        <div className="flex items-center gap-5">

          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-400 via-fuchsia-400 to-rose-400 shadow-lg shadow-pink-200">

            <BookOpen
              size={30}
              className="text-white"
              strokeWidth={2.5}
            />

          </div>

          <div>

            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">

              Học bài thôi

            </h1>

            <p className="mt-1 text-base font-medium text-slate-500">

              AI tạo câu hỏi điền khuyết giúp bạn nhớ lâu hơn.

            </p>

          </div>

        </div>

        {/* Right */}

        <div className="flex items-center gap-4">

          <div className="hidden rounded-full bg-pink-100 px-5 py-2 text-sm font-semibold text-pink-700 md:flex md:items-center md:gap-2">

            <Sparkles size={15} />

            AI Powered

          </div>

          <div className="rounded-full border border-pink-200 bg-white px-5 py-2 text-sm font-semibold text-pink-600 shadow-sm">

            Beta

          </div>

        </div>

      </div>

    </header>
  );
}