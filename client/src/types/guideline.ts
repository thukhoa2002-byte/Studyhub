export type GuidelineStatus = "draft" | "reviewed" | "published" | "archived";

export type RelationType =
  | "recommended"
  | "preferred"
  | "alternative"
  | "contraindicated"
  | "avoid"
  | "consider"
  | "dose-adjustment"
  | "interaction"
  | "monitoring";

export interface GuidelineSource {
  guidelineId: string;
  sectionId: string;
  page: number | null;
  table: string;
  figure: string;
}

export interface DrugReference {
  drugId: string;
  relationType: RelationType;
  context: string;
  doseNote?: string;
  recommendationId?: string;
}

export interface GuidelineRecommendation {
  id: string;
  title: string;
  content: string;
  classOfRecommendation: string;
  levelOfEvidence: string;
  population: string;
  clinicalContext: string;
  tags: string[];
  drugReferences: DrugReference[];
  source: GuidelineSource;
  status: GuidelineStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  lastUpdatedAt: string;
  sourceVerified: boolean;
  isPlaceholder: boolean;
}

export interface GuidelineSection {
  id: string;
  slug: string;
  title: string;
  titleVi: string;
  order: number;
  summary: string;
  recommendations: GuidelineRecommendation[];
  drugReferences: DrugReference[];
  calculatorReferences: string[];
  flowchartReferences: string[];
  flashcardReferences?: string[];
  quizReferences?: string[];
  imageReferences?: string[];
}

export interface Guideline {
  id: string;
  slug: string;
  title: string;
  titleVi: string;
  organization: string;
  publicationYear: number;
  version: string;
  specialty: string;
  topics: string[];
  summary: string;
  sourceUrl: string;
  lastReviewedAt: string;
  status: GuidelineStatus;
  isPlaceholder: boolean;
  sections: GuidelineSection[];
}

export interface GuidelineReference {
  guideline: Guideline;
  section: GuidelineSection;
  recommendation: GuidelineRecommendation;
  relationType: RelationType;
  context: string;
}
