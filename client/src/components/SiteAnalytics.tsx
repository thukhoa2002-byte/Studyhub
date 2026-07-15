import { useEffect, useState } from "react";
import { Activity, Eye, Users } from "lucide-react";
import { getSiteAnalytics, getVisitorKey, recordSiteVisit, type SiteAnalyticsSummary } from "../services/analytics";
import { supabase } from "../services/supabase";

interface SiteAnalyticsProps {
  userId?: string | null;
  visible: boolean;
}

export default function SiteAnalytics({ userId, visible }: SiteAnalyticsProps) {
  const [summary, setSummary] = useState<SiteAnalyticsSummary>({ totalVisits: 0, uniqueVisitors: 0 });
  const [online, setOnline] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    void recordSiteVisit(userId).catch((error) => {
      console.warn("Site visit analytics are not configured yet", error);
    });
  }, [userId]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const visitorKey = getVisitorKey(userId);
    const channel = client.channel("site-presence", {
      config: { presence: { key: visitorKey } },
    });

    const updateOnlineCount = () => {
      const uniqueVisitors = new Set<string>();
      Object.values(channel.presenceState()).forEach((entries) => {
        entries.forEach((entry) => {
          const presence = entry as { visitor_key?: unknown };
          const key = typeof presence.visitor_key === "string" ? presence.visitor_key : null;
          if (key) uniqueVisitors.add(key);
        });
      });
      setOnline(uniqueVisitors.size);
    };

    channel
      .on("presence", { event: "sync" }, updateOnlineCount)
      .on("presence", { event: "join" }, updateOnlineCount)
      .on("presence", { event: "leave" }, updateOnlineCount)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ visitor_key: visitorKey, online_at: new Date().toISOString() });
        }
      });

    return () => {
      void channel.untrack();
      void client.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const refresh = async () => {
      try {
        const next = await getSiteAnalytics();
        if (active) {
          setSummary(next);
          setUnavailable(false);
        }
      } catch (error) {
        console.warn("Site analytics are not available", error);
        if (active) setUnavailable(true);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [visible]);

  if (!visible) return null;

  const metrics = [
    { label: "Tổng lượt truy cập", value: summary.totalVisits, icon: Eye, color: "text-rose-500", background: "bg-rose-100/80" },
    { label: "Số người truy cập", value: summary.uniqueVisitors, icon: Users, color: "text-violet-500", background: "bg-violet-100/80" },
    { label: "Đang trực tuyến", value: online, icon: Activity, color: "text-teal-500", background: "bg-teal-100/80" },
  ];

  return (
    <section className="site-analytics glass-panel mx-auto mb-6 max-w-5xl rounded-3xl border border-white/70 bg-white/55 p-4 shadow-sm sm:p-5" aria-label="Thống kê truy cập">
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-500">Bảng điều khiển riêng</p>
          <h2 className="mt-1 text-lg font-bold text-rose-950">Thống kê trang web</h2>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-teal-100 bg-white/75 px-3 py-1.5 text-xs font-semibold text-teal-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal-400" /> Trực tiếp
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon, color, background }) => (
          <article key={label} className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_8px_24px_rgba(148,163,184,.1)] backdrop-blur-xl">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${background}`}><Icon className={`h-5 w-5 ${color}`} /></div>
            <p className="text-2xl font-extrabold tabular-nums text-slate-800">{unavailable && label !== "Đang trực tuyến" ? "—" : value.toLocaleString("vi-VN")}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
          </article>
        ))}
      </div>
      {unavailable && <p className="mt-3 px-1 text-xs text-amber-600">Chạy file SQL thống kê trong Supabase để bắt đầu lưu lượt truy cập.</p>}
    </section>
  );
}
