import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Eye, Folder, FolderPlus, Globe2, LockKeyhole, Pencil, Play, RotateCcw, Settings2, ShieldCheck, Trash2, Trophy, UserMinus, UserPlus, X, XCircle } from "lucide-react";
import { getMcqProgress, saveMcqProgress, type McqProgress } from "../services/supabase";
import McqAdminStudio from "./McqAdminStudio";
import McqIcon from "./McqIcon";
import RippleButton from "./RippleButton";
import { addMcqAdmin, archiveMcqBank, createMcqFolder, deleteMcqBank, deleteMcqFolder, hasMcqAdminAccess, listMcqAdmins, listMcqBanks, listMcqBankStates, listMcqFolders, mcqLibraryErrorMessage, moveMcqBank, removeMcqAdmin, saveMcqBank, updateMcqFolder, type McqAdminAccess, type McqBankState, type McqFolder, type McqLibraryBank, type McqLibraryQuestion, type McqOption } from "../services/mcqLibrary";

type Option = { id: string; text: string };
type QuizQuestion = {
  id: string;
  source_number: number;
  question: string;
  options: Option[];
  correct_answer?: string;
  explanation?: string;
  review_required?: boolean;
  image_url?: string;
  image_alt?: string;
  shared_context?: string;
};
type QuizBank = { title: string; questions: QuizQuestion[] };
type Props = { userId?: string; userEmail?: string; onAiCallsRemaining?: (remaining: number) => void };
type DeckDefinition = { key: string; title: string; description: string; questionCount: number; dataUrl?: string; bank?: QuizBank; libraryBank?: McqLibraryBank; managedBankId?: string; folderId?: string | null; visibility: "draft" | "published" };

const staticDecks: DeckDefinition[] = [
  { key: "bo-mcq-kho-khe", managedBankId: "b0000000-0000-4000-8000-000000000130", title: "Bộ MCQ - Khò khè", description: "Tiếp cận khò khè, viêm tiểu phế quản và hen.", questionCount: 130, dataUrl: "/mcq/bo-mcq-kho-khe.json", visibility: "published" },
  { key: "bo-mcq-viem-phoi", managedBankId: "b0000000-0000-4000-8000-000000000091", title: "Bộ MCQ - Viêm phổi", description: "Chẩn đoán, xử trí và biến chứng viêm phổi ở trẻ em.", questionCount: 91, dataUrl: "/mcq/bo-mcq-viem-phoi.json", visibility: "published" },
];
const staticBankIds = new Set(staticDecks.flatMap((deck) => deck.managedBankId ? [deck.managedBankId] : []));

export default function McqPage({ userId, userEmail, onAiCallsRemaining }: Props) {
  const [bank, setBank] = useState<QuizBank | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [opened, setOpened] = useState(false);
  const [activeDeck, setActiveDeck] = useState<DeckDefinition | null>(null);
  const [previewDeck, setPreviewDeck] = useState<DeckDefinition | null>(null);
  const [previewBank, setPreviewBank] = useState<QuizBank | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [progressReady, setProgressReady] = useState(false);
  const [libraryBanks, setLibraryBanks] = useState<McqLibraryBank[]>([]);
  const [libraryFolders, setLibraryFolders] = useState<McqFolder[]>([]);
  const [bankStates, setBankStates] = useState<McqBankState[]>([]);
  const [requestedEditBank, setRequestedEditBank] = useState<McqLibraryBank | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminAccessReady, setAdminAccessReady] = useState(false);
  const [mcqAdmins, setMcqAdmins] = useState<McqAdminAccess[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [accessNotice, setAccessNotice] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null);
  const [openDeckMenuId, setOpenDeckMenuId] = useState<string | null>(null);
  const [folderComposer, setFolderComposer] = useState<"parent" | "child" | null>(null);
  const [folderTitle, setFolderTitle] = useState("");
  const [folderParentId, setFolderParentId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderTitle, setEditingFolderTitle] = useState("");
  const [editingFolderParentId, setEditingFolderParentId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const isOwner = userEmail?.trim().toLowerCase() === "thukhoa2002@gmail.com";

  const refreshMcqAdmins = useCallback(async () => {
    if (!isOwner) { setMcqAdmins([]); return; }
    try { setMcqAdmins(await listMcqAdmins()); }
    catch (accessError) { setAccessNotice(mcqLibraryErrorMessage(accessError, "Không thể tải danh sách quyền MCQ.")); }
  }, [isOwner]);

  useEffect(() => {
    let active = true;
    if (!userId) { setIsAdmin(false); setAdminAccessReady(true); return; }
    if (isOwner) { setIsAdmin(true); setAdminAccessReady(true); void refreshMcqAdmins(); return; }
    setIsAdmin(false);
    setAdminAccessReady(false);
    void hasMcqAdminAccess()
      .then((allowed) => { if (active) setIsAdmin(allowed); })
      .catch(() => { if (active) setIsAdmin(false); })
      .finally(() => { if (active) setAdminAccessReady(true); });
    return () => { active = false; };
  }, [isOwner, refreshMcqAdmins, userId]);

  async function grantMcqAccess() {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email) return;
    setAccessBusy(true); setAccessNotice("");
    try {
      await addMcqAdmin(email);
      setNewAdminEmail("");
      setAccessNotice(`Đã cấp quyền Xưởng MCQ cho ${email}.`);
      await refreshMcqAdmins();
    } catch (accessError) {
      setAccessNotice(mcqLibraryErrorMessage(accessError, "Không thể cấp quyền MCQ."));
    } finally { setAccessBusy(false); }
  }

  async function revokeMcqAccess(email: string) {
    if (!confirm(`Thu hồi quyền Xưởng MCQ của ${email}?`)) return;
    setAccessBusy(true); setAccessNotice("");
    try {
      await removeMcqAdmin(email);
      await refreshMcqAdmins();
    } catch (accessError) {
      setAccessNotice(mcqLibraryErrorMessage(accessError, "Không thể thu hồi quyền MCQ."));
    } finally { setAccessBusy(false); }
  }
  const refreshLibrary = useCallback(async () => {
    if (!userId) { setLibraryBanks([]); setBankStates([]); return; }
    try {
      // The bank list is the source of truth for drafts. A missing/old status
      // RPC must not hide a bank that was already saved successfully.
      const [banks, folders, states] = await Promise.all([
        listMcqBanks(),
        listMcqFolders(),
        listMcqBankStates().catch((stateError) => {
          console.warn("Không thể tải trạng thái MCQ, vẫn hiển thị bản nháp đã lưu.", stateError);
          return [] as McqBankState[];
        }),
      ]);
      setLibraryBanks(banks);
      setLibraryFolders(folders);
      setBankStates(states);
    }
    catch (loadError) {
      console.warn("Không thể tải thư viện MCQ", loadError);
      setError(mcqLibraryErrorMessage(loadError, "Không thể tải danh sách bộ MCQ."));
    }
  }, [userId]);
  useEffect(() => { void refreshLibrary(); }, [refreshLibrary]);
  const decks = useMemo<DeckDefinition[]>(() => [
    ...staticDecks.flatMap<DeckDefinition>((deck) => {
      const state = bankStates.find((item) => item.id === deck.managedBankId)?.status;
      if (state === "archived" || (!isAdmin && state === "draft")) return [];
      const managedBank = libraryBanks.find((item) => item.id === deck.managedBankId);
      if (managedBank?.status === "archived") return [];
      if (!managedBank) return [deck];
      return [{
        ...deck,
        title: managedBank.title,
        description: managedBank.description,
        questionCount: managedBank.questions.length,
        bank: { title: managedBank.title, questions: managedBank.questions },
        libraryBank: managedBank,
        folderId: managedBank.folder_id || null,
        visibility: managedBank.status === "published" ? "published" as const : "draft" as const,
      }];
    }),
    ...libraryBanks.filter((item) => item.status !== "archived" && (item.status === "published" || isAdmin) && !staticBankIds.has(item.id)).map((item) => ({
      key: `mcq-bank-${item.id}`,
      title: item.title,
      description: item.description || "Bộ câu hỏi đã được quản trị viên kiểm tra và công khai.",
      questionCount: item.questions.length,
      bank: { title: item.title, questions: item.questions },
      libraryBank: item,
      folderId: item.folder_id || null,
      visibility: item.status === "published" ? "published" as const : "draft" as const,
    })),
  ], [bankStates, isAdmin, libraryBanks]);

  useEffect(() => {
    if (!activeDeck) { setBank(null); setError(""); return; }
    if (activeDeck.bank) { setBank(activeDeck.bank); return; }
    if (!activeDeck.dataUrl) { setError("Bộ MCQ chưa có dữ liệu."); return; }
    void fetch(activeDeck.dataUrl)
      .then((response) => response.ok ? response.json() as Promise<QuizBank> : Promise.reject(new Error("Không thể tải bộ MCQ.")))
      .then(setBank)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Không thể tải bộ MCQ."));
  }, [activeDeck]);

  useEffect(() => {
    if (!bank || !activeDeck) return;
    let active = true;
    setProgressReady(false);
    setHasStarted(false);
    setStartedAt(null);
    setIndex(0);
    setAnswers({});
    setChecked({});
    if (!userId) { setProgressReady(true); return; }
    void getMcqProgress(userId, activeDeck.key)
      .then((saved) => {
        if (!active || !saved) return;
        const questionIds = new Set(bank.questions.map((item) => item.id));
        setIndex(Math.min(Math.max(saved.current_index, 0), bank.questions.length - 1));
        setAnswers(Object.fromEntries(Object.entries(saved.answers).filter(([id, value]) => questionIds.has(id) && typeof value === "string")));
        setChecked(Object.fromEntries(Object.entries(saved.checked).filter(([id, value]) => questionIds.has(id) && value === true)));
        setStartedAt(saved.started_at);
        setHasStarted(true);
      })
      .catch((loadError: unknown) => console.warn("Không thể tải tiến độ MCQ", loadError))
      .finally(() => { if (active) setProgressReady(true); });
    return () => { active = false; };
  }, [activeDeck, bank, userId]);

  const question = bank?.questions[index] ?? null;
  const selected = question ? answers[question.id] : undefined;
  const isChecked = question ? Boolean(checked[question.id]) : false;
  const gradedBank = Boolean(bank?.questions.some((item) => item.correct_answer));
  const correctCount = useMemo(
    () => bank?.questions.filter((item) => item.correct_answer && checked[item.id] && answers[item.id] === item.correct_answer).length ?? 0,
    [answers, bank, checked]
  );
  const completedCount = Object.keys(checked).length;

  function persist(next: Pick<McqProgress, "current_index" | "answers" | "checked" | "started_at">) {
    if (!userId || !activeDeck) return;
    void saveMcqProgress(userId, activeDeck.key, next).catch((saveError: unknown) => console.warn("Không thể lưu tiến độ MCQ", saveError));
  }

  function openDeck(deck: DeckDefinition) {
    setBank(null);
    setProgressReady(false);
    setActiveDeck(deck);
    setOpened(true);
  }

  async function openPreview(deck: DeckDefinition) {
    setError("");
    setPreviewDeck(deck);
    setPreviewBank(null);
    setPreviewLoading(true);
    try {
      let source: QuizBank;
      if (deck.bank) source = deck.bank;
      else {
        if (!deck.dataUrl) throw new Error("Bộ MCQ chưa có dữ liệu để xem trước.");
        const response = await fetch(deck.dataUrl);
        if (!response.ok) throw new Error("Không thể tải nội dung xem trước.");
        source = await response.json() as QuizBank;
      }
      // Preview deliberately strips grading metadata: it is a read-only question catalogue.
      setPreviewBank({
        title: source.title,
        questions: source.questions.map(({ correct_answer: _answer, explanation: _explanation, review_required: _review, ...question }) => question),
      });
    } catch (previewError) {
      setPreviewDeck(null);
      setError(previewError instanceof Error ? previewError.message : "Không thể mở chế độ xem trước.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function editableBankFor(deck: DeckDefinition): Promise<McqLibraryBank> {
    if (!userId) throw new Error("Bạn cần đăng nhập để sửa bộ MCQ.");
    if (deck.libraryBank) return deck.libraryBank;
    if (!deck.dataUrl || !deck.managedBankId) throw new Error("Bộ MCQ này chưa có nguồn dữ liệu để sửa.");
    const response = await fetch(deck.dataUrl);
    if (!response.ok) throw new Error("Không thể tải nội dung bộ MCQ để sửa.");
    const source = await response.json() as QuizBank;
    const editableQuestions: McqLibraryQuestion[] = source.questions.map((question, questionIndex) => ({
      ...question,
      id: question.id || crypto.randomUUID(),
      source_number: question.source_number || questionIndex + 1,
      options: (["A", "B", "C", "D"] as const).map((id): McqOption => ({
        id,
        text: question.options.find((option) => option.id === id)?.text || "",
      })),
    }));
    const now = new Date().toISOString();
    return { id: deck.managedBankId, owner_id: userId, title: deck.title, description: deck.description, questions: editableQuestions, status: deck.visibility, created_at: now, updated_at: now, published_at: deck.visibility === "published" ? now : null };
  }

  async function requestDeckEdit(deck: DeckDefinition) {
    if (!isAdmin || !userId) return;
    try {
      setError("");
      setRequestedEditBank(await editableBankFor(deck));
      requestAnimationFrame(() => document.getElementById("mcq-admin-studio")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Không thể mở bộ MCQ để sửa.");
    }
  }

  async function changeDeckVisibility(deck: DeckDefinition, status: "draft" | "published") {
    if (!isAdmin || !userId || deck.visibility === status) return;
    try {
      setError("");
      const editable = await editableBankFor(deck);
      await saveMcqBank(userId, { title: editable.title, description: editable.description, questions: editable.questions, status }, editable.id);
      await refreshLibrary();
    } catch (visibilityError) {
      setError(mcqLibraryErrorMessage(visibilityError, "Không thể thay đổi quyền xem bộ MCQ."));
    }
  }

  async function removeDeck(deck: DeckDefinition) {
    if (!isAdmin || !userId || !confirm(`Xóa toàn bộ “${deck.title}”? Hành động này không thể hoàn tác.`)) return;
    try {
      setError("");
      if (deck.managedBankId && staticBankIds.has(deck.managedBankId)) await archiveMcqBank(userId, deck.managedBankId, deck.title);
      else if (deck.libraryBank) await deleteMcqBank(deck.libraryBank.id);
      else throw new Error("Bộ MCQ này chưa được lưu trong thư viện.");
      if (requestedEditBank?.id === (deck.libraryBank?.id || deck.managedBankId)) setRequestedEditBank(null);
      await refreshLibrary();
    } catch (deleteError) {
      setError(mcqLibraryErrorMessage(deleteError, "Không thể xóa bộ MCQ."));
    }
  }

  function beginCreateFolder(mode: "parent" | "child", parentId: string | null = null) {
    setFolderComposer(mode);
    setFolderTitle("");
    setFolderParentId(parentId);
    setOpenFolderMenuId(null);
  }

  async function submitFolder() {
    if (!isAdmin || !userId || !folderTitle.trim()) return;
    try {
      setError("");
      const created = await createMcqFolder(userId, folderTitle, folderComposer === "child" ? folderParentId : null);
      setLibraryFolders((items) => [...items, created]);
      setFolderComposer(null);
      setFolderTitle("");
      setFolderParentId(null);
    } catch (folderError) {
      setError(mcqLibraryErrorMessage(folderError, "Không thể tạo thư mục MCQ."));
    }
  }

  function folderDescendantIds(folderId: string): Set<string> {
    const descendants = new Set<string>();
    const visit = (parentId: string) => {
      libraryFolders.filter((folder) => folder.parent_id === parentId).forEach((folder) => {
        if (descendants.has(folder.id)) return;
        descendants.add(folder.id);
        visit(folder.id);
      });
    };
    visit(folderId);
    return descendants;
  }

  function beginEditFolder(folder: McqFolder) {
    setEditingFolderId(folder.id);
    setEditingFolderTitle(folder.title);
    setEditingFolderParentId(folder.parent_id);
    setOpenFolderMenuId(null);
  }

  async function saveFolderEdit(folder: McqFolder) {
    if (!isAdmin || !editingFolderTitle.trim()) return;
    try {
      setError("");
      const updated = await updateMcqFolder(folder.id, { title: editingFolderTitle, parentId: editingFolderParentId });
      setLibraryFolders((items) => items.map((item) => item.id === updated.id ? updated : item));
      setEditingFolderId(null);
    } catch (folderError) {
      setError(mcqLibraryErrorMessage(folderError, "Không thể sửa thư mục MCQ."));
    }
  }

  async function toggleFolderVisibility(folder: McqFolder) {
    if (!isAdmin) return;
    try {
      setError("");
      const updated = await updateMcqFolder(folder.id, { status: folder.status === "published" ? "draft" : "published" });
      setLibraryFolders((items) => items.map((item) => item.id === updated.id ? updated : item));
    } catch (folderError) {
      setError(mcqLibraryErrorMessage(folderError, "Không thể thay đổi quyền xem thư mục."));
    }
  }

  async function removeFolder(folder: McqFolder) {
    if (!isAdmin || !confirm(`Xóa thư mục “${folder.title}”? Các bộ MCQ bên trong sẽ chuyển về thư mục gốc.`)) return;
    try {
      setError("");
      await deleteMcqFolder(folder.id);
      setLibraryFolders((items) => items.filter((item) => item.id !== folder.id).map((item) => item.parent_id === folder.id ? { ...item, parent_id: null } : item));
      setLibraryBanks((items) => items.map((item) => item.folder_id === folder.id ? { ...item, folder_id: null } : item));
      if (editingFolderId === folder.id) setEditingFolderId(null);
    } catch (folderError) {
      setError(mcqLibraryErrorMessage(folderError, "Không thể xóa thư mục MCQ."));
    }
  }

  async function moveDeckToFolder(deck: DeckDefinition, folderId: string | null) {
    if (!isAdmin) return;
    const bankId = deck.libraryBank?.id || deck.managedBankId;
    if (!bankId) return;
    try {
      setError("");
      const updated = await moveMcqBank(bankId, folderId);
      setLibraryBanks((items) => items.some((item) => item.id === updated.id) ? items.map((item) => item.id === updated.id ? updated : item) : [...items, updated]);
      setOpenDeckMenuId(null);
    } catch (moveError) {
      setError(mcqLibraryErrorMessage(moveError, "Không thể di chuyển bộ MCQ."));
    }
  }

  function returnToDeckList() {
    if (hasStarted && startedAt) persist({ current_index: index, answers, checked, started_at: startedAt });
    setOpened(false);
    setActiveDeck(null);
  }

  useEffect(() => {
    if (!opened || !bank || !progressReady || hasStarted || !activeDeck) return;
    const nextStartedAt = new Date().toISOString();
    setStartedAt(nextStartedAt);
    setHasStarted(true);
    persist({ current_index: index, answers, checked, started_at: nextStartedAt });
  }, [activeDeck, answers, bank, checked, hasStarted, index, opened, progressReady, startedAt]);

  function choose(optionId: string) {
    if (!question || isChecked) return;
    const nextAnswers = { ...answers, [question.id]: optionId };
    setAnswers(nextAnswers);
    if (hasStarted && startedAt) persist({ current_index: index, answers: nextAnswers, checked, started_at: startedAt });
  }

  function checkAnswer() {
    if (!question || !selected) return;
    const nextChecked = { ...checked, [question.id]: true };
    setChecked(nextChecked);
    if (hasStarted && startedAt) persist({ current_index: index, answers, checked: nextChecked, started_at: startedAt });
  }

  function restart() {
    setIndex(0);
    setAnswers({});
    setChecked({});
    if (hasStarted && startedAt) persist({ current_index: 0, answers: {}, checked: {}, started_at: startedAt });
  }

  const visibleFolders = isAdmin ? libraryFolders : libraryFolders.filter((folder) => folder.status === "published");
  const visibleFolderIds = new Set(visibleFolders.map((folder) => folder.id));
  const currentFolder = activeFolderId ? visibleFolders.find((folder) => folder.id === activeFolderId) || null : null;
  const currentFolders = visibleFolders.filter((folder) => (folder.parent_id || null) === activeFolderId);
  const currentDecks = activeFolderId
    ? decks.filter((deck) => deck.folderId === activeFolderId)
    : decks.filter((deck) => !deck.folderId || !visibleFolderIds.has(deck.folderId));

  function renderDeckCard(deck: DeckDefinition): ReactNode {
    return <article key={deck.key} className="group relative flex min-h-48 flex-col rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/90 via-white to-teal-50/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><McqIcon size={26} /></div><h2 className="min-w-0 text-xl font-extrabold text-rose-950">{deck.title}</h2></div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-teal-700 shadow-sm">{deck.questionCount} câu</span>
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-500">{deck.description}</p>
      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
        {isAdmin ? <div className="relative">
          <button type="button" aria-label={`Cài đặt ${deck.title}`} title="Cài đặt bộ MCQ" onClick={() => setOpenDeckMenuId((current) => current === deck.key ? null : deck.key)} className="inline-flex items-center justify-center rounded-2xl border border-violet-100 bg-white/95 p-2.5 text-slate-600 shadow-sm hover:bg-violet-50"><Settings2 size={17} /></button>
          {openDeckMenuId === deck.key && <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-[0_18px_40px_rgba(15,23,42,.2)]">
            <button type="button" onClick={() => { setOpenDeckMenuId(null); void requestDeckEdit(deck); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"><Pencil size={15} />Sửa nội dung bộ MCQ</button>
            <label className="mt-1 block rounded-xl px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Chuyển vào thư mục<select value={deck.folderId || ""} onChange={(event) => void moveDeckToFolder(deck, event.target.value || null)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700"><option value="">Thư mục gốc</option>{libraryFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.parent_id ? "↳ " : ""}{folder.title}</option>)}</select></label>
            <button type="button" onClick={() => void changeDeckVisibility(deck, deck.visibility === "published" ? "draft" : "published")} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50">{deck.visibility === "published" ? <LockKeyhole size={15} /> : <Globe2 size={15} />}{deck.visibility === "published" ? "Chuyển riêng tư" : "Công khai bộ MCQ"}</button>
            <button type="button" onClick={() => void removeDeck(deck)} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={15} />Xóa bộ MCQ</button>
          </div>}
        </div> : <span />}
        <div className="ml-auto flex items-center justify-end gap-2 text-sm font-bold"><button type="button" onClick={() => void openPreview(deck)} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-violet-700 hover:bg-violet-50"><Eye size={15} />Xem trước</button><RippleButton text="Bắt đầu" icon={<Play size={15} fill="currentColor" />} onClick={() => openDeck(deck)} className="px-3 py-2 text-sm font-bold" /></div>
      </div>
    </article>;
  }

  function renderFolder(folder: McqFolder, depth = 0): ReactNode {
    const folderDecks = decks.filter((deck) => deck.folderId === folder.id);
    const descendants = folderDescendantIds(folder.id);
    const parentOptions = libraryFolders.filter((item) => item.id !== folder.id && !descendants.has(item.id));
    return <div key={folder.id} className="space-y-3" style={{ marginLeft: depth ? `${Math.min(depth, 4) * 1.25}rem` : undefined }}>
      <div className="relative rounded-2xl border border-amber-200 bg-amber-50/55 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3"><button type="button" onClick={() => { setActiveFolderId(folder.id); setOpenFolderMenuId(null); setOpenDeckMenuId(null); }} className="flex min-w-0 items-center gap-3 text-left"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Folder size={20} /></span><span className="min-w-0"><span className="block truncate text-base font-extrabold text-slate-800">{folder.title}</span><span className="block text-xs font-semibold text-slate-500">{folderDecks.length} bộ MCQ · {folder.status === "published" ? "Công khai" : "Riêng tư"}</span></span></button>{isAdmin && <div className="relative"><button type="button" aria-label={`Cài đặt thư mục ${folder.title}`} title="Cài đặt thư mục" onClick={() => setOpenFolderMenuId((current) => current === folder.id ? null : folder.id)} className="rounded-xl p-2 text-slate-600 hover:bg-amber-100"><Settings2 size={18} /></button>{openFolderMenuId === folder.id && <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,.2)]"><button type="button" onClick={() => beginEditFolder(folder)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"><Pencil size={15} />Sửa và di chuyển thư mục</button><button type="button" onClick={() => void toggleFolderVisibility(folder)} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50">{folder.status === "published" ? <LockKeyhole size={15} /> : <Globe2 size={15} />}{folder.status === "published" ? "Chuyển riêng tư" : "Công khai thư mục"}</button><button type="button" onClick={() => void removeFolder(folder)} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={15} />Xóa thư mục</button></div>}</div>}</div>
        {editingFolderId === folder.id && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px_auto_auto]"><input value={editingFolderTitle} onChange={(event) => setEditingFolderTitle(event.target.value)} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold" placeholder="Tên thư mục" /><select value={editingFolderParentId || ""} onChange={(event) => setEditingFolderParentId(event.target.value || null)} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold"><option value="">Thư mục gốc</option>{parentOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button type="button" onClick={() => void saveFolderEdit(folder)} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white">Lưu</button><button type="button" onClick={() => setEditingFolderId(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600"><X size={16} /></button></div>}
      </div>
    </div>;
  }

  if (error) return <section className="mode-panel mx-auto w-full max-w-5xl px-5 py-8"><p className="rounded-2xl border border-rose-200 bg-white p-5 text-sm font-semibold text-rose-700">{error}</p></section>;

  if (previewDeck) return (
    <section className="mode-panel mx-auto w-full max-w-5xl px-5 py-8" aria-labelledby="mcq-preview-title">
      <div className="glass-panel overflow-hidden border border-violet-100/80 bg-white/75 p-5 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-teal-100 text-violet-700"><Eye size={27} /></div>
            <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-teal-600">Chế độ xem trước</p><h1 id="mcq-preview-title" className="mt-1 text-2xl font-black text-rose-950 sm:text-3xl">{previewDeck.title}</h1><p className="mt-1 text-sm text-slate-500">Chỉ xem câu hỏi · Không thể chọn hoặc xem đáp án.</p></div>
          </div>
          <button type="button" onClick={() => { setPreviewDeck(null); setPreviewBank(null); }} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"><ArrowLeft size={17} />Danh sách bộ MCQ</button>
        </div>
        {previewLoading || !previewBank ? <div className="mt-8 rounded-2xl bg-slate-50 px-5 py-10 text-center text-sm font-semibold text-slate-500">Đang nạp toàn bộ câu hỏi…</div> : <div className="mt-8 space-y-4">
          {previewBank.questions.map((previewQuestion, questionIndex) => <article key={previewQuestion.id || questionIndex} className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3"><span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-violet-100 px-2 text-xs font-black text-violet-700">{questionIndex + 1}</span><div className="min-w-0 flex-1">{previewQuestion.shared_context && <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-slate-700"><p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-amber-700">Tình huống chung</p>{previewQuestion.shared_context}</div>}<h2 className="text-base font-bold leading-7 text-slate-800 sm:text-lg">{previewQuestion.question}</h2>{previewQuestion.image_url && <img src={previewQuestion.image_url} alt={previewQuestion.image_alt || "Hình ảnh kèm câu hỏi"} className="mt-4 max-h-[28rem] max-w-full rounded-2xl border border-slate-200 object-contain" />}</div></div>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">{previewQuestion.options.map((option) => <div key={option.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-sm font-semibold text-slate-700"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-black text-slate-600">{option.id}</span><span className="pt-0.5 leading-6">{option.text}</span></div>)}</div>
          </article>)}
        </div>}
      </div>
    </section>
  );

  if (!opened) return (
    <section className="mode-panel mx-auto w-full max-w-5xl px-5 py-8" aria-labelledby="mcq-title">
      {isOwner && userId && <div className="mb-5 rounded-[1.75rem] border border-teal-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-100 text-teal-700"><ShieldCheck size={21} /></span><div><p className="text-xs font-black uppercase tracking-wider text-teal-700">Quyền Xưởng MCQ</p><p className="text-sm text-slate-500">Chỉ những email trong danh sách mới thấy và sử dụng khu vực tạo MCQ.</p></div></div><div className="flex min-w-0 gap-2"><input type="email" value={newAdminEmail} onChange={(event) => setNewAdminEmail(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void grantMcqAccess(); } }} placeholder="email@gmail.com" className="min-w-0 flex-1 rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500" /><button type="button" disabled={accessBusy || !newAdminEmail.trim()} onClick={() => void grantMcqAccess()} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"><UserPlus size={16} />Thêm</button></div></div>
        {mcqAdmins.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{mcqAdmins.map((admin) => <span key={admin.email} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">{admin.email}{admin.is_owner ? <em className="not-italic text-teal-600">Chủ sở hữu</em> : <button type="button" disabled={accessBusy} aria-label={`Thu hồi quyền ${admin.email}`} title="Thu hồi quyền" onClick={() => void revokeMcqAccess(admin.email)} className="text-rose-500 hover:text-rose-700"><UserMinus size={15} /></button>}</span>)}</div>}
        {accessNotice && <p className="mt-3 text-xs font-semibold text-slate-600">{accessNotice}</p>}
      </div>}
      {adminAccessReady && isAdmin && userId && <div id="mcq-admin-studio"><McqAdminStudio userId={userId} drafts={libraryBanks} requestedBank={requestedEditBank} onChanged={refreshLibrary} onAiCallsRemaining={onAiCallsRemaining} /></div>}
      <div className="glass-panel overflow-hidden border border-violet-100/80 bg-white/70 p-6 sm:p-10">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-teal-100 text-violet-700 shadow-sm"><McqIcon size={34} strokeWidth={1.8} /></div>
          <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-teal-600">Khu vực luyện tập</p><h1 id="mcq-title" className="mt-1 text-3xl font-extrabold tracking-tight text-rose-950">MCQ</h1><p className="mt-1 text-sm text-slate-500">Chọn một bộ đề để bắt đầu làm trắc nghiệm.</p></div>
        </div>
        {isAdmin && <div className="mt-7 rounded-2xl border border-dashed border-amber-200 bg-amber-50/45 p-3">
          <div className="flex flex-wrap items-center gap-2"><p className="mr-2 text-xs font-extrabold uppercase tracking-[.14em] text-amber-800">Kho thư mục MCQ</p><button type="button" onClick={() => beginCreateFolder(activeFolderId ? "child" : "parent", activeFolderId)} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50"><FolderPlus size={15} />Tạo thư mục</button></div>
          {folderComposer && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><input autoFocus value={folderTitle} onChange={(event) => setFolderTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submitFolder(); } }} placeholder={folderComposer === "child" ? "Tên thư mục con" : "Tên thư mục"} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold" /><button type="button" onClick={() => { setFolderComposer(null); setFolderTitle(""); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Hủy</button><button type="button" disabled={!folderTitle.trim()} onClick={() => void submitFolder()} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-45">Lưu</button></div>}
        </div>}
        <div className="mt-8 flex items-center gap-2 text-sm font-bold"><button type="button" onClick={() => setActiveFolderId(null)} className={`rounded-lg px-2 py-1 ${activeFolderId ? "text-amber-700 hover:bg-amber-50" : "text-slate-800"}`}>Kho MCQ</button>{currentFolder && <><ChevronRight size={15} className="text-slate-400" /><span className="truncate text-slate-800">{currentFolder.title}</span></>}</div>
        <div className="mt-3 grid grid-cols-1 gap-4">{currentFolders.map((folder) => renderFolder(folder))}{currentDecks.map(renderDeckCard)}</div>
      </div>
    </section>
  );

  if (!bank || !question || !progressReady) return <section className="mode-panel mx-auto w-full max-w-5xl px-5 py-8"><div className="glass-panel rounded-3xl p-8 text-center text-sm font-semibold text-slate-500">Đang nạp bộ MCQ…</div></section>;

  const isCorrect = selected === question.correct_answer;
  const isLast = index === bank.questions.length - 1;
  const completed = completedCount === bank.questions.length;

  return (
    <section className="mode-panel mx-auto w-full max-w-5xl px-5 py-8" aria-labelledby="mcq-title">
      <div className="glass-panel overflow-hidden border border-violet-100/80 bg-white/70 p-6 sm:p-10">
        <div className="mb-6"><button type="button" onClick={returnToDeckList} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"><ArrowLeft size={17} />Danh sách bộ MCQ</button></div>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-15 w-15 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-teal-100 text-violet-700 shadow-sm"><McqIcon size={31} strokeWidth={1.85} /></div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-teal-600">Bộ trắc nghiệm</p>
              <h1 id="mcq-title" className="mt-1 text-3xl font-extrabold tracking-tight text-rose-950">{activeDeck?.title}</h1>
              <p className="mt-1 text-sm text-slate-500">{bank.questions.length} câu · {gradedBank ? "Chọn đáp án rồi bấm kiểm tra ngay." : "Chọn đáp án và xác nhận trước khi sang câu tiếp theo."}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-teal-50/75 px-4 py-3 text-center sm:min-w-36">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-700">{gradedBank ? "Điểm hiện tại" : "Đã trả lời"}</p>
            <p className="mt-1 text-2xl font-black text-rose-950">{gradedBank ? correctCount : completedCount}<span className="text-sm font-bold text-slate-400">/{gradedBank ? completedCount : bank.questions.length}</span></p>
          </div>
        </div>

        <div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`Tiến độ ${index + 1} trên ${bank.questions.length}`}>
          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-teal-400 transition-all duration-300" style={{ width: `${((index + 1) / bank.questions.length) * 100}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500"><span>Câu {index + 1}/{bank.questions.length}</span><span>Đã kiểm tra {completedCount} câu</span></div>

        <article className="mt-7 rounded-3xl border border-slate-100 bg-gradient-to-br from-white via-violet-50/40 to-teal-50/45 p-5 sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">Câu nguồn #{question.source_number}</p>
          {question.shared_context && <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-slate-700"><p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-amber-700">Tình huống chung</p>{question.shared_context}</div>}
          <h2 className="mt-3 text-lg font-bold leading-7 text-slate-800 sm:text-xl">{question.question}</h2>
          {question.image_url && <img src={question.image_url} alt={question.image_alt || "Hình X-quang kèm theo câu hỏi"} className="mx-auto mt-6 max-h-[30rem] max-w-full rounded-2xl border border-slate-200 bg-white object-contain shadow-sm" />}
          <div className="mt-6 space-y-3">
            {question.options.map((option) => {
              const chosen = selected === option.id;
              const answer = Boolean(question.correct_answer) && question.correct_answer === option.id;
              const stateClass = isChecked && answer ? "border-teal-400 bg-teal-50 text-teal-950" : isChecked && chosen ? "border-rose-400 bg-rose-50 text-rose-950" : chosen ? "border-violet-400 bg-violet-50 text-violet-950" : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50/40";
              return <button key={option.id} type="button" onClick={() => choose(option.id)} disabled={isChecked} className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition ${stateClass} disabled:cursor-default`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${isChecked && answer ? "bg-teal-500 text-white" : isChecked && chosen ? "bg-rose-500 text-white" : chosen ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>{option.id}</span>
                <span className="pt-0.5 leading-6">{option.text}</span>
              </button>;
            })}
          </div>
          {isChecked && <div className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${!question.correct_answer || isCorrect ? "border-teal-200 bg-teal-50 text-teal-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {!question.correct_answer || isCorrect ? <CheckCircle2 className="mt-0.5 shrink-0" size={20} /> : <XCircle className="mt-0.5 shrink-0" size={20} />}
            <p>{!question.correct_answer ? "Đã ghi nhận lựa chọn. Tài liệu chưa có đáp án chắc chắn cho câu này." : isCorrect ? "Chính xác!" : `Chưa đúng. Đáp án là ${question.correct_answer}.`}{question.review_required ? " Đáp án này được giữ theo ghi chú nguồn và nên được rà soát lại." : ""}</p>
          </div>}
          {isChecked && question.explanation && <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap"><p className="mb-1 text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">Giải thích</p>{question.explanation}</div>}
        </article>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"><ChevronLeft size={18} />Câu trước</button>
          <div className="flex gap-3">
            {!isChecked ? <button type="button" onClick={checkAnswer} disabled={!selected} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-45"><CheckCircle2 size={18} />{gradedBank ? "Kiểm tra" : "Xác nhận lựa chọn"}</button> : !isLast ? <button type="button" onClick={() => { const nextIndex = index + 1; setIndex(nextIndex); if (hasStarted && startedAt) persist({ current_index: nextIndex, answers, checked, started_at: startedAt }); }} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-600">Câu tiếp<ChevronRight size={18} /></button> : <button type="button" onClick={restart} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-600"><RotateCcw size={18} />Làm lại</button>}
          </div>
        </div>
        {completed && <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900"><Trophy size={22} className="shrink-0" />{gradedBank ? `Hoàn thành bộ câu hỏi: ${correctCount}/${bank.questions.length} câu đúng.` : `Bạn đã hoàn thành ${bank.questions.length} câu trong bộ này.`}</div>}
      </div>
    </section>
  );
}
