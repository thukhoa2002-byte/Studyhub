import { Bookmark, CheckCircle2, Inbox } from "lucide-react";
import type { GeneratedQuestion } from "../services/api";

interface Props {
  questions: GeneratedQuestion[];
  toggleBookmark: (id: string) => void;
}

export default function Review({ questions, toggleBookmark }: Props) {
  const saved = questions.filter((question) => question.bookmarked);

  return (
    <section className="mx-auto w-full max-w-[1600px] px-5 py-10">
      <div className="rounded-3xl border border-rose-100 bg-white/90 p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-400">Thẻ đã đánh dấu</p>
        <h1 className="mt-2 text-3xl font-bold text-rose-950">Ôn lại sau</h1>
        <p className="mt-2 text-slate-500">Lưu những thẻ bạn muốn đưa vào phiên ôn tập tiếp theo.</p>
        {saved.length === 0 ? <div className="mt-10 rounded-2xl bg-rose-50/60 px-6 py-12 text-center"><Inbox className="mx-auto text-rose-300" size={34} /><p className="mt-4 font-semibold text-slate-700">Chưa có thẻ nào được lưu</p><p className="mt-1 text-sm text-slate-500">Dùng biểu tượng đánh dấu trên thẻ để thêm vào đây.</p></div> : <div className="mt-8 space-y-3">{saved.map((question) => <div key={question.id} className="flex items-start gap-4 rounded-2xl border border-rose-100 bg-rose-50/30 p-5"><CheckCircle2 className="mt-0.5 shrink-0 text-teal-400" size={20} /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-rose-300">{question.category}</p><p className="mt-1 font-semibold text-slate-800">{question.question}</p></div><button onClick={() => toggleBookmark(question.id)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-50" aria-label="Bỏ lưu thẻ"><Bookmark fill="currentColor" size={20} /></button></div>)}</div>}
      </div>
    </section>
  );
}
