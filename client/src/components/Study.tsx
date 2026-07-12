import { useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Sparkles,
} from "lucide-react";

import type { GeneratedQuestion } from "../services/api";

interface Props {
  questions: GeneratedQuestion[];
  toggleBookmark: (id: string) => void;
}

const categoryColor: Record<string, string> = {
  "Định nghĩa":
    "bg-pink-100 text-pink-700",

  "Điều trị":
    "bg-sky-100 text-sky-700",

  "Chẩn đoán":
    "bg-violet-100 text-violet-700",

  Guideline:
    "bg-emerald-100 text-emerald-700",

  "Xét nghiệm":
    "bg-amber-100 text-amber-700",

  "Biến chứng":
    "bg-red-100 text-red-700",

  "Phân loại":
    "bg-fuchsia-100 text-fuchsia-700",
};

export default function Study({
  questions,
  toggleBookmark,
}: Props) {
  const [answers, setAnswers] =
    useState<Record<string, string>>({});

  const [checked, setChecked] =
    useState<Record<string, boolean>>({});

  function check(id: string) {
    setChecked((prev) => ({
      ...prev,
      [id]: true,
    }));
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">

      {/* Header */}

      <div className="mb-10 rounded-[36px] border border-white bg-white/70 p-8 shadow-[0_20px_60px_rgba(0,0,0,.08)] backdrop-blur-xl">

        <div className="flex items-center justify-between">

          <div>

            <div className="inline-flex items-center gap-2 rounded-full bg-pink-100 px-4 py-2 text-sm font-semibold text-pink-700">

              <Sparkles size={16} />

              Study Mode

            </div>

            <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-800">

              Học bài thôi

            </h1>

            <p className="mt-3 text-slate-500">

              {questions.length} câu hỏi cần hoàn thành

            </p>

          </div>

          <div className="hidden rounded-3xl bg-gradient-to-br from-pink-100 to-sky-100 p-8 text-center md:block">

            <div className="text-sm font-semibold text-slate-600">

              Tiến độ

            </div>

            <div className="mt-2 text-4xl font-black">

              {Object.keys(checked).length}

            </div>

            <div className="text-slate-500">

              / {questions.length}

            </div>

          </div>

        </div>

      </div>

      <div className="space-y-8">

        {questions.map((q, index) => {

          const isChecked =
            checked[q.id];

          return (

            <div
              key={q.id}
              className="rounded-[32px] border border-white bg-white/70 p-8 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            >

              <div className="flex items-start justify-between">

                <div>

                  <div className="text-sm font-semibold uppercase tracking-widest text-slate-400">

                    Câu {index + 1}

                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">

                    <span
                      className={`rounded-full px-4 py-2 text-sm font-bold ${
                        categoryColor[q.category] ??
                        "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {q.category}
                    </span>

                    <span className="rounded-full bg-yellow-100 px-4 py-2 text-sm font-bold text-yellow-700">

                      ⭐ {q.importance}/10

                    </span>

                  </div>

                </div>

                <button
                  onClick={() =>
                    toggleBookmark(q.id)
                  }
                  className="rounded-2xl bg-slate-50 p-3 transition hover:scale-110"
                >

                  {q.bookmarked ? (

                    <BookmarkCheck
                      className="text-pink-500"
                    />

                  ) : (

                    <Bookmark />

                  )}

                </button>

              </div>

              <div className="mt-8 rounded-3xl bg-gradient-to-r from-pink-50 via-white to-sky-50 p-7">

                <div className="text-2xl font-bold leading-10 text-slate-800">

                  {q.question}

                </div>

              </div>

              <textarea
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [q.id]:
                      e.target.value,
                  }))
                }
                placeholder="Nhập đáp án..."
                className="
                mt-8
                h-32
                w-full
                resize-none
                rounded-3xl
                border
                border-pink-100
                bg-pink-50/40
                p-5
                text-lg
                outline-none
                transition
                focus:border-sky-300
                focus:bg-white
"
              />
                            {!isChecked ? (

                <button
                  onClick={() => check(q.id)}
                  className="
                    mt-7
                    flex
                    items-center
                    gap-3
                    rounded-2xl
                    bg-gradient-to-r
                    from-pink-400
                    via-fuchsia-400
                    to-sky-400
                    px-8
                    py-4
                    text-lg
                    font-bold
                    text-white
                    shadow-lg
                    transition-all
                    duration-300
                    hover:-translate-y-1
                    hover:shadow-2xl
                    active:scale-[.98]
                  "
                >
                  <Check size={20} />

                  Check đáp án
                </button>

              ) : (

                <div
                  className="
                    mt-8
                    rounded-3xl
                    border
                    border-emerald-200
                    bg-gradient-to-r
                    from-emerald-50
                    to-green-50
                    p-7
                    shadow-sm
                    animate-in
                    fade-in
                  "
                >

                  <div className="flex items-center gap-2">

                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500">

                      <Check
                        size={20}
                        className="text-white"
                      />

                    </div>

                    <div>

                      <div className="text-sm font-semibold uppercase tracking-wider text-emerald-700">

                        Đáp án

                      </div>

                      <div className="text-xs text-emerald-600">

                        So sánh với câu trả lời của bạn

                      </div>

                    </div>

                  </div>

                  <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">

                    <div className="text-2xl font-bold text-slate-800">

                      {q.answer}

                    </div>

                  </div>

                </div>

              )}

            </div>

          );

        })}

      </div>

    </section>

  );

}