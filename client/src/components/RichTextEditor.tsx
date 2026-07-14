import { AlignCenter, AlignLeft, AlignRight, Bold, Highlighter, Image as ImageIcon, Italic, List, ListOrdered, Palette, TextCursorInput, Underline } from "lucide-react";
import { useEffect, useRef } from "react";
import { sanitizeHtml, toEditorHtml } from "../utils/richText";

interface Props { value: string; onChange: (value: string) => void; placeholder: string; onClozeCreated?: (text: string) => void; }

const commands = [
  ["bold", Bold, "Đậm"], ["italic", Italic, "Nghiêng"], ["underline", Underline, "Gạch chân"],
  ["insertUnorderedList", List, "Gạch đầu dòng"], ["insertOrderedList", ListOrdered, "Đánh số"],
  ["justifyLeft", AlignLeft, "Căn trái"], ["justifyCenter", AlignCenter, "Căn giữa"], ["justifyRight", AlignRight, "Căn phải"],
] as const;

export default function RichTextEditor({ value, onChange, placeholder, onClozeCreated }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const lastEmittedValueRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
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
  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const image = Array.from(event.clipboardData.items)
      .find((item) => item.kind === "file" && item.type.startsWith("image/"))
      ?.getAsFile();
    if (!image) return;
    event.preventDefault();
    insertImage(image);
  }
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
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
  return <div className="overflow-hidden rounded-lg border border-rose-100 bg-white focus-within:border-rose-300">
    <div className="flex flex-wrap gap-1 border-b border-rose-50 bg-rose-50/50 p-2">
      {commands.map(([name, Icon, label]) => <button key={name} type="button" title={label} onMouseDown={(event) => { event.preventDefault(); command(name); }} className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><Icon size={16} /></button>)}
      <label title="Màu chữ" className="relative cursor-pointer rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><Palette size={16} /><input type="color" defaultValue="#4b1630" aria-label="Màu chữ" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onMouseDown={(event) => event.preventDefault()} onChange={(event) => applyColor("foreColor", event.target.value)} /></label>
      <label title="Tô sáng" className="relative cursor-pointer rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><Highlighter size={16} /><input type="color" defaultValue="#fff3a3" aria-label="Tô sáng" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onMouseDown={(event) => event.preventDefault()} onChange={(event) => applyColor("hiliteColor", event.target.value)} /></label>
      <button type="button" title="Điền khuyết" aria-label="Điền khuyết" onMouseDown={(event) => { event.preventDefault(); insertCloze(); }} className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><TextCursorInput size={16} /></button>
      <button type="button" title="Chèn hình ảnh" aria-label="Chèn hình ảnh" onMouseDown={(event) => { event.preventDefault(); imageInputRef.current?.click(); }} className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><ImageIcon size={16} /></button>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) insertImage(file); event.target.value = ""; }} />
    </div>
    <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label={placeholder} data-placeholder={placeholder} onBlur={(event) => { emitChange(event.currentTarget.innerHTML); }} onSelect={rememberSelection} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onKeyDown={handleKeyDown} onPaste={handlePaste} onInput={() => { rememberSelection(); }} className="rich-editor min-h-24 px-3 py-3 text-sm outline-none" />
  </div>;
}
