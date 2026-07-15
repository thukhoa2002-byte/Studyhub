import { AlignCenter, AlignLeft, AlignRight, Bold, CaseUpper, ChevronDown, ClipboardPaste, Image as ImageIcon, Italic, List, ListOrdered, PenLine, TextCursorInput, Underline } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sanitizeHtml, toEditorHtml } from "../utils/richText";

interface Props { value: string; onChange: (value: string) => void; placeholder: string; onClozeCreated?: (text: string) => void; capitalizeFirst?: boolean; }

const commands = [
  ["bold", Bold, "Đậm"], ["italic", Italic, "Nghiêng"], ["underline", Underline, "Gạch chân"],
  ["insertUnorderedList", List, "Gạch đầu dòng"], ["insertOrderedList", ListOrdered, "Đánh số"],
  ["justifyLeft", AlignLeft, "Căn trái"], ["justifyCenter", AlignCenter, "Căn giữa"], ["justifyRight", AlignRight, "Căn phải"],
] as const;

const paletteColors = [
  "#ff0000", "#ff6600", "#ffc000", "#ffff00", "#00b050", "#00ffff", "#0070c0", "#0000ff", "#7030a0", "#808080",
  "#c00000", "#e65c00", "#bf9000", "#7f7f00", "#008000", "#008080", "#005b96", "#000080", "#4b0082", "#404040",
  "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#cfe2f3", "#d9d2e9", "#ead1dc", "#eeeeee", "#ffffff",
  "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#9fc5e8", "#b4a7d6", "#d5a6bd", "#cccccc", "#000000",
] as const;

export default function RichTextEditor({ value, onChange, placeholder, onClozeCreated, capitalizeFirst = false }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const lastEmittedValueRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const [showHighlightPalette, setShowHighlightPalette] = useState(false);
  const [showTextPalette, setShowTextPalette] = useState(false);
  useEffect(() => {
    const closeOtherPalettes = () => {
      setShowHighlightPalette(false);
      setShowTextPalette(false);
    };
    window.addEventListener("rich-editor-close-palettes", closeOtherPalettes);
    return () => window.removeEventListener("rich-editor-close-palettes", closeOtherPalettes);
  }, []);
  useEffect(() => {
    // Initialize the uncontrolled contenteditable exactly once. React must
    // never rewrite innerHTML while the user types: mobile browsers then move
    // the caret and may duplicate the previous character.
    if (!editorRef.current || initializedRef.current) return;
    const nextHtml = value ? toEditorHtml(value) : "<div><br></div>";
    if (editorRef.current.innerHTML !== nextHtml) editorRef.current.innerHTML = nextHtml;
    lastEmittedValueRef.current = value;
    initializedRef.current = true;
  }, []);
  useEffect(() => {
    // Accept changes produced outside this editor (for example, the Front
    // cloze action writing its selected answer into Back). Never rewrite the
    // focused editor: doing that while someone types moves the caret and can
    // duplicate characters.
    if (!initializedRef.current || !editorRef.current) return;
    if (value === lastEmittedValueRef.current) return;
    if (document.activeElement === editorRef.current) return;
    const nextHtml = value ? toEditorHtml(value) : "<div><br></div>";
    if (editorRef.current.innerHTML !== nextHtml) editorRef.current.innerHTML = nextHtml;
    lastEmittedValueRef.current = value;
  }, [value]);
  function emitChange(html: string) {
    // Keep typed spaces as normal spaces in the persisted HTML. Browsers often
    // serialize the trailing space in a contenteditable as `&nbsp;`, which
    // would otherwise come back as visible literal text after re-rendering.
    const nextValue = sanitizeHtml(html).replace(/&nbsp;/gi, " ");
    lastEmittedValueRef.current = nextValue;
    onChange(nextValue);
  }
  function rememberSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current?.contains(selection.anchorNode)) return;
    selectionRef.current = selection.getRangeAt(0).cloneRange();
  }
  function command(name: string) {
    editorRef.current?.focus();
    if (selectionRef.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectionRef.current);
    }
    const before = editorRef.current?.innerHTML ?? "";
    document.execCommand(name, false);
    if (name === "insertUnorderedList" && editorRef.current && !editorRef.current.innerHTML.includes("<ul")) {
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : selectionRef.current;
      const text = range?.toString() ?? "";
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (range && lines.length > 0) {
        const list = document.createElement("ul");
        lines.forEach((line) => { const item = document.createElement("li"); item.textContent = line; list.appendChild(item); });
        range.deleteContents();
        range.insertNode(list);
      } else if (editorRef.current.innerHTML === before) {
        editorRef.current.innerHTML = `${editorRef.current.innerHTML}<ul><li><br></li></ul>`;
      }
    }
    rememberSelection();
    if (editorRef.current) emitChange(editorRef.current.innerHTML);
  }
  function insertImage(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src || !editorRef.current) return;
      editorRef.current.focus();
      const selection = window.getSelection();
      selection?.removeAllRanges();
      if (selectionRef.current) selection?.addRange(selectionRef.current);
      document.execCommand("insertHTML", false, `<img src="${src}" alt="Ảnh thẻ" />`);
      rememberSelection();
      emitChange(editorRef.current.innerHTML);
    };
    reader.readAsDataURL(file);
  }
  async function pasteImageFromClipboard() {
    if (!navigator.clipboard?.read) {
      imageInputRef.current?.click();
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        insertImage(new File([blob], "clipboard-image.png", { type: imageType }));
        return;
      }
      imageInputRef.current?.click();
    } catch {
      // Clipboard access may be denied outside a secure/user gesture context.
      imageInputRef.current?.click();
    }
  }
  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const image = Array.from(event.clipboardData.items)
      .find((item) => item.kind === "file" && item.type.startsWith("image/"))
      ?.getAsFile();
    if (!image) return;
    event.preventDefault();
    insertImage(image);
  }
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (capitalizeFirst && !(event.metaKey || event.ctrlKey || event.altKey) && event.key.length === 1 && /\p{L}/u.test(event.key) && !editorRef.current?.textContent?.trim()) {
      event.preventDefault();
      document.execCommand("insertText", false, event.key.toLocaleUpperCase("vi-VN"));
      rememberSelection();
      return;
    }
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const shortcut = event.key.toLowerCase();
    const commandName = shortcut === "b" ? "bold" : shortcut === "i" ? "italic" : shortcut === "u" ? "underline" : null;
    if (!commandName) return;
    event.preventDefault();
    rememberSelection();
    command(commandName);
  }
  function applyColor(commandName: "foreColor" | "hiliteColor", color: string) {
    editorRef.current?.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    if (selectionRef.current) selection?.addRange(selectionRef.current);
    const before = editorRef.current?.innerHTML ?? "";
    document.execCommand(commandName, false, color);
    // Chromium uses `hiliteColor`; a few browsers only implement `backColor`.
    if (commandName === "hiliteColor" && editorRef.current?.innerHTML === before) {
      document.execCommand("backColor", false, color);
    }
    rememberSelection();
    if (editorRef.current) emitChange(editorRef.current.innerHTML);
  }
  function insertCloze() {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    if (selectionRef.current) selection?.addRange(selectionRef.current);
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const text = range?.toString().trim();
    if (!range || !text) return;
    range.deleteContents();
    range.insertNode(document.createTextNode(`{{c1::${text}}}`));
    rememberSelection();
    emitChange(editorRef.current.innerHTML);
    onClozeCreated?.(text);
  }
  function togglePalette(palette: "highlight" | "text") {
    const shouldOpen = palette === "highlight" ? !showHighlightPalette : !showTextPalette;
    window.dispatchEvent(new Event("rich-editor-close-palettes"));
    if (palette === "highlight") setShowHighlightPalette(shouldOpen);
    else setShowTextPalette(shouldOpen);
  }
  return <div className="overflow-visible rounded-lg border border-rose-100 bg-white focus-within:border-rose-300">
    <div className="flex flex-wrap gap-1 border-b border-rose-50 bg-rose-50/50 p-2">
      {commands.map(([name, Icon, label]) => <button key={name} type="button" title={label} onMouseDown={(event) => { event.preventDefault(); command(name); }} className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><Icon size={16} /></button>)}
      <div className="relative">
        <button type="button" title="Tô sáng" aria-label="Mở bảng màu highlight" onMouseDown={(event) => event.preventDefault()} onClick={() => togglePalette("highlight")} className="relative inline-flex items-center gap-0.5 rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><PenLine size={16} /><span className="pointer-events-none absolute bottom-1 left-1.5 right-3 h-0.5 rounded-full bg-yellow-400" /><ChevronDown size={10} className="pointer-events-none" /></button>
        {showHighlightPalette && <div className="absolute left-0 top-full z-[100] mt-1 w-56 rounded-lg border border-slate-300 bg-white p-2 shadow-xl" onMouseDown={(event) => event.preventDefault()}>
          <button type="button" onClick={() => { applyColor("hiliteColor", "transparent"); setShowHighlightPalette(false); }} className="mb-2 flex h-7 w-full items-center justify-center rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-100">Không màu</button>
          <div className="grid grid-cols-10 gap-1">
            {paletteColors.map((color) => <button key={color} type="button" aria-label={`Highlight ${color}`} title={color} onClick={() => { applyColor("hiliteColor", color); setShowHighlightPalette(false); }} className="h-4 w-4 rounded-sm border border-slate-300 shadow-sm hover:scale-125" style={{ backgroundColor: color }} />)}
          </div>
        </div>}
      </div>
      <div className="relative">
        <button type="button" title="Màu chữ" aria-label="Mở bảng màu chữ" onMouseDown={(event) => event.preventDefault()} onClick={() => togglePalette("text")} className="relative inline-flex items-center gap-0.5 rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><CaseUpper size={16} /><span className="pointer-events-none absolute bottom-1 left-1.5 right-3 h-0.5 rounded-full bg-red-500" /><ChevronDown size={10} className="pointer-events-none" /></button>
        {showTextPalette && <div className="absolute left-0 top-full z-[100] mt-1 w-56 rounded-lg border border-slate-300 bg-white p-2 shadow-xl" onMouseDown={(event) => event.preventDefault()}>
          <button type="button" onClick={() => { applyColor("foreColor", "inherit"); setShowTextPalette(false); }} className="mb-2 flex h-7 w-full items-center justify-center rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-100">Màu mặc định</button>
          <div className="grid grid-cols-10 gap-1">
            {paletteColors.map((color) => <button key={color} type="button" aria-label={`Màu chữ ${color}`} title={color} onClick={() => { applyColor("foreColor", color); setShowTextPalette(false); }} className="h-4 w-4 rounded-sm border border-slate-300 shadow-sm hover:scale-125" style={{ backgroundColor: color }} />)}
          </div>
        </div>}
      </div>
      <button type="button" title="Điền khuyết" aria-label="Điền khuyết" onMouseDown={(event) => { event.preventDefault(); insertCloze(); }} className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><TextCursorInput size={16} /></button>
      <button type="button" title="Chèn hình ảnh" aria-label="Chèn hình ảnh" onMouseDown={(event) => { event.preventDefault(); imageInputRef.current?.click(); }} className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><ImageIcon size={16} /></button>
      <button type="button" title="Dán ảnh từ clipboard" aria-label="Dán ảnh từ clipboard" onMouseDown={(event) => event.preventDefault()} onClick={pasteImageFromClipboard} className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><ClipboardPaste size={16} /></button>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) insertImage(file); event.target.value = ""; }} />
    </div>
    <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label={placeholder} data-placeholder={placeholder} onBlur={(event) => { emitChange(event.currentTarget.innerHTML); }} onSelect={rememberSelection} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onKeyDown={handleKeyDown} onPaste={handlePaste} onInput={() => { rememberSelection(); }} className="rich-editor min-h-24 px-3 py-3 text-sm outline-none" />
  </div>;
}
