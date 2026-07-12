function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-5xl">

        <h1 className="text-center text-5xl font-bold">
          🩺 NOITRU AI
        </h1>

        <p className="mt-4 text-center text-xl text-gray-600">
          Ôn thi Bác sĩ Nội trú
        </p>

        <div className="mt-12 grid grid-cols-2 gap-6">

          <button className="rounded-2xl bg-white p-8 text-2xl font-semibold shadow-md transition hover:shadow-xl">
            📚 Học theo môn
          </button>

          <button className="rounded-2xl bg-white p-8 text-2xl font-semibold shadow-md transition hover:shadow-xl">
            📝 Thi thử
          </button>

          <button className="rounded-2xl bg-white p-8 text-2xl font-semibold shadow-md transition hover:shadow-xl">
            ⭐ Câu đã lưu
          </button>

          <button className="rounded-2xl bg-white p-8 text-2xl font-semibold shadow-md transition hover:shadow-xl">
            📊 Thống kê
          </button>

        </div>

      </div>
    </main>
  );
}

export default HomePage;