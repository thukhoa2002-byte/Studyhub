import React from "react";

interface UploadImageProps {
  preview: string;
  loading: boolean;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerate: () => void;
}

export default function UploadImage({
  preview,
  loading,
  onImageChange,
  onGenerate,
}: UploadImageProps) {
  return (
    <div className="mx-auto mt-10 max-w-4xl">

      <div className="rounded-[32px] bg-white p-10 shadow-2xl">

        <div className="text-center">

          <div className="text-6xl">📚</div>

          <h1 className="mt-4 text-5xl font-extrabold text-slate-900">
            Tạo bộ câu hỏi
          </h1>

          <p className="mt-3 text-lg text-slate-500">
            Chỉ cần tải ảnh bài học lên, AI sẽ tạo bộ câu hỏi điền khuyết
            giúp bạn ôn tập nhanh hơn.
          </p>

        </div>

        <label
          htmlFor="upload"
          className="mt-10 flex h-80 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-300 bg-blue-50 transition hover:border-blue-500 hover:bg-blue-100"
        >

          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="h-full max-h-72 rounded-2xl object-contain"
            />
          ) : (
            <>
              <div className="text-7xl">📷</div>

              <div className="mt-6 text-3xl font-bold text-slate-800">
                Chọn ảnh
              </div>

              <div className="mt-2 text-slate-500">
                PNG, JPG, JPEG
              </div>

              <div className="mt-6 rounded-full bg-blue-600 px-6 py-3 text-lg font-bold text-white shadow-lg">
                Chọn từ máy tính
              </div>
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
          onClick={onGenerate}
          disabled={loading || !preview}
          className="mt-10 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-5 text-2xl font-bold text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "🤖 AI đang tạo câu hỏi..." : "🚀 Bắt đầu học"}
        </button>

      </div>

      <div className="mt-10 grid grid-cols-3 gap-6">

        <div className="rounded-2xl bg-white p-6 text-center shadow">

          <div className="text-4xl">📷</div>

          <div className="mt-3 font-bold">
            Upload ảnh
          </div>

          <div className="mt-2 text-sm text-slate-500">
            Chụp hoặc tải ảnh tài liệu.
          </div>

        </div>

        <div className="rounded-2xl bg-white p-6 text-center shadow">

          <div className="text-4xl">🤖</div>

          <div className="mt-3 font-bold">
            AI tạo câu hỏi
          </div>

          <div className="mt-2 text-sm text-slate-500">
            Tự động tạo câu hỏi điền khuyết.
          </div>

        </div>

        <div className="rounded-2xl bg-white p-6 text-center shadow">

          <div className="text-4xl">🎯</div>

          <div className="mt-3 font-bold">
            Ôn tập
          </div>

          <div className="mt-2 text-sm text-slate-500">
            Học, đánh dấu và ôn lại.
          </div>

        </div>

      </div>

    </div>
  );
}