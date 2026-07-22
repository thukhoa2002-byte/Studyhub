import { useRef, useState } from "react";
import { Bell, BellOff, Camera, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, LogOut, Moon, Palette, Sun, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";

interface Props {
  user: User | null;
  onUserChange: (user: User | null) => void;
  theme: "color" | "basic" | "test" | "test-light" | "green";
  onThemeChange: (theme: "color" | "basic" | "test" | "test-light" | "green") => void;
  sharedDeckNotificationsEnabled: boolean;
  onSharedDeckNotificationsChange: (enabled: boolean) => void;
}

export default function WorkspaceSettings({ user, onUserChange, theme, onThemeChange, sharedDeckNotificationsEnabled, onSharedDeckNotificationsChange }: Props) {
  const [open, setOpen] = useState(false);
  const [menuView, setMenuView] = useState<"root" | "theme" | "help" | "profile">("root");
  const [busy, setBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const avatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const displayName = user?.user_metadata?.full_name || user?.email || "Khách";

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
      setMenuView("root");
    } catch (error) {
      alert(`Không thể cập nhật ảnh đại diện: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-settings relative mt-3 lg:mt-auto lg:border-t lg:border-slate-200/80 lg:pt-4">
      <button
        type="button"
        onClick={() => { setOpen((value) => !value); setMenuView("root"); }}
        aria-label="Mở cài đặt tài khoản"
        aria-expanded={open}
        title="Tài khoản và chế độ giao diện"
        className={`flex h-12 w-full items-center justify-start gap-3 rounded-xl border bg-white/80 px-2.5 text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 ${open ? "border-teal-200 bg-teal-50 text-teal-700" : "border-white/80"}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-teal-100 bg-teal-50 text-teal-700">{avatar ? <img src={avatar as string} alt="Ảnh đại diện" className="h-full w-full object-cover" /> : user ? <span className="text-xs font-black">{(user.email?.[0] || "U").toUpperCase()}</span> : <UserRound size={18} />}</span>
        <span className="workspace-settings__label min-w-0 text-left"><span className="block truncate text-sm font-bold">{displayName}</span><span className="block truncate text-[11px] font-medium text-slate-400">{user ? "Tài khoản StudyHub" : "Chế độ khách"}</span></span>
        <ChevronDown className="workspace-settings__chevron ml-auto shrink-0" size={17} aria-hidden="true" />
      </button>

      {open && <div className="glass-dialog absolute bottom-[calc(100%+.75rem)] left-0 z-[100] w-full rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-[0_18px_45px_rgba(15,23,42,.18)] backdrop-blur-xl">
        {menuView === "root" && <div className="space-y-1">
          <button type="button" onClick={() => setMenuView("theme")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700"><Palette size={17} /><span className="flex-1">Giao diện background</span><ChevronRight size={16} className="text-slate-400" /></button>
          <button type="button" onClick={() => setMenuView("help")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700"><CircleHelp size={17} /><span className="flex-1">Help center</span><ChevronRight size={16} className="text-slate-400" /></button>
          <button type="button" onClick={() => setMenuView("profile")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700"><UserRound size={17} /><span className="flex-1">My Profile</span><ChevronRight size={16} className="text-slate-400" /></button>
        </div>}

        {menuView !== "root" && <>
          <button type="button" onClick={() => setMenuView("root")} className="mb-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700"><ChevronLeft size={14} />Quay lại</button>
          {menuView === "theme" && <div>
            <p className="px-2 pb-2 text-sm font-black text-slate-800">Giao diện background</p>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-50 p-1">
              <button type="button" onClick={() => onThemeChange("color")} className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${theme === "color" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"}`}>Color</button>
              <button type="button" onClick={() => onThemeChange("basic")} className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${theme === "basic" ? "bg-slate-700 text-white shadow-sm" : "text-slate-500"}`}>Basic</button>
              <button type="button" onClick={() => onThemeChange("test")} className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${theme === "test" ? "bg-slate-900 text-cyan-200 shadow-sm" : theme === "test-light" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Test</button>
              <button type="button" onClick={() => onThemeChange("green")} className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${theme === "green" ? "bg-[#064E3B] text-[#F8E7C9] shadow-sm" : "text-slate-500"}`}>Green</button>
            </div>
            {(theme === "test" || theme === "test-light") && <button type="button" onClick={() => onThemeChange(theme === "test" ? "test-light" : "test")} className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200/70 px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50" aria-label={theme === "test" ? "Chuyển Test sang chế độ sáng" : "Chuyển Test sang chế độ tối"}>
              <span className="flex items-center gap-2">{theme === "test" ? <Sun size={15} /> : <Moon size={15} />}Test {theme === "test" ? "sáng" : "tối"}</span>
              <span className="text-[10px] text-slate-400">Đổi</span>
            </button>}
          </div>}
          {menuView === "help" && <div className="px-2 pb-1"><p className="text-sm font-black text-slate-800">Help center</p><p className="mt-2 text-xs leading-5 text-slate-500">Trung tâm trợ giúp StudyHub.</p></div>}
          {menuView === "profile" && <div>
            <p className="truncate px-2 pb-2 text-sm font-black text-slate-800">My Profile</p>
            {user ? <>
              <p className="truncate px-2 pb-2 text-xs font-semibold text-slate-500">{user.email}</p>
              <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(event) => void updateAvatar(event)} />
              <button type="button" disabled={busy} onClick={() => avatarInput.current?.click()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-rose-50 disabled:opacity-50"><Camera size={16} />Đổi ảnh đại diện</button>
              <button type="button" role="switch" aria-checked={sharedDeckNotificationsEnabled} onClick={() => onSharedDeckNotificationsChange(!sharedDeckNotificationsEnabled)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-teal-50">
                {sharedDeckNotificationsEnabled ? <Bell size={16} className="text-teal-600" /> : <BellOff size={16} className="text-slate-400" />}
                <span className="flex-1">Thông báo bộ thẻ</span>
                <span className={`relative h-5 w-9 rounded-full transition ${sharedDeckNotificationsEnabled ? "bg-teal-400" : "bg-slate-200"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${sharedDeckNotificationsEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} /></span>
              </button>
              <button type="button" onClick={() => { setOpen(false); setMenuView("root"); void supabase?.auth.signOut(); onUserChange(null); }} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"><LogOut size={16} />Đăng xuất</button>
            </> : <div className="flex items-center gap-2 px-2 pb-2 text-xs font-semibold text-slate-500"><UserRound size={16} />Chế độ khách</div>}
          </div>}
        </>}
      </div>}
    </div>
  );
}
