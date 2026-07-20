import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, Camera, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { flushSync } from "react-dom";
import { supabase } from "../services/supabase";
import type { User } from "@supabase/supabase-js";

interface Props {
  onUserChange: (user: User | null) => void;
  specialUser?: boolean;
  theme: "color" | "basic" | "test" | "test-light";
  onThemeChange: (theme: "color" | "basic" | "test" | "test-light") => void;
  sharedDeckNotificationsEnabled: boolean;
  onSharedDeckNotificationsChange: (enabled: boolean) => void;
  showMenu?: boolean;
}

async function signInWithGoogle() {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) alert(`${error.message}${error.status ? ` (mã ${error.status})` : ""}`);
}

export default function AuthPanel({ onUserChange, specialUser = false, theme, onThemeChange, sharedDeckNotificationsEnabled, onSharedDeckNotificationsChange, showMenu = true }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const testThemeToggle = useRef<HTMLButtonElement>(null);

  const toggleTestTheme = useCallback(async () => {
    const button = testThemeToggle.current;
    if (!button) return;

    const nextTheme = theme === "test" ? "test-light" : "test";
    const applyTheme = () => {
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem("hocbai-theme", nextTheme);
      flushSync(() => onThemeChange(nextTheme));
    };
    const startViewTransition = (document as Document & {
      startViewTransition?: (update: () => void) => { ready: Promise<void> };
    }).startViewTransition;

    if (!startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyTheme();
      return;
    }

    const { left, top, width, height } = button.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const transition = startViewTransition.call(document, applyTheme);

    await transition.ready;
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      {
        duration: 560,
        easing: "cubic-bezier(.22, 1, .36, 1)",
        pseudoElement: "::view-transition-new(root)",
      } as KeyframeAnimationOptions & { pseudoElement: string },
    );
  }, [onThemeChange, theme]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    void client.auth.getUser().then(({ data }) => {
      setUser(data.user);
      onUserChange(data.user);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);
      onUserChange(nextUser);
    });
    return () => data.subscription.unsubscribe();
  }, [onUserChange]);

  useEffect(() => {
    const handleRequestedGoogleLogin = () => void signInWithGoogle();
    window.addEventListener("hocbai:google-sign-in", handleRequestedGoogleLogin);
    return () => window.removeEventListener("hocbai:google-sign-in", handleRequestedGoogleLogin);
  }, []);

  if (!supabase) {
    return <span className="text-xs font-medium text-slate-400">Chế độ khách</span>;
  }

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
      setUser(data.user);
      onUserChange(data.user);
      setMenuOpen(false);
    } catch (error) {
      alert(`Không thể cập nhật ảnh đại diện: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    const avatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
    return (
      <div className="relative flex items-center gap-3">
        {specialUser && <div className="special-note hidden shrink-0 items-center gap-1 whitespace-nowrap text-center sm:flex" aria-label="Lời nhắn riêng">
          <span className="hydrangea hydrangea-left" aria-hidden="true">✿</span>
          <span>Tú ơii, cố lên.<br />Anh ở bên nèeee</span>
          <span className="hydrangea hydrangea-right" aria-hidden="true">✿</span>
        </div>}
        <button type="button" onClick={showMenu ? () => setMenuOpen((open) => !open) : undefined} aria-label="Ảnh đại diện" className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-teal-100 bg-teal-50 text-teal-700 shadow-sm hover:border-teal-300">
          {avatar ? <img src={avatar} alt="Ảnh đại diện" className="h-full w-full object-cover" /> : <UserRound size={19} />}
        </button>
        {showMenu && menuOpen && <div className="glass-dialog absolute right-0 top-full z-[80] mt-2 w-64 rounded-2xl border border-rose-100 bg-white p-3 shadow-[0_20px_55px_rgba(15,23,42,.2)]">
          <p className="truncate px-2 pb-2 text-xs font-semibold text-slate-500">{user.email}</p>
          <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(event) => void updateAvatar(event)} />
          <button type="button" disabled={busy} onClick={() => avatarInput.current?.click()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-rose-50 disabled:opacity-50"><Camera size={16} /> Đổi ảnh đại diện</button>
          <button type="button" onClick={() => { setMenuOpen(false); void supabase?.auth.signOut(); }} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"><LogOut size={16} /> Đăng xuất</button>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <button type="button" role="switch" aria-checked={sharedDeckNotificationsEnabled} onClick={() => onSharedDeckNotificationsChange(!sharedDeckNotificationsEnabled)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-teal-50">
              {sharedDeckNotificationsEnabled ? <Bell size={16} className="text-teal-600" /> : <BellOff size={16} className="text-slate-400" />}
              <span className="flex-1">Thông báo bộ thẻ</span>
              <span className={`relative h-5 w-9 rounded-full transition ${sharedDeckNotificationsEnabled ? "bg-teal-400" : "bg-slate-200"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${sharedDeckNotificationsEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} /></span>
            </button>
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Giao diện</p>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-50 p-1">
              <button type="button" onClick={() => onThemeChange("color")} className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${theme === "color" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"}`}>Color</button>
              <button type="button" onClick={() => onThemeChange("basic")} className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${theme === "basic" ? "bg-slate-700 text-white shadow-sm" : "text-slate-500"}`}>Basic</button>
              <button type="button" onClick={() => onThemeChange("test")} className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${theme === "test" ? "bg-slate-900 text-cyan-200 shadow-sm" : theme === "test-light" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Test</button>
            </div>
            {(theme === "test" || theme === "test-light") && <button ref={testThemeToggle} type="button" onClick={() => void toggleTestTheme()} className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200/70 px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50" aria-label={theme === "test" ? "Chuyển Test sang chế độ sáng" : "Chuyển Test sang chế độ tối"}>
              <span className="flex items-center gap-2">{theme === "test" ? <Sun size={15} /> : <Moon size={15} />} Test {theme === "test" ? "sáng" : "tối"}</span>
              <span className="text-[10px] text-slate-400">Đổi</span>
            </button>}
          </div>
        </div>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => void signInWithGoogle()} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
        <span className="font-bold text-blue-600">G</span>
        Google
      </button>
    </div>
  );
}
