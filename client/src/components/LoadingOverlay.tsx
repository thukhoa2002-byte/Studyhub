export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">

      <div className="w-[420px] rounded-[32px] bg-white p-10 text-center shadow-2xl">

        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-100">

          <svg
            className="h-12 w-12 animate-spin text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              className="opacity-20"
            />

            <path
              fill="currentColor"
              className="opacity-90"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />

          </svg>

        </div>

        <h2 className="mt-8 text-3xl font-bold">
          🤖 AI đang tạo câu hỏi
        </h2>

        <p className="mt-4 text-slate-500">
          Đang đọc tài liệu và chọn những ý quan trọng...
        </p>

        <div className="mt-10 h-3 overflow-hidden rounded-full bg-slate-200">

          <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-600" />

        </div>

        <p className="mt-5 text-sm text-slate-400">
          Việc này chỉ mất vài giây
        </p>

      </div>

    </div>
  );
}