import React from "react";
import { ArrowRight, UploadCloud } from "lucide-react";

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
    <section className="relative min-h-[calc(100vh-96px)] overflow-hidden">

      {/* Background */}

      <div className="absolute -left-40 -top-20 h-[420px] w-[420px] rounded-full bg-pink-200/40 blur-3xl" />

      <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-sky-200/40 blur-3xl" />

      <div className="absolute bottom-0 left-1/2 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-fuchsia-200/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-96px)] max-w-5xl items-center justify-center px-6 py-14">

        <div className="w-full rounded-[40px] border border-white/60 bg-white/70 p-10 shadow-[0_30px_80px_rgba(236,72,153,.12)] backdrop-blur-2xl">

          {/* Header */}

          <div className="text-center">

            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-pink-400 via-fuchsia-400 to-sky-400 shadow-xl">

              <UploadCloud
                size={46}
                className="text-white"
              />

            </div>

            <h1 className="mt-8 text-5xl font-black tracking-tight text-slate-800">

              Học bài thoiii

            </h1>

            <p className="mx-auto mt-4 max-w-lg text-lg leading-8 text-slate-500">

              Biến tài liệu thành câu hỏi điền khuyết bằng AI để học nhanh hơn và nhớ lâu hơn.

            </p>

          </div>

          {/* Upload Box */}

          <label
            htmlFor="upload"
            className="
              group
              mt-10
              flex
              h-[360px]
              cursor-pointer
              flex-col
              items-center
              justify-center
              rounded-[32px]
              border-2
              border-dashed
              border-pink-200
              bg-gradient-to-br
              from-pink-50
              via-white
              to-sky-50
              transition-all
              duration-500
              hover:-translate-y-1
              hover:scale-[1.01]
              hover:border-sky-300
              hover:shadow-2xl
            "
          >
                        {preview ? (

              <img
                src={preview}
                alt="Preview"
                className="
                  max-h-[280px]
                  rounded-[28px]
                  border
                  border-white
                  object-contain
                  shadow-2xl
                  transition-all
                  duration-500
                  group-hover:scale-[1.02]
                "
              />

            ) : (

              <>

                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-sky-400 shadow-xl transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">

                  <UploadCloud
                    size={50}
                    className="text-white"
                  />

                </div>

                <h2 className="mt-8 text-3xl font-black tracking-tight text-slate-800">

                  Chọn ảnh bài học

                </h2>

                <p className="mt-3 text-lg text-slate-500">

                  Kéo ảnh vào đây hoặc bấm để chọn

                </p>

                <div className="mt-8 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow">

                  PNG • JPG • JPEG

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
            disabled={!preview || loading}
            onClick={onGenerate}
            className="
              mt-8
              flex
              w-full
              items-center
              justify-center
              gap-3
              rounded-2xl
              bg-gradient-to-r
              from-pink-400
              via-fuchsia-400
              to-sky-400
              py-5
              text-xl
              font-bold
              text-white
              shadow-xl
              transition-all
              duration-500
              hover:-translate-y-1
              hover:shadow-[0_20px_50px_rgba(236,72,153,.30)]
              active:scale-[.98]
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >

            {loading ? (

              <>

                <svg
                  className="h-6 w-6 animate-spin"
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
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />

                </svg>

                AI đang tạo câu hỏi...

              </>

            ) : (

              <>

                Bắt đầu học

                <ArrowRight size={22} />

              </>

            )}

          </button>

          <p className="mt-5 text-center text-sm text-slate-500">

            Hỗ trợ ảnh từ sách, slide, PDF và ghi chú.

          </p>
                  </div>

      </div>

      {/* Floating Decorations */}

      <div className="pointer-events-none absolute left-16 top-28 hidden lg:block">

        <div className="rounded-full bg-white/70 px-5 py-3 shadow-xl backdrop-blur">

          🌸 Học nhanh hơn

        </div>

      </div>

      <div className="pointer-events-none absolute right-16 bottom-24 hidden lg:block">

        <div className="rounded-full bg-white/70 px-5 py-3 shadow-xl backdrop-blur">

          💙 AI hỗ trợ

        </div>

      </div>

      <div className="pointer-events-none absolute right-40 top-40 hidden lg:block">

        <div className="rounded-full bg-white/70 px-5 py-3 shadow-xl backdrop-blur">

          ✨ Ghi nhớ lâu

        </div>

      </div>

    </section>
  );
}
