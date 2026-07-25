import type { DataRoute } from "../utils/dataRoutes";
import DrugDataPage from "./DrugDataPage";

export default function DrugsPage({ route, user, onNavigate }: { route: Extract<DataRoute, { tab: "drugs" }>; user: import("@supabase/supabase-js").User | null; onNavigate: (path: string) => void }) {
  return <DrugDataPage route={route} user={user} onNavigate={onNavigate} />;
}
