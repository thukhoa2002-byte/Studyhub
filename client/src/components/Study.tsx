import { useEffect, useMemo, useState } from "react";
import type { GeneratedQuestion } from "../services/api";

interface Props {
  questions: GeneratedQuestion[];
  toggleBookmark: (id: string) => void;
}

export default function Study({
  questions,
  toggleBookmark,
}: Props) {
  const [shuffle, setShuffle] = useState(false);

  const studyQuestions = useMemo(() => {
    if (!shuffle) return questions;

    const copy = [...questions];

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }, [questions, shuffle]);

  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    setCurrent(0);
    setAnswer("");
    setShowAnswer(false);
  }, [shuffle]);

  const question = studyQuestions[current];

  const progress =
    ((current + 1) / studyQuestions.length) * 100;

  function nextQuestion() {
    if (current >= studyQuestions.length - 1) return;

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case "ArrowRight":
          nextQuestion();
          break;

        case "ArrowLeft":
          previousQuestion();
          break;

        case " ":
          event.preventDefault();
          setShowAnswer(true);
          break;

        case "Enter":
          if (showAnswer) {
            nextQuestion();
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, [current, showAnswer, studyQuestions.length]);

  return (
    <div className="mx-auto mt-10 max-w-5xl">

      <div className="mb-6 flex items-center justify-between">

        <h2 className="text-3xl font-bold">
          📖 Học bài
        </h2>

        <div className="flex items-center gap-3">

          <button
            onClick={() => setShuffle((v) => !v)}
            className={`rounded-xl px-4 py-2 font-semibold ${
              shuffle
                ? "bg-purple-600 text-white"
                : "bg-white"
            }`}
          >
            🔀 Shuffle
          </button>

          <button
            onClick={() => toggleBookmark(question.id)}
            className="text-4xl"
          >
            {question.bookmarked ? "⭐" : "☆"}
          </button>

        </div>

      </div>

      <div className="mb-8">

        <div className="mb-2 flex justify-between text-sm text-gray-500">

          <span>
            {current + 1} / {studyQuestions.length}
          </span>

          <span>
            {Math.round(progress)}%
          </span>

        </div>

        <div className="h-3 rounded-full bg-gray-200">

          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{
              width: `${progress}%`,
            }}
          />

        </div>

      </div>

      <div className="rounded-2xl bg-white p-8 shadow">

        <div className="mb-5 flex gap-3">

          <span className="rounded-full bg-blue-100 px-4 py-2">
            {question.category}
          </span>

          <span className="rounded-full bg-yellow-100 px-4 py-2">
            ⭐ {question.importance}/10
          </span>

        </div>

        <h1 className="mb-8 text-3xl font-bold leading-relaxed">
          {question.question}
        </h1>

        <textarea
          value={answer}
          onChange={(e) =>
            setAnswer(e.target.value)
          }
          placeholder="Nhập đáp án..."
          className="h-40 w-full rounded-xl border p-4 text-lg"
        />

        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="mt-6 w-full rounded-xl bg-blue-600 py-4 text-xl font-bold text-white"
          >
            Hiện đáp án
          </button>
        ) : (
          <div className="mt-6 rounded-xl bg-green-100 p-6">

            <div className="text-sm">
              Đáp án
            </div>

            <div className="mt-2 text-3xl font-bold">
              {question.answer}
            </div>

          </div>
        )}

      </div>

      <div className="mt-8 flex justify-between">

        <button
          onClick={previousQuestion}
          disabled={current === 0}
          className="rounded-xl border px-6 py-3 disabled:opacity-40"
        >
          ← Trước
        </button>

        <button
          onClick={nextQuestion}
          disabled={
            current === studyQuestions.length - 1
          }
          className="rounded-xl bg-black px-6 py-3 text-white disabled:opacity-40"
        >
          Tiếp →
        </button>

      </div>

    </div>
  );
}