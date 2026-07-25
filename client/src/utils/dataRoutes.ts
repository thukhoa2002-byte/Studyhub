export type DataRoute =
  | { tab: "tools"; kind: "calculator-list" | "calculator-detail"; calculatorSlug?: string }
  | { tab: "guidelines"; kind: "guideline-list" }
  | { tab: "guidelines"; kind: "guideline-detail"; slug: string; sectionSlug?: string; recommendationId?: string }
  | { tab: "drugs"; kind: "drug-list" }
  | { tab: "drugs"; kind: "drug-detail"; slug: string }
  | { tab: "admin"; kind: "admin-dashboard" | "admin-drug-list" | "admin-drug-new" | "admin-drug-detail" | "admin-drug-edit" | "admin-drug-import" | "admin-guideline-list" | "admin-guideline-new" | "admin-guideline-detail" | "admin-guideline-edit" | "admin-guideline-sections" | "admin-guideline-recommendations" | "admin-guideline-import" | "admin-calculator-list" | "admin-calculator-new" | "admin-calculator-import" | "admin-calculator-edit"; drugId?: string; guidelineId?: string; calculatorId?: string }
  | { tab: null; kind: "other" };

export function parseDataRoute(pathname: string): DataRoute {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || "/";
  const parts = pathOnly.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if (parts[0] === "admin") {
    if (!parts[1]) return { tab: "admin", kind: "admin-dashboard" };
    if (parts[1] === "thuoc" || parts[1] === "drugs") {
      if (!parts[2]) return { tab: "admin", kind: "admin-drug-list" };
      if (parts[2] === "new") return { tab: "admin", kind: "admin-drug-new" };
      if (parts[2] === "import") return { tab: "admin", kind: "admin-drug-import" };
      if (parts[3] === "edit") return { tab: "admin", kind: "admin-drug-edit", drugId: parts[2] };
      return { tab: "admin", kind: "admin-drug-detail", drugId: parts[2] };
    }
    if (parts[1] === "guidelines" || parts[1] === "guideline") {
      if (!parts[2]) return { tab: "admin", kind: "admin-guideline-list" };
      if (parts[2] === "new") return { tab: "admin", kind: "admin-guideline-new" };
      if (parts[2] === "import") return { tab: "admin", kind: "admin-guideline-import" };
      if (parts[3] === "edit") return { tab: "admin", kind: "admin-guideline-edit", guidelineId: parts[2] };
      if (parts[3] === "sections") return { tab: "admin", kind: "admin-guideline-sections", guidelineId: parts[2] };
      if (parts[3] === "recommendations") return { tab: "admin", kind: "admin-guideline-recommendations", guidelineId: parts[2] };
      return { tab: "admin", kind: "admin-guideline-detail", guidelineId: parts[2] };
    }
    if (parts[1] === "may-tinh-y-khoa" || parts[1] === "calculators") {
      if (!parts[2]) return { tab: "admin", kind: "admin-calculator-list" };
      if (parts[2] === "new") return { tab: "admin", kind: "admin-calculator-new" };
      if (parts[2] === "import") return { tab: "admin", kind: "admin-calculator-import" };
      if (parts[3] === "edit") return { tab: "admin", kind: "admin-calculator-edit", calculatorId: parts[2] };
      return { tab: "admin", kind: "admin-calculator-edit", calculatorId: parts[2] };
    }
  }
  if (parts[0] === "may-tinh-y-khoa" || parts[0] === "calculators") return { tab: "tools", kind: parts[1] ? "calculator-detail" : "calculator-list", calculatorSlug: parts[1] };
  if (parts[0] === "guidelines") {
    if (!parts[1]) return { tab: "guidelines", kind: "guideline-list" };
    if (parts[1] === "manage") return { tab: "admin", kind: "admin-guideline-list" };
    return { tab: "guidelines", kind: "guideline-detail", slug: parts[1], sectionSlug: parts[2], recommendationId: parts[3] };
  }
  if (parts[0] === "drugs" || parts[0] === "thuoc") {
    if (!parts[1]) return { tab: "drugs", kind: "drug-list" };
    return { tab: "drugs", kind: "drug-detail", slug: parts[1] };
  }
  return { tab: null, kind: "other" };
}

export function guidelinePath(slug: string, sectionId?: string, recommendationId?: string): string {
  const path = ["/guidelines", slug, sectionId, recommendationId].filter((part): part is string => Boolean(part)).map((part, index) => index === 0 ? part : encodeURIComponent(part));
  return path.join("/");
}

export function drugPath(slug: string): string {
  return `/thuoc/${encodeURIComponent(slug)}`;
}

export function canonicalDataPath(pathname: string): string {
  const suffixIndex = pathname.search(/[?#]/);
  const suffix = suffixIndex >= 0 ? pathname.slice(suffixIndex) : "";
  const pathOnly = suffixIndex >= 0 ? pathname.slice(0, suffixIndex) : pathname;
  const parts = pathOnly.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  const withSuffix = (path: string) => `${path}${suffix}`;
  if (parts[0] === "guidelines" && parts[1] === "manage") return withSuffix("/admin/guidelines");
  if ((parts[0] === "thuoc" || parts[0] === "drugs") && ["admin", "manage", "edit", "new"].includes(parts[1] || "")) {
    const tail = parts.slice(2);
    if (parts[1] === "admin" || parts[1] === "manage") return withSuffix(`/admin/thuoc${tail.length ? `/${tail.join("/")}` : ""}`);
    return withSuffix(`/admin/thuoc/${parts[1]}${tail.length ? `/${tail.join("/")}` : ""}`);
  }
  if ((parts[0] === "guidelines" || parts[0] === "guideline") && ["admin", "manage", "edit", "new"].includes(parts[1] || "")) {
    const tail = parts.slice(2);
    if (parts[1] === "admin" || parts[1] === "manage") return withSuffix(`/admin/guidelines${tail.length ? `/${tail.join("/")}` : ""}`);
    return withSuffix(`/admin/guidelines/${parts[1]}${tail.length ? `/${tail.join("/")}` : ""}`);
  }
  if (parts[0] === "drugs") return withSuffix(`/thuoc${parts.length > 1 ? `/${parts.slice(1).join("/")}` : ""}`);
  if (parts[0] === "calculators") return withSuffix(`/may-tinh-y-khoa${parts.length > 1 ? `/${parts.slice(1).join("/")}` : ""}`);
  return `${pathOnly || "/"}${suffix}`;
}
