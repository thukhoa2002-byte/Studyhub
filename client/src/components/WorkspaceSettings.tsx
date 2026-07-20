import { useRef, useState } from "react";
import { Bell, BellOff, Camera, LogOut, Moon, Settings, Sun, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";

interface Props {
  user: User | null;
  onUserChange: (user: User | null) => void;
  theme: "color" | "basic" | "test" | "test-light";
  onThemeChange: (theme: "color" | "basic" | "test" | "test-light") => void;
  sharedDeckNotificationsEnabled: boolean;
  onSharedDeckNotificationsChange: (enabled: boolean) => void;
}

export default function WorkspaceSettings({ user, onUserChange, theme, onThemeChange, sharedDeckNotificationsEnabled, onSharedDeckNotificationsChange }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  async function updateAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !supabase || !user) return;
    if (!file.type.startsWith("image/")) { alert("Vui lòng chọn một tệp hình ảnh."); return; }
    if (file.size > 2 * 1024 * 1024) { alert("Ảnh đại diện nên nhỏ hơn 2 MB."); return; }
    setBusy(true);
    try {
      const avatarUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Không thể đọc ảnh."));
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      if (error) throw error;
      onUserChange(data.user);
      setOpen(false);
    } catch (error) {
      alert(`Không thể cập nhật ảnh đại diện: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-settings mt-3 lg:mt-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Mở cài đặt tài khoản"
        aria-expanded={open}
        title="Cài đặt tài khoản và giao diện"
        className={`flex h-11 w-full items-center justify-start gap-3 rounded-xl border bg-white/80 px-3 text-slate-600 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 ${open ? "border-teal-200 bg-teal-50 text-teal-700" : "border-white/80"}`}
      >
        <Settings size={21} />
        <span className="workspace-settings__label text-sm font-bold">Cài đặt</span>
      </button>

      {open && <div className="glass-dialog mt-3 rounded-2xl border border-rose-100 bg-white/95 p-3 shadow-[0_18px_45px_rgba(15,23,42,.15)]">
        {user ? <>
          <p className="truncate px-2 pb-2 text-xs font-semibold text-slate-500">{user.email}</p>
          <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(event) => void updateAvatar(event)} />
          <button type="button" disabled={busy} onClick={() => avatarInput.current?.click()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-rose-50 disabled:opacity-50"><Camera size={16} />Đổi ảnh đại diện</button>
          <button type="button" onClick={() => { setOpen(false); void supabase?.auth.signOut(); }} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"><LogOut size={16} />Đăng xuất</button>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <button type="button" role="switch" aria-checked={sharedDeckNotificationsEnabled} onClick={() => onSharedDeckNotificationsChange(!sharedDeckNotificationsEnabled)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-teal-50">
              {sharedDeckNotificationsEnabled ? <Bell size={16} className="text-teal-600" /> : <BellOff size={16} className="text-slate-400" />}
              <span className="flex-1">Thông báo bộ thẻ</span>
              <span className={`relative h-5 w-9 rounded-full transition ${sharedDeckNotificationsEnabled ? "bg-teal-400" : "bg-slate-200"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${sharedDeckNotificationsEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} /></span>
            </button>
          </div>
        </> : <div className="flex items-center gap-2 px-2 pb-2 text-xs font-semibold text-slate-500"><UserRound size={16} />Chế độ khách</div>}

        <div className="mt-2 border-t border-slate-100 pt-2">
          <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Giao diện</p>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50 p-1">
            <button type="button" onClick={() => onThemeChange("color")} className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${theme === "color" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"}`}>Color</button>
            <button type="button" onClick={() => onThemeChange("basic")} className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${theme === "basic" ? "bg-slate-700 text-white shadow-sm" : "text-slate-500"}`}>Basic</button>
            <button type="button" onClick={() => onThemeChange("test")} className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${theme === "test" ? "bg-slate-900 text-cyan-200 shadow-sm" : theme === "test-light" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Test</button>
          </div>
          {(theme === "test" || theme === "test-light") && <button type="button" onClick={() => onThemeChange(theme === "test" ? "test-light" : "test")} className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200/70 px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50" aria-label={theme === "test" ? "Chuyển Test sang chế độ sáng" : "Chuyển Test sang chế độ tối"}>
            <span className="flex items-center gap-2">{theme === "test" ? <Sun size={15} /> : <Moon size={15} />}Test {theme === "test" ? "sáng" : "tối"}</span>
            <span className="text-[10px] text-slate-400">Đổi</span>
          </button>}
        </div>
      </div>}
    </div>
  );
}
