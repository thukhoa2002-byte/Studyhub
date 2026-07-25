import type { DatabaseCalculator, CalculatorGuidelineReferenceRow } from "../modules/calculators/databaseTypes.ts";
import type { CalculatorClinicalTestCase, CalculatorDefinition, CalculatorScoringRule } from "../modules/calculators/types.ts";

function localized(value: unknown, fallback = ""): { vi: string; en: string } {
  if (!value || typeof value !== "object") return { vi: fallback, en: fallback };
  const source = value as { vi?: unknown; en?: unknown };
  return { vi: typeof source.vi === "string" ? source.vi : fallback, en: typeof source.en === "string" ? source.en : fallback };
}

function stringList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

function localizedList(value: unknown): { vi: string[]; en: string[] } {
  if (!value || typeof value !== "object") return { vi: [], en: [] };
  const source = value as { vi?: unknown; en?: unknown };
  return { vi: stringList(source.vi), en: stringList(source.en) };
}

function clinicalTestCases(value: unknown): CalculatorClinicalTestCase[] {
  if (!Array.isArray(value)) return [];
  const entry = value.find((item) => item && typeof item === "object" && (item as { key?: unknown }).key === "clinical_test_cases") as { cases?: unknown } | undefined;
  return Array.isArray(entry?.cases) ? entry.cases as CalculatorClinicalTestCase[] : [];
}

export function databaseCalculatorToDefinition(record: DatabaseCalculator, guidelineReferences: CalculatorGuidelineReferenceRow[] = []): CalculatorDefinition {
  const name = localized(record.name);
  const description = localized(record.description);
  const purpose = localized(record.purpose);
  const whenToUse = localizedList(record.when_to_use);
  const whenNotToUse = localizedList(record.when_not_to_use);
  const limitations = localizedList(record.limitations);
  return {
    id: record.id,
    slug: record.slug,
    name: name.en || name.vi,
    nameVi: name.vi || name.en,
    shortName: record.short_name,
    specialty: record.specialty_id || "",
    category: record.category_id || "",
    description: description.vi || description.en,
    purpose: purpose.vi || purpose.en,
    whenToUse: whenToUse.vi.length ? whenToUse.vi : whenToUse.en,
    whenNotToUse: whenNotToUse.vi.length ? whenNotToUse.vi : whenNotToUse.en,
    limitations: limitations.vi.length ? limitations.vi : limitations.en,
    inputFields: Array.isArray(record.input_fields) ? record.input_fields as CalculatorDefinition["inputFields"] : [],
    calculation: { handlerId: record.handler_key || "" },
    scoringRules: Array.isArray(record.scoring_rules) ? record.scoring_rules as CalculatorScoringRule[] : [],
    resultDefinitions: Array.isArray(record.result_definitions) ? record.result_definitions as CalculatorDefinition["resultDefinitions"] : [],
    interpretations: stringList(record.warnings),
    guidelineReferences: guidelineReferences.map((reference) => ({
      id: reference.id,
      guidelineId: reference.guideline_id,
      sectionId: reference.section_id || undefined,
      recommendationId: reference.recommendation_id || undefined,
      relationType: reference.relation_type,
      context: localized(reference.context).vi,
    })),
    flashcardReferences: [],
    quizReferences: [],
    relatedCalculatorReferences: [],
    references: stringList(record.evidence_references),
    testCases: clinicalTestCases(record.formula_variables),
    status: record.status,
    version: record.version,
    sourceVerified: record.source_verified,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function filterPublicDatabaseCalculators(records: DatabaseCalculator[]): DatabaseCalculator[] {
  return records.filter((record) => record.status === "published");
}
