import type { GuidelineStatus } from "./guideline";
import type { LocalizedContent, TranslationMetadata } from "./language";

export type DrugStatus = GuidelineStatus | "in_review";

export interface DrugImportMetadata extends TranslationMetadata {
  importMethod: "manual" | "json" | "text" | "pdf" | "docx" | "ai";
  originalFileName?: string;
  importedAt: string;
  importedBy?: string;
  aiGenerated: boolean;
  aiModel?: string;
  promptVersion?: string;
  sourceDocumentTitle?: string;
  sourceType?: string;
}

export interface DrugProvenance {
  sourceId: string;
  title: string;
  organization?: string;
  year?: number | null;
  url?: string;
  pages?: string;
  sections?: string[];
  guidelineId?: string;
  tableName?: string;
  tableNumber?: string;
  documentTitle?: string;
  accessedAt?: string;
}

export interface DrugIndication {
  id: string;
  name: string;
  population: string;
  clinicalContext: string;
  notes: string;
}

export interface DrugDosingRegimen {
  id: string;
  indication: string;
  population: string;
  route: string;
  startingDose: string;
  loadingDose: string;
  maintenanceDose: string;
  targetDose: string;
  interval: string;
  duration: string;
  notes: string;
}

export interface DrugSourceReference {
  id: string;
  title: string;
  organization: string;
  year: number | null;
  url: string;
  pages: string;
  table: string;
  section: string;
  notes: string;
}

export interface DrugGuidelineLink {
  guidelineId: string;
  sectionId: string;
  recommendationId: string;
  relationType: string;
  context: string;
}

export interface Drug {
  id: string;
  slug: string;
  genericName: string;
  titleVi: string;
  aliases: string[];
  brandNames: string[];
  dosageForms: string[];
  routes: string[];
  drugClass: string;
  specialties: string[];
  indications: string;
  contraindications: string;
  dosing: string;
  renalAdjustment: string;
  hepaticAdjustment: string;
  pregnancy: string;
  breastfeeding: string;
  adverseEffects: string;
  interactions: string;
  monitoring: string;
  mechanism: string;
  pharmacodynamics: string;
  indicationsDetailed: DrugIndication[];
  dosingRegimens: DrugDosingRegimen[];
  elderlyAdjustment: string;
  pediatricAdjustment: string;
  specialPopulationAdjustments: string;
  precautions: string;
  references: string[];
  sourceReferences: DrugSourceReference[];
  guidelineLinks: DrugGuidelineLink[];
  guidelineReferences: string[];
  flashcardReferences: string[];
  quizReferences: string[];
  calculatorReferences: string[];
  flowchartReferences: string[];
  imageReferences: string[];
  notes: string;
  summary: string;
  status: DrugStatus;
  isPlaceholder: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  sourceVerified?: boolean;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  publishedBy?: string | null;
  importMetadata?: DrugImportMetadata;
  localizedContent?: LocalizedContent;
  provenance?: DrugProvenance[];
}
