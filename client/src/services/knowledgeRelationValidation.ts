export interface RelationMetadataInput {
  context_text?: string;
  source_location?: string;
  display_order?: number;
}

export function hasActiveDuplicateRelation<T extends { status: string; relation_type: string }>(items: T[], targetKey: keyof T, targetId: string, relationType: string): boolean {
  return items.some((item) => String(item[targetKey]) === targetId && item.relation_type === relationType && item.status === "active");
}

export function validateRelationMetadata(metadata: RelationMetadataInput): string[] {
  const errors: string[] = [];
  if (metadata.display_order !== undefined && (!Number.isFinite(Number(metadata.display_order)) || Number(metadata.display_order) < 0)) errors.push("Thứ tự hiển thị phải là số không âm.");
  return errors;
}
