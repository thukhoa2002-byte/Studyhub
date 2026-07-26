import { calculatorMethodRegistry } from "./methodRegistry.ts";
import type { CalculatorImplementation, CalculatorResult, CalculatorValidationResult } from "./platformTypes.ts";
import { calculateRenalReference, toStructuredReferenceResult, type ReferenceCrclVariant, type ReferenceEgfrMethod } from "./referenceToolRuntime.ts";
import { registerContentPackV2 } from "./contentPackV2.ts";

type Sex = "male" | "female";
type RenalInput = { age: number; sex: Sex; weightKg?: number; heightM?: number; creatinineMgDl?: number; cystatinCMgL?: number };

function numberValue(input: Record<string, unknown>, key: string): number | null {
  const value = input[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sexValue(input: Record<string, unknown>): Sex | null {
  return input.sex === "male" || input.sex === "female" ? input.sex : null;
}

function recordValidation(input: unknown): CalculatorValidationResult<Record<string, unknown>> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { valid: false, errors: ["Dữ liệu đầu vào phải là một đối tượng."], warnings: [] };
  return { valid: true, value: input as Record<string, unknown>, errors: [], warnings: [] };
}

function normalizeRecord(input: Record<string, unknown>): Record<string, unknown> { return { ...input }; }

function selectedUnit(input: Record<string, unknown>, field: string, fallback: string): string {
  const candidate = input[`${field}__unit`] ?? input[`${field}Unit`];
  return typeof candidate === "string" && candidate.trim() ? candidate.trim().toLowerCase() : fallback;
}

function normalizeMassKg(value: number | null, unit: string): number | null {
  if (value === null || value <= 0) return null;
  if (unit === "kg") return value;
  if (unit === "g") return value / 1000;
  if (unit === "lb" || unit === "lbs") return value * 0.45359237;
  return null;
}

function normalizeLengthM(value: number | null, unit: string): number | null {
  if (value === null || value <= 0) return null;
  if (unit === "m") return value;
  if (unit === "cm") return value / 100;
  if (unit === "in" || unit === "inch") return value * 0.0254;
  return null;
}

function normalizeCreatinineMgDl(value: number | null, unit: string): number | null {
  if (value === null || value <= 0) return null;
  if (unit === "mg/dl") return value;
  if (unit === "mg/l") return value / 10;
  if (unit === "umol/l" || unit === "µmol/l" || unit === "μmol/l") return value / 88.4;
  return null;
}

function normalizeCystatinCMgL(value: number | null, unit: string): number | null {
  if (value === null || value <= 0) return null;
  if (unit === "mg/l") return value;
  if (unit === "mg/dl") return value * 10;
  return null;
}

function bmiInput(input: Record<string, unknown>): { weightKg: number; heightM: number } | null {
  const rawWeight = numberValue(input, "weightKg") ?? numberValue(input, "weight");
  const rawHeight = numberValue(input, "heightM") ?? numberValue(input, "heightCm") ?? numberValue(input, "height");
  const weightUnit = selectedUnit(input, numberValue(input, "weightKg") !== null ? "weightKg" : "weight", "kg");
  const inferredHeightUnit = numberValue(input, "heightCm") !== null ? "cm" : "m";
  const heightField = numberValue(input, "heightM") !== null ? "heightM" : numberValue(input, "heightCm") !== null ? "heightCm" : "height";
  const weightKg = normalizeMassKg(rawWeight, weightUnit);
  const heightM = normalizeLengthM(rawHeight, selectedUnit(input, heightField, inferredHeightUnit));
  return weightKg !== null && heightM !== null ? { weightKg, heightM } : null;
}

function renalInput(input: Record<string, unknown>): RenalInput | null {
  const age = numberValue(input, "age");
  const sex = sexValue(input);
  if (age === null || age <= 0 || sex === null) return null;
  return {
    age,
    sex,
    weightKg: normalizeMassKg(numberValue(input, "weightKg") ?? numberValue(input, "weight"), selectedUnit(input, numberValue(input, "weightKg") !== null ? "weightKg" : "weight", "kg")) ?? undefined,
    heightM: normalizeLengthM(numberValue(input, "heightM") ?? numberValue(input, "heightCm") ?? numberValue(input, "height"), selectedUnit(input, numberValue(input, "heightM") !== null ? "heightM" : numberValue(input, "heightCm") !== null ? "heightCm" : "height", numberValue(input, "heightCm") !== null ? "cm" : "m")) ?? undefined,
    creatinineMgDl: normalizeCreatinineMgDl(numberValue(input, "creatinineMgDl") ?? numberValue(input, "creatinine"), selectedUnit(input, numberValue(input, "creatinineMgDl") !== null ? "creatinineMgDl" : "creatinine", "mg/dl")) ?? undefined,
    cystatinCMgL: normalizeCystatinCMgL(numberValue(input, "cystatinCMgL") ?? numberValue(input, "cystatinC"), selectedUnit(input, numberValue(input, "cystatinCMgL") !== null ? "cystatinCMgL" : "cystatinC", "mg/l")) ?? undefined,
  };
}

function unavailable(topicKey: string, methodKey: string, name: string, sourceReference: string): CalculatorResult {
  return toStructuredReferenceResult(topicKey, methodKey, name, sourceReference, "Kết quả", null, "");
}

function renalImplementation(
  methodKey: string,
  formulaName: string,
  formulaYear: number,
  egfrMethod: ReferenceEgfrMethod,
): CalculatorImplementation {
  return {
    topicKey: "renal_function",
    methodKey,
    implementationVersion: "1.0.0",
    calculationModelType: "equation",
    formulaName,
    formulaYear,
    formulaVersion: String(formulaYear),
    status: "published",
    effectiveFrom: `${formulaYear}-01-01`,
    inputSchema: [
      { key: "age", label: "Tuổi", inputType: "integer", required: true, min: 1, max: 120, unit: "years" },
      { key: "sex", label: "Giới tính sinh học", inputType: "select", required: true, options: [{ value: "female", label: "Nữ" }, { value: "male", label: "Nam" }] },
      { key: "creatinineMgDl", label: "Creatinine huyết thanh", inputType: "number", required: egfrMethod !== "cystatin", unit: "mg/dL", alternativeUnits: ["µmol/L"] },
      { key: "cystatinCMgL", label: "Cystatin C", inputType: "number", required: egfrMethod === "cystatin" || egfrMethod === "combined", unit: "mg/L", alternativeUnits: ["mg/dL"] },
    ],
    source: { primarySource: "NIDDK estimating GFR equations", sourceReference: "NIDDK CKD-EPI & MDRD estimating equations", sourceUrl: "https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/estimating-gfr-equations", verified: true, lastVerifiedAt: "2026-07-26", population: "Người lớn", applicability: "Không dùng thay thế đánh giá lâm sàng; đối chiếu chỉ định của từng công thức." },
    changelog: ["1.0.0: triển khai từ phương trình nguồn đã xác minh."],
    backwardCompatibilityNotes: "Không thay hệ số dưới cùng implementationVersion.",
    validate: recordValidation,
    normalize: (input) => renalInput(input) || input,
    calculate(input) {
      const normalized = renalInput(input);
      if (!normalized) return unavailable("renal_function", methodKey, formulaName, "NIDDK CKD-EPI & MDRD estimating equations");
      const result = calculateRenalReference({ ...normalized, weightKg: normalized.weightKg ?? null, heightM: normalized.heightM ?? null, creatinineMgDl: normalized.creatinineMgDl ?? null, cystatinCMgL: normalized.cystatinCMgL ?? null, egfrMethod, crclVariant: "actual-body-weight" });
      const output = toStructuredReferenceResult("renal_function", methodKey, formulaName, "NIDDK CKD-EPI & MDRD estimating equations", "eGFR", result.egfr, "mL/min/1,73 m²", "indexed_to_1_73m2");
      return { ...output, formulaYear, calculationDetails: [{ key: "age", label: "Tuổi", value: normalized.age }, { key: "sex", label: "Giới tính", value: normalized.sex }] };
    },
  };
}

function cockcroftImplementation(variantKey: ReferenceCrclVariant, label: string): CalculatorImplementation {
  const methodKey = "crcl_cockcroft_gault";
  return {
    topicKey: "renal_function",
    methodKey,
    variantKey,
    implementationVersion: "1.0.0",
    calculationModelType: "equation",
    formulaName: label,
    formulaYear: 1976,
    formulaVersion: "1976",
    effectiveFrom: "1976-01-01",
    inputSchema: [{ key: "age", label: "Tuổi", inputType: "integer", required: true, min: 1, max: 120 }, { key: "sex", label: "Giới tính sinh học", inputType: "select", required: true, options: [{ value: "female", label: "Nữ" }, { value: "male", label: "Nam" }] }, { key: "weightKg", label: "Cân nặng", inputType: "number", required: true, unit: "kg" }, { key: "creatinineMgDl", label: "Creatinine huyết thanh", inputType: "number", required: true, unit: "mg/dL", alternativeUnits: ["µmol/L"] }, { key: "heightM", label: "Chiều cao", inputType: "number", required: variantKey !== "actual-body-weight", unit: "m", alternativeUnits: ["cm"] }],
    source: { primarySource: "Cockcroft DW, Gault MH", sourceReference: "Prediction of creatinine clearance from serum creatinine. Nephron. 1976.", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/1244564/", verified: variantKey === "actual-body-weight", lastVerifiedAt: "2026-07-26", population: "Người lớn", applicability: variantKey === "actual-body-weight" ? "Kết quả là CrCl, không phải eGFR. Cân nặng dùng cho chỉnh liều phải theo hướng dẫn thuốc cụ thể." : "Cần nguồn chính sách chọn cân nặng/BSA được phê duyệt trước khi dùng lâm sàng." },
    changelog: ["1.0.0: triển khai Cockcroft-Gault với variant cân nặng tường minh."],
    backwardCompatibilityNotes: "Variant là một identity riêng, không tự đổi cân nặng giữa các variant.",
    status: variantKey === "actual-body-weight" ? "published" : "draft",
    validate: recordValidation,
    normalize: (input) => renalInput(input) || input,
    calculate(input) {
      const normalized = renalInput(input);
      if (!normalized || !normalized.weightKg || !normalized.creatinineMgDl || (variantKey !== "actual-body-weight" && !normalized.heightM)) return unavailable("renal_function", methodKey, label, "Cockcroft DW, Gault MH. 1976");
      const result = calculateRenalReference({ ...normalized, weightKg: normalized.weightKg, heightM: normalized.heightM ?? null, creatinineMgDl: normalized.creatinineMgDl, cystatinCMgL: null, egfrMethod: "creatinine", crclVariant: variantKey });
      const indexing = variantKey === "bsa-normalized" ? "indexed_to_1_73m2" : "absolute_ml_min";
      const output = toStructuredReferenceResult("renal_function", methodKey, label, "Cockcroft DW, Gault MH. 1976", "CrCl", result.crcl, result.crclUnit, indexing);
      return { ...output, variantKey, formulaYear: 1976, calculationDetails: [{ key: "weight", label: "Cân nặng dùng tính", value: result.selectedWeightKg ?? "—" }] };
    },
  };
}

function createBmiImplementation(topicKey: "bmi" | "body_size", status: "published" | "deprecated"): CalculatorImplementation {
  return {
  topicKey,
  methodKey: "bmi_adult",
  implementationVersion: "1.0.0",
  calculationModelType: "equation",
  formulaName: "Body Mass Index",
  source: { primarySource: "WHO BMI classification", sourceReference: "WHO BMI classification", verified: true, lastVerifiedAt: "2026-07-26", population: "Người lớn", applicability: "Diễn giải cần phù hợp quần thể lâm sàng." },
  status,
  inputSchema: [{ key: "weight", label: "Cân nặng", inputType: "number", required: true, unit: "kg", alternativeUnits: ["lb"] }, { key: "height", label: "Chiều cao", inputType: "number", required: true, unit: "m", alternativeUnits: ["cm"] }],
  changelog: ["1.0.0: triển khai BMI cơ bản."],
  validate: recordValidation,
  normalize: (input) => bmiInput(input) || {},
  calculate(input) {
    const normalized = bmiInput(input) || (typeof input.weightKg === "number" && typeof input.heightM === "number" ? { weightKg: input.weightKg, heightM: input.heightM } : null);
    const value = normalized ? normalized.weightKg / (normalized.heightM * normalized.heightM) : null;
    const result = toStructuredReferenceResult(topicKey, "bmi_adult", "Body Mass Index", "WHO BMI classification", "BMI", value, "kg/m²");
    const category = value === null ? undefined : value < 18.5 ? "underweight" : value < 25 ? "normal" : value < 30 ? "overweight" : "obesity";
    return { ...result, category, classification: category, interpretation: category === "underweight" ? "Thiếu cân" : category === "normal" ? "BMI trong khoảng phân loại bình thường của WHO" : category === "overweight" ? "Thừa cân" : category === "obesity" ? "Béo phì" : undefined, calculationDetails: normalized ? [{ key: "weightKg", label: "Cân nặng chuẩn hóa", value: normalized.weightKg }, { key: "heightM", label: "Chiều cao chuẩn hóa", value: normalized.heightM }] : [] };
  },
};
}

const childPughInrScaffold: CalculatorImplementation = {
  topicKey: "child_pugh", methodKey: "child_pugh_inr", implementationVersion: "0.0.0", calculationModelType: "threshold_point_score", formulaName: "Child-Pugh (INR)", formulaVersion: "source_required", status: "draft", inputSchema: [],
  source: { primarySource: "Chưa có bảng ngưỡng Child-Pugh được phê duyệt trong StudyHub", sourceReference: "SOURCE_REQUIRED: Child-Pugh INR threshold table", verified: false, population: "Bệnh gan mạn", applicability: "Bị khóa: không được tính hoặc xuất bản trước khi có nguồn ngưỡng INR, bilirubin, albumin, cổ trướng và bệnh não gan được phê duyệt." },
  changelog: ["0.0.0: scaffold an toàn; chưa có logic hay ngưỡng điểm."],
  validate: recordValidation, normalize: normalizeRecord,
  calculate: () => unavailable("child_pugh", "child_pugh_inr", "Child-Pugh (INR)", "SOURCE_REQUIRED"),
};

const childPughPtScaffold: CalculatorImplementation = {
  topicKey: "child_pugh", methodKey: "child_pugh_pt_prolongation", implementationVersion: "0.0.0", calculationModelType: "threshold_point_score", formulaName: "Child-Pugh (PT prolongation)", formulaVersion: "source_required", status: "draft", inputSchema: [],
  source: { primarySource: "Chưa có bảng ngưỡng Child-Pugh được phê duyệt trong StudyHub", sourceReference: "SOURCE_REQUIRED: Child-Pugh PT prolongation threshold table", verified: false, population: "Bệnh gan mạn", applicability: "Bị khóa: không được tính hoặc xuất bản trước khi có nguồn ngưỡng PT prolongation, bilirubin, albumin, cổ trướng và bệnh não gan được phê duyệt." },
  changelog: ["0.0.0: scaffold an toàn; chưa có logic hay ngưỡng điểm."],
  validate: recordValidation, normalize: normalizeRecord,
  calculate: () => unavailable("child_pugh", "child_pugh_pt_prolongation", "Child-Pugh (PT prolongation)", "SOURCE_REQUIRED"),
};

const ckdEpi2021CombinedScaffold: CalculatorImplementation = {
  topicKey: "renal_function", methodKey: "egfr_ckd_epi_2021_creatinine_cystatin_c", implementationVersion: "0.0.0", calculationModelType: "equation", formulaName: "CKD-EPI Creatinine-Cystatin C 2021", formulaYear: 2021, formulaVersion: "source_required", status: "draft", inputSchema: [],
  source: { primarySource: "Chưa có đặc tả phương trình CKD-EPI 2021 creatinine-cystatin C được phê duyệt trong StudyHub", sourceReference: "SOURCE_REQUIRED: CKD-EPI 2021 creatinine-cystatin C", verified: false, population: "Người lớn", applicability: "Bị khóa: không dùng phương trình CKD-EPI 2012 thay cho method 2021." },
  changelog: ["0.0.0: scaffold an toàn; không tái sử dụng hệ số 2012 cho method 2021."],
  validate: recordValidation, normalize: normalizeRecord,
  calculate: () => unavailable("renal_function", "egfr_ckd_epi_2021_creatinine_cystatin_c", "CKD-EPI Creatinine-Cystatin C 2021", "SOURCE_REQUIRED"),
};

export function registerBuiltInCalculatorMethods(): void {
  if (calculatorMethodRegistry.getTopic("renal_function")) return;
  calculatorMethodRegistry.registerTopic({ topicKey: "renal_function", title: "Chức năng thận", defaultMethodKey: "egfr_ckd_epi_2021_creatinine", enabledMethodKeys: ["egfr_ckd_epi_2021_creatinine", "egfr_ckd_epi_2012_creatinine_cystatin_c", "egfr_ckd_epi_2012_cystatin_c", "egfr_mdrd_4_variable_idms", "crcl_cockcroft_gault"], comparisonEnabled: true });
  calculatorMethodRegistry.registerTopic({ topicKey: "bmi", title: "BMI", defaultMethodKey: "bmi_adult", enabledMethodKeys: ["bmi_adult"] });
  calculatorMethodRegistry.registerTopic({ topicKey: "body_size", title: "Chỉ số cơ thể (legacy)", defaultMethodKey: "bmi_adult", enabledMethodKeys: ["bmi_adult"] });
  calculatorMethodRegistry.registerTopic({ topicKey: "child_pugh", title: "Child-Pugh", enabledMethodKeys: [] });
  calculatorMethodRegistry.register(renalImplementation("egfr_ckd_epi_2021_creatinine", "CKD-EPI Creatinine 2021", 2021, "creatinine"));
  calculatorMethodRegistry.register(renalImplementation("egfr_ckd_epi_2012_creatinine_cystatin_c", "CKD-EPI Creatinine-Cystatin C 2012", 2012, "combined"));
  calculatorMethodRegistry.register(renalImplementation("egfr_ckd_epi_2012_cystatin_c", "CKD-EPI Cystatin C 2012", 2012, "cystatin"));
  calculatorMethodRegistry.register(renalImplementation("egfr_mdrd_4_variable_idms", "MDRD 4-variable IDMS", 2006, "mdrd"));
  calculatorMethodRegistry.register(cockcroftImplementation("actual-body-weight", "Estimated Creatinine Clearance — Cockcroft-Gault"));
  calculatorMethodRegistry.register(cockcroftImplementation("ideal-body-weight", "Cockcroft-Gault ideal body weight"));
  calculatorMethodRegistry.register(cockcroftImplementation("adjusted-body-weight", "Cockcroft-Gault adjusted body weight"));
  calculatorMethodRegistry.register(cockcroftImplementation("bsa-normalized", "Cockcroft-Gault BSA-normalized"));
  calculatorMethodRegistry.register(createBmiImplementation("bmi", "published"));
  calculatorMethodRegistry.register(createBmiImplementation("body_size", "deprecated"));
  calculatorMethodRegistry.register(childPughInrScaffold);
  calculatorMethodRegistry.register(childPughPtScaffold);
  calculatorMethodRegistry.register(ckdEpi2021CombinedScaffold);
  registerContentPackV2(calculatorMethodRegistry);
}

registerBuiltInCalculatorMethods();

const legacyImplementationKeys = new Set(["bmi", "bmi_adult", "cockcroft-gault", "curb-65", "egfr_ckd_epi_2021_creatinine", "egfr_ckd_epi_2021_creatinine_cystatin_c", "egfr_ckd_epi_2012_creatinine_cystatin_c", "egfr_ckd_epi_2012_cystatin_c", "egfr_mdrd_4_variable_idms", "crcl_cockcroft_gault", "child_pugh_inr", "child_pugh_pt_prolongation", "cha2ds2_vasc", "has_bled", "curb_65", "qsofa", "heart_score", "qtc_bazett", "qtc_fridericia", "qtc_framingham", "qtc_hodges", "meld_original"]);
export function isSupportedCalculatorImplementationKey(key: string | null | undefined): boolean { return Boolean(key && legacyImplementationKeys.has(key)); }
