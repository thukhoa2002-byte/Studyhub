import { LockKeyhole } from "lucide-react";
import { Card } from "./UiPrimitives";

export const AUTH_RETURN_PATH_KEY = "studyhub:auth-return-path";

export function requestGoogleLogin(path = typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}${window.location.hash}`) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(AUTH_RETURN_PATH_KEY, path);
  window.dispatchEvent(new Event("hocbai:google-sign-in"));
}

export default function ProtectedContentGate({ compact = false }: { compact?: boolean }) {
  return <section className={`mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 ${compact ? "py-6" : ""}`} aria-labelledby="protected-content-title">
    <Card className="p-7 text-center sm:p-9">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-subtle)] text-[var(--primary)]"><LockKeyhole size={22} /></span>
      <h1 id="protected-content-title" className="mt-4 text-xl font-extrabold text-[var(--text-primary)]">Nội dung cần đăng nhập</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Đăng nhập bằng Google để tiếp tục xem nội dung StudyHub.</p>
      <button type="button" onClick={() => requestGoogleLogin()} className="ui-button-primary mt-5 inline-flex items-center gap-2">Đăng nhập bằng Google</button>
    </Card>
  </section>;
}
