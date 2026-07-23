import { ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { addMcqAdmin, listMcqAdmins, mcqLibraryErrorMessage, removeMcqAdmin, type McqAdminAccess } from "../services/mcqLibrary";

interface Props {
  userEmail?: string;
  visible?: boolean;
}

const ownerEmail = "thukhoa2002@gmail.com";

export default function McqAccessPanel({ userEmail, visible = true }: Props) {
  const [admins, setAdmins] = useState<McqAdminAccess[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const isOwner = userEmail?.trim().toLowerCase() === ownerEmail;

  const refreshAdmins = useCallback(async () => {
    if (!isOwner) return;
    try {
      setAdmins(await listMcqAdmins());
    } catch (error) {
      setNotice(mcqLibraryErrorMessage(error, "Không thể tải danh sách quyền MCQ."));
    }
  }, [isOwner]);

  useEffect(() => {
    if (visible) void refreshAdmins();
  }, [refreshAdmins, visible]);

  async function grantAccess() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    setNotice("");
    try {
      await addMcqAdmin(email);
      setNewEmail("");
      setNotice(`Đã cấp quyền Xưởng MCQ cho ${email}.`);
      await refreshAdmins();
    } catch (error) {
      setNotice(mcqLibraryErrorMessage(error, "Không thể cấp quyền MCQ."));
    } finally {
      setBusy(false);
    }
  }

  async function revokeAccess(email: string) {
    if (!confirm(`Thu hồi quyền Xưởng MCQ của ${email}?`)) return;
    setBusy(true);
    setNotice("");
    try {
      await removeMcqAdmin(email);
      await refreshAdmins();
    } catch (error) {
      setNotice(mcqLibraryErrorMessage(error, "Không thể thu hồi quyền MCQ."));
    } finally {
      setBusy(false);
    }
  }

  if (!isOwner || !visible) return null;

  return (
    <section className="mb-0 rounded-3xl border border-teal-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-xl" aria-label="Quyền trắc nghiệm">
      <div className="rounded-2xl border border-teal-100 bg-white/75 p-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700"><ShieldCheck size={21} /></span>
          <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.14em] text-teal-700">Quyền trắc nghiệm</p><p className="mt-1 text-sm font-bold text-slate-700">Email được cấp quyền</p></div>
        </div>
        {admins.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{admins.map((admin) => <span key={admin.email} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"><span className="truncate">{admin.email}</span>{admin.is_owner ? <em className="shrink-0 not-italic text-teal-600">Chủ sở hữu</em> : <button type="button" disabled={busy} aria-label={`Thu hồi quyền ${admin.email}`} title="Thu hồi quyền" onClick={() => void revokeAccess(admin.email)} className="shrink-0 text-rose-500 hover:text-rose-700"><UserMinus size={15} /></button>}</span>)}</div>}
        {admins.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400">Chưa có email nào.</p>}
        {notice && <p className="mt-3 text-xs font-semibold text-slate-600">{notice}</p>}
        <div className="mt-3 flex gap-2 border-t border-teal-100 pt-3">
          <input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void grantAccess(); } }} placeholder="email@gmail.com" aria-label="Email cần cấp quyền MCQ" className="min-w-0 flex-1 rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500" />
          <button type="button" disabled={busy || !newEmail.trim()} onClick={() => void grantAccess()} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"><UserPlus size={16} />Thêm</button>
        </div>
      </div>
    </section>
  );
}
