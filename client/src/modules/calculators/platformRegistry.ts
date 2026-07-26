import { calculatorMethodRegistry } from "./methodRegistry.ts";
import type { CalculatorImplementation, CalculatorResult, CalculatorValidationResult } from "./platformTypes.ts";
import { calculateRenalReference, toStructuredReferenceResult, type ReferenceCrclVariant, type ReferenceEgfrMethod } from "./referenceToolRuntime.ts";

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

function renalInput(input: Record<string, unknown>): RenalInput | null {
  const age = numberValue(input, "age");
  const sex = sexValue(input);
  if (age === null || age <= 0 || sex === null) return null;
  return {
    age,
    sex,
    weightKg: numberValue(input, "weightKg") ?? undefined,
    heightM: numberValue(input, "heightM") ?? undefined,
    creatinineMgDl: numberValue(input, "creatinineMgDl") ?? undefined,
    cystatinCMgL: numberValue(input, "cystatinCMgL") ?? undefined,
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
    normalize: normalizeRecord,
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
    status: "published",
    effectiveFrom: "1976-01-01",
    inputSchema: [{ key: "age", label: "Tuổi", inputType: "integer", required: true, min: 1, max: 120 }, { key: "sex", label: "Giới tính sinh học", inputType: "select", required: true, options: [{ value: "female", label: "Nữ" }, { value: "male", label: "Nam" }] }, { key: "weightKg", label: "Cân nặng", inputType: "number", required: true, unit: "kg" }, { key: "creatinineMgDl", label: "Creatinine huyết thanh", inputType: "number", required: true, unit: "mg/dL", alternativeUnits: ["µmol/L"] }, { key: "heightM", label: "Chiều cao", inputType: "number", required: variantKey !== "actual-body-weight", unit: "m", alternativeUnits: ["cm"] }],
    source: { primarySource: "Cockcroft DW, Gault MH", sourceReference: "Prediction of creatinine clearance from serum creatinine. Nephron. 1976.", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/1244564/", verified: true, lastVerifiedAt: "2026-07-26", population: "Người lớn", applicability: "Cân nặng dùng cho chỉnh liều phải tuân thủ hướng dẫn thuốc cụ thể." },
    changelog: ["1.0.0: triển khai Cockcroft-Gault với variant cân nặng tường minh."],
    backwardCompatibilityNotes: "Variant là một identity riêng, không tự đổi cân nặng giữa các variant.",
    validate: recordValidation,
    normalize: normalizeRecord,
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

const bmiImplementation: CalculatorImplementation = {
  topicKey: "body_size",
  methodKey: "bmi_adult",
  implementationVersion: "1.0.0",
  calculationModelType: "equation",
  formulaName: "Body Mass Index",
  source: { primarySource: "WHO BMI classification", sourceReference: "WHO BMI classification", verified: true, lastVerifiedAt: "2026-07-26", population: "Người lớn", applicability: "Diễn giải cần phù hợp quần thể lâm sàng." },
  status: "published",
  inputSchema: [{ key: "weightKg", label: "Cân nặng", inputType: "number", required: true, unit: "kg" }, { key: "heightM", label: "Chiều cao", inputType: "number", required: true, unit: "m", alternativeUnits: ["cm"] }],
  changelog: ["1.0.0: triển khai BMI cơ bản."],
  validate: recordValidation,
  normalize: normalizeRecord,
  calculate(input) {
    const weight = numberValue(input, "weightKg"); const height = numberValue(input, "heightM");
    const value = weight !== null && height !== null && weight > 0 && height > 0 ? weight / (height * height) : null;
    return toStructuredReferenceResult("body_size", "bmi_adult", "Body Mass Index", "WHO BMI classification", "BMI", value, "kg/m²");
  },
};

export function registerBuiltInCalculatorMethods(): void {
  if (calculatorMethodRegistry.getTopic("renal_function")) return;
  calculatorMethodRegistry.registerTopic({ topicKey: "renal_function", title: "Chức năng thận", defaultMethodKey: "egfr_ckd_epi_2021_creatinine", enabledMethodKeys: ["egfr_ckd_epi_2021_creatinine", "egfr_ckd_epi_2021_creatinine_cystatin_c", "egfr_ckd_epi_2012_cystatin_c", "egfr_mdrd_4_variable_idms", "crcl_cockcroft_gault"], comparisonEnabled: true });
  calculatorMethodRegistry.registerTopic({ topicKey: "body_size", title: "Chỉ số cơ thể", defaultMethodKey: "bmi_adult", enabledMethodKeys: ["bmi_adult"] });
  calculatorMethodRegistry.register(renalImplementation("egfr_ckd_epi_2021_creatinine", "CKD-EPI Creatinine 2021", 2021, "creatinine"));
  calculatorMethodRegistry.register(renalImplementation("egfr_ckd_epi_2021_creatinine_cystatin_c", "CKD-EPI Creatinine-Cystatin C 2012", 2012, "combined"));
  calculatorMethodRegistry.register(renalImplementation("egfr_ckd_epi_2012_cystatin_c", "CKD-EPI Cystatin C 2012", 2012, "cystatin"));
  calculatorMethodRegistry.register(renalImplementation("egfr_mdrd_4_variable_idms", "MDRD 4-variable IDMS", 2006, "mdrd"));
  calculatorMethodRegistry.register(cockcroftImplementation("actual-body-weight", "Cockcroft-Gault actual body weight"));
  calculatorMethodRegistry.register(cockcroftImplementation("ideal-body-weight", "Cockcroft-Gault ideal body weight"));
  calculatorMethodRegistry.register(cockcroftImplementation("adjusted-body-weight", "Cockcroft-Gault adjusted body weight"));
  calculatorMethodRegistry.register(cockcroftImplementation("bsa-normalized", "Cockcroft-Gault BSA-normalized"));
  calculatorMethodRegistry.register(bmiImplementation);
}

registerBuiltInCalculatorMethods();

const legacyImplementationKeys = new Set(["bmi", "bmi_adult", "cockcroft-gault", "curb-65", "egfr_ckd_epi_2021_creatinine", "egfr_ckd_epi_2021_creatinine_cystatin_c", "egfr_ckd_epi_2012_cystatin_c", "egfr_mdrd_4_variable_idms", "crcl_cockcroft_gault"]);
export function isSupportedCalculatorImplementationKey(key: string | null | undefined): boolean { return Boolean(key && legacyImplementationKeys.has(key)); }
