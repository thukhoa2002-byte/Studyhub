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
  useEffect(() => { if (editorRef.current && editorRef.current.innerHTML !== toEditorHtml(value)) editorRef.current.innerHTML = toEditorHtml(value); }, [value]);
  function command(name: string) { editorRef.current?.focus(); document.execCommand(name); if (editorRef.current) onChange(sanitizeHtml(editorRef.current.innerHTML)); }
  return <div className="overflow-hidden rounded-lg border border-rose-100 bg-white focus-within:border-rose-300">
    <div className="flex flex-wrap gap-1 border-b border-rose-50 bg-rose-50/50 p-2">
      {commands.map(([name, Icon, label]) => <button key={name} type="button" title={label} onMouseDown={(event) => event.preventDefault()} onClick={() => command(name)} className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-rose-600"><Icon size={16} /></button>)}
    </div>
    <div ref={editorRef} contentEditable role="textbox" aria-label={placeholder} data-placeholder={placeholder} onInput={(event) => onChange(sanitizeHtml(event.currentTarget.innerHTML))} className="rich-editor min-h-24 px-3 py-3 text-sm outline-none" />
  </div>;
}
