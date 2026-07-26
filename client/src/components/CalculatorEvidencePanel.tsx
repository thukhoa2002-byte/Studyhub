import { ExternalLink, ShieldCheck, ShieldX } from "lucide-react";
import { calculatorEvidenceFor, isEvidencePublishable, publicEvidenceSummary } from "../modules/calculators/evidenceRegistry";
import type { CalculatorImplementation } from "../modules/calculators/platformTypes";

type Props = { implementation: CalculatorImplementation | null | undefined; mode?: "public" | "admin" };

export default function CalculatorEvidencePanel({ implementation, mode = "public" }: Props) {
  if (!implementation) return null;
  const profile = implementation.evidence || calculatorEvidenceFor(implementation);
  const blockers = isEvidencePublishable(profile);
  const summary = publicEvidenceSummary(profile);

  if (mode === "public") {
    if (!summary) return <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Nguồn công thức đang chờ xác minh.</section>;
    return <section className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] p-4" aria-label="Nguồn công thức">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-teal-600" size={19} /><div className="min-w-0"><h2 className="font-extrabold text-slate-800">Nguồn công thức</h2><p className="mt-1 text-sm font-semibold text-slate-600">{implementation.formulaName}{implementation.formulaYear ? ` · ${implementation.formulaYear}` : ""}{summary.sourceVersion ? ` · ${summary.sourceVersion}` : ""}</p><p className="mt-2 text-sm leading-6 text-slate-600">{summary.citation}</p>{summary.organization && <p className="mt-1 text-xs font-bold text-slate-500">{summary.organization}</p>}{summary.lastVerifiedAt && <p className="mt-2 text-xs font-semibold text-slate-500">Xác minh lần cuối: {summary.lastVerifiedAt}</p>}<details className="mt-3 text-sm"><summary className="cursor-pointer font-bold text-[var(--text-link)]">Xem nguồn và nghiên cứu liên quan</summary><ul className="mt-2 grid gap-2">{profile.records.map((item) => <li key={item.evidenceId} className="rounded-lg bg-white px-3 py-2"><strong className="block text-slate-700">{item.citationText}</strong>{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[var(--text-link)]">Mở nguồn công khai <ExternalLink size={12} /></a>}</li>)}</ul></details></div></div>
    </section>;
  }

  return <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4" aria-label="Evidence của method">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold text-slate-800">Evidence &amp; xác minh method</h3><p className="mt-1 text-xs font-semibold text-slate-500">Nguồn công thức được khóa theo implementation trong code registry.</p></div>{blockers.length === 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-extrabold text-teal-800"><ShieldCheck size={14} />Đủ điều kiện evidence</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-800"><ShieldX size={14} />Chưa đủ evidence</span>}</div>
    <div className="mt-3 grid gap-2">{profile.records.length > 0 ? profile.records.map((item) => <article key={item.evidenceId} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{item.role}</p><p className="mt-1 text-sm font-bold text-slate-700">{item.citationText}</p><p className="mt-1 text-xs font-semibold text-slate-500">Claims: {item.supportedClaims.join(", ")}</p></article>) : <p className="text-sm font-semibold text-amber-800">Chưa có evidence record được khóa cho method này.</p>}</div>
    <p className="mt-3 text-xs font-semibold text-slate-600">Reference fixtures: {profile.fixtures.filter((item) => item.fixtureKind === "clinical_reference").length} · Xác minh: {profile.verification.lastVerifiedAt || "chưa có"}</p>
    {blockers.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-semibold text-amber-800">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
  </section>;
}
