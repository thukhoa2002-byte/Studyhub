import type { Drug, DrugDosingRegimen, DrugGuidelineLink, DrugImportMetadata, DrugIndication, DrugProvenance, DrugSourceReference } from "../types/drug";

export interface DrugImportCandidate {
  candidateId: string;
  sourceType: "manual" | "json" | "text" | "pdf" | "docx" | "ai";
  sourceMetadata: Record<string, string | number | null>;
  rawFileName?: string;
  parsedDrug: Partial<Drug>;
  validationErrors: string[];
  validationWarnings: string[];
  duplicateStatus: "new_record" | "exact_duplicate" | "possible_duplicate";
  importStatus: "pending" | "extracting" | "validating" | "valid" | "invalid" | "duplicate" | "ready" | "saving" | "saved" | "failed";
  aiMetadata?: DrugImportMetadata;
}

const statuses = new Set(["draft", "in_review", "reviewed", "published", "archived"]);

function stringValue(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))] : []; }
function slugify(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function objectArray<T>(value: unknown, normalize: (item: Record<string, unknown>, index: number) => T): T[] { return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))).map(normalize) : []; }
function objectText(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function normalizeIndication(value: Record<string, unknown>, index: number): DrugIndication { return { id: objectText(value.id) || `indication-${index + 1}`, name: objectText(value.name), population: objectText(value.population), clinicalContext: objectText(value.clinicalContext), notes: objectText(value.notes) }; }
function normalizeRegimen(value: Record<string, unknown>, index: number): DrugDosingRegimen { return { id: objectText(value.id) || `dosing-${index + 1}`, indication: objectText(value.indication), population: objectText(value.population), route: objectText(value.route), startingDose: objectText(value.startingDose), loadingDose: objectText(value.loadingDose), maintenanceDose: objectText(value.maintenanceDose), targetDose: objectText(value.targetDose), interval: objectText(value.interval), duration: objectText(value.duration), notes: objectText(value.notes) }; }
function normalizeSource(value: Record<string, unknown>, index: number): DrugSourceReference { const year = Number(value.year); return { id: objectText(value.id) || `source-${index + 1}`, title: objectText(value.title), organization: objectText(value.organization), year: Number.isInteger(year) && year > 0 ? year : null, url: objectText(value.url), pages: objectText(value.pages), table: objectText(value.table), section: objectText(value.section), notes: objectText(value.notes) }; }
function normalizeGuidelineLink(value: Record<string, unknown>): DrugGuidelineLink { return { guidelineId: objectText(value.guidelineId), sectionId: objectText(value.sectionId), recommendationId: objectText(value.recommendationId), relationType: objectText(value.relationType) || "recommended", context: objectText(value.context) }; }

export function normalizeDrugImport(value: Record<string, unknown>): Partial<Drug> {
  const titleVi = stringValue(value.titleVi || value.name || value.genericName);
  const genericName = stringValue(value.genericName || titleVi);
  const normalized: Partial<Drug> = {
    id: stringValue(value.id), slug: slugify(stringValue(value.slug || titleVi)), genericName, titleVi,
    aliases: stringArray(value.aliases), brandNames: stringArray(value.brandNames), dosageForms: stringArray(value.dosageForms), routes: stringArray(value.routes), drugClass: stringValue(value.drugClass), specialties: stringArray(value.specialties),
    indications: stringValue(value.indications), indicationsDetailed: objectArray(value.indicationsDetailed, normalizeIndication), contraindications: stringValue(value.contraindications), dosing: stringValue(value.dosing), dosingRegimens: objectArray(value.dosingRegimens, normalizeRegimen), renalAdjustment: stringValue(value.renalAdjustment), hepaticAdjustment: stringValue(value.hepaticAdjustment), elderlyAdjustment: stringValue(value.elderlyAdjustment), pediatricAdjustment: stringValue(value.pediatricAdjustment), specialPopulationAdjustments: stringValue(value.specialPopulationAdjustments), pregnancy: stringValue(value.pregnancy), breastfeeding: stringValue(value.breastfeeding), precautions: stringValue(value.precautions), adverseEffects: stringValue(value.adverseEffects), interactions: stringValue(value.interactions), monitoring: stringValue(value.monitoring), mechanism: stringValue(value.mechanism), pharmacodynamics: stringValue(value.pharmacodynamics), references: stringArray(value.references), sourceReferences: objectArray(value.sourceReferences, normalizeSource), guidelineReferences: stringArray(value.guidelineReferences), guidelineLinks: objectArray(value.guidelineLinks, normalizeGuidelineLink), flashcardReferences: stringArray(value.flashcardReferences), quizReferences: stringArray(value.quizReferences), calculatorReferences: stringArray(value.calculatorReferences), flowchartReferences: stringArray(value.flowchartReferences), imageReferences: stringArray(value.imageReferences), notes: stringValue(value.notes), summary: stringValue(value.summary), status: "draft", sourceVerified: false,
  };
  if (Array.isArray(value.provenance)) normalized.provenance = value.provenance as DrugProvenance[];
  return normalized;
}

export function unwrapDrugImport(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  if (value && typeof value === "object" && Array.isArray((value as { drugs?: unknown }).drugs)) return unwrapDrugImport((value as { drugs: unknown }).drugs);
  return value && typeof value === "object" ? [value as Record<string, unknown>] : [];
}

export function validateDrugImport(drug: Partial<Drug>): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!stringValue(drug.id) && !stringValue(drug.slug)) errors.push("id: cần nhập id hoặc slug.");
  if (stringValue(drug.slug) && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stringValue(drug.slug))) errors.push("slug: chỉ dùng chữ thường, số, dấu gạch ngang.");
  if (!stringValue(drug.genericName)) errors.push("genericName: bắt buộc và không được để trống.");
  if (drug.status && !statuses.has(drug.status)) errors.push("status: giá trị không hợp lệ.");
  if (drug.status === "published" || drug.status === "reviewed" || drug.status === "in_review") errors.push("status: dữ liệu import chỉ được lưu dưới dạng draft.");
  if (drug.sourceVerified === true) errors.push("sourceVerified: dữ liệu import không được tự đánh dấu đã xác minh.");
  for (const field of ["indicationsDetailed", "dosingRegimens", "sourceReferences", "guidelineLinks"] as const) {
    const value = drug[field];
    if (value !== undefined && (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object" || Array.isArray(item)))) errors.push(`${field}: phải là mảng object.`);
  }
  if (!stringValue(drug.indications)) warnings.push("Chưa có chỉ định.");
  if (!stringValue(drug.dosing)) warnings.push("Chưa có liều dùng.");
  if (!stringValue(drug.contraindications)) warnings.push("Chưa có chống chỉ định.");
  if (!Array.isArray(drug.references) || drug.references.length === 0) warnings.push("Chưa có nguồn tham khảo.");
  return { errors, warnings };
}

export function findDrugDuplicate(drug: Partial<Drug>, existing: Drug[]): DrugImportCandidate["duplicateStatus"] {
  const id = stringValue(drug.id).toLowerCase();
  const slug = stringValue(drug.slug).toLowerCase();
  const genericName = stringValue(drug.genericName).toLocaleLowerCase("vi");
  if (existing.some((item) => item.id.toLowerCase() === id || item.slug.toLowerCase() === slug)) return "exact_duplicate";
  if (genericName && existing.some((item) => item.genericName.toLocaleLowerCase("vi") === genericName || item.aliases.some((alias) => alias.toLocaleLowerCase("vi") === genericName) || item.brandNames.some((brand) => brand.toLocaleLowerCase("vi") === genericName))) return "possible_duplicate";
  return "new_record";
}

export function candidateFromDrug(drug: Partial<Drug>, sourceType: DrugImportCandidate["sourceType"], sourceMetadata: DrugImportCandidate["sourceMetadata"], existing: Drug[] = [], rawFileName?: string, aiMetadata?: DrugImportMetadata): DrugImportCandidate {
  const parsedDrug = normalizeDrugImport(drug as Record<string, unknown>);
  const validation = validateDrugImport(parsedDrug);
  const duplicateStatus = findDrugDuplicate(parsedDrug, existing);
  return { candidateId: `${parsedDrug.id || "candidate"}-${Math.random().toString(36).slice(2, 8)}`, sourceType, sourceMetadata, rawFileName, parsedDrug, validationErrors: validation.errors, validationWarnings: validation.warnings, duplicateStatus, importStatus: validation.errors.length ? "invalid" : duplicateStatus === "exact_duplicate" ? "duplicate" : "ready", aiMetadata };
}
