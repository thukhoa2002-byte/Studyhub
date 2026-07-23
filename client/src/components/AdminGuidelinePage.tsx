import type { User } from "@supabase/supabase-js";
import type { DataRoute } from "../utils/dataRoutes";
import GuidelinesPage from "./GuidelinesPage";

interface Props {
  user: User | null;
  route: Extract<DataRoute, { tab: "admin" }>;
  onAiCallsRemaining?: (remaining: number) => void;
}

export default function AdminGuidelinePage({ user, route, onAiCallsRemaining }: Props) {
  const isNew = route.kind === "admin-guideline-new";
  const guidelineId = route.guidelineId;
  return <section aria-labelledby="admin-guideline-title">
    <div className="mb-5"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-violet-600">Quản trị Guideline</p><h1 id="admin-guideline-title" className="mt-1 text-2xl font-extrabold text-rose-950">Kho guideline quản trị</h1><p className="mt-1 text-sm font-semibold text-slate-500">Tải tài liệu, kiểm tra khuyến cáo và quản lý trạng thái công khai.</p></div>
    <GuidelinesPage user={user} onAiCallsRemaining={onAiCallsRemaining} initialGuidelineId={guidelineId} autoOpenDocumentForm={isNew} />
  </section>;
}
