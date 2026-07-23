import type { GuidelineStatus } from "./guideline";

export type DrugStatus = GuidelineStatus;

export interface Drug {
  id: string;
  slug: string;
  genericName: string;
  titleVi: string;
  aliases: string[];
  brandNames: string[];
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
  references: string[];
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
}
