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
    <div className="mx-auto flex min-h-[85vh] max-w-6xl items-center justify-center px-6 py-10">

      <div className="w-full rounded-[36px] border border-slate-200 bg-white p-12 shadow-2xl">

        {/* Header */}

        <div className="text-center">

          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-5xl shadow-xl">
            📚
          </div>

          <h1 className="mt-8 text-6xl font-extrabold tracking-tight text-slate-900">
            Học bài thôi
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-xl leading-9 text-slate-500">
            Biến tài liệu thành bộ câu hỏi điền khuyết bằng AI.
            Học nhanh hơn. Nhớ lâu hơn.
          </p>

        </div>

        {/* Upload */}

        <label
          htmlFor="upload"
          className="group mt-14 flex h-[360px] cursor-pointer flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 transition duration-300 hover:scale-[1.01] hover:border-blue-500 hover:shadow-xl"
        >

          {preview ? (

            <img
              src={preview}
              alt="Preview"
              className="max-h-[300px] rounded-3xl object-contain shadow-xl"
            />

          ) : (

            <>

              <div className="text-8xl transition duration-300 group-hover:scale-110">
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

        {/* Button */}

        <button
          onClick={onGenerate}
          disabled={loading || !preview}
          className="mt-12 flex w-full items-center justify-center rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 py-5 text-2xl font-bold text-white shadow-xl transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
        >

          {loading ? (

            <div className="flex items-center gap-4">

              <svg
                className="h-7 w-7 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >

                <circle
                  className="opacity-20"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />

                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />

              </svg>

              <span>
                AI đang tạo câu hỏi...
              </span>

            </div>

          ) : (

            <>
              🚀 Bắt đầu học
            </>

          )}

        </button>

        {/* Features */}

        <div className="mt-14 grid gap-6 md:grid-cols-3">

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 transition hover:-translate-y-1 hover:shadow-lg">

            <div className="text-5xl">
              📷
            </div>

            <h3 className="mt-6 text-xl font-bold">
              Tải tài liệu
            </h3>

            <p className="mt-3 leading-7 text-slate-500">
              Chụp hoặc tải lên ảnh sách, slide, ghi chú hoặc guideline.
            </p>

          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 transition hover:-translate-y-1 hover:shadow-lg">

            <div className="text-5xl">
              🤖
            </div>

            <h3 className="mt-6 text-xl font-bold">
              AI phân tích
            </h3>

            <p className="mt-3 leading-7 text-slate-500">
              AI chọn các ý quan trọng nhất và tạo câu hỏi điền khuyết.
            </p>

          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 transition hover:-translate-y-1 hover:shadow-lg">

            <div className="text-5xl">
              🎯
            </div>

            <h3 className="mt-6 text-xl font-bold">
              Ghi nhớ nhanh
            </h3>

            <p className="mt-3 leading-7 text-slate-500">
              Trả lời, kiểm tra đáp án và ôn tập những câu quan trọng.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}