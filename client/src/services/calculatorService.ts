import { hasCalculatorHandler } from "../modules/calculators/engine.ts";
import type { CalculatorDefinition, CalculatorStatus } from "../modules/calculators/types";
import { onlyPublished } from "../utils/publicVisibility.ts";

const STORAGE_KEY = "studyhub:calculators:v1";
const RESET_MARKER_KEY = "studyhub:calculators:reset-v1";
let catalog: CalculatorDefinition[] | null = null;

function now() { return new Date().toISOString(); }
function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function createId() { return `calculator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

function normalize(value: Partial<CalculatorDefinition>): CalculatorDefinition {
  const nameVi = value.nameVi?.trim() || value.name?.trim() || "Máy tính chưa đặt tên";
  return {
    id: value.id || createId(), slug: slugify(value.slug || nameVi) || createId(), name: value.name?.trim() || nameVi, nameVi,
    shortName: value.shortName?.trim() || nameVi, specialty: value.specialty?.trim() || "", category: value.category?.trim() || "",
    description: value.description?.trim() || "", purpose: value.purpose?.trim() || "", whenToUse: value.whenToUse || [], whenNotToUse: value.whenNotToUse || [], limitations: value.limitations || [],
    inputFields: value.inputFields || [], calculation: value.calculation || { handlerId: "" }, resultDefinitions: value.resultDefinitions || [], interpretations: value.interpretations || [],
    guidelineReferences: value.guidelineReferences || [], flashcardReferences: value.flashcardReferences || [], quizReferences: value.quizReferences || [], relatedCalculatorReferences: value.relatedCalculatorReferences || [], references: value.references || [],
    status: value.status || "draft", version: value.version || "1.0.0", sourceVerified: value.sourceVerified ?? false, createdAt: value.createdAt || now(), updatedAt: value.updatedAt || now(), updatedBy: value.updatedBy, changeNotes: value.changeNotes, history: value.history || [],
  };
}

function read(): CalculatorDefinition[] {
  if (catalog) return catalog;
  if (typeof window === "undefined") return (catalog = []);
  try {
    // One-time cleanup removes the pre-reset catalog without deleting future
    // records created by the next calculator architecture.
    if (window.localStorage.getItem(RESET_MARKER_KEY) !== "done") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem("studyhub-reference-formula-overrides");
      window.localStorage.setItem(RESET_MARKER_KEY, "done");
    }
  } catch { /* local persistence is optional */ }
  catalog = [];
  return catalog;
}

function write(items: CalculatorDefinition[]) {
  catalog = items;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return items;
}

export function getAllCalculators(): CalculatorDefinition[] { return [...read()]; }
export function getPublishedCalculators(): CalculatorDefinition[] { return getAllCalculators().filter((item) => item.status === "published"); }
export function getCalculatorById(id: string) { return read().find((item) => item.id === id); }
export function getCalculatorBySlug(slug: string) { return read().find((item) => item.slug === slug); }
export function getPublishedCalculatorById(id: string) { return onlyPublished(getAllCalculators()).find((item) => item.id === id); }
export function getPublishedCalculatorBySlug(slug: string) { return onlyPublished(getAllCalculators()).find((item) => item.slug === slug); }
export function searchCalculators(query = "", specialty = "all", category = "all", publicOnly = false) {
  const normalized = query.trim().toLocaleLowerCase();
  return (publicOnly ? getPublishedCalculators() : getAllCalculators()).filter((item) => {
    const haystack = [item.name, item.nameVi, item.shortName, item.specialty, item.category, item.description].join(" ").toLocaleLowerCase();
    return (!normalized || haystack.includes(normalized)) && (specialty === "all" || item.specialty === specialty) && (category === "all" || item.category === category);
  });
}
export function getCalculatorFilterOptions(publicOnly = false) { const all = publicOnly ? getPublishedCalculators() : getAllCalculators(); return { specialties: [...new Set(all.map((item) => item.specialty).filter(Boolean))], categories: [...new Set(all.map((item) => item.category).filter(Boolean))] }; }
export function getGuidelineReferencesForCalculator(calculatorId: string) { return getCalculatorById(calculatorId)?.guidelineReferences || []; }
export function getCalculatorReferencesForGuideline(guidelineId: string) { return getAllCalculators().filter((item) => item.guidelineReferences.some((reference) => reference.guidelineId === guidelineId)); }
export function getPublishedCalculatorReferencesForGuideline(guidelineId: string) { return getPublishedCalculators().filter((item) => item.guidelineReferences.some((reference) => reference.guidelineId === guidelineId)); }
export function getFlashcardsForCalculator(calculatorId: string) { return getCalculatorById(calculatorId)?.flashcardReferences || []; }
export function getQuizzesForCalculator(calculatorId: string) { return getCalculatorById(calculatorId)?.quizReferences || []; }
export function createCalculator(input: Partial<CalculatorDefinition>): CalculatorDefinition { const created = normalize({ ...input, id: input.id || createId(), status: "draft", sourceVerified: false, createdAt: now(), updatedAt: now() }); return write([...read(), created]).at(-1)!; }
export function updateCalculator(id: string, input: Partial<CalculatorDefinition>): CalculatorDefinition | undefined { const current = getCalculatorById(id); if (!current) return undefined; if (input.status === "published" && !hasCalculatorHandler({ ...current, ...input } as CalculatorDefinition)) return undefined; const nextUpdatedAt = now(); const versionChanged = input.version && input.version !== current.version; const history = versionChanged || input.changeNotes ? [...(current.history || []), { version: input.version || current.version, changedAt: nextUpdatedAt, changedBy: input.updatedBy, changeNotes: input.changeNotes }] : current.history; const updated = normalize({ ...current, ...input, id, createdAt: current.createdAt, updatedAt: nextUpdatedAt, history }); write(read().map((item) => item.id === id ? updated : item)); return updated; }
export function deleteCalculator(id: string) { write(read().filter((item) => item.id !== id)); }
export function archiveCalculator(id: string) { return updateCalculator(id, { status: "archived" }); }
export function publishCalculator(id: string) { const current = getCalculatorById(id); return current && hasCalculatorHandler(current) ? updateCalculator(id, { status: "published" }) : undefined; }
export function calculatorHasDuplicate(id: string | undefined, field: "id" | "slug", value: string) { return read().some((item) => item.id !== id && item[field] === value.trim()); }
export function calculatorStatusLabel(status: CalculatorStatus) { return ({ draft: "Bản nháp", in_review: "Đang rà soát", reviewed: "Đã rà soát", published: "Đã xuất bản", archived: "Đã lưu trữ" } satisfies Record<CalculatorStatus, string>)[status]; }
