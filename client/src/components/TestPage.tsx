import { Check, Code2, Copy, Home, MessageCircle, MoreHorizontal, Phone, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

const codeSample = `<nav class="liquid-nav">
  <button class="active"><i class="home"></i>Home</button>
  <button><i class="phone"></i>Call</button>
  <button><i class="message"></i>Chat</button>
  <button><i class="more"></i>More</button>
</nav>`;

const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "call", label: "Call", icon: Phone },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "more", label: "More", icon: MoreHorizontal },
] as const;

export default function TestPage() {
  const [active, setActive] = useState("home");
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(codeSample);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return <main className="mode-panel min-h-[calc(100vh-5rem)] bg-[#090a10] px-4 py-6 text-white sm:px-8 sm:py-10" aria-labelledby="test-page-title">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-cyan-300"><Sparkles size={14} />Giao diện thử nghiệm</p><h1 id="test-page-title" className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Liquid Glass Navbar</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Khu vực thử riêng để kiểm tra giao diện mới trước khi đưa vào các tab chính.</p></div>
        <span className="w-fit rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-300">Đang thử nghiệm</span>
      </header>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11131c] shadow-2xl shadow-black/30" aria-label="Xem trước navbar">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs font-bold text-slate-400"><span>Preview</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" />Interactive</span></div>
          <div className="relative flex min-h-[30rem] items-end justify-center overflow-hidden px-5 pb-10 pt-8 sm:min-h-[34rem]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(244,114,182,.22),transparent_38%,rgba(56,189,248,.18)),linear-gradient(25deg,transparent_42%,rgba(250,204,21,.12),transparent_68%)]" />
            <div className="pointer-events-none absolute inset-x-10 top-14 h-px bg-white/10" />
            <div className="relative w-full max-w-xl rounded-[2rem] border border-white/20 bg-white/10 p-3 shadow-2xl shadow-cyan-950/30 backdrop-blur-2xl">
              <div className="flex items-center justify-between px-3 pb-3 text-xs text-slate-400"><span>10:32</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400" />Glass surface</span></div>
              <nav className="grid grid-cols-4 gap-1 rounded-full border border-white/20 bg-white/15 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.3)]" aria-label="Navbar thử nghiệm">
                {navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setActive(id)} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-bold transition sm:px-4 ${active === id ? "bg-white/80 text-slate-900 shadow-lg shadow-white/15" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Icon size={15} />{label}</button>)}
              </nav>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11131c]" aria-label="Mã mẫu">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3"><span className="flex items-center gap-2 text-sm font-bold text-slate-300"><Code2 size={16} />index.html</span><button type="button" onClick={() => void copyCode()} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Đã copy" : "Copy"}</button></div>
          <pre className="min-h-[26rem] overflow-auto p-5 text-xs leading-6 text-cyan-100"><code>{codeSample}</code></pre>
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4"><span className="text-xs text-slate-500">Đang chọn: <strong className="text-slate-300">{active}</strong></span><button type="button" onClick={() => setActive("home")} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white"><RotateCcw size={14} />Đặt lại</button></div>
        </section>
      </div>
    </div>
  </main>;
}
