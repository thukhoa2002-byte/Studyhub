import { useState } from "react";
import type { GeneratedQuestion } from "../services/api";

interface Props {
  questions: GeneratedQuestion[];
  toggleBookmark: (id: string) => void;
}

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
    <div className="mx-auto max-w-5xl p-8">

      <div className="mb-10">

        <h1 className="text-4xl font-bold">
          📖 Học bài thôi
        </h1>

        <p className="mt-2 text-gray-500">
          {questions.length} câu hỏi
        </p>

      </div>

      <div className="space-y-8">

        {questions.map((q, index) => (
          <div
            key={q.id}
            className="rounded-2xl border bg-white p-8 shadow-sm"
          >
            <div className="mb-6 flex items-center justify-between">

              <div>

                <h2 className="text-4xl font-bold">
                  Câu {index + 1}
                </h2>

                <div className="mt-3 flex gap-3">

                  <span className="rounded-full bg-blue-100 px-4 py-2 font-semibold text-blue-700">
                    {q.category}
                  </span>

                  <span className="rounded-full bg-yellow-100 px-4 py-2 font-semibold text-yellow-700">
                    ⭐ {q.importance}/10
                  </span>

                </div>

              </div>

              <button
                onClick={() => toggleBookmark(q.id)}
                className="text-4xl"
              >
                {q.bookmarked ? "⭐" : "☆"}
              </button>

            </div>

            <div className="mb-8 text-3xl font-bold leading-relaxed">
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
              placeholder="Nhập đáp án..."
              className="h-36 w-full rounded-xl border p-5 text-xl"
            />

            {!checked[q.id] ? (
              <button
                onClick={() => check(q.id)}
                className="mt-5 rounded-xl bg-blue-600 px-8 py-3 text-lg font-bold text-white"
              >
                Check
              </button>
            ) : (
              <div className="mt-6 rounded-xl bg-green-100 p-6">

                <div className="text-lg font-semibold">
                  Đáp án
                </div>

                <div className="mt-3 text-2xl font-bold">
                  {q.answer}
                </div>

              </div>
            )}

          </div>
        ))}

      </div>

    </div>
  );
}