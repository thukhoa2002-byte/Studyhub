import { MessageCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PandaAction = "sleep" | "wake" | "eat" | "nap" | "study" | "exercise";

const PANDA_TITLES: Record<PandaAction, string> = {
  sleep: "Panda đi ngủ đây! 🐼",
  wake: "Panda thức dậy rồi! 🐼",
  eat: "Panda ăn sáng đây! 🐼",
  nap: "Panda nghỉ trưa đây! 🐼",
  study: "Panda học bài đây! 🐼",
  exercise: "Panda đi chơi đây! 🐼",
};

function getPandaRoutine(date: Date): { action: PandaAction; label: string; message: string; emoji: string } {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 6 * 60 + 15 && minutes < 7 * 60 + 30) return { action: "eat", label: "Thức dậy · vệ sinh · ăn uống", message: "Panda vừa thức dậy, vệ sinh và đang gặm trúc nạp năng lượng cho ngày mới.", emoji: "🎋" };
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
  const sleeping = routine.action === "sleep" || routine.action === "nap";
  const pandaImage = sleeping ? "/panda-sleeping-branch.png" : "/panda-assistant.png";
  const scene = routine.action === "exercise" ? "🎉✨" : "";

  return (
    <div className="fixed bottom-20 right-4 z-[var(--z-chatbot)] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      {open && <div className="ui-card relative w-60 p-4 text-sm text-[var(--text-secondary)]">
        <button type="button" onClick={() => setOpen(false)} aria-label="Đóng trợ lý" className="absolute right-2 top-2 rounded-full p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"><X size={14} /></button>
        <p className="pr-5 font-bold text-[var(--text-primary)]">{PANDA_TITLES[routine.action]}</p>
        <p className="mt-1 font-semibold text-[var(--accent-hover)]">{routine.label} · {routine.emoji}</p>
        <p className="mt-1 text-[11px] font-medium text-slate-400">Cập nhật lúc {timeLabel}</p>
        <p className="mt-1 leading-5">{routine.message}</p>
      </div>}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`Mở trợ lý AI Panda: ${routine.label}`} title={routine.label} aria-expanded={open} className="group relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-[var(--surface-selected)] shadow-[var(--shadow-md)] transition hover:scale-105 sm:h-20 sm:w-20">
        {scene && <span className={`panda-scene panda-scene-${routine.action}`} aria-hidden="true">{scene}</span>}
        <img src={pandaImage} alt={sleeping ? "Panda đang ngủ trên cành cây" : "Trợ lý AI Panda"} className={`panda-bob panda-action-${routine.action} relative z-[1] h-full w-full rounded-full object-cover`} />
        <span className={`panda-prop panda-prop-${routine.action}`} aria-hidden="true">{routine.emoji}</span>
        <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-sm"><MessageCircle size={13} /></span>
      </button>
    </div>
  );
}
