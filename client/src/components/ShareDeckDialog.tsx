import { Share2, UserRound, UserRoundX, X } from "lucide-react";
import { useEffect, useState } from "react";
import { listDeckMembers, removeDeckMember, setDeckMemberAccess, setDeckMemberRole, type DeckMember } from "../services/supabase";
import AnimatedDropdown from "./AnimatedDropdown";

interface Props { deckId: string; title: string; onClose: () => void; onShare: (emails: string[]) => void | Promise<void>; }

export default function ShareDeckDialog({ deckId, title, onClose, onShare }: Props) {
  const [emails, setEmails] = useState("");
  const [members, setMembers] = useState<DeckMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberError, setMemberError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [changingAccess, setChangingAccess] = useState<string | null>(null);

  async function loadMembers() {
    setLoadingMembers(true);
    setMemberError("");
    try { setMembers(await listDeckMembers(deckId)); }
    catch (error) { console.error(error); setMemberError("Cần chạy phần SQL chia sẻ trong Supabase để xem danh sách."); }
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
    setRemoving(member.email);
    try { await removeDeckMember(deckId, member.email); await loadMembers(); }
    catch (error) { alert(`Không thể dừng chia sẻ: ${error instanceof Error ? error.message : String(error)}`); }
    finally { setRemoving(null); }
  }

  async function changeRole(member: DeckMember, role: "admin" | "member") {
    if (!member.user_id || member.role === role) return;
    setChangingRole(member.email);
    try { await setDeckMemberRole(deckId, member.user_id, role); await loadMembers(); }
    catch (error) { alert(`Không thể đổi quyền: ${error instanceof Error ? error.message : String(error)}`); }
    finally { setChangingRole(null); }
  }

  async function changeAccess(member: DeckMember, access: "edit" | "view") {
    if (!member.user_id || member.access === access) return;
    setChangingAccess(member.email);
    const previousAccess = member.access;
    // Reflect the selection immediately so the control never appears stuck.
    setMembers((current) => current.map((item) => item.user_id === member.user_id ? { ...item, access } : item));
    try {
      await setDeckMemberAccess(deckId, member.user_id, access);
      await loadMembers();
    }
    catch (error) {
      setMembers((current) => current.map((item) => item.user_id === member.user_id ? { ...item, access: previousAccess } : item));
      alert(`Không thể đổi quyền chỉnh sửa: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally { setChangingAccess(null); }
  }

  const owner = members.filter((member) => member.is_owner);
  const admins = members.filter((member) => member.role === "admin" && !member.is_owner);
  const regularMembers = members.filter((member) => member.role !== "admin" && !member.is_owner);
  const renderMember = (member: DeckMember) => <div key={`${member.email}-${member.role}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700"><div className="flex min-w-0 items-center gap-2"><span className="min-w-0 truncate">{member.email}{!member.user_id && <small className="ml-2 text-[10px] text-slate-400">(đang chờ)</small>}</span></div><div className="flex shrink-0 items-center gap-1">{member.is_owner ? <span className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600">Chủ sở hữu</span> : <>{member.user_id ? <AnimatedDropdown value={member.role} options={[{ value: "admin", label: "Quản trị viên" }, { value: "member", label: "Thành viên" }]} disabled={!member.user_id || changingRole === member.email} onChange={(value) => void changeRole(member, value as "admin" | "member")} ariaLabel={`Vai trò của ${member.email}`} triggerClassName="h-7 max-w-32 rounded-md border border-teal-100 bg-white px-1.5 py-1 text-[11px] font-semibold text-slate-600" menuClassName="right-0 left-auto min-w-36" /> : null}{member.user_id ? <AnimatedDropdown value={member.access} options={[{ value: "edit", label: "Có thể chỉnh sửa" }, { value: "view", label: "Chỉ xem" }]} disabled={changingAccess === member.email} onChange={(value) => void changeAccess(member, value as "edit" | "view")} ariaLabel={`Quyền truy cập của ${member.email}`} triggerClassName="h-7 max-w-32 rounded-md border border-amber-100 bg-white px-1.5 py-1 text-[11px] font-semibold text-amber-700" menuClassName="right-0 left-auto min-w-36" /> : null}{member.user_id && <button type="button" title="Dừng chia sẻ" disabled={removing === member.email} onClick={() => void remove(member)} className="rounded-md p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><UserRoundX size={15} /></button>}</>}</div></div>;

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/35 px-4"><div className="glass-dialog w-full max-w-md rounded-2xl border border-rose-100 bg-white p-6 shadow-xl">
    <div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-rose-500">Chia sẻ bộ thẻ</p><h2 className="mt-1 text-xl font-bold text-rose-950">{title}</h2></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50"><X size={18} /></button></div>
    <p className="mt-4 text-sm text-slate-500">Bạn muốn share cho:</p><input autoFocus value={emails} onChange={(event) => setEmails(event.target.value)} placeholder="" className="mt-3 w-full rounded-lg border border-rose-100 px-3 py-3 text-sm outline-none focus:border-rose-300" />
    <div className="mt-5 rounded-xl bg-teal-50/60 p-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-700"><UserRound size={14} /> Thành viên trong nhóm</div>{loadingMembers ? <p className="mt-2 text-xs text-slate-400">Đang tải danh sách...</p> : memberError ? <p className="mt-2 text-xs text-rose-600">{memberError}</p> : members.length === 0 ? <p className="mt-2 text-xs text-slate-400">Chưa có người nhận.</p> : <div className="mt-2 space-y-2">{owner.length > 0 && <><p className="px-1 text-[10px] font-bold uppercase tracking-wider text-rose-600">Chủ sở hữu</p>{owner.map(renderMember)}</>}{owner.length > 0 && admins.length > 0 && <div className="my-3 border-t border-dashed border-teal-200" />}{admins.length > 0 && <><p className="px-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">Quản trị viên</p>{admins.map(renderMember)}</>}{(owner.length > 0 || admins.length > 0) && regularMembers.length > 0 && <div className="my-3 border-t border-dashed border-teal-200" />}{regularMembers.length > 0 && <><p className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Thành viên</p>{regularMembers.map(renderMember)}</>}</div>}</div>
    <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500">Đóng</button><button disabled={!emails.trim()} onClick={() => void share()} className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Share2 size={16} /> Chia sẻ</button></div>
  </div></div>;
}
