import assert from "node:assert/strict";
import test from "node:test";
import { parseDrugJsonPayload, validateDrugRecord, validateGuidelineTableBundle } from "../services/drugImport.js";

const validDrug = {
  id: "aspirin",
  slug: "aspirin",
  genericName: "Aspirin",
  titleVi: "Aspirin",
  indications: "",
  dosing: "",
  references: [],
};

test("parse accepts a single drug object", () => {
  const candidates = parseDrugJsonPayload(JSON.stringify(validDrug));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].parsedDrug.id, "aspirin");
  assert.equal(candidates[0].parsedDrug.status, "draft");
  assert.equal(candidates[0].parsedDrug.sourceVerified, false);
});

test("parse accepts a drugs wrapper and isolates duplicate ids", () => {
  const candidates = parseDrugJsonPayload({ drugs: [validDrug, { ...validDrug, slug: "aspirin-2" }] });
  assert.equal(candidates.length, 2);
  assert.match(candidates[1].validationErrors[0], /trùng trong batch/);
});

test("parse rejects malformed JSON and invalid record shape", () => {
  assert.throws(() => parseDrugJsonPayload("{"), /JSON không hợp lệ/);
  assert.throws(() => parseDrugJsonPayload({ drugs: "invalid" }), /Trường drugs phải là/);
});

test("validation rejects published or source-verified imports", () => {
  const result = validateDrugRecord({ ...validDrug, status: "published", sourceVerified: true });
  assert.ok(result.errors.some((error) => error.startsWith("status:")));
  assert.ok(result.errors.some((error) => error.startsWith("sourceVerified:")));
});

test("validation reports missing required fields", () => {
  const result = validateDrugRecord({ titleVi: "Không đủ trường" });
  assert.ok(result.errors.some((error) => error.startsWith("id:")));
  assert.ok(result.errors.some((error) => error.startsWith("genericName:")));
});

test("guideline table validation keeps each active ingredient as a separate row", () => {
  const result = validateGuidelineTableBundle({
    guideline: { title: "Beta-blocker guideline" },
    rows: [
      { drugName: "Bisoprolol", dose: "5 mg once daily" },
      { drugName: "Carvedilol", dose: "12.5 mg twice daily" },
      { drugName: "Metoprolol succinate", dose: "50 mg once daily" },
      { drugName: "Nebivolol", dose: "5 mg once daily" },
    ],
    provenance: [{ tableName: "Table 4", page: "12" }],
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.some((warning) => warning.startsWith("rows[")), false);
});

test("guideline table validation requires a drug name and flags missing dose for review", () => {
  const result = validateGuidelineTableBundle({
    guideline: { title: "Guideline" },
    rows: [{ drugName: "Aspirin", dose: "" }, { drugName: "", dose: "10 mg" }],
    provenance: [],
  });
  assert.ok(result.errors.includes("rows[1].drugName: bắt buộc."));
  assert.ok(result.warnings.includes("rows[0].dose: chưa nhận diện được liều."));
  assert.ok(result.warnings.includes("provenance: chưa có nguồn đầy đủ cho bảng."));
});
