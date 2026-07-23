import type { Drug } from "../types/drug";
import { candidateFromDrug, type DrugImportCandidate } from "./drugImport";

export interface GuidelineImportProvenance {
  guidelineId?: string;
  title: string;
  tableName: string;
  tableNumber: string;
  page: string;
  section: string;
  documentTitle: string;
  publicationYear: number | null;
  organization?: string;
  url?: string;
}

export interface GuidelineTableRow {
  drugName: string;
  drugId?: string;
  drugClass: string;
  brandNames: string[];
  dose: string;
  renalAdjustment: string;
  hepaticAdjustment: string;
  contraindications: string;
  monitoring: string;
  clinicalContext: string;
  relationType: string;
  page: string;
  section: string;
  tableCells: Array<{ text: string; colSpan: number; rowSpan: number; backgroundColor: string; textColor: string; textAlign: "left" | "center" | "right"; fontWeight: "normal" | "bold" }>;
}

export interface GuidelineImportCandidate {
  candidateId: string;
  sourceType: "text" | "pdf" | "docx" | "ai";
  guideline: { id: string; slug: string; title: string; titleVi: string; organization: string; publicationYear: number; version: string; specialty: string; topics: string[]; summary: string; sourceUrl: string };
  table: { name: string; number: string; page: string; section: string };
  rows: GuidelineTableRow[];
  drugCandidates: DrugImportCandidate[];
  provenance: GuidelineImportProvenance[];
  validationErrors: string[];
  validationWarnings: string[];
  importStatus: "ready" | "invalid" | "saved";
}

export interface GuidelineTableBundle {
  guideline: GuidelineImportCandidate["guideline"];
  table: GuidelineImportCandidate["table"];
  rows: GuidelineTableRow[];
  provenance: GuidelineImportProvenance[];
}

export type GuidelineImportScope = "guideline" | "drugs" | "both" | "link_existing";

function slugify(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))] : []; }

function normalizeRow(value: Partial<GuidelineTableRow>): GuidelineTableRow {
  return {
    drugName: text(value.drugName), drugId: text(value.drugId), drugClass: text(value.drugClass), brandNames: stringArray(value.brandNames), dose: text(value.dose), renalAdjustment: text(value.renalAdjustment), hepaticAdjustment: text(value.hepaticAdjustment), contraindications: text(value.contraindications), monitoring: text(value.monitoring), clinicalContext: text(value.clinicalContext), relationType: text(value.relationType) || "recommended", page: text(value.page), section: text(value.section), tableCells: Array.isArray(value.tableCells) ? value.tableCells : [],
  };
}

export function buildGuidelineImportCandidate(bundle: GuidelineTableBundle, sourceType: GuidelineImportCandidate["sourceType"], existingDrugs: Drug[]): GuidelineImportCandidate {
  const guidelineId = text(bundle.guideline.id) || slugify(`${bundle.guideline.organization}-${bundle.guideline.title}-${bundle.guideline.publicationYear}`) || `guideline-${Date.now()}`;
  const guideline = { ...bundle.guideline, id: guidelineId, slug: text(bundle.guideline.slug) || slugify(guidelineId) };
  const rows = (bundle.rows || []).map(normalizeRow).filter((row) => row.drugName);
  const provenance = (bundle.provenance || []).map((item) => ({ ...item, guidelineId: item.guidelineId || guidelineId, title: text(item.title) || guideline.title, tableName: text(item.tableName) || bundle.table.name, tableNumber: text(item.tableNumber) || bundle.table.number, page: text(item.page) || bundle.table.page, section: text(item.section) || bundle.table.section, documentTitle: text(item.documentTitle) || guideline.title, publicationYear: item.publicationYear || guideline.publicationYear || null }));
  const sourceMetadata = { type: sourceType, title: guideline.title, table: bundle.table.name, tableNumber: bundle.table.number, page: bundle.table.page, section: bundle.table.section };
  const drugCandidates = rows.map((row, index) => {
    const existing = existingDrugs.find((drug) => [drug.id, drug.slug, drug.genericName, drug.titleVi, ...drug.aliases, ...drug.brandNames].some((name) => slugify(name) === slugify(row.drugName)));
    const id = row.drugId || existing?.id || slugify(row.drugName) || `drug-row-${index + 1}`;
    return candidateFromDrug({ id, slug: existing?.slug || slugify(row.drugName), genericName: row.drugName, titleVi: row.drugName, drugClass: row.drugClass, brandNames: row.brandNames, dosing: row.dose, renalAdjustment: row.renalAdjustment, hepaticAdjustment: row.hepaticAdjustment, contraindications: row.contraindications, monitoring: row.monitoring, notes: row.clinicalContext, references: provenance.map((item) => item.title).filter(Boolean), guidelineReferences: [guidelineId], status: "draft", sourceVerified: false }, "ai", sourceMetadata, existingDrugs, undefined, { importMethod: "ai", importedAt: new Date().toISOString(), aiGenerated: true, sourceDocumentTitle: guideline.title, sourceType });
  });
  const errors: string[] = [];
  if (!guideline.title.trim()) errors.push("guideline.title: bắt buộc.");
  if (!rows.length) errors.push("table.rows: không nhận diện được dòng thuốc nào.");
  const seenNames = new Set<string>();
  rows.forEach((row, index) => { const key = slugify(row.drugName); if (seenNames.has(key)) errors.push(`table.rows[${index}].drugName: hoạt chất trùng trong bảng.`); seenNames.add(key); });
  const warnings = ["Kiểm tra lại liều, đơn vị và tần suất của từng dòng thuốc trước khi lưu.", ...(!bundle.table.name ? ["Chưa nhận diện được tên bảng."] : []), ...(!provenance.length ? ["Chưa có provenance đầy đủ cho bảng guideline."] : [])];
  return { candidateId: `guideline-import-${Date.now()}`, sourceType, guideline, table: bundle.table, rows, drugCandidates, provenance, validationErrors: errors, validationWarnings: warnings, importStatus: errors.length ? "invalid" : "ready" };
}
