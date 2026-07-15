import { useEffect, useRef, useState } from "react";
import { Camera, LogIn, LogOut, UserRound } from "lucide-react";
import { supabase } from "../services/supabase";
import type { User } from "@supabase/supabase-js";

interface Props {
  onUserChange: (user: User | null) => void;
  specialUser?: boolean;
  theme: "color" | "basic";
  onThemeChange: (theme: "color" | "basic") => void;
}

export default function AuthPanel({ onUserChange, specialUser = false, theme, onThemeChange }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

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

  if (!supabase) {
    return <span className="text-xs font-medium text-slate-400">Chế độ khách</span>;
  }

  async function signIn() {
    if (!email.trim()) return;
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        alert(`${error.message}${error.status ? ` (mã ${error.status})` : ""}`);
      } else {
        alert("Đã gửi link đăng nhập vào email của bạn.");
      }
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      alert(`Không kết nối được Supabase: ${detail}`);
      console.error("Supabase sign-in failed", error);
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) alert(`${error.message}${error.status ? ` (mã ${error.status})` : ""}`);
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
        <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Mở tài khoản" className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-teal-100 bg-teal-50 text-teal-700 shadow-sm hover:border-teal-300">
          {avatar ? <img src={avatar} alt="Ảnh đại diện" className="h-full w-full object-cover" /> : <UserRound size={19} />}
        </button>
        {menuOpen && <div className="absolute right-0 top-full z-[80] mt-2 w-64 rounded-2xl border border-rose-100 bg-white p-3 shadow-[0_20px_55px_rgba(15,23,42,.2)]">
          <p className="truncate px-2 pb-2 text-xs font-semibold text-slate-500">{user.email}</p>
          <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(event) => void updateAvatar(event)} />
          <button type="button" disabled={busy} onClick={() => avatarInput.current?.click()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-rose-50 disabled:opacity-50"><Camera size={16} /> Đổi ảnh đại diện</button>
          <button type="button" onClick={() => { setMenuOpen(false); void supabase?.auth.signOut(); }} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"><LogOut size={16} /> Đăng xuất</button>
          <div className="mt-2 border-t border-slate-100 pt-2"><p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Background</p><div className="flex gap-1 rounded-xl bg-slate-50 p-1"><button type="button" onClick={() => onThemeChange("color")} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${theme === "color" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"}`}>Color</button><button type="button" onClick={() => onThemeChange("basic")} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${theme === "basic" ? "bg-slate-700 text-white shadow-sm" : "text-slate-500"}`}>Basic</button></div></div>
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
      <form onSubmit={(event) => { event.preventDefault(); void signIn(); }} className="flex items-center gap-2">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="Email"
          className="hidden w-36 rounded-full border border-rose-100 bg-white px-3 py-1.5 text-xs outline-none focus:border-rose-300 sm:block"
        />
        <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200 disabled:opacity-50">
          <LogIn size={14} />
          {busy ? "Đang gửi..." : "Email"}
        </button>
      </form>
    </div>
  );
}
