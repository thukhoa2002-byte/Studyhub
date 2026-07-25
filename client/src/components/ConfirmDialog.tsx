import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef } from "react";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const trapDialogFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCancel(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []);
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", trapDialogFocus);
    window.requestAnimationFrame(() => confirmRef.current?.focus());
    return () => {
      window.removeEventListener("keydown", trapDialogFocus);
      window.requestAnimationFrame(() => restoreFocusRef.current?.focus());
    };
  }, [onCancel, open]);
  if (!open) return null;
  const danger = tone === "danger";
  return <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--overlay)] px-4 py-6 backdrop-blur-[3px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <div ref={dialogRef} className="glass-dialog w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
      <div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${danger ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-700"}`}><AlertTriangle size={20} /></span><div className="min-w-0 flex-1"><h2 id="confirm-dialog-title" className="text-lg font-extrabold text-slate-800">{title}</h2><p id="confirm-dialog-description" className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div><button type="button" onClick={onCancel} aria-label="Đóng" title="Đóng" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button></div>
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onCancel} className="ui-button-secondary">{cancelLabel}</button><button ref={confirmRef} type="button" onClick={onConfirm} className={danger ? "ui-button-danger" : "ui-button-warning"}>{confirmLabel}</button></div>
    </div>
  </div>;
}
