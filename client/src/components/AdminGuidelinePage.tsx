import type { User } from "@supabase/supabase-js";
import type { DataRoute } from "../utils/dataRoutes";
import AdminGuidelineStructuredEditor from "./AdminGuidelineStructuredEditor";

interface Props {
  user: User | null;
  route: Extract<DataRoute, { tab: "admin" }>;
  onNavigate: (path: string) => void;
  onAiCallsRemaining?: (remaining: number) => void;
}

export default function AdminGuidelinePage({ user, route, onNavigate }: Props) {
  if (!user) return null;
  return <AdminGuidelineStructuredEditor user={user} route={route} onNavigate={onNavigate} />;
}
