import { useState } from "react";

import Header from "./components/Header";
import UploadImage from "./components/UploadImage";
import QuestionList from "./components/QuestionList";
import ScoreCard from "./components/ScoreCard";

import { generateQuestions } from "./services/api";

import type { Question } from "./types/question";

function App() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setImage(file);
    setPreview(URL.createObjectURL(file));

    setQuestions([]);
    setAnswers([]);
    setSubmitted(false);
  };

  const handleGenerate = async () => {
    if (!image) {
      alert("Vui lòng chọn ảnh.");
      return;
    }

    try {
      setLoading(true);

      const data = await generateQuestions(image);

      console.log(data.text);

      const mappedQuestions: Question[] = data.data.map((item) => ({
        id: crypto.randomUUID(),

        question: item.question,

        answer: item.answer,

        category: item.category,

        importance: item.importance,

        remembered: false,

        bookmarked: false,

        revealed: false,
      }));

      setQuestions(mappedQuestions);

      setAnswers(new Array(mappedQuestions.length).fill(""));

      setSubmitted(false);
    } catch (error) {
      console.error(error);
      alert("Không thể kết nối tới server.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (
    index: number,
    value: string
  ) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const revealAnswer = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              revealed: true,
            }
          : q
      )
    );
  };

  const rememberQuestion = (
    id: string,
    remembered: boolean
  ) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              remembered,
            }
          : q
      )
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow">
        <Header />

        <UploadImage
          preview={preview}
          loading={loading}
          onImageChange={handleImageChange}
          onGenerate={handleGenerate}
        />

        {questions.length > 0 && (
          <>
            <QuestionList
              questions={questions}
              answers={answers}
              submitted={submitted}
              onAnswerChange={handleAnswerChange}
            />

            <ScoreCard
              submitted={submitted}
              onSubmit={() => setSubmitted(true)}
            />
          </>
        )}
      </div>
    </main>
  );
}

export default App;