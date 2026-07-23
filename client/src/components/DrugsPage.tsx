import type { DataRoute } from "../utils/dataRoutes";
import DrugDataPage from "./DrugDataPage";

export default function DrugsPage({ route, onNavigate }: { route: Extract<DataRoute, { tab: "drugs" }>; onNavigate: (path: string) => void }) {
  return <DrugDataPage route={route} onNavigate={onNavigate} />;
}
