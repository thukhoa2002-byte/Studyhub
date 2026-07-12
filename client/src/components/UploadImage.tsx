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
    <div className="mx-auto flex min-h-[85vh] max-w-6xl items-center justify-center px-6">

      <div className="w-full rounded-[40px] border border-slate-200 bg-white p-12 shadow-2xl">

        <div className="text-center">

          <div className="inline-flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-5xl shadow-lg">
            📚
          </div>

          <h1 className="mt-8 text-6xl font-extrabold tracking-tight text-slate-900">
            Học bài thôi
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-xl leading-9 text-slate-500">
            AI sẽ đọc tài liệu, chọn những ý quan trọng nhất và tạo
            câu hỏi điền khuyết để bạn học nhanh hơn.
          </p>

        </div>

        <label
          htmlFor="upload"
          className="group mt-14 flex h-[360px] cursor-pointer flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 transition duration-300 hover:scale-[1.01] hover:border-blue-500 hover:shadow-xl"
        >

          {preview ? (

            <img
              src={preview}
              alt="Preview"
              className="max-h-[300px] rounded-3xl object-contain shadow-lg"
            />

          ) : (

            <>

              <div className="text-8xl transition group-hover:scale-110">
                📄
              </div>

              <h2 className="mt-8 text-3xl font-bold text-slate-800">
                Kéo ảnh vào đây
              </h2>

              <p className="mt-3 text-lg text-slate-500">
                hoặc bấm để chọn ảnh từ máy tính
              </p>

              <div className="mt-8 rounded-2xl bg-blue-600 px-8 py-4 text-xl font-bold text-white shadow-lg transition group-hover:bg-blue-700">
                Chọn ảnh
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
          className="mt-12 w-full rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 py-5 text-2xl font-bold text-white shadow-xl transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "🤖 AI đang tạo câu hỏi..."
            : "🚀 Bắt đầu học"}
        </button>

        <div className="mt-12 grid gap-6 md:grid-cols-3">

          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center">

            <div className="text-5xl">
              📷
            </div>

            <div className="mt-5 text-xl font-bold">
              Tải ảnh
            </div>

            <p className="mt-3 text-slate-500">
              Chụp hoặc tải lên tài liệu, slide, sách hoặc ghi chú.
            </p>

          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center">

            <div className="text-5xl">
              🤖
            </div>

            <div className="mt-5 text-xl font-bold">
              AI phân tích
            </div>

            <p className="mt-3 text-slate-500">
              Tự động chọn kiến thức trọng tâm và tạo câu hỏi.
            </p>

          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center">

            <div className="text-5xl">
              🎯
            </div>

            <div className="mt-5 text-xl font-bold">
              Ôn tập
            </div>

            <p className="mt-3 text-slate-500">
              Trả lời, kiểm tra và ghi nhớ nhanh hơn.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}