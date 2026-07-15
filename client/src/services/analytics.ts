import { supabase } from "./supabase";

export interface SiteAnalyticsSummary {
  totalVisits: number;
  uniqueVisitors: number;
}

const VISITOR_ID_KEY = "hocbaithoiii-visitor-id";
let visitRecorded = false;

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
  if (!supabase || visitRecorded) return;
  visitRecorded = true;
  const { error } = await supabase.rpc("record_site_visit", {
    p_visitor_key: getVisitorKey(userId),
  });
  if (error) {
    visitRecorded = false;
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
