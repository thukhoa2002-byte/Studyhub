import { createGuidelineDocument, createGuidelineEntries, type NewGuidelineEntry } from "./guidelines";
import { createThuoc, getAllThuoc, updateThuoc } from "./thuocService";
import type { Drug } from "../types/drug";
import type { GuidelineImportCandidate, GuidelineImportScope } from "../utils/guidelineImport";
import type { DrugImportCandidate } from "../utils/drugImport";

type DuplicateChoice = "skip" | "copy" | "update";

function condition(value: string): "ACS" | "HF" | "AF" | "Khác" {
  const normalized = value.toLocaleLowerCase();
  if (normalized.includes("acs") || normalized.includes("coronary")) return "ACS";
  if (normalized.includes("heart failure") || normalized.includes("suy tim")) return "HF";
  if (normalized.includes("atrial") || normalized.includes("rung nhĩ")) return "AF";
  return "Khác";
}

function duplicateFor(candidate: DrugImportCandidate, existing: Drug[]): Drug | undefined {
  return existing.find((drug) => drug.id === candidate.parsedDrug.id || drug.slug === candidate.parsedDrug.slug || drug.genericName.toLocaleLowerCase() === String(candidate.parsedDrug.genericName || "").toLocaleLowerCase());
}

function saveDrug(candidate: DrugImportCandidate, choice: DuplicateChoice, existing: Drug[], guidelineId?: string): Drug | undefined {
  const duplicate = duplicateFor(candidate, existing);
  if (duplicate && choice === "skip") return duplicate;
  const guidelineReferences = [...new Set([...(duplicate?.guidelineReferences || []), ...(candidate.parsedDrug.guidelineReferences || []), ...(guidelineId ? [guidelineId] : [])])];
  const payload = { ...candidate.parsedDrug, status: "draft" as const, sourceVerified: false, guidelineReferences, provenance: candidate.provenance || candidate.parsedDrug.provenance || [], importMetadata: candidate.aiMetadata };
  if (duplicate && choice === "update") return updateThuoc(duplicate.id, payload);
  if (duplicate && choice === "copy") {
    const suffix = `-import-${Date.now()}`;
    return createThuoc({ ...payload, id: `${payload.id || "thuoc"}${suffix}`, slug: `${payload.slug || "thuoc"}${suffix}` });
  }
  return createThuoc(payload);
}

export async function saveGuidelineTableImport({ candidate, scope, selectedDrugIds, duplicateChoices, userId }: { candidate: GuidelineImportCandidate; scope: GuidelineImportScope; selectedDrugIds: string[]; duplicateChoices: Record<string, DuplicateChoice>; userId: string }): Promise<{ guidelineId?: string; savedDrugIds: string[]; skippedDrugNames: string[] }> {
  const existing = getAllThuoc();
  const shouldCreateGuideline = scope !== "drugs";
  let document: Awaited<ReturnType<typeof createGuidelineDocument>> | undefined;
  if (shouldCreateGuideline) {
    document = await createGuidelineDocument(userId, {
      title: candidate.guideline.titleVi || candidate.guideline.title || candidate.table.name,
      society: candidate.guideline.organization || "Chưa xác định",
      condition: condition(candidate.guideline.specialty),
      publicationYear: candidate.guideline.publicationYear || new Date().getFullYear(),
      versionLabel: candidate.guideline.version || "",
      sourceUrl: candidate.guideline.sourceUrl || "",
      visibility: "private",
      tableName: candidate.table.name,
      tableNumber: candidate.table.number,
      summary: candidate.guideline.summary || candidate.commonGuidance.why || "",
      topics: candidate.guideline.topics || [],
      provenance: [...candidate.provenance, { kind: "group_guidance", ...candidate.commonGuidance }],
    });
  }

  const savedDrugs: Drug[] = [];
  const savedByCandidate = new Map<string, Drug>();
  const skippedDrugNames: string[] = [];
  if (scope === "drugs" || scope === "both") {
    for (const drugCandidate of candidate.drugCandidates.filter((item) => selectedDrugIds.includes(item.candidateId))) {
      const choice = duplicateChoices[drugCandidate.candidateId] || "skip";
      const duplicate = duplicateFor(drugCandidate, existing);
      if (scope === "drugs" && duplicate && choice === "skip") { skippedDrugNames.push(String(drugCandidate.parsedDrug.genericName || "Thuốc")); continue; }
      const saved = saveDrug(drugCandidate, choice, existing, document?.id);
      if (saved) { savedDrugs.push(saved); savedByCandidate.set(drugCandidate.candidateId, saved); }
    }
  }

  if (!document) return { savedDrugIds: savedDrugs.map((drug) => drug.id), skippedDrugNames };

  const entries: NewGuidelineEntry[] = candidate.rows.map((row, index) => {
    const linkedCandidate = candidate.drugCandidates[index];
    const linkedDrug = linkedCandidate ? savedByCandidate.get(linkedCandidate.candidateId) || duplicateFor(linkedCandidate, existing) : undefined;
    const page = row.page || candidate.table.page;
    return {
      document_id: document!.id,
      drug_id: scope === "guideline" ? null : linkedDrug?.id || null,
      topic: candidate.table.name || candidate.guideline.titleVi,
      drug_name: row.drugName,
      clinical_context: row.clinicalContext,
      recommendation_summary: "",
      dose: row.dose,
      renal_adjustment: row.renalAdjustment,
      hepatic_adjustment: row.hepaticAdjustment,
      contraindications: row.contraindications,
      monitoring: row.monitoring,
      recommendation_class: "",
      evidence_level: "",
      page_reference: `${candidate.guideline.titleVi}${page ? ` — ${page}` : ""}${candidate.table.number ? ` — ${candidate.table.number}` : ""}`,
      source_order: index + 1,
      table_kind: "data" as const,
      table_row_role: "body" as const,
      table_cells: row.tableCells,
      provenance: candidate.provenance,
    };
  }).filter((entry) => scope !== "link_existing" || Boolean(entry.drug_id));
  await createGuidelineEntries(userId, entries);

  const linkedIds = entries.flatMap((entry) => entry.drug_id ? [entry.drug_id] : []);
  for (const drugId of linkedIds) {
    const drug = getAllThuoc().find((item) => item.id === drugId);
    if (drug && !drug.guidelineReferences.includes(document.id)) updateThuoc(drug.id, { guidelineReferences: [...drug.guidelineReferences, document.id] });
  }
  return { guidelineId: document.id, savedDrugIds: savedDrugs.map((drug) => drug.id), skippedDrugNames };
}
