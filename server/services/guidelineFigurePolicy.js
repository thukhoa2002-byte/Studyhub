export const FIGURE_PERMISSION_STATUSES = [
  "private_educational_use",
  "permission_pending",
  "permission_granted",
  "link_only",
  "public_not_allowed",
];

export function normalizeFigurePermissionStatus(value) {
  return FIGURE_PERMISSION_STATUSES.includes(value) ? value : "private_educational_use";
}

export function figureDisplayModel(figure, { isOwnerOrAdmin = false } = {}) {
  const permissionStatus = normalizeFigurePermissionStatus(figure?.permissionStatus);
  const canViewOriginal = isOwnerOrAdmin || permissionStatus === "permission_granted";
  const canDisplayPublicImage = permissionStatus === "permission_granted";
  const safe = {
    figureNumber: String(figure?.figureNumber || ""),
    title: String(figure?.translatedTitle || figure?.sourceTitle || "Figure"),
    summary: String(figure?.translatedCaption || figure?.sourceCaption || ""),
    attribution: String(figure?.attribution || ""),
    sourcePages: Array.isArray(figure?.sourcePages) ? figure.sourcePages : [],
    officialSourceUrl: String(figure?.officialSourceUrl || ""),
    relatedRecommendationIds: Array.isArray(figure?.relatedRecommendationIds) ? figure.relatedRecommendationIds : [],
    permissionStatus,
  };
  return {
    ...safe,
    mode: canViewOriginal ? "original" : "metadata_only",
    canViewOriginal,
    canDisplayPublicImage,
    // The path is intentionally only included for an authorized admin/owner or
    // for a Figure whose publisher explicitly permitted public reproduction.
    ...(canViewOriginal && figure?.originalAssetPath ? { originalAssetPath: figure.originalAssetPath } : {}),
  };
}
