import { ExternalLink } from "lucide-react";
import { recommendationAdminPath, recommendationDeepLinkPath } from "../utils/recommendationDeepLink";

export interface RecommendationLinkLocation {
  guidelineId: string;
  guidelineSlug: string;
  guidelineTitle: string;
  sectionId: string | null;
  sectionTitle: string;
  recommendationId: string;
  recommendationTitle: string;
  recommendationPreview: string;
  publicEligible: boolean;
}

type Props = {
  location: RecommendationLinkLocation;
  onNavigate: (path: string) => void;
  admin?: boolean;
  className?: string;
};

export default function RecommendationLink({ location, onNavigate, admin = false, className = "" }: Props) {
  const destination = admin
    ? recommendationAdminPath(location.guidelineId, location.recommendationId)
    : location.publicEligible && location.sectionId
      ? recommendationDeepLinkPath(location.guidelineSlug, location.sectionId, location.recommendationId)
      : "";
  const unavailable = !destination;

  return <article className={`recommendation-link rounded-xl border border-slate-200 bg-white p-3 ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-bold text-slate-800">{location.recommendationTitle || "Khuyến cáo"}</p>
        {location.recommendationPreview && <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{location.recommendationPreview}</p>}
        <p className="mt-2 text-xs font-semibold text-slate-500">{location.guidelineTitle} · {location.sectionTitle}</p>
      </div>
      <button
        type="button"
        disabled={unavailable}
        onClick={() => destination && onNavigate(destination)}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {unavailable ? "Không còn khả dụng" : "Mở"}<ExternalLink size={14} />
      </button>
    </div>
  </article>;
}
