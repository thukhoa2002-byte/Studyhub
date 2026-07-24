import { AlertTriangle, X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, description, confirmLabel = "Xóa", cancelLabel = "Hủy", tone = "danger", onConfirm, onCancel }: Props) {
  if (!open) return null;
  const danger = tone === "danger";
  return <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/30 px-4 py-6 backdrop-blur-[3px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <div className="glass-dialog w-full max-w-md rounded-3xl border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_rgba(15,23,42,.2)]" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
      <div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${danger ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-700"}`}><AlertTriangle size={20} /></span><div className="min-w-0 flex-1"><h2 id="confirm-dialog-title" className="text-lg font-extrabold text-slate-800">{title}</h2><p id="confirm-dialog-description" className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div><button type="button" onClick={onCancel} aria-label="Đóng" title="Đóng" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button></div>
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">{cancelLabel}</button><button type="button" autoFocus onClick={onConfirm} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"}`}>{confirmLabel}</button></div>
    </div>
  </div>;
}
