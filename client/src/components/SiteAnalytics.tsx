import { useEffect, useState } from "react";
import { Activity, Clock3, Eye, MoreHorizontal, Users, X } from "lucide-react";
import {
  getSiteAnalytics,
  getSiteAnalyticsDetails,
  getVisitorKey,
  recordSiteVisit,
  type SiteAnalyticsDetails,
  type SiteAnalyticsSummary,
} from "../services/analytics";
import { supabase } from "../services/supabase";

interface SiteAnalyticsProps {
  userId?: string | null;
  visible: boolean;
}

interface OnlineVisitor {
  visitorKey: string;
  onlineAt: string;
}

type DetailPanel = "visits" | "visitors" | "online";

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

export default function SiteAnalytics({ userId, visible }: SiteAnalyticsProps) {
  const [summary, setSummary] = useState<SiteAnalyticsSummary>({ totalVisits: 0, uniqueVisitors: 0 });
  const [details, setDetails] = useState<SiteAnalyticsDetails>({ visitors: [], visits: [] });
  const [onlineVisitors, setOnlineVisitors] = useState<OnlineVisitor[]>([]);
  const [activePanel, setActivePanel] = useState<DetailPanel | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    // Give Supabase a brief moment to restore an existing session so a signed
    // in visit is not counted once as a guest and again as a member.
    const timer = window.setTimeout(() => {
      void recordSiteVisit(userId).catch((error) => {
        console.warn("Site visit analytics are not configured yet", error);
      });
    }, userId ? 0 : 1_200);
    return () => window.clearTimeout(timer);
  }, [userId]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const visitorKey = getVisitorKey(userId);
    const channel = client.channel("site-presence", {
      config: { presence: { key: visitorKey } },
    });

    const updateOnlineVisitors = () => {
      const uniqueVisitors = new Map<string, OnlineVisitor>();
      Object.values(channel.presenceState()).forEach((entries) => {
        entries.forEach((entry) => {
          const presence = entry as { visitor_key?: unknown; online_at?: unknown };
          if (typeof presence.visitor_key !== "string") return;
          const next: OnlineVisitor = {
            visitorKey: presence.visitor_key,
            onlineAt: typeof presence.online_at === "string" ? presence.online_at : new Date().toISOString(),
          };
          const previous = uniqueVisitors.get(next.visitorKey);
          if (!previous || new Date(next.onlineAt).getTime() < new Date(previous.onlineAt).getTime()) {
            uniqueVisitors.set(next.visitorKey, next);
          }
        });
      });
      setOnlineVisitors([...uniqueVisitors.values()].sort((a, b) => a.onlineAt.localeCompare(b.onlineAt)));
    };

    channel
      .on("presence", { event: "sync" }, updateOnlineVisitors)
      .on("presence", { event: "join" }, updateOnlineVisitors)
      .on("presence", { event: "leave" }, updateOnlineVisitors)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Presence payload intentionally excludes email. Only the protected
          // analytics RPC below resolves visitor keys to account labels.
          await channel.track({ visitor_key: visitorKey, online_at: new Date().toISOString() });
          updateOnlineVisitors();
        }
      });

    const timer = window.setInterval(updateOnlineVisitors, 10_000);
    return () => {
      window.clearInterval(timer);
      void channel.untrack();
      void client.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const refresh = async () => {
      try {
        const [nextSummary, nextDetails] = await Promise.all([getSiteAnalytics(), getSiteAnalyticsDetails()]);
        if (active) {
          setSummary(nextSummary);
          setDetails(nextDetails);
          setUnavailable(false);
        }
      } catch (error) {
        console.warn("Site analytics are not available", error);
        if (active) setUnavailable(true);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [visible]);

  if (!visible) return null;

  const metrics: Array<{ id: DetailPanel; label: string; value: number; icon: typeof Eye; color: string; background: string }> = [
    { id: "visits", label: "Tổng lượt truy cập", value: summary.totalVisits, icon: Eye, color: "text-rose-500", background: "bg-rose-100/80" },
    { id: "visitors", label: "Số người truy cập", value: summary.uniqueVisitors, icon: Users, color: "text-violet-500", background: "bg-violet-100/80" },
    { id: "online", label: "Đang trực tuyến", value: onlineVisitors.length, icon: Activity, color: "text-teal-500", background: "bg-teal-100/80" },
  ];

  const panelTitle = activePanel === "visits" ? "Lịch sử lượt truy cập" : activePanel === "visitors" ? "Danh sách người truy cập" : "Người đang trực tuyến";
  const onlineLabel = (visitorKey: string) => details.visitors.find((visitor) => visitor.visitorKey === visitorKey)?.label
    ?? (visitorKey.startsWith("guest:") ? `Khách • ${visitorKey.slice(-4).toUpperCase()}` : "Thành viên");

  return (
    <section className="site-analytics glass-panel mx-auto mb-6 max-w-5xl rounded-3xl border border-white/70 bg-white/55 p-4 shadow-sm sm:p-5" aria-label="Thống kê truy cập">
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-500">Bảng điều khiển riêng</p>
          <h2 className="mt-1 text-lg font-bold text-rose-950">Thống kê trang web</h2>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-teal-100 bg-white/75 px-3 py-1.5 text-xs font-semibold text-teal-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal-400" /> Trực tiếp · 10s
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map(({ id, label, value, icon: Icon, color, background }) => (
          <article key={id} className={`relative rounded-2xl border bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_8px_24px_rgba(148,163,184,.1)] backdrop-blur-xl transition ${activePanel === id ? "border-teal-200 ring-2 ring-teal-100" : "border-white/80"}`}>
            <button type="button" onClick={() => setActivePanel((current) => current === id ? null : id)} aria-label={`Xem ${label.toLowerCase()}`} title={`Xem ${label.toLowerCase()}`} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-teal-600"><MoreHorizontal size={19} /></button>
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${background}`}><Icon className={`h-5 w-5 ${color}`} /></div>
            <p className="text-2xl font-extrabold tabular-nums text-slate-800">{unavailable && id !== "online" ? "—" : value.toLocaleString("vi-VN")}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
          </article>
        ))}
      </div>

      {activePanel && <div className="mt-4 overflow-hidden rounded-2xl border border-teal-100 bg-white/80 shadow-[0_12px_35px_rgba(15,118,110,.1)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-teal-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock3 size={17} className="text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">{panelTitle}</h3>
          </div>
          <button type="button" onClick={() => setActivePanel(null)} aria-label="Đóng danh sách" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X size={17} /></button>
        </div>

        <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto px-2 py-1">
          {activePanel === "visits" && details.visits.map((visit) => <div key={visit.id} className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 hover:bg-rose-50/50"><span className="min-w-0 truncate text-sm font-semibold text-slate-700">{visit.label}</span><time className="shrink-0 text-xs font-medium tabular-nums text-slate-400">{formatDateTime(visit.visitedAt)}</time></div>)}
          {activePanel === "visitors" && details.visitors.map((visitor) => <div key={visitor.visitorKey} className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 hover:bg-violet-50/50"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-700">{visitor.label}</p><p className="mt-0.5 text-[11px] text-slate-400">Lần gần nhất: {formatDateTime(visitor.lastVisitedAt)}</p></div><span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-600">{visitor.visitCount.toLocaleString("vi-VN")} lượt</span></div>)}
          {activePanel === "online" && onlineVisitors.map((visitor) => <div key={visitor.visitorKey} className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 hover:bg-teal-50/50"><span className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-slate-700"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-400 shadow-[0_0_0_4px_rgba(45,212,191,.12)]" />{onlineLabel(visitor.visitorKey)}</span><span className="shrink-0 text-xs font-medium text-slate-400">Từ {formatDateTime(visitor.onlineAt)}</span></div>)}
          {((activePanel === "visits" && details.visits.length === 0) || (activePanel === "visitors" && details.visitors.length === 0) || (activePanel === "online" && onlineVisitors.length === 0)) && <p className="px-3 py-8 text-center text-sm font-medium text-slate-400">Chưa có dữ liệu.</p>}
        </div>
      </div>}

      {unavailable && <p className="mt-3 px-1 text-xs text-amber-600">Chạy lại file SQL thống kê trong Supabase để bật danh sách chi tiết.</p>}
    </section>
  );
}
