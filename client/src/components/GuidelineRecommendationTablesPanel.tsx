import { CheckCircle2, ChevronDown, ChevronRight, Clipboard, Copy, FileJson, FileText, Plus, Save, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  createGuidelineRecommendationGroup,
  createGuidelineRecommendationTable,
  updateGuidelineRecommendationTable,
} from "../services/guidelineRecommendationTableRepository";
import { createGuidelineRecommendation } from "../services/guidelineRecommendationRepository";
import { publishRecommendationGroupEligibleContent, publishRecommendationTableEligibleContent } from "../services/guidelineBulkPublicationService";
import type {
  GuidelineRecommendationGroupRecord,
  GuidelineRecommendationRecord,
  GuidelineRecommendationTableRecord,
  GuidelineSectionRecord,
} from "../services/guidelineCoreTypes";
import SharedSelect from "./SharedSelect";

type Notice = { type: "error" | "success" | "info"; text: string; details?: string[] } | null;
type Props = {
  guidelineId: string;
  user: User;
  tables: GuidelineRecommendationTableRecord[];
  groups: GuidelineRecommendationGroupRecord[];
  sections: GuidelineSectionRecord[];
  recommendations: GuidelineRecommendationRecord[];
  storageReady: boolean;
  setTables: (items: GuidelineRecommendationTableRecord[]) => void;
  setGroups: (items: GuidelineRecommendationGroupRecord[]) => void;
  setRecommendations: (items: GuidelineRecommendationRecord[]) => void;
  setNotice: (notice: Notice) => void;
  onOpenRecommendation: (id: string) => void;
  onBulkPublished: () => void;
};

function message(error: unknown) { return error instanceof Error ? error.message : "Không thể hoàn tất thao tác."; }
function tableLabel(table: GuidelineRecommendationTableRecord) { return table.source_table_number || table.table_number || "Chưa đánh số"; }
function sourceSection(section: GuidelineSectionRecord | undefined) { return section ? `${section.section_number ? `${section.section_number}. ` : ""}${section.title_vi || section.title}` : "Chưa gắn Mục nguồn"; }
function statusLabel(status: string) { return status === "published" ? "Đã xuất bản" : status === "archived" ? "Đã lưu trữ" : "Bản nháp"; }

type VirtualGroup = Pick<GuidelineRecommendationGroupRecord, "id" | "source_heading" | "title_vi" | "group_order" | "source_page"> & { virtual?: boolean };

function groupsForTable(table: GuidelineRecommendationTableRecord, groups: GuidelineRecommendationGroupRecord[], recommendations: GuidelineRecommendationRecord[]): VirtualGroup[] {
  const explicit = groups.filter((group) => group.recommendation_table_id === table.id).map((group) => ({ ...group }));
  const explicitIds = new Set(explicit.map((group) => group.id));
  const legacyOrders = [...new Set(recommendations.filter((item) => item.recommendation_table_id === table.id && !item.recommendation_group_id).map((item) => Math.floor((item.sort_order % 1_000_000) / 1_000)))];
  const virtual = legacyOrders.filter((order) => !explicitIds.has(`legacy-${table.id}-${order}`)).map((order) => ({ id: `legacy-${table.id}-${order}`, source_heading: order ? `Nhóm nguồn ${order}` : "Khuyến cáo chưa phân nhóm", title_vi: order ? `Mục khuyến cáo ${order}` : "Khuyến cáo chưa phân nhóm", group_order: order, source_page: null, virtual: true }));
  return [...explicit, ...virtual].sort((a, b) => a.group_order - b.group_order);
}

export default function GuidelineRecommendationTablesPanel({ guidelineId, user, tables, groups, sections, recommendations, storageReady, setTables, setGroups, setRecommendations, setNotice, onOpenRecommendation, onBulkPublished }: Props) {
  const [tableForm, setTableForm] = useState({ table_number: "", title: "", title_vi: "", source_page_start: "", source_page_end: "", short_description: "", source_order: "" });
  const [openTableId, setOpenTableId] = useState<string | null>(tables[0]?.id || null);
  const [saving, setSaving] = useState(false);
  const sortedTables = useMemo(() => [...tables].sort((a, b) => (a.source_order ?? a.display_order) - (b.source_order ?? b.display_order) || (a.source_page_start ?? a.source_page ?? 0) - (b.source_page_start ?? b.source_page ?? 0)), [tables]);

  async function addTable() {
    if (!tableForm.title.trim() && !tableForm.title_vi.trim()) { setNotice({ type: "error", text: "Bảng khuyến cáo cần tiêu đề nguồn hoặc tiêu đề tiếng Việt." }); return; }
    setSaving(true);
    try {
      const created = await createGuidelineRecommendationTable(user.id, {
        guideline_id: guidelineId,
        section_id: null,
        table_number: tableForm.table_number.trim(),
        source_table_number: tableForm.table_number.trim(),
        title: tableForm.title.trim() || tableForm.title_vi.trim(),
        title_vi: tableForm.title_vi.trim() || tableForm.title.trim(),
        short_description: tableForm.short_description.trim(),
        source_page: tableForm.source_page_start ? Number(tableForm.source_page_start) : null,
        source_page_start: tableForm.source_page_start ? Number(tableForm.source_page_start) : null,
        source_page_end: tableForm.source_page_end ? Number(tableForm.source_page_end) : null,
        source_quote: "",
        source_anchor: "",
        source_order: tableForm.source_order ? Number(tableForm.source_order) : tables.length,
        display_order: tables.length,
        is_complete: false,
      });
      setTables([...tables, created]); setOpenTableId(created.id);
      setTableForm({ table_number: "", title: "", title_vi: "", source_page_start: "", source_page_end: "", short_description: "", source_order: "" });
      setNotice({ type: "success", text: "Đã tạo Bảng khuyến cáo." });
    } catch (error) { setNotice({ type: "error", text: message(error) }); }
    finally { setSaving(false); }
  }

  if (!storageReady) return <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900"><p className="font-extrabold">Bảng khuyến cáo chưa sẵn sàng trong database.</p><p className="mt-1">Cần áp dụng migration Bảng khuyến cáo trước. Mục nguồn chỉ là provenance, không dùng guideline_entries làm dữ liệu thay thế.</p></div>;
  return <div className="mt-4 space-y-4">
    <JsonRecommendationImport guidelineId={guidelineId} user={user} tables={tables} groups={groups} recommendations={recommendations} setTables={setTables} setGroups={setGroups} setRecommendations={setRecommendations} setNotice={setNotice} />
    <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
      <div><h2 className="text-base font-extrabold text-teal-950">Tạo bảng khuyến cáo</h2><p className="mt-1 text-xs font-semibold text-slate-500">Mục nguồn chỉ là metadata nguồn, không phải điều kiện tạo, dịch hoặc xuất bản bảng.</p></div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input value={tableForm.table_number} onChange={(event) => setTableForm({ ...tableForm, table_number: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" placeholder="Số bảng nguồn" />
        <input value={tableForm.title} onChange={(event) => setTableForm({ ...tableForm, title: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold md:col-span-2" placeholder="Tiêu đề nguồn" />
        <input value={tableForm.title_vi} onChange={(event) => setTableForm({ ...tableForm, title_vi: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold md:col-span-2" placeholder="Tiêu đề tiếng Việt" />
        <input value={tableForm.source_page_start} onChange={(event) => setTableForm({ ...tableForm, source_page_start: event.target.value })} type="number" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" placeholder="Trang nguồn bắt đầu" />
        <input value={tableForm.source_page_end} onChange={(event) => setTableForm({ ...tableForm, source_page_end: event.target.value })} type="number" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" placeholder="Trang nguồn kết thúc" />
        <textarea value={tableForm.short_description} onChange={(event) => setTableForm({ ...tableForm, short_description: event.target.value })} className="min-h-20 rounded-xl border border-slate-200 p-3 text-sm font-semibold md:col-span-2" placeholder="Mô tả ngắn (tùy chọn)" />
        <input value={tableForm.source_order} onChange={(event) => setTableForm({ ...tableForm, source_order: event.target.value })} type="number" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" placeholder="Thứ tự nguồn" />
      </div>
      <button type="button" disabled={saving} onClick={() => void addTable()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"><Plus size={16} />{saving ? "Đang tạo..." : "Tạo bảng khuyến cáo"}</button>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4"><div className="flex items-center justify-between"><div><h2 className="text-base font-extrabold text-slate-800">Bảng khuyến cáo theo thứ tự nguồn</h2><p className="mt-1 text-xs font-semibold text-slate-500">Thứ tự hiển thị dùng số bảng, trang và thứ tự nguồn; không dùng thời gian tạo.</p></div><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-extrabold text-violet-700">{tables.length} bảng</span></div>
      {sortedTables.length === 0 ? <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500">Chưa có Bảng khuyến cáo. Mục nguồn chưa được hiển thị như một bảng.</div> : <div className="mt-3 space-y-3">{sortedTables.map((table) => <TableCard key={table.id} table={table} sourceSection={sections.find((section) => section.id === table.section_id)} groups={groupsForTable(table, groups, recommendations)} recommendations={recommendations.filter((item) => item.recommendation_table_id === table.id)} user={user} open={openTableId === table.id} onToggle={() => setOpenTableId(openTableId === table.id ? null : table.id)} onAddGroup={(group) => setGroups([...groups, group])} onAddRecommendation={(recommendation) => setRecommendations([...recommendations, recommendation])} onTableUpdate={(updated) => setTables(tables.map((item) => item.id === updated.id ? updated : item))} setNotice={setNotice} onOpenRecommendation={onOpenRecommendation} onBulkPublished={onBulkPublished} />)}</div>}</div>
  </div>;
}

type JsonImportRecommendation = { title?: string; title_original?: string; recommendation_text_original?: string; original?: string; recommendation_text_vi?: string; vietnamese?: string; translation_vi?: string; recommendation_class?: string; class?: string; evidence_level?: string; level?: string; source_page?: number | null };
type JsonImportGroup = { source_heading?: string; title_vi?: string; context?: string; source_page?: number | null; recommendations?: JsonImportRecommendation[] };
type JsonImportTable = { table_number?: string; source_table_number?: string; title?: string; title_original?: string; title_vi?: string; short_description?: string; source_page?: number | null; source_page_start?: number | null; source_page_end?: number | null; source_order?: number; groups?: JsonImportGroup[]; recommendations?: JsonImportRecommendation[] };

const recommendationPrompt = `Bạn là biên tập viên guideline tim mạch. Tôi sẽ gửi một đoạn khuyến cáo nguyên bản tiếng Anh.

Hãy dịch sát nghĩa y văn, không tóm tắt, không diễn giải thêm, không đổi mức độ khuyến cáo. Giữ nguyên thuốc, liều, đơn vị, ngưỡng, thời gian, viết tắt và điều kiện lâm sàng. “Recommended” dịch là “được khuyến cáo”; “should be considered” dịch là “nên được cân nhắc”; “may be considered” dịch là “có thể được cân nhắc”; “is not recommended” dịch là “không được khuyến cáo”.

Chỉ trả về JSON hợp lệ, không markdown, theo đúng cấu trúc:
{
  "table": {
    "table_number": "Table 4",
    "title_original": "New recommendations",
    "title_vi": "Các khuyến cáo mới",
    "source_page_start": 7,
    "source_page_end": 7,
    "groups": [{
      "source_heading": "Recommendations for ...",
      "title_vi": "Khuyến cáo về ...",
      "recommendations": [{
        "recommendation_text_original": "giữ nguyên nguyên văn",
        "recommendation_text_vi": "bản dịch y khoa đầy đủ",
        "recommendation_class": "I",
        "evidence_level": "C",
        "source_page": 7
      }]
    }]
  }
}

Mỗi hàng khuyến cáo phải là một phần tử riêng. Không gộp nhiều hàng. Class và Level/LoE phải lấy đúng từ bảng nguồn. Nếu không có dữ liệu thì dùng chuỗi rỗng, không tự đoán.`;

function jsonString(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function jsonNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function readJsonRecommendation(value: JsonImportRecommendation) {
  return { title: jsonString(value.title || value.title_original), original: jsonString(value.recommendation_text_original || value.original), vi: jsonString(value.recommendation_text_vi || value.vietnamese || value.translation_vi), recommendationClass: jsonString(value.recommendation_class || value.class), evidenceLevel: jsonString(value.evidence_level || value.level), sourcePage: jsonNumber(value.source_page) };
}

function JsonRecommendationImport({ guidelineId, user, tables, groups, recommendations, setTables, setGroups, setRecommendations, setNotice }: { guidelineId: string; user: User; tables: GuidelineRecommendationTableRecord[]; groups: GuidelineRecommendationGroupRecord[]; recommendations: GuidelineRecommendationRecord[]; setTables: (items: GuidelineRecommendationTableRecord[]) => void; setGroups: (items: GuidelineRecommendationGroupRecord[]) => void; setRecommendations: (items: GuidelineRecommendationRecord[]) => void; setNotice: (notice: Notice) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  async function copyPrompt() { await navigator.clipboard.writeText(recommendationPrompt); setPromptCopied(true); window.setTimeout(() => setPromptCopied(false), 1800); }
  function loadFile(file: File | undefined) { if (!file) return; const reader = new FileReader(); reader.onload = () => setText(String(reader.result || "")); reader.readAsText(file); }
  function parsePayload() {
    const parsed = JSON.parse(text) as { table?: JsonImportTable; tables?: JsonImportTable[] };
    const incoming = parsed.tables || (parsed.table ? [parsed.table] : []);
    if (!incoming.length) throw new Error("JSON cần có table hoặc tables.");
    const normalized = incoming.map((table, tableIndex) => {
      const tableGroups = Array.isArray(table.groups) ? table.groups : [];
      const fallback = Array.isArray(table.recommendations) ? table.recommendations : [];
      const groupsWithRows = tableGroups.length ? tableGroups : [{ source_heading: "", title_vi: "Khuyến cáo chưa phân nhóm", recommendations: fallback }];
      const rows = groupsWithRows.flatMap((group) => (Array.isArray(group.recommendations) ? group.recommendations : []).map(readJsonRecommendation)).filter((row) => row.original || row.vi);
      if (!jsonString(table.title || table.title_original || table.title_vi)) throw new Error(`Bảng ${tableIndex + 1} thiếu tiêu đề.`);
      if (!rows.length) throw new Error(`Bảng ${tableIndex + 1} chưa có khuyến cáo.`);
      return { table, groups: groupsWithRows, rows };
    });
    return normalized;
  }
  async function importJson() {
    try {
      const payload = parsePayload();
      if (!window.confirm(`Nhập ${payload.reduce((sum, item) => sum + item.rows.length, 0)} khuyến cáo từ JSON? Dữ liệu sẽ được tạo dạng bản nháp.`)) return;
      setBusy(true);
      const createdTables: GuidelineRecommendationTableRecord[] = [];
      const createdGroups: GuidelineRecommendationGroupRecord[] = [];
      const createdRecommendations: GuidelineRecommendationRecord[] = [];
      for (const [tableIndex, item] of payload.entries()) {
        const source = item.table;
        const title = jsonString(source.title || source.title_original || source.title_vi);
        const createdTable = await createGuidelineRecommendationTable(user.id, { guideline_id: guidelineId, section_id: null, table_number: jsonString(source.table_number || source.source_table_number), source_table_number: jsonString(source.source_table_number || source.table_number), title, title_vi: jsonString(source.title_vi || title), short_description: jsonString(source.short_description), source_page: jsonNumber(source.source_page_start || source.source_page), source_page_start: jsonNumber(source.source_page_start || source.source_page), source_page_end: jsonNumber(source.source_page_end || source.source_page_start || source.source_page), source_quote: "", source_anchor: "json-manual-import", source_order: typeof source.source_order === "number" ? source.source_order : tables.length + tableIndex, display_order: tables.length + tableIndex, is_complete: true, translation_status: "reviewed" });
        createdTables.push(createdTable);
        for (const [groupIndex, group] of item.groups.entries()) {
          const rows = Array.isArray(group.recommendations) ? group.recommendations.map(readJsonRecommendation).filter((row) => row.original || row.vi) : [];
          if (!rows.length) continue;
          const createdGroup = await createGuidelineRecommendationGroup(user.id, { guideline_id: guidelineId, section_id: null, recommendation_table_id: createdTable.id, source_heading: jsonString(group.source_heading || group.title_vi) || `Nhóm ${groupIndex + 1}`, title_vi: jsonString(group.title_vi || group.source_heading) || `Nhóm ${groupIndex + 1}`, context: jsonString(group.context), source_page: jsonNumber(group.source_page), group_order: groupIndex });
          createdGroups.push(createdGroup);
          for (const [rowIndex, row] of rows.entries()) {
            const created = await createGuidelineRecommendation(user.id, { guideline_id: guidelineId, section_id: null, recommendation_table_id: createdTable.id, recommendation_group_id: createdGroup.id, title: row.title, recommendation_text_original: row.original, recommendation_text_vi: row.vi, rationale_vi: "", recommendation_class: row.recommendationClass, evidence_level: row.evidenceLevel, evidence_system: "", population: "", intervention: "", comparator: "", outcome: "", conditions: "", contraindications: "", source_page: row.sourcePage ?? jsonNumber(source.source_page_start || source.source_page), source_quote: row.original, source_anchor: "json-manual-import", verification_status: "needs_review", review_note: "Nhập từ JSON thủ công; cần đối chiếu nguồn trước khi xuất bản.", sort_order: groupIndex * 1_000 + rowIndex });
            createdRecommendations.push(created);
          }
        }
      }
      setTables([...tables, ...createdTables]); setGroups([...groups, ...createdGroups]); setRecommendations([...recommendations, ...createdRecommendations]); setText(""); setNotice({ type: "success", text: `Đã nhập ${createdTables.length} bảng và ${createdRecommendations.length} khuyến cáo dạng bản nháp.` });
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "JSON không hợp lệ." }); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-base font-extrabold text-indigo-950"><FileJson size={18} />Nhập bảng khuyến cáo bằng JSON</h2><p className="mt-1 max-w-3xl text-xs font-semibold text-slate-600">Cắt từng bảng hoặc từng đoạn, nhờ ChatGPT dịch theo prompt, sau đó dán hoặc tải JSON. Website sẽ tự tạo tên bảng, nhóm, nội dung, Class và Level/LoE ở dạng bản nháp.</p></div><button type="button" onClick={() => void copyPrompt()} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-extrabold text-indigo-700">{promptCopied ? <CheckCircle2 size={15} /> : <Copy size={15} />}{promptCopied ? "Đã sao chép prompt" : "Sao chép prompt ChatGPT"}</button></div><textarea value={text} onChange={(event) => setText(event.target.value)} className="mt-3 min-h-48 w-full rounded-xl border border-indigo-200 bg-white p-3 font-mono text-xs text-slate-700" placeholder='Dán JSON tại đây, ví dụ: {"table":{"table_number":"Table 4",...}}' /><div className="mt-3 flex flex-wrap items-center gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-extrabold text-indigo-700"><Upload size={15} />Tải JSON<input type="file" accept="application/json,.json" className="hidden" onChange={(event) => loadFile(event.target.files?.[0])} /></label><button type="button" disabled={busy || !text.trim()} onClick={() => void importJson()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"><Clipboard size={15} />{busy ? "Đang nhập..." : "Kiểm tra và nhập JSON"}</button><span className="text-[11px] font-semibold text-slate-500">Tạo bản nháp, không tự xuất bản.</span></div><details className="mt-3 rounded-xl border border-indigo-100 bg-white/70 p-3"><summary className="cursor-pointer text-xs font-extrabold text-indigo-800">Xem prompt dịch y khoa</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-slate-600">{recommendationPrompt}</pre></details></section>;
}

function TableCard({ table, sourceSection: section, groups, recommendations, user, open, onToggle, onAddGroup, onAddRecommendation, onTableUpdate, setNotice, onOpenRecommendation, onBulkPublished }: {
  table: GuidelineRecommendationTableRecord; sourceSection: GuidelineSectionRecord | undefined; groups: VirtualGroup[]; recommendations: GuidelineRecommendationRecord[]; user: User; open: boolean; onToggle: () => void; onAddGroup: (group: GuidelineRecommendationGroupRecord) => void; onAddRecommendation: (recommendation: GuidelineRecommendationRecord) => void; onTableUpdate: (table: GuidelineRecommendationTableRecord) => void; setNotice: (notice: Notice) => void; onOpenRecommendation: (id: string) => void; onBulkPublished: () => void;
}) {
  const [groupForm, setGroupForm] = useState({ source_heading: "", title_vi: "", context: "", source_page: "" });
  const [rowForm, setRowForm] = useState({ groupId: "", title: "", text: "", recommendation_class: "", evidence_level: "", source_page: "" });
  const [saving, setSaving] = useState(false);
  async function addGroup() {
    if (!groupForm.source_heading.trim() && !groupForm.title_vi.trim()) { setNotice({ type: "error", text: "Mục khuyến cáo cần tiêu đề nguồn hoặc tiêu đề tiếng Việt." }); return; }
    setSaving(true);
    try {
      const created = await createGuidelineRecommendationGroup(user.id, { guideline_id: table.guideline_id, section_id: table.section_id, recommendation_table_id: table.id, source_heading: groupForm.source_heading.trim() || groupForm.title_vi.trim(), title_vi: groupForm.title_vi.trim() || groupForm.source_heading.trim(), context: groupForm.context.trim(), source_page: groupForm.source_page ? Number(groupForm.source_page) : null, group_order: groups.length });
      onAddGroup(created); setGroupForm({ source_heading: "", title_vi: "", context: "", source_page: "" }); setNotice({ type: "success", text: "Đã thêm Mục khuyến cáo." });
    } catch (error) { setNotice({ type: "error", text: message(error) }); }
    finally { setSaving(false); }
  }
  async function addRow() {
    const group = groups.find((item) => item.id === rowForm.groupId);
    if (!rowForm.text.trim() && !rowForm.title.trim()) { setNotice({ type: "error", text: "Khuyến cáo cần nội dung hoặc tiêu đề." }); return; }
    if (groups.some((item) => !item.virtual) && (!group || group.virtual)) { setNotice({ type: "error", text: "Hãy chọn Mục khuyến cáo thuộc Bảng khuyến cáo này." }); return; }
    setSaving(true);
    try {
      const order = (group?.group_order ?? 0) * 1_000 + recommendations.filter((item) => item.recommendation_group_id === rowForm.groupId).length;
      const created = await createGuidelineRecommendation(user.id, { guideline_id: table.guideline_id, section_id: table.section_id, recommendation_table_id: table.id, recommendation_group_id: group?.virtual ? null : rowForm.groupId || null, title: rowForm.title.trim(), recommendation_text_original: rowForm.text.trim(), recommendation_text_vi: "", rationale_vi: "", recommendation_class: rowForm.recommendation_class.trim(), evidence_level: rowForm.evidence_level.trim(), evidence_system: "", population: "", intervention: "", comparator: "", outcome: "", conditions: "", contraindications: "", source_page: rowForm.source_page ? Number(rowForm.source_page) : (group?.source_page ?? table.source_page ?? null), source_quote: "", source_anchor: "", verification_status: "unverified", review_note: "", sort_order: order });
      onAddRecommendation(created); setRowForm({ groupId: "", title: "", text: "", recommendation_class: "", evidence_level: "", source_page: "" }); setNotice({ type: "success", text: "Đã thêm Khuyến cáo vào bảng." });
    } catch (error) { setNotice({ type: "error", text: message(error) }); }
    finally { setSaving(false); }
  }
  async function markComplete() { try { const updated = await updateGuidelineRecommendationTable(table.id, { is_complete: true }); onTableUpdate(updated); setNotice({ type: "success", text: "Đã đánh dấu bảng đã hoàn chỉnh sau khi kiểm tra nguồn." }); } catch (error) { setNotice({ type: "error", text: message(error) }); } }
  async function publishTable() {
    const draft = recommendations.filter((item) => item.status === "draft").length;
    const published = recommendations.filter((item) => item.status === "published").length;
    if (!window.confirm(`Bảng này có ${draft} khuyến cáo bản nháp và ${published} đã xuất bản. Chỉ khuyến cáo hợp lệ mới được xuất bản.`)) return;
    try {
      const result = await publishRecommendationTableEligibleContent(table.id, user.id);
      onBulkPublished();
      setNotice({ type: result.blocked.length ? "info" : "success", text: `Đã xuất bản ${result.publishedRecommendationIds.length} khuyến cáo trong bảng.`, details: result.blocked.flatMap((item) => item.reasons.map((reason) => `${item.title}: ${reason}`)) });
    } catch (error) { setNotice({ type: "error", text: message(error) }); }
  }
  async function archiveTable() {
    if (!window.confirm("Lưu trữ Bảng khuyến cáo này? Các khuyến cáo giữ nguyên dữ liệu nhưng sẽ không còn công khai.")) return;
    try {
      const updated = await updateGuidelineRecommendationTable(table.id, { status: "archived" });
      onTableUpdate(updated);
      setNotice({ type: "success", text: "Đã lưu trữ Bảng khuyến cáo." });
    } catch (error) { setNotice({ type: "error", text: message(error) }); }
  }
  async function publishGroup(group: VirtualGroup, rows: GuidelineRecommendationRecord[]) {
    if (group.virtual) { setNotice({ type: "info", text: "Mục khuyến cáo legacy chưa có định danh nhóm độc lập. Hãy tạo Mục khuyến cáo mới trước khi xuất bản theo phạm vi nhóm." }); return; }
    if (!window.confirm(`Xuất bản các khuyến cáo hợp lệ trong “${group.title_vi || group.source_heading}”? (${rows.length} khuyến cáo)`)) return;
    try {
      const result = await publishRecommendationGroupEligibleContent(group.id, user.id);
      onBulkPublished();
      setNotice({ type: result.blocked.length ? "info" : "success", text: `Đã xuất bản ${result.publishedRecommendationIds.length} khuyến cáo trong Mục khuyến cáo.`, details: result.blocked.flatMap((item) => item.reasons.map((reason) => `${item.title}: ${reason}`)) });
    } catch (error) { setNotice({ type: "error", text: message(error) }); }
  }
  const pageRange = table.source_page_start || table.source_page ? `${table.source_page_start ?? table.source_page}${table.source_page_end && table.source_page_end !== table.source_page_start ? `–${table.source_page_end}` : ""}` : "Chưa có trang nguồn";
  return <article className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm"><button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-violet-50/40"><div className="flex min-w-0 gap-3"><span className="rounded-xl bg-violet-50 p-2 text-violet-700"><FileText size={18} /></span><div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[.12em] text-violet-700">Bảng khuyến cáo {tableLabel(table)}</p><h3 className="mt-1 text-base font-extrabold text-slate-900">{table.title_vi || table.title || "Chưa có tiêu đề"}</h3><p className="mt-1 text-xs font-semibold text-slate-500">Nguồn: {table.title || table.title_vi}</p><p className="mt-2 text-xs font-semibold text-slate-600">{section ? `Nguồn: Mục ${sourceSection(section)} · ` : ""}Trang {pageRange}</p></div></div><div className="flex shrink-0 items-center gap-2"><span className="hidden rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 sm:block">{groups.length} mục · {recommendations.length} khuyến cáo</span><span className="rounded-full bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-700">{statusLabel(table.status)}</span>{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div></button>
    {open && <div className="border-t border-slate-100 p-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void markComplete()} className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-extrabold text-teal-800">{table.is_complete ? "Bảng đã hoàn chỉnh" : "Đánh dấu đã hoàn chỉnh"}</button><button type="button" onClick={() => void publishTable()} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-extrabold text-white">Xuất bản toàn bộ bảng</button><button type="button" onClick={() => void archiveTable()} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-extrabold text-rose-700">Lưu trữ bảng</button></div>
      <div className="mt-4 space-y-3">{groups.map((group) => { const rows = recommendations.filter((item) => group.virtual ? !item.recommendation_group_id && Math.floor((item.sort_order % 1_000_000) / 1_000) === group.group_order : item.recommendation_group_id === group.id); return <section key={group.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">Mục khuyến cáo {group.group_order + 1}{group.virtual ? " · cần phân loại" : ""}</p><h4 className="mt-1 text-sm font-extrabold text-slate-800">{group.title_vi || group.source_heading}</h4>{group.source_heading && group.title_vi && group.source_heading !== group.title_vi && <p className="mt-1 text-xs font-semibold text-slate-500">{group.source_heading}</p>}</div><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-500">{rows.length} khuyến cáo</span><button type="button" onClick={() => void publishGroup(group, rows)} className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-[11px] font-extrabold text-violet-700">Xuất bản mục</button></div></div><div className="mt-3 space-y-2">{rows.map((row) => <button key={row.id} type="button" onClick={() => onOpenRecommendation(row.id)} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-violet-300"><div className="flex flex-wrap items-start justify-between gap-2"><span className="font-extrabold text-slate-800">{row.title || row.recommendation_text_vi || row.recommendation_text_original || "Khuyến cáo chưa có nội dung"}</span><span className="flex gap-1 text-[11px] font-bold"><span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">Class: {row.recommendation_class || "-"}</span><span className="rounded bg-teal-50 px-1.5 py-0.5 text-teal-700">LoE: {row.evidence_level || "-"}</span></span></div><p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{row.recommendation_text_vi || row.recommendation_text_original || "Chưa có nội dung"}</p><p className="mt-1 text-[11px] font-semibold text-slate-400">Trang nguồn: {row.source_page ?? "chưa có"}</p></button>)}{rows.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-xs font-semibold text-slate-500">Chưa có Khuyến cáo trong mục này.</p>}</div></section>; })}</div>
      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-2"><div><p className="text-sm font-extrabold text-slate-800">Thêm Mục khuyến cáo</p><div className="mt-2 grid gap-2"><input value={groupForm.source_heading} onChange={(event) => setGroupForm({ ...groupForm, source_heading: event.target.value })} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold" placeholder="Tiêu đề nguồn" /><input value={groupForm.title_vi} onChange={(event) => setGroupForm({ ...groupForm, title_vi: event.target.value })} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold" placeholder="Tiêu đề tiếng Việt" /><input value={groupForm.source_page} onChange={(event) => setGroupForm({ ...groupForm, source_page: event.target.value })} type="number" className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold" placeholder="Trang nguồn" /><button type="button" disabled={saving} onClick={() => void addGroup()} className="w-fit rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-extrabold text-violet-700"><Plus size={14} className="mr-1 inline" />Thêm mục khuyến cáo</button></div></div><div><p className="text-sm font-extrabold text-slate-800">Thêm Khuyến cáo</p><div className="mt-2 grid gap-2"><SharedSelect value={rowForm.groupId} onValueChange={(groupId) => setRowForm({ ...rowForm, groupId })} ariaLabel="Mục khuyến cáo sở hữu" options={[{ value: "", label: "Chọn Mục khuyến cáo" }, ...groups.map((group) => ({ value: group.id, label: group.title_vi || group.source_heading }))]} /><input value={rowForm.title} onChange={(event) => setRowForm({ ...rowForm, title: event.target.value })} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold" placeholder="Tiêu đề (tùy chọn)" /><textarea value={rowForm.text} onChange={(event) => setRowForm({ ...rowForm, text: event.target.value })} className="min-h-20 rounded-lg border border-slate-200 p-3 text-xs font-semibold" placeholder="Nội dung khuyến cáo nguồn" /><div className="grid grid-cols-2 gap-2"><input value={rowForm.recommendation_class} onChange={(event) => setRowForm({ ...rowForm, recommendation_class: event.target.value })} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold" placeholder="Class" /><input value={rowForm.evidence_level} onChange={(event) => setRowForm({ ...rowForm, evidence_level: event.target.value })} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold" placeholder="Level of Evidence" /></div><button type="button" disabled={saving} onClick={() => void addRow()} className="w-fit rounded-lg bg-violet-600 px-3 py-2 text-xs font-extrabold text-white"><Save size={14} className="mr-1 inline" />Lưu khuyến cáo</button></div></div></div>
    </div>}</article>;
}
