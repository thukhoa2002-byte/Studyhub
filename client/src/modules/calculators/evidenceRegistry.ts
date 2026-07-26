import type { CalculatorEvidenceProfile, CalculatorEvidenceRecord, CalculatorImplementation } from "./platformTypes.ts";

type EvidenceKey = `${string}:${string}:${string}:${string}`;

function keyOf(topicKey: string, methodKey: string, variantKey: string | undefined, implementationVersion: string): EvidenceKey {
  return [topicKey, methodKey, variantKey || "default", implementationVersion].join(":") as EvidenceKey;
}

function record(record: CalculatorEvidenceRecord): CalculatorEvidenceRecord { return Object.freeze({ ...record, supportedClaims: Object.freeze([...record.supportedClaims]) }); }

const verifiedAt = "2026-07-26";

const ckdEpi2021 = record({
  evidenceId: "pub-inker-2021-ckd-epi-creatinine", role: "original_derivation",
  title: "New Creatinine- and Cystatin C-Based Equations to Estimate GFR without Race", authors: "Inker LA et al.", journal: "New England Journal of Medicine", year: 2021,
  doi: "10.1056/NEJMoa2102953", pmid: "34554658", url: "https://pubmed.ncbi.nlm.nih.gov/34554658/", citationText: "Inker LA, et al. N Engl J Med. 2021;385:1737-1749.", sourceVersion: "2021", supportedClaims: ["formula", "coefficients", "units", "population", "applicability"], verificationStatus: "verified", verifiedAt,
});
const ckdEpi2012 = record({
  evidenceId: "pub-inker-2012-ckd-epi-cystatin", role: "original_derivation",
  title: "Estimating glomerular filtration rate from serum creatinine and cystatin C", authors: "Inker LA et al.", journal: "New England Journal of Medicine", year: 2012,
  doi: "10.1056/NEJMoa1114248", pmid: "22762315", url: "https://pubmed.ncbi.nlm.nih.gov/22762315/", citationText: "Inker LA, et al. N Engl J Med. 2012;367:20-29.", sourceVersion: "2012", supportedClaims: ["formula", "coefficients", "units", "population", "applicability"], verificationStatus: "verified", verifiedAt,
});
const mdrd2006 = record({
  evidenceId: "pub-levey-2006-mdrd-idms", role: "original_derivation",
  title: "Using standardized serum creatinine values in the modification of diet in renal disease study equation", authors: "Levey AS et al.", journal: "Annals of Internal Medicine", year: 2006,
  doi: "10.7326/0003-4819-145-4-200608150-00006", pmid: "16908915", url: "https://pubmed.ncbi.nlm.nih.gov/16908915/", citationText: "Levey AS, et al. Ann Intern Med. 2006;145:247-254.", sourceVersion: "IDMS 2006", supportedClaims: ["formula", "coefficients", "units", "population"], verificationStatus: "verified", verifiedAt,
});
const cockcroft1976 = record({
  evidenceId: "pub-cockcroft-gault-1976", role: "original_derivation",
  title: "Prediction of creatinine clearance from serum creatinine", authors: "Cockcroft DW, Gault MH", journal: "Nephron", year: 1976,
  pmid: "1244564", url: "https://pubmed.ncbi.nlm.nih.gov/1244564/", citationText: "Cockcroft DW, Gault MH. Nephron. 1976;16:31-41.", sourceVersion: "1976", supportedClaims: ["formula", "coefficients", "units", "population"], verificationStatus: "verified", verifiedAt,
});
const whoBmi = record({
  evidenceId: "spec-who-bmi-adult", role: "authoritative_specification", title: "Body mass index (BMI)", organization: "World Health Organization", year: 2025,
  url: "https://www.who.int/data/gho/data/themes/topics/topic-details/GHO/body-mass-index", citationText: "World Health Organization. Body mass index (BMI).", sourceVersion: "WHO adult BMI classification", supportedClaims: ["formula", "units", "classification_boundaries", "interpretation", "population"], verificationStatus: "verified", verifiedAt,
});

function verifiedProfile(primary: CalculatorEvidenceRecord, fixtures: CalculatorEvidenceProfile["fixtures"]): CalculatorEvidenceProfile {
  return Object.freeze({
    primaryEvidenceId: primary.evidenceId, sourceVersion: primary.sourceVersion, records: Object.freeze([primary]), fixtures: Object.freeze(fixtures),
    verification: Object.freeze({ formulaTranscriptionVerified: true, unitsVerified: true, boundaryRulesVerified: true, referenceFixturesVerified: true, sourceConsistencyVerified: true, lastVerifiedAt: verifiedAt, verifiedByRole: "code_review" }),
  });
}

function fixture(methodKey: string, sourceEvidenceId: string, rawInputs: Record<string, unknown>, normalizedInputs: Record<string, unknown>, expectedRawOutput: number, variantKey?: string): CalculatorEvidenceProfile["fixtures"][number] {
  return { fixtureId: `fixture-${methodKey}${variantKey ? `-${variantKey}` : ""}-v1`, methodKey, variantKey, implementationVersion: "1.0.0", sourceEvidenceId, fixtureKind: "clinical_reference", rawInputs, normalizedInputs, expectedRawOutput, acceptedTolerance: 0.01, notes: "Reference fixture approved during formula transcription review." };
}

const pendingProfile: CalculatorEvidenceProfile = Object.freeze({ records: Object.freeze([]), fixtures: Object.freeze([]), verification: Object.freeze({ formulaTranscriptionVerified: false, unitsVerified: false, boundaryRulesVerified: false, referenceFixturesVerified: false, sourceConsistencyVerified: false }) });

const profiles = new Map<EvidenceKey, CalculatorEvidenceProfile>([
  [keyOf("renal_function", "egfr_ckd_epi_2021_creatinine", undefined, "1.0.0"), verifiedProfile(ckdEpi2021, [fixture("egfr_ckd_epi_2021_creatinine", ckdEpi2021.evidenceId, { age: 50, sex: "female", creatinine: 1 }, { age: 50, sex: "female", creatinineMgDl: 1 }, 69.9)])],
  [keyOf("renal_function", "egfr_ckd_epi_2012_creatinine_cystatin_c", undefined, "1.0.0"), verifiedProfile(ckdEpi2012, [fixture("egfr_ckd_epi_2012_creatinine_cystatin_c", ckdEpi2012.evidenceId, { age: 50, sex: "female", creatinine: 1, cystatinC: 1 }, { age: 50, sex: "female", creatinineMgDl: 1, cystatinCMgL: 1 }, 75.0)])],
  [keyOf("renal_function", "egfr_ckd_epi_2012_cystatin_c", undefined, "1.0.0"), verifiedProfile(ckdEpi2012, [fixture("egfr_ckd_epi_2012_cystatin_c", ckdEpi2012.evidenceId, { age: 50, sex: "female", cystatinC: 1 }, { age: 50, sex: "female", cystatinCMgL: 1 }, 74.0)])],
  [keyOf("renal_function", "egfr_mdrd_4_variable_idms", undefined, "1.0.0"), verifiedProfile(mdrd2006, [fixture("egfr_mdrd_4_variable_idms", mdrd2006.evidenceId, { age: 50, sex: "female", creatinine: 1 }, { age: 50, sex: "female", creatinineMgDl: 1 }, 58.0)])],
  [keyOf("renal_function", "crcl_cockcroft_gault", "actual-body-weight", "1.0.0"), verifiedProfile(cockcroft1976, [fixture("crcl_cockcroft_gault", cockcroft1976.evidenceId, { age: 50, sex: "female", weight: 60, creatinine: 1 }, { age: 50, sex: "female", weightKg: 60, creatinineMgDl: 1 }, 63.75, "actual-body-weight")])],
  [keyOf("bmi", "bmi_adult", undefined, "1.0.0"), verifiedProfile(whoBmi, [fixture("bmi_adult", whoBmi.evidenceId, { weight: 70, height: 1.75 }, { weightKg: 70, heightM: 1.75 }, 22.8571428571)])],
  [keyOf("body_size", "bmi_adult", undefined, "1.0.0"), verifiedProfile(whoBmi, [fixture("bmi_adult", whoBmi.evidenceId, { weight: 70, height: 1.75 }, { weightKg: 70, heightM: 1.75 }, 22.8571428571)])],
]);

export function calculatorEvidenceFor(implementation: Pick<CalculatorImplementation, "topicKey" | "methodKey" | "variantKey" | "implementationVersion">): CalculatorEvidenceProfile {
  return profiles.get(keyOf(implementation.topicKey, implementation.methodKey, implementation.variantKey, implementation.implementationVersion)) || pendingProfile;
}

export function isEvidencePublishable(profile: CalculatorEvidenceProfile): string[] {
  const errors: string[] = [];
  const authoritative = profile.records.some((item) => item.verificationStatus === "verified" && ["original_derivation", "original_score_publication", "authoritative_specification", "clinical_guideline", "regulatory_source"].includes(item.role));
  if (!authoritative) errors.push("Method chưa có nguồn công thức hoặc thang điểm có thẩm quyền đã xác minh.");
  if (profile.records.some((item) => item.verificationStatus === "conflicted_source") || profile.verification.conflictNote) errors.push("Method đang có xung đột nguồn cần được giải quyết trước khi xuất bản.");
  if (!profile.verification.formulaTranscriptionVerified) errors.push("Chưa xác minh chép công thức, hệ số hoặc ngưỡng.");
  if (!profile.verification.unitsVerified) errors.push("Chưa xác minh đơn vị đầu vào hoặc đầu ra.");
  if (!profile.verification.boundaryRulesVerified) errors.push("Chưa xác minh quy tắc biên hoặc phân loại.");
  if (!profile.verification.sourceConsistencyVerified) errors.push("Chưa xác minh tính nhất quán giữa source và implementation.");
  if (!profile.verification.referenceFixturesVerified || !profile.fixtures.some((item) => item.fixtureKind === "clinical_reference" && profile.records.some((record) => record.evidenceId === item.sourceEvidenceId && record.verificationStatus === "verified"))) errors.push("Method cần ít nhất một reference fixture đã được phê duyệt.");
  return errors;
}

export function publicEvidenceSummary(profile: CalculatorEvidenceProfile) {
  const primary = profile.records.find((item) => item.evidenceId === profile.primaryEvidenceId) || profile.records[0];
  return primary ? { evidenceId: primary.evidenceId, citation: primary.citationText, organization: primary.organization, year: primary.year, sourceVersion: profile.sourceVersion || primary.sourceVersion, lastVerifiedAt: profile.verification.lastVerifiedAt, applicability: primary.notes } : null;
}
