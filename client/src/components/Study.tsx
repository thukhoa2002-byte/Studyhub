import { useState } from "react";
import type { GeneratedQuestion } from "../services/api";

interface Props {
  questions: GeneratedQuestion[];
  toggleBookmark: (id: string) => void;
}

const categoryIcon: Record<string, string> = {
  "Định nghĩa": "📖",
  "Điều trị": "💊",
  "Chẩn đoán": "🩺",
  "Guideline": "📋",
  "Xét nghiệm": "🧪",
  "Phân loại": "📚",
  "Biến chứng": "⚠️",
};

export default function Study({
  questions,
  toggleBookmark,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  function check(id: string) {
    setChecked((prev) => ({
      ...prev,
      [id]: true,
    }));
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">

      <div className="mb-10 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white shadow-xl">

        <h1 className="text-5xl font-extrabold">
          📚 Học bài thôi
        </h1>

        <p className="mt-3 text-lg text-blue-100">
          {questions.length} câu hỏi
        </p>

      </div>

      <div className="space-y-8">

        {questions.map((q, index) => {

          const isChecked = checked[q.id];

          return (

            <div
              key={q.id}
              className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
            >

              <div className="flex items-start justify-between">

                <div>

                  <div className="text-sm font-semibold text-slate-400">
                    CÂU {index + 1}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3">

                    <span className="rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700">

                      {categoryIcon[q.category] ?? "📘"} {q.category}

                    </span>

                    <span className="rounded-full bg-yellow-100 px-4 py-2 text-sm font-semibold text-yellow-700">

                      ⭐ {q.importance}/10

                    </span>

                  </div>

                </div>

                <button
                  onClick={() => toggleBookmark(q.id)}
                  className="text-3xl transition hover:scale-125"
                >
                  {q.bookmarked ? "⭐" : "☆"}
                </button>

              </div>

              <div className="mt-8 text-2xl font-bold leading-relaxed text-slate-800">
                {q.question}
              </div>

              <textarea
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [q.id]: e.target.value,
                  }))
                }
                placeholder="✍️ Nhập đáp án..."
                className="mt-8 h-32 w-full rounded-2xl border-2 border-slate-200 p-5 text-lg transition focus:border-blue-500"
              />

              {!isChecked ? (

                <button
                  onClick={() => check(q.id)}
                  className="mt-6 rounded-2xl bg-blue-600 px-8 py-3 text-lg font-bold text-white transition hover:bg-blue-700"
                >
                  ✓ Check đáp án
                </button>

              ) : (

                <div className="mt-6 rounded-2xl border border-green-300 bg-green-50 p-6">

                  <div className="mb-2 text-sm font-bold uppercase tracking-wide text-green-700">
                    Đáp án
                  </div>

                  <div className="text-2xl font-bold text-green-900">
                    {q.answer}
                  </div>

                </div>

              )}

            </div>

          );
        })}

      </div>

    </div>
  );
}