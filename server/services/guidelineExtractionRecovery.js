const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const TEMPORARY_SECTION_KEY = /^(?:section[-_ ]?)?(?:\d{4,}|[12]0{2,}\d+)$/i;
const NUMBERED_SECTION = /^\s*(\d+(?:\.\d+){0,5})\.?\s+(.+?)\s*$/;

export function normalizeGuidelineText(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/([A-Za-zÀ-ỹ])-\u00AD?[\r\n]+([A-Za-zÀ-ỹ])/g, "$1-$2")
    .replace(/\u00AD/g, "")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/\uFB00/g, "ff").replace(/\uFB01/g, "fi").replace(/\uFB02/g, "fl")
    .replace(CONTROL_CHARACTERS, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/([A-Za-zÀ-ỹ])-[\r\n]+([a-zà-ỹ])/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function validSourcePage(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function sourceSectionIdentity(section) {
  const sourceKey = normalizeGuidelineText(section?.sourceKey || section?.source_key || "");
  const title = normalizeGuidelineText(section?.titleOriginal || section?.title_original || section?.titleVi || section?.title_vi || "");
  const titleMatch = title.match(NUMBERED_SECTION);
  const keyMatch = sourceKey.match(/(?:section|sec(?:tion)?)?[-_: ]*(\d+(?:\.\d+){0,5})\b/i);
  const number = titleMatch?.[1] || keyMatch?.[1] || "";
  const temporary = TEMPORARY_SECTION_KEY.test(sourceKey) || (!number && /^\d{4,}$/.test(sourceKey));
  return {
    number,
    title: titleMatch ? titleMatch[2] : title,
    temporary,
    canonicalKey: number ? `section:${number}` : "",
  };
}

export function sourceTableIdentity(item, table) {
  const candidate = normalizeGuidelineText(table?.sourceKey || item?.label || "");
  const number = candidate.match(/(?:supplementary\s+)?table\s*([A-Za-z]?\s*\d+(?:\.\d+)?)/i)?.[1]?.replace(/\s+/g, "") || "";
  return number ? `table:${number.toLowerCase()}` : "";
}

function sourceNumber(value) {
  const text = normalizeGuidelineText(value);
  const match = text.match(/(?:recommendation\s+)?(?:supplementary\s+)?table\s*([A-Za-z]?\s*\d+(?:\.\d+)?)/i) || text.match(/^([A-Za-z]?\s*\d+(?:\.\d+)?)/);
  return match?.[1]?.replace(/\s+/g, "") || "";
}

function numericTableNumber(value) {
  const match = sourceNumber(value).match(/^(?:[A-Za-z]+)?(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function compareSourceTables(left, right) {
  const leftOrder = Number(left?.sourceOrder ?? left?.source_order);
  const rightOrder = Number(right?.sourceOrder ?? right?.source_order);
  if (Number.isFinite(leftOrder) && Number.isFinite(rightOrder) && leftOrder !== rightOrder) return leftOrder - rightOrder;
  const leftPage = validSourcePage(left?.sourcePage ?? left?.source_page_start) || Number.MAX_SAFE_INTEGER;
  const rightPage = validSourcePage(right?.sourcePage ?? right?.source_page_start) || Number.MAX_SAFE_INTEGER;
  if (leftPage !== rightPage) return leftPage - rightPage;
  const leftNumber = numericTableNumber(left?.tableNumber || left?.sourceTableNumber || left?.label);
  const rightNumber = numericTableNumber(right?.tableNumber || right?.sourceTableNumber || right?.label);
  if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) return leftNumber - rightNumber;
  return 0;
}

export function compareSourceRows(left, right) {
  for (const [camel, snake] of [["sourceOrder", "source_order"], ["groupOrder", "group_order"], ["rowOrder", "row_order"]]) {
    const leftValue = Number(left?.[camel] ?? left?.[snake]);
    const rightValue = Number(right?.[camel] ?? right?.[snake]);
    if (Number.isFinite(leftValue) && Number.isFinite(rightValue) && leftValue !== rightValue) return leftValue - rightValue;
  }
  return 0;
}

export function missingRecommendationTableNumbers(items = []) {
  const numbers = [...new Set(items
    .filter((item) => item?.resourceType === "recommendation_table" || item?.contentType?.startsWith("recommendation_table"))
    .map((item) => numericTableNumber(item.sourceTableNumber || item.label))
    .filter((item) => item !== null))].sort((a, b) => a - b);
  if (numbers.length < 2) return [];
  const missing = [];
  for (let value = numbers[0]; value <= numbers.at(-1); value += 1) if (!numbers.includes(value)) missing.push(value);
  return missing;
}

export function structuralImportDiagnostics({ items = [], sections = [], recommendations = [], tables = [], issues = [] }) {
  const diagnostics = [];
  const add = (code, message, sourcePage = null, detail = {}) => diagnostics.push({ severity: "blocking", code, message, sourcePage: validSourcePage(sourcePage), ...detail });
  const note = (code, message, sourcePage = null, detail = {}) => diagnostics.push({ severity: "info", code, message, sourcePage: validSourcePage(sourcePage), ...detail });
  const tableKeys = new Set(tables.flatMap((table) => [table.sourceKey, table.source_key]).filter(Boolean));
  const temporarySections = sections.filter((section) => sourceSectionIdentity(section).temporary);
  temporarySections.forEach((section) => note("source_section_metadata_unresolved", `Mục nguồn ${section.sourceKey || section.source_key || section.titleOriginal || section.title_original || "không rõ"} chưa có số mục nguồn ổn định; không ảnh hưởng checklist Bảng khuyến cáo.`, section.sourcePage ?? section.source_page));
  recommendations.forEach((recommendation) => {
    if (!validSourcePage(recommendation.sourcePage ?? recommendation.source_page)) add("missing_source_page", `Khuyến cáo ${recommendation.sourceKey || recommendation.source_key || "không rõ"} thiếu trang nguồn.`, null);
    const tableKey = recommendation.tableSourceKey || recommendation.table_source_key;
    if (tableKey && !tableKeys.has(tableKey)) add("incomplete_table", `Không tìm thấy bảng nguồn ${tableKey} cho ${recommendation.sourceKey || recommendation.source_key || "không rõ"}.`, recommendation.sourcePage ?? recommendation.source_page);
    const original = normalizeGuidelineText(recommendation.recommendationTextOriginal || recommendation.recommendation_text_original || "");
    const translated = normalizeGuidelineText(recommendation.recommendationTextVi || recommendation.recommendation_text_vi || "");
    if (!translated || (/\b(?:the|and|should|recommended|patients)\b/i.test(translated) && /[À-ỹ]/.test(translated) === false)) add("mixed_language", `Khuyến cáo ${recommendation.sourceKey || recommendation.source_key || "không rõ"} chưa có bản tiếng Việt hoàn chỉnh.`, recommendation.sourcePage ?? recommendation.source_page);
    if (!original && !translated) add("incomplete_recommendation", `Khuyến cáo ${recommendation.sourceKey || recommendation.source_key || "không rõ"} chưa có nội dung.`, recommendation.sourcePage ?? recommendation.source_page);
  });
  const seen = new Set();
  recommendations.forEach((recommendation) => {
    const identity = normalizeGuidelineText(recommendation.recommendationTextOriginal || recommendation.recommendation_text_original || recommendation.recommendationTextVi || recommendation.recommendation_text_vi || "").toLowerCase();
    if (!identity) return;
    if (seen.has(identity)) add("duplicate_recommendation", "Phát hiện khuyến cáo trùng nội dung trong batch.", recommendation.sourcePage ?? recommendation.source_page);
    seen.add(identity);
  });
  const requiredTables = items.filter((item) => item.resourceType === "recommendation_table" || item.contentType === "recommendation_table_incomplete");
  requiredTables.forEach((item) => {
    const table = tables.find((candidate) => candidate.itemId === item.id || candidate.sourceKey === item.id || candidate.source_key === item.id);
    // The processing route already persists the canonical
    // recommendation_table_incomplete issue. Do not add a second blocking
    // incomplete_table diagnostic for the same item.
    if (item.contentType !== "recommendation_table_incomplete" && (!table || !Array.isArray(table.rows) || !table.rows.length)) add("incomplete_table", `${item.label || "Bảng khuyến cáo"} chưa được khôi phục đầy đủ.`, item.pageStart || null, { itemId: item.id });
    else if (!table.sectionSourceKey && !table.section_source_key) note("source_section_metadata_unresolved", `${item.label || "Bảng khuyến cáo"} chưa có Mục nguồn; title, trang và thứ tự nguồn vẫn được giữ.`, table.sourcePage || table.source_page || item.pageStart || null, { itemId: item.id });
    if (table?.continuationExpected && !validSourcePage(table.sourcePageEnd || table.source_page_end)) add("table_continuation_missing", `${item.label || "Bảng khuyến cáo"} thiếu trang tiếp nối đã được phát hiện.`, table.sourcePage || table.source_page || item.pageStart || null, { itemId: item.id });
  });
  const recoveredRequiredTables = requiredTables.filter((item) => tables.some((candidate) => candidate.itemId === item.id || candidate.sourceKey === item.id || candidate.source_key === item.id));
  if (requiredTables.length !== recoveredRequiredTables.length) {
    add("inventory_mismatch", `Inventory bảng khuyến cáo không khớp: phát hiện ${requiredTables.length}, khôi phục ${recoveredRequiredTables.length}.`);
  }
  const missingNumbers = missingRecommendationTableNumbers(requiredTables);
  // Numeric gaps are not proof of missing source tables: guideline editions
  // routinely skip numbers and supplementary tables use a separate sequence.
  // Keep this as a non-blocking diagnostic unless an explicit source inventory
  // confirms the missing numbers.
  if (missingNumbers.length) note("missing_recommendation_table", `Khoảng số bảng không liên tục trong các mục đã nhận diện: ${missingNumbers.map((number) => `Bảng ${number}`).join(", ")}. Cần đối chiếu mục lục nguồn, không tự coi là bảng bị mất.`);
  for (const issue of issues) if (issue?.severity === "blocking" && issue?.code) diagnostics.push({ ...issue, sourcePage: validSourcePage(issue.sourcePage ?? issue.source_page) });
  const unique = new Map();
  for (const diagnostic of diagnostics) {
    const key = [diagnostic.code, diagnostic.message, diagnostic.itemId || "", diagnostic.recommendation_id || ""].join("|");
    if (!unique.has(key)) unique.set(key, diagnostic);
  }
  return [...unique.values()];
}

export function canImportStructuredBatch(input) {
  const diagnostics = structuralImportDiagnostics(input);
  const blockers = diagnostics.filter((diagnostic) => diagnostic.severity === "blocking");
  return { valid: blockers.length === 0, blockers, diagnostics };
}

export function sourceSectionDisplay(section) {
  const identity = sourceSectionIdentity(section);
  return identity.number || "Mục chưa xác định";
}
