import type { CalculatorInputField } from "./types.ts";

type UnitFamily = "mass" | "creatinine" | "length" | "none";

const aliases: Record<string, string> = {
  "µmol/l": "umol/l",
  "μmol/l": "umol/l",
  "mg/dl": "mg/dl",
  "mg/l": "mg/l",
  cm: "cm",
  m: "m",
  kg: "kg",
  g: "g",
};

function normalized(unit: string): string {
  return aliases[unit.trim().toLowerCase()] || unit.trim().toLowerCase();
}

function family(unit: string): UnitFamily {
  const value = normalized(unit);
  if (["mg/dl", "mg/l", "umol/l"].includes(value)) return "creatinine";
  if (["kg", "g"].includes(value)) return "mass";
  if (["cm", "m"].includes(value)) return "length";
  return "none";
}

export function canConvertUnit(from: string, to: string): boolean {
  return normalized(from) === normalized(to) || (family(from) !== "none" && family(from) === family(to));
}

export function convertUnit(value: number, from: string, to: string): number {
  const source = normalized(from);
  const target = normalized(to);
  if (!Number.isFinite(value)) throw new Error("Giá trị đơn vị không hợp lệ.");
  if (source === target) return value;
  if (!canConvertUnit(source, target)) throw new Error(`Không thể quy đổi từ ${from} sang ${to}.`);

  if (family(source) === "creatinine") {
    const asMgDl = source === "mg/dl" ? value : source === "mg/l" ? value / 10 : value / 88.4;
    return target === "mg/dl" ? asMgDl : target === "mg/l" ? asMgDl * 10 : asMgDl * 88.4;
  }
  if (family(source) === "mass") {
    const asKg = source === "kg" ? value : value / 1000;
    return target === "kg" ? asKg : asKg * 1000;
  }
  if (family(source) === "length") {
    const asCm = source === "cm" ? value : value * 100;
    return target === "cm" ? asCm : asCm / 100;
  }
  return value;
}

export function unitForField(field: CalculatorInputField, inputs: Record<string, unknown>): string | null {
  const requested = inputs[field.unitKey || `${field.id}__unit`];
  const unit = typeof requested === "string" && requested.trim()
    ? requested
    : field.displayUnit || field.unit || field.canonicalUnit || "";
  if (!unit) return field.canonicalUnit || null;
  if (field.allowedUnits?.length && !field.allowedUnits.some((candidate) => normalized(candidate) === normalized(unit))) return null;
  return unit;
}

export function toCanonicalInputValue(field: CalculatorInputField, inputs: Record<string, unknown>): number | null {
  const raw = inputs[field.id];
  const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
  if (!Number.isFinite(value)) return null;
  const displayUnit = unitForField(field, inputs);
  const canonicalUnit = field.canonicalUnit || field.displayUnit || field.unit;
  if (!canonicalUnit || !displayUnit) return value;
  return convertUnit(value, displayUnit, canonicalUnit);
}

export function canonicalizeInputs(fields: CalculatorInputField[], inputs: Record<string, unknown>): Record<string, unknown> {
  const canonical = { ...inputs };
  for (const field of fields) {
    if (field.type !== "number") continue;
    const raw = inputs[field.id];
    if (raw === undefined || raw === null || raw === "") continue;
    canonical[field.id] = toCanonicalInputValue(field, inputs);
  }
  return canonical;
}
