import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AnimatedDropdownOption = { value: string; label: string };

interface Props {
  value: string;
  options: AnimatedDropdownOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  name?: string;
  disabled?: boolean;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
}

export default function AnimatedDropdown({ value, options, onChange, ariaLabel = "Chọn một mục", name, disabled = false, triggerClassName = "", menuClassName = "", optionClassName = "" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div ref={rootRef} className="relative min-w-0">
    {name && <input type="hidden" name={name} value={value} />}
    <button
      type="button"
      disabled={disabled || options.length === 0}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
      className={`animated-dropdown__trigger flex min-w-0 items-center justify-between gap-2 outline-none disabled:cursor-not-allowed disabled:opacity-50 ${triggerClassName}`}
    >
      <span className="min-w-0 truncate">{selected?.label || "Chọn một mục"}</span>
      {open ? <ChevronRight size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
    </button>
    {open && <div className={`animated-dropdown__menu absolute left-0 top-full z-[80] mt-2 max-h-72 min-w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_35px_rgba(15,23,42,.18)] ${menuClassName}`} role="listbox" aria-label={ariaLabel}>
      {options.map((option) => <button
        key={option.value}
        type="button"
        role="option"
        aria-selected={option.value === value}
        onClick={() => { onChange(option.value); setOpen(false); }}
        className={`animated-dropdown__option flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${option.value === value ? "animated-dropdown__option--selected" : "text-slate-600 hover:bg-teal-50 hover:text-teal-800"} ${optionClassName}`}
      ><span className="min-w-0 truncate">{option.label}</span>{option.value === value && <Check size={16} className="shrink-0" />}</button>)}
    </div>}
  </div>;
}
