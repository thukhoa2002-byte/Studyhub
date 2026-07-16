import { useState, type FormEvent } from "react";
import { Activity, Ban, ExternalLink, FlaskConical, LoaderCircle, Pill, Search, ShieldAlert, Syringe } from "lucide-react";

import { searchDrug, type DrugLookupResult, type DrugSummarySections } from "../services/api";

const sections: Array<{ key: keyof DrugSummarySections; title: string; icon: typeof Activity; tone: string }> = [
  { key: "indications", title: "Chỉ định", icon: Activity, tone: "from-teal-50 to-white text-teal-700" },
  { key: "contraindications", title: "Chống chỉ định", icon: Ban, tone: "from-rose-50 to-white text-rose-700" },
  { key: "dosage", title: "Liều dùng", icon: Syringe, tone: "from-sky-50 to-white text-sky-700" },
  { key: "mechanism", title: "Cơ chế tác dụng", icon: FlaskConical, tone: "from-violet-50 to-white text-violet-700" },
  { key: "liverKidney", title: "Chuyển hoá qua gan · thận", icon: ShieldAlert, tone: "from-amber-50 to-white text-amber-700" },
];

function formatLabelDate(value: string) {
  if (!/^\d{8}$/.test(value)) return "";
  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
}

export default function DrugsPage() {
  const [query, setQuery] = useState("");
  const [drug, setDrug] = useState<DrugLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) return;
    setLoading(true);
    setError("");
    try {
      setDrug(await searchDrug(normalized));
    } catch (lookupError) {
      setDrug(null);
      setError(lookupError instanceof Error ? lookupError.message : "Không thể tra cứu thuốc.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mode-panel mx-auto w-full max-w-5xl px-5 py-8" aria-labelledby="drugs-title">
      <div className="glass-panel overflow-visible border border-rose-100/80 bg-white/68 p-7 sm:p-10">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-teal-100 text-rose-600 shadow-sm">
              <Pill size={32} strokeWidth={1.9} />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-teal-600">Góc dược lý</p>
              <h1 id="drugs-title" className="mt-1 text-3xl font-extrabold tracking-tight text-rose-950">Drugs</h1>
              <p className="mt-1 text-sm text-slate-500">Tra nhanh 5 thông tin cốt lõi từ nhãn thuốc chính thức.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex w-full gap-2 lg:max-w-md">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-rose-100 bg-white/80 px-4 py-3 text-sm shadow-sm focus-within:border-rose-300">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-slate-800 placeholder:text-slate-400" placeholder="Tên hoạt chất, ví dụ: amoxicillin" aria-label="Tên thuốc" />
            </label>
            <button disabled={loading || query.trim().length < 2} className="inline-flex min-w-24 items-center justify-center gap-2 rounded-2xl bg-teal-500 px-5 font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50" type="submit">
              {loading ? <LoaderCircle size={18} className="animate-spin" /> : <Search size={18} />}
              Tìm
            </button>
          </form>
        </div>

        {error ? (
          <div role="alert" className="mt-7 rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
        ) : null}

        {!drug && !error ? (
          <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-teal-200 bg-gradient-to-br from-teal-50/65 via-white/55 to-rose-50/65 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm"><Pill size={28} /></div>
            <h2 className="mt-4 text-lg font-bold text-rose-950">Tìm theo tên hoạt chất</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">Kết quả chỉ gồm: chỉ định, chống chỉ định, liều, cơ chế tác dụng và chuyển hoá qua gan · thận.</p>
          </div>
        ) : null}

        {drug ? (
          <div className="mt-8">
            <div className="rounded-3xl border border-teal-100 bg-white/72 p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-teal-600">Hoạt chất</p>
                  <h2 className="mt-1 text-2xl font-extrabold text-rose-950">{drug.genericName}</h2>
                  {drug.brandName ? <p className="mt-1 text-sm text-slate-500">Biệt dược trên nhãn: {drug.brandName}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    {drug.route.map((route) => <span key={route} className="rounded-full bg-teal-50 px-3 py-1 font-semibold">{route}</span>)}
                    {drug.manufacturer ? <span className="rounded-full bg-rose-50 px-3 py-1 font-semibold">{drug.manufacturer}</span> : null}
                  </div>
                </div>
                <a className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-rose-100 bg-white px-4 py-2 text-sm font-bold text-rose-700 shadow-sm hover:border-rose-300" href={drug.sourceUrl} target="_blank" rel="noreferrer">
                  Nhãn gốc <ExternalLink size={15} />
                </a>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {sections.map(({ key, title, icon: Icon, tone }, index) => (
                <article key={key} className={`glass-card border border-white/80 bg-gradient-to-br ${tone} p-5 ${index === sections.length - 1 ? "md:col-span-2" : ""}`}>
                  <h3 className="flex items-center gap-2 text-base font-extrabold"><Icon size={19} />{title}</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    {drug.summary[key].map((item, itemIndex) => <li key={`${key}-${itemIndex}`} className="flex gap-2"><span aria-hidden="true" className="mt-[0.65rem] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-55" /><span>{item}</span></li>)}
                  </ul>
                </article>
              ))}
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-slate-400">Nguồn: nhãn thuốc DailyMed/openFDA{formatLabelDate(drug.effectiveTime) ? ` · Cập nhật ${formatLabelDate(drug.effectiveTime)}` : ""}. Bản dịch phục vụ ôn tập; luôn đối chiếu hướng dẫn điều trị và nhãn thuốc đang lưu hành tại Việt Nam.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
