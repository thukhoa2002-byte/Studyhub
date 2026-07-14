import { Bell, BellOff, X } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "hoc-bai-reminder";
interface Reminder { enabled: boolean; time: string; }

export default function ReminderSettings() {
  const [open, setOpen] = useState(false);
  const [reminder, setReminder] = useState<Reminder>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "") as Reminder; } catch { return { enabled: false, time: "20:00" }; }
  });

  useEffect(() => {
    if (!reminder.enabled) return;
    const timer = window.setInterval(() => {
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const last = localStorage.getItem(`${KEY}-last`);
      const today = now.toISOString().slice(0, 10);
      if (current === reminder.time && last !== today) {
        localStorage.setItem(`${KEY}-last`, today);
        if ("Notification" in window && Notification.permission === "granted") new Notification("Học bài thoiii", { body: "Đến giờ ôn thẻ rồi đó 🌸" });
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [reminder]);

  async function save() {
    if (reminder.enabled && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    localStorage.setItem(KEY, JSON.stringify(reminder));
    setOpen(false);
  }

  return <>
    <button onClick={() => setOpen(true)} title="Nhắc học" aria-label="Nhắc học" className={`rounded-full p-2 ${reminder.enabled ? "bg-amber-50 text-amber-500" : "text-slate-400 hover:bg-rose-50 hover:text-rose-500"}`}>{reminder.enabled ? <Bell size={17} /> : <BellOff size={17} />}</button>
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/35 px-4"><div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"><div className="flex justify-between"><h2 className="text-xl font-bold text-rose-950">Nhắc học</h2><button onClick={() => setOpen(false)}><X size={18} /></button></div><label className="mt-5 flex items-center gap-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={reminder.enabled} onChange={(event) => setReminder({ ...reminder, enabled: event.target.checked })} /> Bật nhắc học mỗi ngày</label><label className="mt-4 block text-sm font-semibold text-slate-700">Giờ nhắc<input type="time" value={reminder.time} onChange={(event) => setReminder({ ...reminder, time: event.target.value })} className="mt-2 w-full rounded-lg border border-rose-100 px-3 py-2" /></label><button onClick={() => void save()} className="mt-5 w-full rounded-lg bg-teal-400 py-3 font-bold text-white">Lưu nhắc học</button></div></div>}
  </>;
}
