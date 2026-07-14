import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Underline } from "lucide-react";
import { useEffect, useRef } from "react";
import { sanitizeHtml, toEditorHtml } from "../utils/richText";

interface Props { value: string; onChange: (value: string) => void; placeholder: string; }

const commands = [
  ["bold", Bold, "Đậm"], ["italic", Italic, "Nghiêng"], ["underline", Underline, "Gạch chân"],
  ["insertUnorderedList", List, "Gạch đầu dòng"], ["insertOrderedList", ListOrdered, "Đánh số"],
  ["justifyLeft", AlignLeft, "Căn trái"], ["justifyCenter", AlignCenter, "Căn giữa"], ["justifyRight", AlignRight, "Căn phải"],
] as const;

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  useEffect(() => { if (editorRef.current && editorRef.current.innerHTML !== toEditorHtml(value)) editorRef.current.innerHTML = toEditorHtml(value); }, [value]);
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
    if (editorRef.current) onChange(sanitizeHtml(editorRef.current.innerHTML));
  }
  return <div className="overflow-hidden rounded-lg border border-rose-100 bg-white focus-within:border-rose-300">
    <div className="flex flex-wrap gap-1 border-b border-rose-50 bg-rose-50/50 p-2">
      {commands.map(([name, Icon, label]) => <button key={name} type="button" title={label} onMouseDown={(event) => { event.preventDefault(); command(name); }} className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><Icon size={16} /></button>)}
    </div>
    <div ref={editorRef} contentEditable role="textbox" aria-label={placeholder} data-placeholder={placeholder} onSelect={rememberSelection} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onInput={(event) => { rememberSelection(); onChange(sanitizeHtml(event.currentTarget.innerHTML)); }} className="rich-editor min-h-24 px-3 py-3 text-sm outline-none" />
  </div>;
}
