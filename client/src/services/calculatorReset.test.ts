import assert from "node:assert/strict";
import test from "node:test";
import { getAllCalculators, getCalculatorFilterOptions, searchCalculators } from "./calculatorService.ts";

test("calculator catalog is empty after reset", () => {
  assert.deepEqual(getAllCalculators(), []);
  assert.deepEqual(searchCalculators("BMI"), []);
  assert.deepEqual(searchCalculators("", "all", "all", true), []);
  assert.deepEqual(getCalculatorFilterOptions(), { specialties: [], categories: [] });
});
