import { MessageCircle, X } from "lucide-react";
import { useState } from "react";

export default function PandaAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-2 sm:bottom-7 sm:right-7">
      {open && <div className="relative w-60 rounded-2xl border border-rose-100 bg-white/95 p-4 text-sm text-slate-600 shadow-[0_16px_40px_rgba(190,24,93,0.18)] backdrop-blur">
        <button type="button" onClick={() => setOpen(false)} aria-label="Đóng trợ lý" className="absolute right-2 top-2 rounded-full p-1 text-slate-400 hover:bg-rose-50"><X size={14} /></button>
        <p className="pr-5 font-bold text-rose-950">Panda học bài đây! 🐼</p>
        <p className="mt-1 leading-5">Cần mình giúp tạo thẻ, ôn bài hay giải thích kiến thức không?</p>
      </div>}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Mở trợ lý AI Panda" className="group relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-rose-100 to-teal-100 shadow-[0_10px_30px_rgba(15,118,110,0.2)] transition hover:scale-105 sm:h-24 sm:w-24">
        <img src="/panda-assistant.png" alt="Trợ lý AI Panda" className="panda-bob h-full w-full object-contain" />
        <span className="panda-bamboo" aria-hidden="true">🎋</span>
        <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-teal-400 text-white shadow-sm"><MessageCircle size={14} /></span>
      </button>
    </div>
  );
}
