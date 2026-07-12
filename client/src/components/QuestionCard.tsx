import type { Question } from "../types/question";

interface Props {
  index: number;
  question: Question;
  answer: string;
  submitted: boolean;
  onChange: (value: string) => void;
}

export default function QuestionCard({
  index,
  question,
  answer,
  submitted,
  onChange,
}: Props) {

  const correct =
    answer.trim().toLowerCase() ===
    question.answer.trim().toLowerCase();

  return (
    <div className="rounded-2xl border bg-white p-8 shadow">

      <h2 className="text-3xl font-bold">
        Câu {index + 1}
      </h2>

      <div className="mt-3 flex gap-3">

        <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
          {question.category}
        </span>

        <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-700">
          ⭐ {question.importance}/10
        </span>

      </div>

      <p className="mt-6 text-2xl leading-10">
        {question.question}
      </p>

      <input
        disabled={submitted}
        value={answer}
        onChange={(e) => onChange(e.target.value)}
        className="mt-6 w-full rounded-xl border p-4 text-xl"
        placeholder="Nhập đáp án..."
      />

      {submitted && (

        <div className="mt-6">

          <div
            className={
              correct
                ? "text-green-600 font-bold"
                : "text-red-600 font-bold"
            }
          >
            {correct ? "✓ Đúng" : "✗ Sai"}
          </div>

          <div className="mt-2 text-xl text-green-700">
            Đáp án: {question.answer}
          </div>

        </div>

      )}

    </div>
  );
}