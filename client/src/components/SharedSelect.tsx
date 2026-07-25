import { Check, ChevronDown, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";

export type SharedSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type MenuPosition = { left: number; top: number; width: number; maxHeight: number; placement: "top" | "bottom" };

interface SharedSelectProps {
  value: string;
  options: SharedSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  loading?: boolean;
  invalid?: boolean;
  searchable?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  allowClear?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const VIEWPORT_GUTTER = 12;
const TRIGGER_GAP = 8;
const MENU_MAX_HEIGHT = 320;

function positionMenu(trigger: HTMLElement, menu: HTMLElement | null): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const preferredHeight = Math.min(menu?.scrollHeight || MENU_MAX_HEIGHT, MENU_MAX_HEIGHT);
  const below = viewportHeight - rect.bottom - VIEWPORT_GUTTER;
  const above = rect.top - VIEWPORT_GUTTER;
  const placement = below < Math.min(180, preferredHeight) && above > below ? "top" : "bottom";
  const availableHeight = Math.max(120, placement === "bottom" ? below - TRIGGER_GAP : above - TRIGGER_GAP);
  const maxWidth = Math.max(160, viewportWidth - VIEWPORT_GUTTER * 2);
  const naturalWidth = menu?.scrollWidth || rect.width;
  const width = Math.min(maxWidth, Math.max(rect.width, naturalWidth));
  const left = Math.min(Math.max(VIEWPORT_GUTTER, rect.left), viewportWidth - width - VIEWPORT_GUTTER);
  const top = placement === "bottom"
    ? rect.bottom + TRIGGER_GAP
    : Math.max(VIEWPORT_GUTTER, rect.top - TRIGGER_GAP - Math.min(preferredHeight, availableHeight));
  return { left, top, width, maxHeight: Math.min(MENU_MAX_HEIGHT, availableHeight), placement };
}

export default function SharedSelect({
  value,
  options,
  onValueChange,
  placeholder = "Chọn một mục",
  ariaLabel,
  id,
  name,
  disabled = false,
  loading = false,
  invalid = false,
  searchable = false,
  emptyMessage = "Không có lựa chọn phù hợp.",
  searchPlaceholder = "Tìm lựa chọn...",
  className = "",
  triggerClassName = "",
  menuClassName = "",
  optionClassName = "",
  allowClear = false,
  onOpenChange,
}: SharedSelectProps) {
  const instanceId = useId();
  const menuId = `studyhub-select-${instanceId.replace(/:/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const selected = options.find((option) => option.value === value);
  const isMissingValue = Boolean(value && !selected);
  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    if (!normalized) return options;
    return options.filter((option) => `${option.label} ${option.description || ""}`.toLocaleLowerCase("vi").includes(normalized));
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    onOpenChange?.(false);
  }, [onOpenChange]);

  function openMenu() {
    if (disabled || loading) return;
    window.dispatchEvent(new CustomEvent("studyhub:close-shared-select", { detail: menuId }));
    setOpen(true);
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value && !option.disabled)));
    onOpenChange?.(true);
  }

  function choose(nextValue: string) {
    onValueChange(nextValue);
    close();
    triggerRef.current?.focus();
  }

  useEffect(() => {
    const closeOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== menuId) close();
    };
    window.addEventListener("studyhub:close-shared-select", closeOther);
    return () => window.removeEventListener("studyhub:close-shared-select", closeOther);
  }, [close, menuId]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => setMenuPosition(positionMenu(triggerRef.current!, menuRef.current));
    update();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, visibleOptions.length, query]);

  useEffect(() => {
    if (!open) return;
    if (searchable) window.requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, searchable]);

  function moveActive(direction: 1 | -1) {
    if (!visibleOptions.length) return;
    let next = activeIndex;
    for (let attempts = 0; attempts < visibleOptions.length; attempts += 1) {
      next = (next + direction + visibleOptions.length) % visibleOptions.length;
      if (!visibleOptions[next].disabled) {
        setActiveIndex(next);
        optionRefs.current[next]?.focus();
        return;
      }
    }
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!open) openMenu();
      if (event.key === "ArrowDown" && open) moveActive(1);
      if (event.key === "ArrowUp" && open) moveActive(-1);
    }
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      const first = visibleOptions.findIndex((option) => !option.disabled);
      setActiveIndex(first);
      optionRefs.current[first]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      const last = visibleOptions.map((option) => !option.disabled).lastIndexOf(true);
      setActiveIndex(last);
      optionRefs.current[last]?.focus();
    } else if (event.key === "Enter" && activeIndex >= 0 && visibleOptions[activeIndex] && !visibleOptions[activeIndex].disabled) {
      event.preventDefault();
      choose(visibleOptions[activeIndex].value);
    }
  }

  const selectedLabel = selected?.label || (isMissingValue ? "Giá trị đã lưu không còn khả dụng" : placeholder);
  const disabledTrigger = disabled || loading;

  return <div ref={rootRef} className={`shared-select relative min-w-0 ${className}`}>
    {name && <input type="hidden" name={name} value={value} />}
    <button
      ref={triggerRef}
      id={id}
      type="button"
      disabled={disabledTrigger}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onClick={() => open ? close() : openMenu()}
      onKeyDown={onTriggerKeyDown}
      className={`shared-select__trigger ${invalid ? "shared-select__trigger--invalid" : ""} ${open ? "shared-select__trigger--open" : ""} ${triggerClassName}`}
    >
      <span className={`min-w-0 truncate ${isMissingValue ? "text-amber-700" : ""}`}>{loading ? "Đang tải..." : selectedLabel}</span>
      <ChevronDown size={17} aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && typeof document !== "undefined" && createPortal(
      <div
        ref={menuRef}
        id={menuId}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={activeIndex >= 0 ? `${menuId}-option-${activeIndex}` : undefined}
        onKeyDown={onMenuKeyDown}
        className={`shared-select__menu ${menuPosition?.placement === "top" ? "shared-select__menu--top" : ""} ${menuClassName}`}
        style={menuPosition ? { left: menuPosition.left, top: menuPosition.top, width: menuPosition.width, maxHeight: menuPosition.maxHeight } : { visibility: "hidden" }}
      >
        {searchable && <label className="shared-select__search"><Search size={16} /><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} placeholder={searchPlaceholder} aria-label={`Tìm trong ${ariaLabel}`} /></label>}
        {isMissingValue && <div className="shared-select__missing" role="status">Giá trị đã lưu không còn hợp lệ: {value}</div>}
        <div className="shared-select__options">
          {visibleOptions.length === 0 ? <p className="shared-select__empty">{emptyMessage}</p> : visibleOptions.map((option, index) => <button
            key={option.value}
            ref={(node) => { optionRefs.current[index] = node; }}
            id={`${menuId}-option-${index}`}
            type="button"
            role="option"
            aria-selected={option.value === value}
            disabled={option.disabled}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(option.value)}
            className={`shared-select__option ${option.value === value ? "shared-select__option--selected" : ""} ${optionClassName}`}
          >
            <span className="min-w-0"><span className="block break-words">{option.label}</span>{option.description && <span className="mt-0.5 block text-xs font-semibold text-slate-500">{option.description}</span>}</span>
            {option.value === value && <Check size={16} className="shrink-0" aria-hidden="true" />}
          </button>)}
        </div>
        {allowClear && value && <button type="button" onClick={() => choose("")} className="shared-select__clear"><X size={15} />Bỏ chọn</button>}
      </div>,
      document.body,
    )}
  </div>;
}
