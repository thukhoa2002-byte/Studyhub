import type { GuidelineSectionRecord } from "./guidelineCoreTypes";

export function validateSectionParentChange(
  sectionId: string | null,
  guidelineId: string,
  parentSectionId: string | null,
  sections: Array<Pick<GuidelineSectionRecord, "id" | "guideline_id" | "parent_section_id">>,
): string[] {
  if (!parentSectionId) return [];
  if (parentSectionId === sectionId) return ["Section không thể làm cha của chính nó."];
  const parent = sections.find((section) => section.id === parentSectionId);
  if (!parent || parent.guideline_id !== guidelineId) return ["Section cha phải thuộc cùng Guideline."];

  const byId = new Map(sections.map((section) => [section.id, section]));
  const seen = new Set<string>();
  let current: string | null = parentSectionId;
  while (current) {
    if (seen.has(current)) return ["Cây section hiện có vòng lặp."];
    seen.add(current);
    if (current === sectionId) return ["Không thể chọn section con làm section cha."];
    current = byId.get(current)?.parent_section_id ?? null;
  }
  return [];
}
