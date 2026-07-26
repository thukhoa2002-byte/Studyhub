import assert from "node:assert/strict";
import test from "node:test";
import { calculatorEvidenceFor, isEvidencePublishable, publicEvidenceSummary } from "./evidenceRegistry.ts";
import { calculatorMethodRegistry } from "./methodRegistry.ts";
import "./platformRegistry.ts";
import type { CalculatorEvidenceProfile } from "./platformTypes.ts";

test("published method has an authoritative record, clinical fixture and stable evidence identity", () => {
  const implementation = calculatorMethodRegistry.get("renal_function", "egfr_ckd_epi_2021_creatinine");
  assert.ok(implementation);
  const evidence = calculatorMethodRegistry.evidenceFor(implementation!);
  assert.equal(isEvidencePublishable(evidence).length, 0);
  assert.ok(evidence.records.some((item) => item.role === "original_derivation" && item.doi));
  assert.ok(evidence.fixtures.some((item) => item.fixtureKind === "clinical_reference" && item.sourceEvidenceId === evidence.primaryEvidenceId));
  assert.equal(Object.isFrozen(evidence.records), true);
});

test("synthetic fixtures, missing authority and conflicts cannot satisfy publication evidence", () => {
  const synthetic: CalculatorEvidenceProfile = {
    records: [{ evidenceId: "synthetic", role: "implementation_fixture", title: "Synthetic", citationText: "Synthetic", supportedClaims: ["reference_result"], verificationStatus: "verified" }],
    fixtures: [{ fixtureId: "fixture", methodKey: "test", implementationVersion: "1.0.0", sourceEvidenceId: "synthetic", fixtureKind: "synthetic", rawInputs: {}, normalizedInputs: {}, expectedRawOutput: 1, acceptedTolerance: 0.01 }],
    verification: { formulaTranscriptionVerified: true, unitsVerified: true, boundaryRulesVerified: true, referenceFixturesVerified: true, sourceConsistencyVerified: true },
  };
  assert.match(isEvidencePublishable(synthetic).join(" "), /thẩm quyền/);
  const conflict = { ...synthetic, verification: { ...synthetic.verification, conflictNote: "Conflicting coefficient" } };
  assert.match(isEvidencePublishable(conflict).join(" "), /xung đột/);
});

test("historical execution snapshot retains the evidence and source version used", () => {
  const execution = calculatorMethodRegistry.calculateWithSnapshot("bmi", "bmi_adult", { weight: 70, height: 1.75 });
  assert.equal(execution.snapshot.primaryEvidenceId, "spec-who-bmi-adult");
  assert.equal(execution.snapshot.sourceVersion, "WHO adult BMI classification");
  assert.equal(execution.result.primaryEvidenceId, execution.snapshot.primaryEvidenceId);
});

test("public evidence summary exposes citation only and no internal implementation path", () => {
  const implementation = calculatorMethodRegistry.get("bmi", "bmi_adult");
  const summary = publicEvidenceSummary(calculatorEvidenceFor(implementation!));
  assert.ok(summary?.citation.includes("World Health Organization"));
  assert.doesNotMatch(JSON.stringify(summary), /src\/|repository|fixture-/i);
});
