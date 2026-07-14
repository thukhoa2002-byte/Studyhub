import { useEffect, useState } from "react";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { supabase } from "../services/supabase";
import type { User } from "@supabase/supabase-js";

interface Props {
  onUserChange: (user: User | null) => void;
}

export default function AuthPanel({ onUserChange }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

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
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    alert(error ? error.message : "Đã gửi link đăng nhập vào email của bạn.");
  }

  if (user) {
    return (
      <button
        onClick={() => void supabase?.auth.signOut()}
        className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
      >
        <UserRound size={14} />
        {user.email}
        <LogOut size={14} />
      </button>
    );
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void signIn(); }} className="flex items-center gap-2">
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        type="email"
        placeholder="Email để lưu bộ thẻ"
        className="hidden w-44 rounded-full border border-rose-100 bg-white px-3 py-1.5 text-xs outline-none focus:border-rose-300 sm:block"
      />
      <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200 disabled:opacity-50">
        <LogIn size={14} />
        {busy ? "Đang gửi..." : "Đăng nhập"}
      </button>
    </form>
  );
}
