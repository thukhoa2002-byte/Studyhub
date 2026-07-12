import QuestionCard from "./QuestionCard";
import type { Question } from "../types/question";

interface Props {
  questions: Question[];
  answers: string[];
  submitted: boolean;
  onAnswerChange: (index: number, value: string) => void;
}

export default function QuestionList({
  questions,
  answers,
  submitted,
  onAnswerChange,
}: Props) {
  return (
    <div className="mt-10 space-y-8">
      {questions.map((question, index) => (
        <QuestionCard
          key={index}
          index={index}
          question={question}
          answer={answers[index] ?? ""}
          submitted={submitted}
          onChange={(value) => onAnswerChange(index, value)}
        />
      ))}
    </div>
  );
}