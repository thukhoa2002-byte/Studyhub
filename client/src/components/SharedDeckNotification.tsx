import { BellOff, BellRing, X } from "lucide-react";
import type { DeckActivityNotification } from "../services/supabase";

interface Props {
  notifications: DeckActivityNotification[];
  onDismiss: (notificationId: string) => void;
  onDisable: () => void;
}

export default function SharedDeckNotification({ notifications, onDismiss, onDisable }: Props) {
  if (notifications.length === 0) return null;

  return (
    <aside className="shared-deck-toast fixed right-4 top-20 z-[95] w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-3xl border border-teal-100 bg-white/90 p-4 shadow-[0_24px_65px_rgba(15,118,110,.2)] backdrop-blur-2xl" aria-label="Thông báo bộ thẻ" aria-live="polite">
      <div className="flex items-center gap-3 px-1 pb-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-rose-100 text-teal-700"><BellRing size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">Hoạt động mới</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Trong bộ thẻ bạn đang học chung</p>
        </div>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {notifications.slice(0, 6).map((notification) => (
          <div key={notification.id} className="flex items-start gap-3 rounded-2xl border border-teal-50 bg-gradient-to-r from-teal-50/85 to-rose-50/65 px-3 py-3" role="status">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-base shadow-sm">📝</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5 text-slate-700"><strong className="font-bold text-rose-950">{notification.actor_label}</strong> đã thêm 1 flashcard vào bộ thẻ <strong className="font-bold text-teal-700">{notification.deck_title}</strong>.</p>
              <p className="mt-1 text-[10px] font-semibold text-slate-400">{new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(notification.created_at))}</p>
            </div>
            <button type="button" onClick={() => onDismiss(notification.id)} aria-label="Đánh dấu đã đọc" title="Đóng" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-rose-600"><X size={15} /></button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-end border-t border-slate-100 pt-2">
        <button type="button" onClick={onDisable} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700"><BellOff size={15} /> Tắt thông báo</button>
      </div>
    </aside>
  );
}
