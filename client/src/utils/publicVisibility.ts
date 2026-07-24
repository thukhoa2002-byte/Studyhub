export function isPublishedStatus(status: unknown): boolean {
  return status === "published";
}

export function onlyPublished<T extends { status?: unknown }>(items: T[]): T[] {
  return items.filter((item) => isPublishedStatus(item.status));
}
