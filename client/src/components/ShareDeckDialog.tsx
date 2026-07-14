import { Share2, UserRound, UserRoundX, X } from "lucide-react";
import { useEffect, useState } from "react";
import { listDeckMembers, removeDeckMember, type DeckMember } from "../services/supabase";

interface Props { deckId: string; title: string; onClose: () => void; onShare: (emails: string[]) => void | Promise<void>; }

export default function ShareDeckDialog({ deckId, title, onClose, onShare }: Props) {
  const [emails, setEmails] = useState("");
  const [members, setMembers] = useState<DeckMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  async function loadMembers() {
    setLoadingMembers(true);
    try { setMembers(await listDeckMembers(deckId)); }
    catch (error) { console.error(error); }
    finally { setLoadingMembers(false); }
  }

  useEffect(() => { void loadMembers(); }, [deckId]);

  async function share() {
    const values = emails.split(",").map((email) => email.trim()).filter(Boolean);
    if (!values.length) return;
    await onShare(values);
    setEmails("");
    await loadMembers();
  }

  async function remove(member: DeckMember) {
    setRemoving(member.user_id);
    try { await removeDeckMember(deckId, member.user_id); await loadMembers(); }
    catch (error) { alert(`Không thể dừng chia sẻ: ${error instanceof Error ? error.message : String(error)}`); }
    finally { setRemoving(null); }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/35 px-4"><div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-6 shadow-xl">
    <div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-rose-500">Chia sẻ bộ thẻ</p><h2 className="mt-1 text-xl font-bold text-rose-950">{title}</h2></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50"><X size={18} /></button></div>
    <p className="mt-4 text-sm text-slate-500">Bạn muốn cho ai ôn bài chung?</p><input autoFocus value={emails} onChange={(event) => setEmails(event.target.value)} placeholder="ban@gmail.com" className="mt-3 w-full rounded-lg border border-rose-100 px-3 py-3 text-sm outline-none focus:border-rose-300" />
    <div className="mt-5 rounded-xl bg-teal-50/60 p-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-700"><UserRound size={14} /> Đang được chia sẻ với</div>{loadingMembers ? <p className="mt-2 text-xs text-slate-400">Đang tải danh sách...</p> : members.length === 0 ? <p className="mt-2 text-xs text-slate-400">Chưa có người nhận.</p> : <div className="mt-2 space-y-2">{members.map((member) => <div key={member.user_id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm text-slate-700"><span className="truncate">{member.email}</span><button type="button" title="Dừng chia sẻ" disabled={removing === member.user_id} onClick={() => void remove(member)} className="ml-2 rounded-md p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><UserRoundX size={15} /></button></div>)}</div>}</div>
    <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500">Đóng</button><button disabled={!emails.trim()} onClick={() => void share()} className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Share2 size={16} /> Chia sẻ</button></div>
  </div></div>;
}
