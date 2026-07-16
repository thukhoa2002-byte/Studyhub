import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Play, RotateCcw, Trophy, XCircle } from "lucide-react";

type Option = { id: string; text: string };
type QuizQuestion = {
  id: string;
  source_number: number;
  question: string;
  options: Option[];
  correct_answer: string;
  review_required?: boolean;
};
type QuizBank = { title: string; questions: QuizQuestion[] };

export default function McqPage() {
  const [bank, setBank] = useState<QuizBank | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    void fetch("/mcq/bo-mcq-kho-khe.json")
      .then((response) => response.ok ? response.json() as Promise<QuizBank> : Promise.reject(new Error("Không thể tải bộ MCQ.")))
      .then(setBank)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Không thể tải bộ MCQ."));
  }, []);

  const question = bank?.questions[index] ?? null;
  const selected = question ? answers[question.id] : undefined;
  const isChecked = question ? Boolean(checked[question.id]) : false;
  const correctCount = useMemo(
    () => bank?.questions.filter((item) => checked[item.id] && answers[item.id] === item.correct_answer).length ?? 0,
    [answers, bank, checked]
  );
  const completedCount = Object.keys(checked).length;

  function choose(optionId: string) {
    if (!question || isChecked) return;
    setAnswers((items) => ({ ...items, [question.id]: optionId }));
  }

  function checkAnswer() {
    if (!question || !selected) return;
    setChecked((items) => ({ ...items, [question.id]: true }));
  }

  function restart() {
    setIndex(0);
    setAnswers({});
    setChecked({});
  }

  if (error) return <section className="mode-panel mx-auto w-full max-w-5xl px-5 py-8"><p className="rounded-2xl border border-rose-200 bg-white p-5 text-sm font-semibold text-rose-700">{error}</p></section>;
  if (!bank || !question) return <section className="mode-panel mx-auto w-full max-w-5xl px-5 py-8"><div className="glass-panel rounded-3xl p-8 text-center text-sm font-semibold text-slate-500">Đang nạp danh sách bộ MCQ…</div></section>;

  const isCorrect = selected === question.correct_answer;
  const isLast = index === bank.questions.length - 1;
  const completed = completedCount === bank.questions.length;

  if (!opened) {
    return (
      <section className="mode-panel mx-auto w-full max-w-5xl px-5 py-8" aria-labelledby="mcq-title">
        <div className="glass-panel overflow-hidden border border-violet-100/80 bg-white/70 p-6 sm:p-10">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-teal-100 text-violet-700 shadow-sm"><CircleHelp size={32} strokeWidth={1.9} /></div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-teal-600">Khu vực luyện tập</p>
              <h1 id="mcq-title" className="mt-1 text-3xl font-extrabold tracking-tight text-rose-950">MCQ</h1>
              <p className="mt-1 text-sm text-slate-500">Chọn một bộ đề để bắt đầu làm trắc nghiệm.</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={() => setOpened(true)} className="group rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/90 via-white to-teal-50/80 p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><CircleHelp size={24} /></div>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-teal-700 shadow-sm">{bank.questions.length} câu</span>
              </div>
              <h2 className="mt-5 text-xl font-extrabold text-rose-950">Bộ MCQ - Khò khè</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Tiếp cận khò khè, viêm tiểu phế quản và hen.</p>
              <div className="mt-6 flex items-center justify-between text-sm font-bold text-violet-700"><span>{completedCount > 0 ? `Đã kiểm tra ${completedCount} câu` : "Chưa bắt đầu"}</span><span className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-white group-hover:bg-violet-600">{completedCount > 0 ? "Làm tiếp" : "Bắt đầu"}<Play size={15} fill="currentColor" /></span></div>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mode-panel mx-auto w-full max-w-5xl px-5 py-8" aria-labelledby="mcq-title">
      <div className="glass-panel overflow-hidden border border-violet-100/80 bg-white/70 p-6 sm:p-10">
        <div className="mb-6"><button type="button" onClick={() => setOpened(false)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"><ArrowLeft size={17} />Danh sách bộ MCQ</button></div>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-15 w-15 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-teal-100 text-violet-700 shadow-sm"><CircleHelp size={30} strokeWidth={2} /></div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-teal-600">Bộ trắc nghiệm</p>
              <h1 id="mcq-title" className="mt-1 text-3xl font-extrabold tracking-tight text-rose-950">Bộ MCQ - Khò khè</h1>
              <p className="mt-1 text-sm text-slate-500">{bank.questions.length} câu · Chọn đáp án rồi bấm kiểm tra ngay.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-teal-50/75 px-4 py-3 text-center sm:min-w-36">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Điểm hiện tại</p>
            <p className="mt-1 text-2xl font-black text-rose-950">{correctCount}<span className="text-sm font-bold text-slate-400">/{completedCount}</span></p>
          </div>
        </div>

        <div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`Tiến độ ${index + 1} trên ${bank.questions.length}`}>
          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-teal-400 transition-all duration-300" style={{ width: `${((index + 1) / bank.questions.length) * 100}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500"><span>Câu {index + 1}/{bank.questions.length}</span><span>Đã kiểm tra {completedCount} câu</span></div>

        <article className="mt-7 rounded-3xl border border-slate-100 bg-gradient-to-br from-white via-violet-50/40 to-teal-50/45 p-5 sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">Câu nguồn #{question.source_number}</p>
          <h2 className="mt-3 text-lg font-bold leading-7 text-slate-800 sm:text-xl">{question.question}</h2>
          <div className="mt-6 space-y-3">
            {question.options.map((option) => {
              const chosen = selected === option.id;
              const answer = question.correct_answer === option.id;
              const stateClass = isChecked && answer ? "border-teal-400 bg-teal-50 text-teal-950" : isChecked && chosen ? "border-rose-400 bg-rose-50 text-rose-950" : chosen ? "border-violet-400 bg-violet-50 text-violet-950" : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50/40";
              return <button key={option.id} type="button" onClick={() => choose(option.id)} disabled={isChecked} className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition ${stateClass} disabled:cursor-default`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${isChecked && answer ? "bg-teal-500 text-white" : isChecked && chosen ? "bg-rose-500 text-white" : chosen ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>{option.id}</span>
                <span className="pt-0.5 leading-6">{option.text}</span>
              </button>;
            })}
          </div>
          {isChecked && <div className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${isCorrect ? "border-teal-200 bg-teal-50 text-teal-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {isCorrect ? <CheckCircle2 className="mt-0.5 shrink-0" size={20} /> : <XCircle className="mt-0.5 shrink-0" size={20} />}
            <p>{isCorrect ? "Chính xác!" : `Chưa đúng. Đáp án là ${question.correct_answer}.`}{question.review_required ? " Đáp án này được giữ theo ghi chú nguồn và nên được rà soát lại." : ""}</p>
          </div>}
        </article>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"><ChevronLeft size={18} />Câu trước</button>
          <div className="flex gap-3">
            {!isChecked ? <button type="button" onClick={checkAnswer} disabled={!selected} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-45"><CheckCircle2 size={18} />Kiểm tra</button> : !isLast ? <button type="button" onClick={() => setIndex((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-600">Câu tiếp<ChevronRight size={18} /></button> : <button type="button" onClick={restart} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-600"><RotateCcw size={18} />Làm lại</button>}
          </div>
        </div>
        {completed && <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900"><Trophy size={22} className="shrink-0" />Hoàn thành bộ câu hỏi: {correctCount}/{bank.questions.length} câu đúng.</div>}
      </div>
    </section>
  );
}
