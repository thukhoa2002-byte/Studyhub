export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl">

      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">

        <div className="flex items-center gap-4">

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-2xl shadow-lg">
            📚
          </div>

          <div>

            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Học bài thôi
            </h1>

            <p className="text-sm text-slate-500">
              AI giúp bạn học nhanh hơn
            </p>

          </div>

        </div>

        <div className="hidden md:flex items-center gap-4">

          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
            AI Cloze Generator
          </div>

        </div>

      </div>

    </header>
  );
}