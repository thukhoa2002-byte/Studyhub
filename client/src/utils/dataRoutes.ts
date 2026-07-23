export type DataRoute =
  | { tab: "guidelines"; kind: "guideline-list" }
  | { tab: "guidelines"; kind: "guideline-detail"; slug: string; sectionSlug?: string; recommendationId?: string }
  | { tab: "drugs"; kind: "drug-list" }
  | { tab: "drugs"; kind: "drug-detail"; slug: string }
  | { tab: null; kind: "other" };

export function parseDataRoute(pathname: string): DataRoute {
  const parts = pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if (parts[0] === "guidelines") {
    if (!parts[1]) return { tab: "guidelines", kind: "guideline-list" };
    return { tab: "guidelines", kind: "guideline-detail", slug: parts[1], sectionSlug: parts[2], recommendationId: parts[3] };
  }
  if (parts[0] === "drugs") {
    if (!parts[1]) return { tab: "drugs", kind: "drug-list" };
    return { tab: "drugs", kind: "drug-detail", slug: parts[1] };
  }
  return { tab: null, kind: "other" };
}

export function guidelinePath(slug: string, sectionSlug?: string, recommendationId?: string): string {
  const path = ["/guidelines", slug, sectionSlug, recommendationId].filter(Boolean);
  return path.join("/");
}

export function drugPath(slug: string): string {
  return `/drugs/${encodeURIComponent(slug)}`;
}
