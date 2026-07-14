import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import type { GeneratedQuestion } from "../services/api";
import RichTextEditor from "./RichTextEditor";

interface Props {
  title: string;
  questions: GeneratedQuestion[];
  visibility: "private" | "shared";
  onCancel: () => void;
  onSave: (title: string, questions: GeneratedQuestion[], visibility: "private" | "shared") => void | Promise<void>;
  onSaveAndStudy: (title: string, questions: GeneratedQuestion[], visibility: "private" | "shared") => void | Promise<void>;
}

export default function DeckEditor({ title: initialTitle, questions: initialQuestions, visibility: initialVisibility, onCancel, onSave, onSaveAndStudy }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [questions, setQuestions] = useState(initialQuestions);

  function update(id: string, field: "question" | "answer", value: string) {
    setQuestions((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function addCard() {
    setQuestions((current) => [...current, { id: crypto.randomUUID(), question: "", answer: "", category: "Tự tạo", importance: 1, bookmarked: false }]);
  }

  function save(saveAndStudy = false) {
    const valid = questions.filter((item) => item.question.trim() && item.answer.trim());
    if (!title.trim() || valid.length === 0) return;
    void (saveAndStudy ? onSaveAndStudy(title.trim(), valid, visibility) : onSave(title.trim(), valid, visibility));
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div><p className="text-sm font-semibold text-rose-500">Chỉnh sửa</p><h1 className="text-3xl font-bold text-rose-950">Sửa bộ thẻ</h1></div>
        <button onClick={onCancel} className="inline-flex items-center gap-2 rounded-lg border border-rose-100 bg-white px-4 py-2 text-sm font-semibold text-slate-600"><X size={17} /> Hủy</button>
      </div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="flex-1 rounded-lg border border-rose-100 bg-white px-4 py-3 font-semibold text-rose-950 outline-none focus:border-rose-300" />
        <select value={visibility} onChange={(event) => setVisibility(event.target.value as "private" | "shared")} className="rounded-lg border border-rose-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          <option value="private">🔒 Chỉ mình tôi</option><option value="shared">🌸 Chia sẻ</option>
        </select>
      </div>
      <div className="space-y-3">
        {questions.map((item, index) => <div key={item.id} className="grid gap-3 rounded-lg border border-rose-100 bg-white/85 p-4 sm:grid-cols-[1fr_1fr_auto]">
          <RichTextEditor value={item.question} onChange={(value) => update(item.id, "question", value)} placeholder={`Mặt trước thẻ ${index + 1}`} />
          <RichTextEditor value={item.answer} onChange={(value) => update(item.id, "answer", value)} placeholder="Mặt sau" />
          <button onClick={() => setQuestions((current) => current.filter((card) => card.id !== item.id))} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Xóa thẻ"><Trash2 size={18} /></button>
        </div>)}
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button onClick={addCard} title="Thêm thẻ" aria-label="Thêm thẻ" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-rose-100 bg-white text-slate-700 hover:bg-rose-50"><Plus size={20} /></button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={() => save(false)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-white px-5 py-3 text-sm font-bold text-teal-700 hover:bg-teal-50"><Check size={18} /> Lưu</button>
          <button onClick={() => save(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-5 py-3 text-sm font-bold text-white hover:bg-teal-500"><Check size={18} /> Lưu &amp; học ngay</button>
        </div>
      </div>
    </section>
  );
}
