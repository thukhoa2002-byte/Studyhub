import React from "react";
import {
  UploadCloud,
  Image,
  Sparkles,
  ArrowRight,
} from "lucide-react";

interface UploadImageProps {
  preview: string;
  loading: boolean;
  onImageChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  onGenerate: () => void;
}

export default function UploadImage({
  preview,
  loading,
  onImageChange,
  onGenerate,
}: UploadImageProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl items-center px-8">

      <div className="grid w-full gap-16 lg:grid-cols-2">

        {/* LEFT */}

        <div className="flex flex-col justify-center">

          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">

            <Sparkles size={16} />

            AI Cloze Generator

          </div>

          <h1 className="mt-8 text-6xl font-extrabold leading-tight tracking-tight">

            Học thuộc
            <br />

            <span className="text-blue-600">
              nhanh hơn.
            </span>

          </h1>

          <p className="mt-8 max-w-xl text-xl leading-9 text-slate-500">

            Chỉ cần tải ảnh bài học.

            AI sẽ tự đọc nội dung, chọn kiến thức quan trọng và tạo câu hỏi
            điền khuyết để bạn ôn tập hiệu quả.

          </p>

          <div className="mt-12 flex gap-6">

            <div className="rounded-2xl border bg-white px-6 py-5 shadow-sm">

              <div className="text-3xl font-bold">
                OCR
              </div>

              <div className="mt-1 text-sm text-slate-500">
                Đọc tài liệu
              </div>

            </div>

            <div className="rounded-2xl border bg-white px-6 py-5 shadow-sm">

              <div className="text-3xl font-bold">
                AI
              </div>

              <div className="mt-1 text-sm text-slate-500">
                Sinh câu hỏi
              </div>

            </div>

            <div className="rounded-2xl border bg-white px-6 py-5 shadow-sm">

              <div className="text-3xl font-bold">
                Study
              </div>

              <div className="mt-1 text-sm text-slate-500">
                Ôn tập
              </div>

            </div>

          </div>

        </div>

        {/* RIGHT */}

        <div>

          <div className="rounded-[36px] border bg-white p-10 shadow-xl">

            <label
              htmlFor="upload"
              className="flex h-[420px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-blue-500 hover:bg-blue-50"
            >

              {preview ? (

                <img
                  src={preview}
                  alt="preview"
                  className="max-h-[360px] rounded-2xl"
                />

              ) : (

                <>

                  <UploadCloud
                    size={80}
                    className="text-blue-600"
                  />

                  <h2 className="mt-8 text-3xl font-bold">

                    Kéo ảnh vào đây

                  </h2>

                  <p className="mt-3 text-slate-500">

                    hoặc bấm để chọn từ máy tính

                  </p>

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
              disabled={!preview || loading}
              onClick={onGenerate}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-5 text-xl font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >

              {loading ? (

                "AI đang tạo câu hỏi..."

              ) : (

                <>

                  <Image size={22} />

                  Bắt đầu học

                  <ArrowRight size={20} />

                </>

              )}

            </button>

          </div>

        </div>

      </div>

    </div>
  );
}