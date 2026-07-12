import { useEffect, useMemo, useState } from "react";
import type { GeneratedQuestion } from "../services/api";

interface Props {
  questions: GeneratedQuestion[];
  toggleBookmark: (id: string) => void;
}

export default function Review({
  questions,
  toggleBookmark,
}: Props) {
  const reviewQuestions = useMemo(
    () => questions.filter((q) => q.bookmarked),
    [questions]
  );

  const [current, setCurrent] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    if (current >= reviewQuestions.length && reviewQuestions.length > 0) {
      setCurrent(reviewQuestions.length - 1);
    }

    setShowAnswer(false);
  }, [reviewQuestions.length]);

  if (reviewQuestions.length === 0) {
    return (
      <div className="mx-auto mt-20 max-w-4xl rounded-2xl bg-white p-12 text-center shadow">

        <div className="text-7xl">🎉</div>

        <h2 className="mt-6 text-4xl font-bold">
          Không còn câu cần ôn
        </h2>

        <p className="mt-4 text-lg text-gray-500">
          Hãy quay lại chế độ Học và đánh dấu ⭐ những câu muốn ôn lại.
        </p>

      </div>
    );
  }

  const question = reviewQuestions[current];

  const progress =
    ((current + 1) / reviewQuestions.length) * 100;

  function nextQuestion() {
    if (current >= reviewQuestions.length - 1) return;

    setCurrent((prev) => prev + 1);
    setShowAnswer(false);
  }

  function previousQuestion() {
    if (current <= 0) return;

    setCurrent((prev) => prev - 1);
    setShowAnswer(false);
  }

  function removeBookmark() {
    toggleBookmark(question.id);

    if (
      current === reviewQuestions.length - 1 &&
      current > 0
    ) {
      setCurrent((prev) => prev - 1);
    }

    setShowAnswer(false);
  }

  return (
    <div className="mx-auto mt-10 max-w-5xl">

      <div className="mb-6 flex items-center justify-between">

        <h2 className="text-3xl font-bold">
          🔄 Ôn tập
        </h2>

        <button
          onClick={removeBookmark}
          className="text-4xl transition hover:scale-110"
        >
          ⭐
        </button>

      </div>

      <div className="mb-8">

        <div className="mb-2 flex justify-between text-sm text-gray-500">

          <span>
            {current + 1} / {reviewQuestions.length}
          </span>

          <span>
            {Math.round(progress)}%
          </span>

        </div>

        <div className="h-3 overflow-hidden rounded-full bg-gray-200">

          <div
            className="h-full rounded-full bg-green-600 transition-all duration-300"
            style={{
              width: `${progress}%`,
            }}
          />

        </div>

      </div>

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

        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="w-full rounded-xl bg-green-600 py-4 text-xl font-bold text-white hover:bg-green-700"
          >
            Hiện đáp án
          </button>
        ) : (
          <div className="rounded-xl border border-green-300 bg-green-50 p-6">

            <div className="text-sm font-semibold text-green-700">
              Đáp án
            </div>

            <div className="mt-2 text-3xl font-bold text-green-800">
              {question.answer}
            </div>

          </div>
        )}

      </div>

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
          disabled={current === reviewQuestions.length - 1}
          className="rounded-xl bg-black px-6 py-3 font-semibold text-white disabled:opacity-40"
        >
          Tiếp →
        </button>

      </div>

    </div>
  );
}