import { Share2, X } from "lucide-react";
import { useState } from "react";

interface Props { title: string; onClose: () => void; onShare: (emails: string[]) => void | Promise<void>; }

export default function ShareDeckDialog({ title, onClose, onShare }: Props) {
  const [emails, setEmails] = useState("");
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/35 px-4"><div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-6 shadow-xl">
    <div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-rose-500">Chia sẻ bộ thẻ</p><h2 className="mt-1 text-xl font-bold text-rose-950">{title}</h2></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50"><X size={18} /></button></div>
    <p className="mt-4 text-sm text-slate-500">Nhập email, ngăn cách bằng dấu phẩy.</p><input autoFocus value={emails} onChange={(event) => setEmails(event.target.value)} placeholder="ban@gmail.com" className="mt-3 w-full rounded-lg border border-rose-100 px-3 py-3 text-sm outline-none focus:border-rose-300" />
    <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500">Hủy</button><button disabled={!emails.trim()} onClick={() => void onShare(emails.split(",").map((email) => email.trim()).filter(Boolean))} className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Share2 size={16} /> Chia sẻ</button></div>
  </div></div>;
}
