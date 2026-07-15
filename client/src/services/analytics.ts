import { supabase } from "./supabase";

export interface SiteAnalyticsSummary {
  totalVisits: number;
  uniqueVisitors: number;
}

export interface SiteVisitorDetail {
  visitorKey: string;
  label: string;
  visitCount: number;
  lastVisitedAt: string;
}

export interface SiteVisitDetail {
  id: number;
  visitorKey: string;
  label: string;
  visitedAt: string;
}

export interface SiteAnalyticsDetails {
  visitors: SiteVisitorDetail[];
  visits: SiteVisitDetail[];
}

const VISITOR_ID_KEY = "hocbaithoiii-visitor-id";
let recordedVisitorKey: string | null = null;

function getDeviceVisitorId() {
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
}

export function getVisitorKey(userId?: string | null) {
  return userId ? `user:${userId}` : `guest:${getDeviceVisitorId()}`;
}

export async function recordSiteVisit(userId?: string | null) {
  if (!supabase) return;
  const visitorKey = getVisitorKey(userId);
  if (recordedVisitorKey === visitorKey) return;
  recordedVisitorKey = visitorKey;
  const { error } = await supabase.rpc("record_site_visit", {
    p_visitor_key: visitorKey,
  });
  if (error) {
    recordedVisitorKey = null;
    throw error;
  }
}

export async function getSiteAnalytics(): Promise<SiteAnalyticsSummary> {
  if (!supabase) return { totalVisits: 0, uniqueVisitors: 0 };
  const { data, error } = await supabase.rpc("get_site_analytics");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalVisits: Number(row?.total_visits ?? 0),
    uniqueVisitors: Number(row?.unique_visitors ?? 0),
  };
}

export async function getSiteAnalyticsDetails(): Promise<SiteAnalyticsDetails> {
  if (!supabase) return { visitors: [], visits: [] };
  const [{ data: visitors, error: visitorsError }, { data: visits, error: visitsError }] = await Promise.all([
    supabase.rpc("get_site_analytics_visitors"),
    supabase.rpc("get_site_visit_history", { p_limit: 100 }),
  ]);
  if (visitorsError) throw visitorsError;
  if (visitsError) throw visitsError;
  return {
    visitors: (visitors ?? []).map((row: Record<string, unknown>) => ({
      visitorKey: String(row.visitor_key ?? ""),
      label: String(row.visitor_label ?? "Khách"),
      visitCount: Number(row.visit_count ?? 0),
      lastVisitedAt: String(row.last_visited_at ?? ""),
    })),
    visits: (visits ?? []).map((row: Record<string, unknown>) => ({
      id: Number(row.visit_id ?? 0),
      visitorKey: String(row.visitor_key ?? ""),
      label: String(row.visitor_label ?? "Khách"),
      visitedAt: String(row.visited_at ?? ""),
    })),
  };
}
