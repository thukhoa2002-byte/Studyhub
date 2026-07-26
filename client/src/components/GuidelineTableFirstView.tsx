import { FileText, Link as LinkIcon } from "lucide-react";
import type { LanguageMode } from "../types/language";
import type { PublicGuidelineTableFirst, PublicRecommendationTable, PublicRecommendationTableGroup, PublicRecommendationTableRow, PublicStructuredTable } from "../services/guidelineTableFirstPublicAdapter";

interface Props {
  guideline: PublicGuidelineTableFirst;
  languageMode: LanguageMode;
  highlightedRecommendationId: string;
  onNavigateToTable: (table: PublicRecommendationTable) => void;
}

function localized(vi: string, original: string, mode: LanguageMode): string {
  if (mode === "en") return original;
  if (mode === "vi") return vi;
  return vi;
}

function isVisibleInLanguage(row: PublicRecommendationTableRow, mode: LanguageMode): boolean {
  return mode === "en" ? Boolean(row.textOriginal.trim()) : Boolean(row.textVi.trim());
}

function sourcePages(table: PublicRecommendationTable): string {
  if (!table.sourcePageStart) return "";
  return table.sourcePageEnd && table.sourcePageEnd !== table.sourcePageStart
    ? `Trang ${table.sourcePageStart}-${table.sourcePageEnd}`
    : `Trang ${table.sourcePageStart}`;
}

function classStyle(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  if (normalized === "i" || normalized === "classi") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (normalized === "iia" || normalized === "classiia") return "border-amber-200 bg-amber-50 text-amber-900";
  if (normalized === "iib" || normalized === "classiib") return "border-orange-200 bg-orange-50 text-orange-800";
  if (normalized === "iii" || normalized === "classiii") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function evidenceStyle(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  if (normalized === "a" || normalized === "loe a" || normalized === "loea") return "border-teal-300 bg-teal-800 text-white";
  if (normalized === "b" || normalized === "loe b" || normalized === "loeb") return "border-teal-200 bg-teal-100 text-teal-900";
  if (normalized === "c" || normalized === "loe c" || normalized === "loec") return "border-cyan-200 bg-cyan-50 text-cyan-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function RecommendationClassBadge({ value }: { value: string }) {
  const label = value.trim() || "Chưa xác định";
  return <span aria-label={`Class of Recommendation ${label}`} className={`inline-flex min-w-12 justify-center rounded-lg border px-2 py-1 text-xs font-extrabold ${classStyle(label)}`}>Class {label}</span>;
}

export function EvidenceLevelBadge({ value }: { value: string }) {
  const label = value.trim() || "Chưa xác định";
  return <span aria-label={`Level of Evidence ${label}`} className={`inline-flex min-w-12 justify-center rounded-lg border px-2 py-1 text-xs font-extrabold ${evidenceStyle(label)}`}>LoE {label}</span>;
}

function copyDeepLink(id: string) {
  const url = `${window.location.origin}${window.location.pathname}#recommendation-${id}`;
  void navigator.clipboard?.writeText(url);
}

export function RecommendationRow({ row, languageMode, highlighted }: { row: PublicRecommendationTableRow; languageMode: LanguageMode; highlighted: boolean }) {
  const primaryText = localized(row.textVi, row.textOriginal, languageMode);
  const secondaryText = languageMode === "bilingual" ? row.textOriginal : "";
  if (!isVisibleInLanguage(row, languageMode)) return null;
  return <tr id={`recommendation-${row.id}`} tabIndex={highlighted ? -1 : undefined} className={`scroll-mt-8 border-t border-slate-100 align-top ${highlighted ? "recommendation--deep-link" : ""}`}>
    <td className="px-4 py-4 text-sm leading-6 text-slate-700">
      {row.title && <p className="mb-1 font-extrabold text-slate-800">{row.title}</p>}
      <p>{primaryText}</p>
      {secondaryText && <p className="mt-2 border-l-2 border-slate-200 pl-3 text-xs leading-5 text-slate-500">{secondaryText}</p>}
      {(row.population || row.context || row.sourcePage) && <p className="mt-2 text-xs text-slate-500">{[row.population, row.context, row.sourcePage ? `Trang ${row.sourcePage}` : ""].filter(Boolean).join(" · ")}</p>}
    </td>
    <td className="w-24 px-3 py-4 text-center"><RecommendationClassBadge value={row.recommendationClass} /></td>
    <td className="w-24 px-3 py-4 text-center"><EvidenceLevelBadge value={row.evidenceLevel} /></td>
    <td className="w-10 px-3 py-4 text-right"><button type="button" title="Sao chép liên kết khuyến cáo" aria-label="Sao chép liên kết khuyến cáo" onClick={() => copyDeepLink(row.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-700"><LinkIcon size={16} /></button></td>
  </tr>;
}

function MobileRecommendationRow({ row, languageMode, highlighted }: { row: PublicRecommendationTableRow; languageMode: LanguageMode; highlighted: boolean }) {
  const primaryText = localized(row.textVi, row.textOriginal, languageMode);
  const secondaryText = languageMode === "bilingual" ? row.textOriginal : "";
  if (!isVisibleInLanguage(row, languageMode)) return null;
  return <article id={`recommendation-mobile-${row.id}`} className={`scroll-mt-8 border-t border-slate-100 px-4 py-4 ${highlighted ? "recommendation--deep-link" : ""}`}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm leading-6 text-slate-700">{primaryText}</p>{secondaryText && <p className="mt-2 border-l-2 border-slate-200 pl-3 text-xs leading-5 text-slate-500">{secondaryText}</p>}</div><button type="button" title="Sao chép liên kết khuyến cáo" aria-label="Sao chép liên kết khuyến cáo" onClick={() => copyDeepLink(row.id)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-700"><LinkIcon size={16} /></button></div>
    <div className="mt-3 flex flex-wrap gap-2"><RecommendationClassBadge value={row.recommendationClass} /><EvidenceLevelBadge value={row.evidenceLevel} /></div>
    {(row.population || row.context || row.sourcePage) && <p className="mt-3 text-xs text-slate-500">{[row.population, row.context, row.sourcePage ? `Trang ${row.sourcePage}` : ""].filter(Boolean).join(" · ")}</p>}
  </article>;
}

export function RecommendationGroupBlock({ group, languageMode, highlightedRecommendationId }: { group: PublicRecommendationTableGroup; languageMode: LanguageMode; highlightedRecommendationId: string }) {
  const visibleRows = group.rows.filter((row) => isVisibleInLanguage(row, languageMode));
  if (!visibleRows.length) return null;
  const heading = localized(group.titleVi, group.sourceHeading, languageMode);
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    {heading && <header className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="text-sm font-extrabold text-slate-800">{heading}</h3>{languageMode === "bilingual" && group.sourceHeading && group.titleVi && <p className="mt-1 text-xs text-slate-500">{group.sourceHeading}</p>}</header>}
    <div className="hidden md:block overflow-x-auto"><table className="w-full border-collapse" aria-label={heading || "Khuyến cáo"}><thead className="bg-white text-left text-xs font-extrabold uppercase tracking-[.08em] text-slate-500"><tr><th className="px-4 py-3">Khuyến cáo</th><th className="w-24 px-3 py-3 text-center">Class</th><th className="w-24 px-3 py-3 text-center">LoE</th><th className="w-10 px-3 py-3"><span className="sr-only">Liên kết</span></th></tr></thead><tbody>{visibleRows.map((row) => <RecommendationRow key={row.id} row={row} languageMode={languageMode} highlighted={row.id === highlightedRecommendationId} />)}</tbody></table></div>
    <div className="md:hidden">{visibleRows.map((row) => <MobileRecommendationRow key={row.id} row={row} languageMode={languageMode} highlighted={row.id === highlightedRecommendationId} />)}</div>
  </section>;
}

export function RecommendationTableHeader({ table, languageMode }: { table: PublicRecommendationTable; languageMode: LanguageMode }) {
  const title = localized(table.titleVi, table.sourceTitle, languageMode);
  const count = table.groups.reduce((total, group) => total + group.rows.filter((row) => isVisibleInLanguage(row, languageMode)).length, 0);
  return <header className="border-b border-violet-100 bg-violet-50/50 px-4 py-4 sm:px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[.13em] text-violet-600">Bảng khuyến cáo {table.tableNumber}</p><h2 className="mt-1 text-lg font-extrabold leading-7 text-slate-900">{title}</h2>{languageMode === "bilingual" && table.titleVi && table.sourceTitle && <p className="mt-1 text-sm text-slate-500">{table.sourceTitle}</p>}<p className="mt-2 text-xs text-slate-500">{sourcePages(table)}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm">{count} khuyến cáo</span></div>{table.description && <p className="mt-3 text-sm leading-6 text-slate-600">{table.description}</p>}</header>;
}

export function RecommendationTableRenderer({ table, languageMode, highlightedRecommendationId }: { table: PublicRecommendationTable; languageMode: LanguageMode; highlightedRecommendationId: string }) {
  const visibleGroups = table.groups.filter((group) => group.rows.some((row) => isVisibleInLanguage(row, languageMode)));
  if (!visibleGroups.length) return null;
  return <section id={`recommendation-table-${table.id}`} className="scroll-mt-5 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm"><RecommendationTableHeader table={table} languageMode={languageMode} /><div className="space-y-4 p-3 sm:p-4">{visibleGroups.map((group) => <RecommendationGroupBlock key={group.id} group={group} languageMode={languageMode} highlightedRecommendationId={highlightedRecommendationId} />)}</div><footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500"><FileText size={14} />{[sourcePages(table), table.sourceTableNumber ? `Nguồn: ${table.sourceTableNumber}` : ""].filter(Boolean).join(" · ")}</footer></section>;
}

export function StructuredTableRenderer({ table, languageMode }: { table: PublicStructuredTable; languageMode: LanguageMode }) {
  if (!table.headers.length || !table.rows.length) return null;
  const title = localized(table.titleVi, table.sourceTitle, languageMode);
  return <section id={`table-${table.id}`} className="scroll-mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-200 bg-slate-50 px-4 py-4"><p className="text-xs font-extrabold uppercase tracking-[.13em] text-slate-500">Bảng lâm sàng {table.tableNumber}</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">{title}</h2></header><div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead className="bg-white text-left text-xs font-extrabold uppercase tracking-[.08em] text-slate-500"><tr>{table.headers.map((header) => <th key={header} scope="col" className="border-b border-slate-200 px-4 py-3">{header}</th>)}</tr></thead><tbody>{table.rows.map((row, rowIndex) => <tr key={`${table.id}-${rowIndex}`} className="border-b border-slate-100 last:border-0">{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`} className="px-4 py-3 leading-6 text-slate-700">{cell}</td>)}</tr>)}</tbody></table></div>{(table.sourcePageStart || table.footnotes.length > 0) && <footer className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">{[table.sourcePageStart ? `Trang ${table.sourcePageStart}${table.sourcePageEnd && table.sourcePageEnd !== table.sourcePageStart ? `-${table.sourcePageEnd}` : ""}` : "", ...table.footnotes].filter(Boolean).join(" · ")}</footer>}</section>;
}

export function GuidelineResourceNavigation({ guideline, languageMode, onNavigateToTable }: Pick<Props, "guideline" | "languageMode" | "onNavigateToTable">) {
  const visibleTables = guideline.recommendationTables.filter((table) => table.groups.some((group) => group.rows.some((row) => isVisibleInLanguage(row, languageMode))));
  return <aside className="h-fit rounded-2xl border border-slate-200 bg-white/80 p-3 lg:sticky lg:top-4"><p className="px-2 pb-2 text-xs font-extrabold uppercase tracking-[.12em] text-slate-400">Bảng khuyến cáo</p><nav className="grid gap-1">{visibleTables.map((table) => <button key={table.id} type="button" onClick={() => onNavigateToTable(table)} className="rounded-xl px-2 py-2 text-left text-sm font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-700"><span className="block text-xs font-extrabold text-violet-600">Bảng {table.tableNumber}</span><span className="mt-0.5 block line-clamp-2">{localized(table.titleVi, table.sourceTitle, languageMode)}</span></button>)}</nav>{guideline.structuredTables.length > 0 && <><p className="px-2 pb-2 pt-5 text-xs font-extrabold uppercase tracking-[.12em] text-slate-400">Bảng lâm sàng</p><nav className="grid gap-1">{guideline.structuredTables.map((table) => <a key={table.id} href={`#table-${table.id}`} className="rounded-xl px-2 py-2 text-left text-sm font-bold text-slate-600 hover:bg-slate-100">{table.titleVi || table.sourceTitle}</a>)}</nav></>}</aside>;
}

export function GuidelineResourceEmptyState() {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center"><FileText className="mx-auto text-slate-400" size={28} /><h2 className="mt-3 font-extrabold text-slate-700">Chưa có bảng khuyến cáo công khai</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Nội dung chỉ được hiển thị khi Bảng khuyến cáo hoàn chỉnh, các hàng đã xác minh và đã xuất bản.</p></div>;
}

export default function GuidelineTableFirstView({ guideline, languageMode, highlightedRecommendationId, onNavigateToTable }: Props) {
  const visibleTables = guideline.recommendationTables.filter((table) => table.groups.some((group) => group.rows.some((row) => isVisibleInLanguage(row, languageMode))));
  return <div className="mt-5 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]"><GuidelineResourceNavigation guideline={guideline} languageMode={languageMode} onNavigateToTable={onNavigateToTable} /><div className="min-w-0 space-y-5">{visibleTables.map((table) => <RecommendationTableRenderer key={table.id} table={table} languageMode={languageMode} highlightedRecommendationId={highlightedRecommendationId} />)}{guideline.structuredTables.map((table) => <StructuredTableRenderer key={table.id} table={table} languageMode={languageMode} />)}{visibleTables.length === 0 && guideline.structuredTables.length === 0 && <GuidelineResourceEmptyState />}</div></div>;
}
