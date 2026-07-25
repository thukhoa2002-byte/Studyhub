import type { Drug } from "../types/drug.ts";

const transitions: Record<Drug["status"], Drug["status"][]> = {
  draft: ["draft", "in_review", "published"],
  in_review: ["in_review", "reviewed", "draft", "published"],
  reviewed: ["reviewed", "published", "in_review", "draft"],
  published: ["published", "archived"],
  archived: ["archived", "draft", "published"],
};

export function normalizeDrugSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function validateDrugDraft(input: Pick<Drug, "genericName">): string[] {
  return input.genericName.trim() ? [] : ["Tên hoạt chất là bắt buộc."];
}

export function validateDrugPublish(drug: Pick<Drug, "genericName" | "status" | "sourceVerified" | "references" | "sourceReferences">): string[] {
  const errors = validateDrugDraft(drug);
  if (!drug.sourceVerified) errors.push("Thuốc chưa được xác minh nguồn.");
  if (drug.references.length === 0 && drug.sourceReferences.length === 0) errors.push("Thuốc cần ít nhất một nguồn tham khảo trước khi xuất bản.");
  return errors;
}

export function validateDrugStatusTransition(from: Drug["status"], to: Drug["status"]): string[] {
  return transitions[from].includes(to) ? [] : [`Không thể chuyển trạng thái Thuốc từ ${from} sang ${to}.`];
}
