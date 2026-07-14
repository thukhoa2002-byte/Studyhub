import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Check, Clock3, ListOrdered, RotateCcw, Shuffle, Sparkles } from "lucide-react";
import type { GeneratedQuestion } from "../services/api";
import { sanitizeHtml, toClozeQuestionHtml, toEditorHtml } from "../utils/richText";

interface Props {
  questions: GeneratedQuestion[];
  toggleBookmark: (id: string) => void;
  onRate?: (question: GeneratedQuestion, rating: number) => void | Promise<void>;
}

type Rating = "again" | "hard" | "good" | "easy";

const categoryColor: Record<string, string> = {
  "Định nghĩa": "bg-violet-50 text-violet-700 border-violet-100",
  "Điều trị": "bg-sky-50 text-sky-700 border-sky-100",
  "Chẩn đoán": "bg-amber-50 text-amber-700 border-amber-100",
  Guideline: "bg-emerald-50 text-emerald-700 border-emerald-100",
  "Xét nghiệm": "bg-rose-50 text-rose-700 border-rose-100",
};

const ratingStyle: Record<Rating, string> = {
  again: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  hard: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  good: "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100",
  easy: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
};

const ratingText: Record<Rating, [string, string]> = {
  again: ["Lại", "< 1 phút"],
  hard: ["Khó", "< 6 phút"],
  good: ["Tốt", "< 10 phút"],
  easy: ["Dễ", "4 ngày"],
};

export default function Study({ questions, toggleBookmark, onRate }: Props) {
  const [current, setCurrent] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [sessionComplete, setSessionComplete] = useState(false);
  const [studyQuestions, setStudyQuestions] = useState(questions);
  const [isShuffled, setIsShuffled] = useState(false);

  const answered = Object.keys(ratings).length;
  const question = studyQuestions[current];
  const progress = studyQuestions.length ? (answered / studyQuestions.length) * 100 : 0;
  const isLast = current === studyQuestions.length - 1;
  const correctCount = useMemo(
    () => Object.values(ratings).filter((rating) => rating === "good" || rating === "easy").length,
    [ratings]
  );

  useEffect(() => {
    setStudyQuestions(questions);
    setIsShuffled(false);
    setCurrent(0);
    setShowAnswer(false);
    setSelectedOption(null);
    setRatings({});
    setSessionComplete(false);
  }, [questions]);

  function changeOrder(shuffle: boolean) {
    const next = [...questions];
    if (shuffle) {
      for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      }
    }
    setStudyQuestions(next);
    setIsShuffled(shuffle);
    setCurrent(0);
    setShowAnswer(false);
    setSelectedOption(null);
    setRatings({});
    setSessionComplete(false);
  }

  const rateCard = useCallback((rating: Rating) => {
    if (!question) return;
    const ratingNumber = { again: 1, hard: 2, good: 3, easy: 4 }[rating];
    void onRate?.(question, ratingNumber);
    setRatings((previous) => ({ ...previous, [question.id]: rating }));

    if (isLast) {
      setSessionComplete(true);
      return;
    }

    setCurrent((previous) => previous + 1);
    setShowAnswer(false);
    setSelectedOption(null);
  }, [isLast, onRate, question]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (event.code === "Space") {
        event.preventDefault();
        setShowAnswer((shown) => !shown);
      }

      if (showAnswer) {
        const rating = ({ "1": "again", "2": "hard", "3": "good", "4": "easy" } as const)[event.key];
        if (rating) rateCard(rating);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAnswer, rateCard]);

  function restart() {
    setCurrent(0);
    setShowAnswer(false);
    setSelectedOption(null);
    setRatings({});
    setSessionComplete(false);
  }

  function chooseOption(option: string) {
    if (!question?.options || selectedOption) return;
    setSelectedOption(option);
    setShowAnswer(true);
  }

  if (sessionComplete) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-176px)] max-w-3xl items-center px-5 py-10">
        <div className="w-full rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-500"><Check size={32} /></div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-rose-500">Hoàn thành phiên học</p>
          <h1 className="mt-3 text-3xl font-bold text-rose-950">Bạn đã học hết {studyQuestions.length} thẻ</h1>
          <p className="mt-3 text-slate-500">{correctCount} thẻ được đánh giá Tốt hoặc Dễ. Hãy quay lại vào ngày mai để ôn lại.</p>
          <button onClick={restart} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-3 font-semibold text-white hover:bg-teal-500"><RotateCcw size={18} /> Học lại phiên này</button>
        </div>
      </section>
    );
  }

  if (!question) return null;

  return (
    <section className="mx-auto max-w-4xl px-5 py-8 sm:py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-rose-500">Phiên học hôm nay</p>
          <p className="mt-1 text-sm text-slate-400">Còn {studyQuestions.length - answered} thẻ mới</p>
        </div>
        <div className="flex items-center gap-2"><div className="flex items-center gap-1 rounded-lg border border-rose-100 bg-white/80 p-1"><button onClick={() => changeOrder(true)} title="Trộn bộ thẻ" aria-label="Trộn bộ thẻ" className={`rounded-md p-2 ${isShuffled ? "bg-rose-100 text-rose-600" : "text-slate-400 hover:bg-rose-50"}`}><Shuffle size={17} /></button><button onClick={() => changeOrder(false)} title="Học theo thứ tự" aria-label="Học theo thứ tự" className={`rounded-md p-2 ${!isShuffled ? "bg-teal-50 text-teal-600" : "text-slate-400 hover:bg-teal-50"}`}><ListOrdered size={17} /></button></div><div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Clock3 size={17} /> {current + 1} / {studyQuestions.length}</div></div>
      </div>

      <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-rose-100"><div className="h-full rounded-full bg-teal-300 transition-all duration-500" style={{ width: `${progress}%` }} /></div>

      <article className="min-h-[430px] overflow-hidden rounded-3xl border border-rose-100 bg-white/95 shadow-[0_18px_45px_rgba(244,114,182,0.12)]">
        <div className="flex items-center justify-between border-b border-rose-50 px-6 py-5 sm:px-8">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${categoryColor[question.category] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}>{question.category}</span>
          <button onClick={() => toggleBookmark(question.id)} aria-label="Lưu thẻ để ôn lại" className={`rounded-lg p-2 ${question.bookmarked ? "bg-rose-50 text-rose-400" : "text-slate-400 hover:bg-rose-50 hover:text-rose-400"}`}><Bookmark size={20} fill={question.bookmarked ? "currentColor" : "none"} /></button>
        </div>

        <div className="flex min-h-[325px] flex-col justify-center px-6 py-10 text-center sm:px-14">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Câu hỏi</p>
          <div className="rich-content text-2xl font-semibold leading-relaxed text-slate-800 sm:text-3xl" dangerouslySetInnerHTML={{ __html: toClozeQuestionHtml(question.question) }} />
          {question.options?.length ? <div className="mx-auto mt-8 grid w-full max-w-2xl gap-3 text-left">{question.options.map((option, index) => { const chosen = selectedOption === option; const correct = question.correctOption === option; return <button key={`${option}-${index}`} type="button" onClick={() => chooseOption(option)} className={`rounded-xl border px-4 py-3 text-base transition ${showAnswer ? correct ? "border-teal-300 bg-teal-50 text-teal-800" : chosen ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-100 bg-slate-50 text-slate-400" : "border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50"}`}><span className="mr-2 font-bold">{String.fromCharCode(65 + index)}.</span>{option}</button>; })}</div> : null}
          {showAnswer && <div className="mt-10 border-t border-rose-50 pt-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-500">{question.options?.length ? "Giải thích" : "Đáp án"}</p><div className="rich-content mt-3 text-xl font-semibold leading-relaxed text-slate-800 sm:text-2xl" dangerouslySetInnerHTML={{ __html: sanitizeHtml(toEditorHtml(question.options?.length ? (question.explanation || question.answer) : question.answer)) }} /></div>}
        </div>
      </article>

      {!showAnswer ? (
        <button onClick={() => setShowAnswer(true)} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-300 py-4 font-semibold text-rose-950 shadow-sm hover:bg-rose-400"><Sparkles size={18} /> Hiện đáp án</button>
      ) : (
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(ratingText) as Rating[]).map((rating) => <button key={rating} onClick={() => rateCard(rating)} className={`rounded-xl border px-3 py-3 text-center transition ${ratingStyle[rating]}`}><span className="block font-bold">{ratingText[rating][0]}</span><span className="mt-1 block text-xs opacity-70">{ratingText[rating][1]}</span></button>)}
        </div>
      )}
      <p className="mt-5 text-center text-xs text-slate-400">Phím cách: lật thẻ · 1–4: Lại đến Dễ</p>
    </section>
  );
}
