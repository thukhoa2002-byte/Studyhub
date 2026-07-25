import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, BookOpenCheck, ExternalLink, Search, ShieldAlert } from "lucide-react";
import type { DataRoute } from "../utils/dataRoutes";
import { guidelinePath } from "../utils/dataRoutes";
import { findPublishedCoreGuidelineBySlug, listPublishedGuidelinePreviews, loadPublishedCoreGuidelines, type PublicGuidelinePreview } from "../services/guidelineCorePublicService";
import type { Guideline, GuidelineRecommendation } from "../types/guideline";
import { listPublicCalculatorRecordsForGuideline } from "../services/calculatorDatabaseService";
import type { DatabaseCalculator } from "../modules/calculators/databaseTypes";
import { LanguageToggle, LocalizedTextView, useLanguageMode } from "../utils/language";
import type { LanguageMode } from "../types/language";
import ProtectedContentGate from "./ProtectedContentGate";
import SharedSelect from "./SharedSelect";
import { deepLinkScrollBehavior, resolveGuidelineDeepLink } from "../utils/recommendationDeepLink";

type GuidelineRoute = Extract<DataRoute, { tab: "guidelines"; kind: "guideline-list" | "guideline-detail" }>;

interface Props {
  user: User | null;
  route: GuidelineRoute;
  onNavigate: (path: string) => void;
  onManage?: () => void;
}

function statusLabel(status: Guideline["status"]): string {
  return status === "draft" ? "Bản nháp" : status === "reviewed" ? "Đã rà soát" : status === "published" ? "Đã công khai" : "Lưu trữ";
}

function RecommendationCard({ guideline, sectionId, recommendation, onNavigate, languageMode, highlighted }: { guideline: Guideline; sectionId: string; recommendation: GuidelineRecommendation; onNavigate: (path: string) => void; languageMode: LanguageMode; highlighted: boolean }) {
  return (
    <article id={`recommendation-${recommendation.id}`} tabIndex={highlighted ? -1 : undefined} aria-label={`Khuyến cáo: ${recommendation.title || "không có tiêu đề"}`} className={`scroll-mt-8 rounded-2xl border bg-white/85 p-4 shadow-sm ${highlighted ? "recommendation--deep-link" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-extrabold text-slate-800"><LocalizedTextView value={recommendation.localizedContent?.title || recommendation.title} mode={languageMode} /></h3>
          {recommendation.isPlaceholder && <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">Dữ liệu mẫu · bản nháp</span>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">Class: {recommendation.classOfRecommendation}</span>
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-700">Evidence: {recommendation.levelOfEvidence}</span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600"><LocalizedTextView value={recommendation.localizedContent?.content || recommendation.content} mode={languageMode} /></p>
      {(recommendation.population || recommendation.clinicalContext) && <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
        {recommendation.population && <p><strong className="text-slate-700">Đối tượng:</strong> {recommendation.population}</p>}
        {recommendation.clinicalContext && <p><strong className="text-slate-700">Bối cảnh:</strong> {recommendation.clinicalContext}</p>}
      </div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>{recommendation.source.page ? `Trang ${recommendation.source.page}` : "Nguồn trang sẽ được bổ sung"}</span>
        <button type="button" onClick={() => onNavigate(guidelinePath(guideline.slug, sectionId, recommendation.id))} className="font-bold text-violet-700 hover:text-violet-900">Mở liên kết trực tiếp</button>
      </div>
    </article>
  );
}

function GuidelineDetail({ guideline, route, onNavigate, languageMode, onLanguageChange, relatedCalculators }: { guideline: Guideline; route: Extract<GuidelineRoute, { kind: "guideline-detail" }>; onNavigate: (path: string) => void; languageMode: LanguageMode; onLanguageChange: (mode: LanguageMode) => void; relatedCalculators: DatabaseCalculator[] }) {
  const [highlightedRecommendationId, setHighlightedRecommendationId] = useState("");
  const deepLinkTarget = useMemo(() => resolveGuidelineDeepLink(
    guideline.sections.map((section) => ({ id: section.id, slug: section.slug, recommendations: section.recommendations.map((recommendation) => ({ id: recommendation.id })) })),
    route.sectionSlug,
    route.recommendationId,
  ), [guideline.sections, route.recommendationId, route.sectionSlug]);

  useEffect(() => {
    if (route.recommendationId) {
      if (!deepLinkTarget?.ok) { setHighlightedRecommendationId(""); return; }
      const element = document.getElementById(`recommendation-${deepLinkTarget.recommendationId}`);
      if (!element) return;
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      setHighlightedRecommendationId(deepLinkTarget.recommendationId);
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: "center", behavior: deepLinkScrollBehavior(reducedMotion) });
      const removeHighlight = window.setTimeout(() => setHighlightedRecommendationId((current) => current === deepLinkTarget.recommendationId ? "" : current), 3000);
      return () => window.clearTimeout(removeHighlight);
    }
    if (!route.sectionSlug) return;
    const section = guideline.sections.find((item) => item.id === route.sectionSlug || item.slug === route.sectionSlug);
    const element = section ? document.getElementById(`section-${section.id}`) : null;
    if (!element) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    element.scrollIntoView({ block: "start", behavior: deepLinkScrollBehavior(reducedMotion) });
  }, [deepLinkTarget, guideline.sections, route.recommendationId, route.sectionSlug]);

  const deepLinkError = route.recommendationId && deepLinkTarget && !deepLinkTarget.ok
    ? deepLinkTarget.reason === "section-unavailable" ? "Section của khuyến cáo không còn khả dụng."
      : deepLinkTarget.reason === "recommendation-section-mismatch" ? "Khuyến cáo không thuộc section trong liên kết này."
        : "Khuyến cáo này không còn công khai hoặc không tồn tại."
    : "";

  return <section className="mode-panel mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 xl:px-8" aria-labelledby="guideline-detail-title">
    <div className="glass-panel border border-violet-100 bg-white/75 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button type="button" onClick={() => onNavigate("/guidelines")} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-violet-700 hover:text-violet-900"><ArrowLeft size={16} />Danh sách guideline</button>
          <div className="flex items-start gap-3"><span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><BookOpenCheck size={23} /></span><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-violet-600">{guideline.organization} · {guideline.publicationYear} · {statusLabel(guideline.status)}</p><h1 id="guideline-detail-title" className="mt-1 text-2xl font-extrabold tracking-tight text-rose-950"><LocalizedTextView value={guideline.localizedContent?.title || { vi: guideline.titleVi, en: guideline.title }} mode={languageMode} /></h1></div></div>
        </div>
        <div className="flex flex-wrap items-start gap-2"><LanguageToggle value={languageMode} onChange={onLanguageChange} />{guideline.sourceUrl && <a href={guideline.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700"><ExternalLink size={16} />Nguồn gốc</a>}</div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white/80 p-3 lg:sticky lg:top-4"><p className="px-2 pb-2 text-xs font-extrabold uppercase tracking-[.12em] text-slate-400">Mục guideline</p><nav className="grid gap-1">{guideline.sections.slice().sort((a, b) => a.order - b.order).map((section) => <button key={section.id} type="button" onClick={() => onNavigate(guidelinePath(guideline.slug, section.id))} className="rounded-xl px-2 py-2 text-left text-sm font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-700"><LocalizedTextView value={section.localizedContent?.title || { vi: section.titleVi, en: section.title }} mode={languageMode} /></button>)}</nav></aside>
        <div className="min-w-0">
          {deepLinkError && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{deepLinkError}</p>}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800"><div className="flex items-start gap-2"><ShieldAlert className="mt-0.5 shrink-0" size={18} /><p><LocalizedTextView value={guideline.localizedContent?.summary || guideline.summary} mode={languageMode} /> Chưa hiển thị nhãn đã xác minh vì dữ liệu mẫu chưa có nguồn được đối chiếu.</p></div></div>
          {relatedCalculators.length > 0 && <section className="mt-4 rounded-2xl border border-teal-200 bg-teal-50/50 p-4"><h2 className="text-sm font-extrabold text-teal-800">Máy tính liên quan</h2><div className="mt-2 flex flex-wrap gap-2">{relatedCalculators.map((calculator) => <button key={calculator.id} type="button" onClick={() => onNavigate(`/may-tinh-y-khoa/${calculator.slug}`)} className="rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm font-bold text-teal-700">{calculator.name?.vi || calculator.name?.en || calculator.short_name}</button>)}</div></section>}
          <div className="mt-4 space-y-4">{guideline.sections.slice().sort((a, b) => a.order - b.order).map((section) => <section key={section.id} id={`section-${section.id}`} className="scroll-mt-5 rounded-2xl border border-slate-200 bg-white/75 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-violet-500">Mục {section.order}</p><h2 className="mt-1 text-lg font-extrabold text-slate-800"><LocalizedTextView value={section.localizedContent?.title || { vi: section.titleVi, en: section.title }} mode={languageMode} /></h2></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{section.recommendations.length} khuyến cáo</span></div><p className="mt-3 text-sm leading-6 text-slate-600"><LocalizedTextView value={section.localizedContent?.summary || section.summary} mode={languageMode} /></p>{section.recommendations.length > 0 && <div className="mt-4 space-y-3">{section.recommendations.map((recommendation) => <RecommendationCard key={recommendation.id} guideline={guideline} sectionId={section.id} recommendation={recommendation} onNavigate={onNavigate} languageMode={languageMode} highlighted={highlightedRecommendationId === recommendation.id} />)}</div>}</section>)}</div>
        </div>
      </div>
    </div>
  </section>;
}

type GuidelineListItem = Guideline | PublicGuidelinePreview;

function isFullGuideline(item: GuidelineListItem): item is Guideline {
  return "sections" in item;
}

function itemTitle(item: GuidelineListItem): string {
  return isFullGuideline(item) ? item.titleVi || item.title : item.title;
}

function itemTopics(item: GuidelineListItem): string[] {
  return Array.isArray(item.topics) ? Array.from(item.topics).filter((topic): topic is string => typeof topic === "string") : [];
}

export default function GuidelineDataPage({ user, route, onNavigate, onManage }: Props) {
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [organization, setOrganization] = useState("");
  const [year, setYear] = useState("");
  const [languageMode, setLanguageMode] = useLanguageMode();
  const [allGuidelines, setAllGuidelines] = useState<GuidelineListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [relatedCalculators, setRelatedCalculators] = useState<DatabaseCalculator[]>([]);
  useEffect(() => { let active = true; setLoading(true); const load = user ? loadPublishedCoreGuidelines() : listPublishedGuidelinePreviews(); void load.then((items) => { if (active) { setAllGuidelines(items); setLoadError(""); } }).catch((reason) => { if (active) setLoadError(reason instanceof Error ? reason.message : "Không thể tải Guideline."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [user]);
  const selectedGuideline = route.kind === "guideline-detail" && user ? findPublishedCoreGuidelineBySlug(allGuidelines.filter(isFullGuideline), route.slug) : undefined;
  useEffect(() => { let active = true; if (!selectedGuideline) { setRelatedCalculators([]); return () => { active = false; }; } void listPublicCalculatorRecordsForGuideline(selectedGuideline.id).then((items) => { if (active) setRelatedCalculators(items); }).catch(() => { if (active) setRelatedCalculators([]); }); return () => { active = false; }; }, [selectedGuideline]);
  const filtered = useMemo(() => allGuidelines.filter((guideline) => {
    const haystack = `${itemTitle(guideline)} ${guidelineTitle(guideline)} ${itemTopics(guideline).join(" ")}`.toLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLowerCase())) && (!specialty || guidelineCondition(guideline) === specialty) && (!organization || guidelineOrganization(guideline) === organization) && (!year || String(guidelineYear(guideline)) === year);
  }), [allGuidelines, organization, query, specialty, year]);
  const specialties = [...new Set(allGuidelines.map(guidelineCondition).filter(Boolean))];
  const organizations = [...new Set(allGuidelines.map(guidelineOrganization).filter(Boolean))];
  const years = [...new Set(allGuidelines.map(guidelineYear).filter((item) => item > 0))].sort((a, b) => b - a);

  if (loading) return <section className="mode-panel mx-auto w-full max-w-[1600px] px-4 py-8"><div className="glass-panel p-8 text-center text-sm font-semibold text-slate-500">Đang tải Guideline...</div></section>;
  if (loadError) return <section className="mode-panel mx-auto w-full max-w-[1600px] px-4 py-8"><div role="alert" className="glass-panel border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700">{loadError}</div></section>;
  if (route.kind === "guideline-detail") {
    if (!user) return <ProtectedContentGate />;
    if (!selectedGuideline) return <section className="mode-panel mx-auto w-full max-w-[1600px] px-4 py-8"><div className="glass-panel p-8 text-center"><h1 className="text-xl font-extrabold text-rose-950">Không tìm thấy guideline</h1><button type="button" onClick={() => onNavigate("/guidelines")} className="mt-4 font-bold text-violet-700">Quay về danh sách</button></div></section>;
    return <GuidelineDetail guideline={selectedGuideline} route={route} onNavigate={onNavigate} languageMode={languageMode} onLanguageChange={setLanguageMode} relatedCalculators={relatedCalculators} />;
  }

  return <section className="mode-panel mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 xl:px-8" aria-labelledby="guidelines-data-title">
    <div className="glass-panel border border-violet-100 bg-white/75 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.15em] text-violet-600">Kho dữ liệu</p><h1 id="guidelines-data-title" className="mt-1 text-2xl font-extrabold text-rose-950">Guideline</h1><p className="mt-1 text-sm text-slate-500">Tra cứu guideline theo chuyên khoa, tổ chức và khuyến cáo liên quan.</p></div><div className="flex flex-wrap items-center gap-2"><LanguageToggle value={languageMode} onChange={setLanguageMode} />{onManage && <button type="button" onClick={onManage} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">Quản lý tài liệu nguồn</button>}</div></div>
      <div className="mt-5 grid gap-2 lg:grid-cols-[1fr_180px_180px_140px]"><label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm guideline, chủ đề..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-violet-300" aria-label="Tìm guideline" /></label><SharedSelect value={specialty} onValueChange={setSpecialty} ariaLabel="Lọc chuyên khoa" options={[{ value: "", label: "Chuyên khoa" }, ...specialties.map((item) => ({ value: item, label: item }))]} searchable /><SharedSelect value={organization} onValueChange={setOrganization} ariaLabel="Lọc tổ chức" options={[{ value: "", label: "Tổ chức" }, ...organizations.map((item) => ({ value: item, label: item }))]} searchable /><SharedSelect value={year} onValueChange={setYear} ariaLabel="Lọc năm" options={[{ value: "", label: "Năm" }, ...years.map((item) => ({ value: String(item), label: String(item) }))]} /></div>
      <div className="mt-5 grid gap-3">{filtered.map((guideline) => <button key={guideline.id} type="button" onClick={() => onNavigate(guidelinePath(guidelineSlug(guideline)))} className="group rounded-2xl border border-slate-200 bg-white/85 p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold text-slate-800 group-hover:text-violet-700">{itemTitle(guideline)}</h2><span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">Đã công khai</span>{!user && <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">Cần đăng nhập để xem</span>}</div><p className="mt-1 text-sm font-semibold text-slate-500">{guidelineTitle(guideline)}</p><p className="mt-2 text-sm text-slate-600">{guidelineSummary(guideline) || "Guideline đã công khai · nội dung chi tiết yêu cầu đăng nhập."}</p></div><span className="shrink-0 text-sm font-extrabold text-violet-700">{guidelineOrganization(guideline)} · {guidelineYear(guideline) || "Chưa ghi năm"}</span></div><div className="mt-3 flex flex-wrap gap-1.5">{itemTopics(guideline).map((topic) => <span key={topic} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">{topic}</span>)}</div></button>)}{filtered.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Không có guideline phù hợp.</div>}</div>
    </div>
  </section>;
}

function guidelineTitle(item: GuidelineListItem): string { return isFullGuideline(item) ? item.title : item.title; }
function guidelineSummary(item: GuidelineListItem): string { return item.summary || ""; }
function guidelineCondition(item: GuidelineListItem): string { return isFullGuideline(item) ? item.specialty : item.condition; }
function guidelineOrganization(item: GuidelineListItem): string { return isFullGuideline(item) ? item.organization : item.society; }
function guidelineYear(item: GuidelineListItem): number { return isFullGuideline(item) ? item.publicationYear : item.publication_year || 0; }
function guidelineSlug(item: GuidelineListItem): string { return isFullGuideline(item) ? item.slug : slugForPreview(item); }
function slugForPreview(item: PublicGuidelinePreview): string {
  return `${item.society}-${item.title}-${item.publication_year ?? item.version_label}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || item.id;
}
