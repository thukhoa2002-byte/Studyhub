import assert from "node:assert/strict";
import test from "node:test";
import { validateSectionParentChange } from "./guidelineSectionValidation.ts";

const sections = [
  { id: "root", guideline_id: "g1", parent_section_id: null },
  { id: "child", guideline_id: "g1", parent_section_id: "root" },
  { id: "other", guideline_id: "g2", parent_section_id: null },
];

test("section parent may be a section in the same guideline", () => {
  assert.deepEqual(validateSectionParentChange(null, "g1", "root", sections), []);
});

test("section hierarchy rejects self, descendant and cross-guideline parents", () => {
  assert.ok(validateSectionParentChange("root", "g1", "root", sections).length > 0);
  assert.ok(validateSectionParentChange("root", "g1", "child", sections).some((error) => /con làm section cha/.test(error)));
  assert.ok(validateSectionParentChange("child", "g1", "other", sections).some((error) => /cùng Guideline/.test(error)));
});

test("section hierarchy detects an existing cycle", () => {
  const cyclic = [
    { id: "a", guideline_id: "g1", parent_section_id: "b" },
    { id: "b", guideline_id: "g1", parent_section_id: "a" },
  ];
  assert.ok(validateSectionParentChange(null, "g1", "a", cyclic).some((error) => /vòng lặp/.test(error)));
});
