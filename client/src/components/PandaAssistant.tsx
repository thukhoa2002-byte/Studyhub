import { MessageCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PandaAction = "sleep" | "wake" | "eat" | "nap" | "study" | "exercise";

function getPandaRoutine(date: Date): { action: PandaAction; label: string; message: string; emoji: string } {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 6 * 60 + 15 && minutes < 7 * 60 + 30) return { action: "wake", label: "Thức dậy · vệ sinh · ăn uống", message: "Panda vừa thức dậy, vệ sinh và nạp năng lượng cho ngày mới.", emoji: "🌱" };
  if (minutes >= 7 * 60 + 30 && minutes < 11 * 60 + 30) return { action: "study", label: "Học buổi sáng", message: "Panda đang học cùng bạn, cố lên nhé!", emoji: "📚" };
  if (minutes >= 11 * 60 + 30 && minutes < 13 * 60 + 30) return { action: "nap", label: "Nghỉ trưa", message: "Panda nghỉ một chút để chiều học thật tỉnh nhé.", emoji: "💤" };
  if (minutes >= 13 * 60 + 30 && minutes < 17 * 60 + 30) return { action: "study", label: "Học chiều", message: "Cùng bạn nạp kiến thức vào bộ nhớ thôi!", emoji: "📚" };
  if (minutes >= 17 * 60 + 30 && minutes < 19 * 60) return { action: "exercise", label: "Thể dục · thư giãn", message: "Panda vận động, thư giãn và nghỉ ngơi trước buổi tối.", emoji: "🏃" };
  if (minutes >= 19 * 60 && minutes < 23 * 60) return { action: "study", label: "Học buổi tối", message: "Buổi tối vẫn còn thời gian để ôn thêm một chút nha.", emoji: "📚" };
  return { action: "sleep", label: "Ngủ ngon", message: "Panda đang ngủ để mai lại đồng hành cùng bạn.", emoji: "💤" };
}

export default function PandaAssistant() {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const routine = useMemo(() => getPandaRoutine(now), [now]);
  const timeLabel = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-2 sm:bottom-7 sm:right-7">
      {open && <div className="relative w-60 rounded-2xl border border-rose-100 bg-white/95 p-4 text-sm text-slate-600 shadow-[0_16px_40px_rgba(190,24,93,0.18)] backdrop-blur">
        <button type="button" onClick={() => setOpen(false)} aria-label="Đóng trợ lý" className="absolute right-2 top-2 rounded-full p-1 text-slate-400 hover:bg-rose-50"><X size={14} /></button>
        <p className="pr-5 font-bold text-rose-950">Panda học bài đây! 🐼</p>
        <p className="mt-1 font-semibold text-teal-600">{routine.label} · {routine.emoji}</p>
        <p className="mt-1 text-[11px] font-medium text-slate-400">Cập nhật lúc {timeLabel}</p>
        <p className="mt-1 leading-5">{routine.message}</p>
      </div>}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`Mở trợ lý AI Panda: ${routine.label}`} title={routine.label} className="group relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-rose-100 to-teal-100 shadow-[0_10px_30px_rgba(15,118,110,0.2)] transition hover:scale-105 sm:h-24 sm:w-24">
        <img src="/panda-assistant.png" alt="Trợ lý AI Panda" className={`panda-bob panda-action-${routine.action} h-full w-full object-contain`} />
        <span className={`panda-prop panda-prop-${routine.action}`} aria-hidden="true">{routine.emoji}</span>
        <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-teal-400 text-white shadow-sm"><MessageCircle size={14} /></span>
      </button>
    </div>
  );
}
