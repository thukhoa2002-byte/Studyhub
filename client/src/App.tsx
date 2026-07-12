import { useState } from "react";

import Header from "./components/Header";
import Navbar from "./components/Navbar";
import UploadImage from "./components/UploadImage";
import Study from "./components/Study";
import Review from "./components/Review";

import {
  generateQuestions,
  type GeneratedQuestion,
} from "./services/api";

export default function App() {
  const [mode, setMode] = useState<"study" | "review">("study");

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);

  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);

  function onImageChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  async function onGenerate() {
    if (!image) return;

    try {
      setLoading(true);

      const response = await generateQuestions(image);

      setQuestions(response.data);

      setMode("study");
    } catch (error) {
      console.error(error);
      alert("Không thể tạo câu hỏi.");
    } finally {
      setLoading(false);
    }
  }

  function toggleBookmark(id: string) {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === id
          ? {
              ...question,
              bookmarked: !question.bookmarked,
            }
          : question
      )
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">

      <Header />

      {questions.length > 0 && (
        <Navbar
          mode={mode}
          setMode={setMode}
        />
      )}

      {questions.length === 0 ? (
        <UploadImage
          preview={preview}
          loading={loading}
          onImageChange={onImageChange}
          onGenerate={onGenerate}
        />
      ) : mode === "study" ? (
        <Study
          questions={questions}
          toggleBookmark={toggleBookmark}
        />
      ) : (
        <Review
          questions={questions}
          toggleBookmark={toggleBookmark}
        />
      )}

    </main>
  );
}