import { BookOpen } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">

        <div className="flex items-center gap-4">

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
            <BookOpen className="h-6 w-6 text-white" />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight">
              Học bài thôi
            </h1>

            <p className="text-sm text-slate-500">
              AI tạo câu hỏi điền khuyết
            </p>

          </div>

        </div>

        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
          Beta
        </div>

      </div>
    </header>
  );
}