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
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);

  const question = questions[current];

  const progress =
    ((current + 1) / questions.length) * 100;

  function nextQuestion() {
    if (current >= questions.length - 1) return;

    setCurrent((prev) => prev + 1);
    setAnswer("");
    setShowAnswer(false);
  }

  function previousQuestion() {
    if (current <= 0) return;

    setCurrent((prev) => prev - 1);
    setAnswer("");
    setShowAnswer(false);
  }

  return (
    <div className="mx-auto mt-10 max-w-5xl">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">

        <h2 className="text-3xl font-bold">
          📖 Học bài
        </h2>

        <button
          onClick={() => toggleBookmark(question.id)}
          className="text-4xl transition hover:scale-110"
        >
          {question.bookmarked ? "⭐" : "☆"}
        </button>

      </div>

      {/* Progress */}
      <div className="mb-8">

        <div className="mb-2 flex justify-between text-sm text-gray-500">

          <span>
            {current + 1} / {questions.length}
          </span>

          <span>
            {Math.round(progress)}%
          </span>

        </div>

        <div className="h-3 overflow-hidden rounded-full bg-gray-200">

          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{
              width: `${progress}%`,
            }}
          />

        </div>

      </div>

      {/* Card */}
      <div className="rounded-2xl bg-white p-8 shadow">

        <div className="mb-5 flex gap-3">

          <span className="rounded-full bg-blue-100 px-4 py-2 text-blue-700">
            {question.category}
          </span>

          <span className="rounded-full bg-yellow-100 px-4 py-2 text-yellow-700">
            ⭐ {question.importance}/10
          </span>

        </div>

        <h1 className="mb-8 text-3xl font-bold leading-relaxed">
          {question.question}
        </h1>

        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Nhập đáp án..."
          className="h-40 w-full rounded-xl border p-4 text-lg outline-none focus:ring-2 focus:ring-blue-500"
        />

        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="mt-6 w-full rounded-xl bg-blue-600 py-4 text-xl font-bold text-white hover:bg-blue-700"
          >
            Hiện đáp án
          </button>
        ) : (
          <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-6">

            <div className="text-sm font-semibold text-green-700">
              Đáp án
            </div>

            <div className="mt-2 text-3xl font-bold text-green-800">
              {question.answer}
            </div>

          </div>
        )}

      </div>

      {/* Navigation */}
      <div className="mt-8 flex justify-between">

        <button
          onClick={previousQuestion}
          disabled={current === 0}
          className="rounded-xl border px-6 py-3 font-semibold disabled:opacity-40"
        >
          ← Trước
        </button>

        <button
          onClick={nextQuestion}
          disabled={current === questions.length - 1}
          className="rounded-xl bg-black px-6 py-3 font-semibold text-white disabled:opacity-40"
        >
          Tiếp →
        </button>

      </div>

    </div>
  );
}