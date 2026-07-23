import { drugs as seedDrugs } from "../data/drugData";
import type { Drug, DrugDosingRegimen, DrugGuidelineLink, DrugImportMetadata, DrugIndication, DrugProvenance, DrugSourceReference, DrugStatus } from "../types/drug";

const STORAGE_KEY = "studyhub:thuoc:v1";
let memoryCatalog: Drug[] | null = null;

export type ThuocInput = Omit<Drug, "id" | "createdAt" | "updatedAt" | "publishedAt" | "isPlaceholder"> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
  isPlaceholder?: boolean;
};

export interface ThuocFilter {
  query?: string;
  drugClass?: string;
  specialty?: string;
  status?: DrugStatus | "all";
}

function now(): string {
  return new Date().toISOString();
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function createId(): string {
  return `thuoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}

function objectArray<T>(value: unknown, normalize: (item: Record<string, unknown>, index: number) => T): T[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))).map(normalize) : [];
}

function textValue(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

function normalizeIndication(item: Record<string, unknown>, index: number): DrugIndication {
  return { id: textValue(item.id) || `indication-${index + 1}`, name: textValue(item.name), population: textValue(item.population), clinicalContext: textValue(item.clinicalContext), notes: textValue(item.notes) };
}

function normalizeRegimen(item: Record<string, unknown>, index: number): DrugDosingRegimen {
  return { id: textValue(item.id) || `dosing-${index + 1}`, indication: textValue(item.indication), population: textValue(item.population), route: textValue(item.route), startingDose: textValue(item.startingDose), loadingDose: textValue(item.loadingDose), maintenanceDose: textValue(item.maintenanceDose), targetDose: textValue(item.targetDose), interval: textValue(item.interval), duration: textValue(item.duration), notes: textValue(item.notes) };
}

function normalizeSource(item: Record<string, unknown>, index: number): DrugSourceReference {
  const year = Number(item.year);
  return { id: textValue(item.id) || `source-${index + 1}`, title: textValue(item.title), organization: textValue(item.organization), year: Number.isInteger(year) && year > 0 ? year : null, url: textValue(item.url), pages: textValue(item.pages), table: textValue(item.table), section: textValue(item.section), notes: textValue(item.notes) };
}

function normalizeGuidelineLink(item: Record<string, unknown>): DrugGuidelineLink {
  return { guidelineId: textValue(item.guidelineId), sectionId: textValue(item.sectionId), recommendationId: textValue(item.recommendationId), relationType: textValue(item.relationType) || "recommended", context: textValue(item.context) };
}

function normalizeDrug(value: Partial<Drug>): Drug {
  const titleVi = value.titleVi?.trim() || value.genericName?.trim() || "Thuốc chưa đặt tên";
  const genericName = value.genericName?.trim() || titleVi;
  const createdAt = value.createdAt || now();
  return {
    id: value.id || createId(),
    slug: slugify(value.slug || titleVi) || createId(),
    genericName,
    titleVi,
    aliases: stringArray(value.aliases),
    brandNames: stringArray(value.brandNames),
    dosageForms: stringArray(value.dosageForms),
    routes: stringArray(value.routes),
    drugClass: value.drugClass?.trim() || "",
    specialties: stringArray(value.specialties),
    indications: value.indications?.trim() || "",
    contraindications: value.contraindications?.trim() || "",
    dosing: value.dosing?.trim() || "",
    renalAdjustment: value.renalAdjustment?.trim() || "",
    hepaticAdjustment: value.hepaticAdjustment?.trim() || "",
    pregnancy: value.pregnancy?.trim() || "",
    breastfeeding: value.breastfeeding?.trim() || "",
    adverseEffects: value.adverseEffects?.trim() || "",
    interactions: value.interactions?.trim() || "",
    monitoring: value.monitoring?.trim() || "",
    mechanism: value.mechanism?.trim() || "",
    pharmacodynamics: value.pharmacodynamics?.trim() || "",
    indicationsDetailed: objectArray(value.indicationsDetailed, normalizeIndication),
    dosingRegimens: objectArray(value.dosingRegimens, normalizeRegimen),
    elderlyAdjustment: value.elderlyAdjustment?.trim() || "",
    pediatricAdjustment: value.pediatricAdjustment?.trim() || "",
    specialPopulationAdjustments: value.specialPopulationAdjustments?.trim() || "",
    precautions: value.precautions?.trim() || "",
    references: stringArray(value.references),
    sourceReferences: objectArray(value.sourceReferences, normalizeSource),
    guidelineLinks: objectArray(value.guidelineLinks, normalizeGuidelineLink),
    guidelineReferences: stringArray(value.guidelineReferences),
    flashcardReferences: stringArray(value.flashcardReferences),
    quizReferences: stringArray(value.quizReferences),
    calculatorReferences: stringArray(value.calculatorReferences),
    flowchartReferences: stringArray(value.flowchartReferences),
    imageReferences: stringArray(value.imageReferences),
    notes: value.notes?.trim() || "",
    summary: value.summary?.trim() || "",
    status: value.status || "draft",
    isPlaceholder: value.isPlaceholder ?? false,
    createdAt,
    updatedAt: value.updatedAt || createdAt,
    publishedAt: value.publishedAt || null,
    sourceVerified: value.sourceVerified ?? false,
    reviewedAt: value.reviewedAt || null,
    reviewedBy: value.reviewedBy || null,
    publishedBy: value.publishedBy || null,
    importMetadata: value.importMetadata as DrugImportMetadata | undefined,
    provenance: Array.isArray(value.provenance) ? value.provenance as DrugProvenance[] : [],
  };
}

function readCatalog(): Drug[] {
  if (memoryCatalog) return memoryCatalog;
  if (typeof window === "undefined") {
    memoryCatalog = seedDrugs.map(normalizeDrug);
    return memoryCatalog;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    memoryCatalog = stored ? JSON.parse(stored).map((item: Partial<Drug>) => normalizeDrug(item)) : seedDrugs.map(normalizeDrug);
  } catch {
    memoryCatalog = seedDrugs.map(normalizeDrug);
  }
  return memoryCatalog!;
}

function writeCatalog(items: Drug[]): Drug[] {
  memoryCatalog = items;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* local persistence is optional */ }
  }
  return items;
}

export function getAllThuoc(): Drug[] {
  return [...readCatalog()];
}

export function getThuocById(id: string): Drug | undefined {
  return readCatalog().find((drug) => drug.id === id);
}

export function getThuocBySlug(slug: string): Drug | undefined {
  return readCatalog().find((drug) => drug.slug === slug);
}

export function searchThuoc(query: string): Drug[] {
  return filterThuoc({ query });
}

export function filterThuoc({ query = "", drugClass = "all", specialty = "all", status = "all" }: ThuocFilter = {}): Drug[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return getAllThuoc().filter((drug) => {
    const haystack = [drug.titleVi, drug.genericName, drug.slug, drug.drugClass, ...drug.aliases, ...drug.brandNames, ...drug.specialties].join(" ").toLocaleLowerCase();
    return (!normalizedQuery || haystack.includes(normalizedQuery)) &&
      (drugClass === "all" || !drugClass || drug.drugClass === drugClass) &&
      (specialty === "all" || !specialty || drug.specialties.includes(specialty)) &&
      (status === "all" || !status || drug.status === status);
  });
}

export function createThuoc(input: Partial<ThuocInput>): Drug {
  const created = normalizeDrug({ ...input, id: input.id || createId(), status: input.status || "draft", isPlaceholder: input.isPlaceholder ?? false, createdAt: input.createdAt || now(), updatedAt: now() });
  writeCatalog([...readCatalog(), created]);
  return created;
}

export function updateThuoc(id: string, input: Partial<ThuocInput>): Drug | undefined {
  const current = getThuocById(id);
  if (!current) return undefined;
  const updated = normalizeDrug({ ...current, ...input, id, createdAt: current.createdAt, updatedAt: now() });
  writeCatalog(readCatalog().map((drug) => drug.id === id ? updated : drug));
  return updated;
}

export function deleteThuoc(id: string): boolean {
  const items = readCatalog();
  if (!items.some((drug) => drug.id === id)) return false;
  writeCatalog(items.filter((drug) => drug.id !== id));
  return true;
}

export function publishThuoc(id: string): Drug | undefined {
  return updateThuoc(id, { status: "published", publishedAt: now(), isPlaceholder: false });
}

export function archiveThuoc(id: string): Drug | undefined {
  return updateThuoc(id, { status: "archived" });
}

export function getThuocFilterOptions(): { drugClasses: string[]; specialties: string[] } {
  const all = getAllThuoc();
  return {
    drugClasses: [...new Set(all.map((drug) => drug.drugClass).filter(Boolean))].sort(),
    specialties: [...new Set(all.flatMap((drug) => drug.specialties))].sort(),
  };
}
