import type { User } from "@supabase/supabase-js";
import type { DataRoute } from "../utils/dataRoutes";
import AdminGuidelineStructuredEditor from "./AdminGuidelineStructuredEditor";
import AdminGuidelineImportPage from "./AdminGuidelineImportPage";

interface Props {
  user: User | null;
  route: Extract<DataRoute, { tab: "admin" }>;
  onNavigate: (path: string) => void;
  onAiCallsRemaining?: (remaining: number) => void;
}

export default function AdminGuidelinePage({ user, route, onNavigate }: Props) {
  if (!user) return null;
  if (route.kind === "admin-guideline-import") return <AdminGuidelineImportPage user={user} onNavigate={onNavigate} />;
  return <AdminGuidelineStructuredEditor user={user} route={route} onNavigate={onNavigate} />;
}
