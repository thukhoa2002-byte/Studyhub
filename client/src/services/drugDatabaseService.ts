import { supabase } from "./supabase.ts";
import { drugRepository, type DatabaseDrug, type DatabaseDrugPreview } from "./drugRepository.ts";
import { normalizeDrugSlug, validateDrugDraft, validateDrugPublish, validateDrugStatusTransition } from "./drugValidation.ts";
import type { Drug, DrugStatus } from "../types/drug.ts";

function contentOf(drug: Partial<Drug>): Partial<Drug> { const { id: _id, slug: _slug, genericName: _genericName, titleVi: _titleVi, drugClass: _drugClass, specialties: _specialties, status: _status, createdAt: _createdAt, updatedAt: _updatedAt, publishedAt: _publishedAt, sourceVerified: _sourceVerified, reviewedAt: _reviewedAt, reviewedBy: _reviewedBy, publishedBy: _publishedBy, ...content } = drug; return content; }
function emptyArray<T>(value: T[] | undefined): T[] { return value || []; }

export function databaseDrugToDrug(row: DatabaseDrug): Drug {
  const content = row.content || {};
  return {
    id: row.id, slug: row.slug, genericName: row.generic_name, titleVi: row.title_vi || row.generic_name,
    aliases: emptyArray(content.aliases), brandNames: emptyArray(content.brandNames), dosageForms: emptyArray(content.dosageForms), routes: emptyArray(content.routes), drugClass: row.drug_class, specialties: emptyArray(row.specialties),
    indications: content.indications || "", contraindications: content.contraindications || "", dosing: content.dosing || "", renalAdjustment: content.renalAdjustment || "", hepaticAdjustment: content.hepaticAdjustment || "", pregnancy: content.pregnancy || "", breastfeeding: content.breastfeeding || "", adverseEffects: content.adverseEffects || "", interactions: content.interactions || "", monitoring: content.monitoring || "", mechanism: content.mechanism || "", pharmacodynamics: content.pharmacodynamics || "",
    indicationsDetailed: emptyArray(content.indicationsDetailed), dosingRegimens: emptyArray(content.dosingRegimens), elderlyAdjustment: content.elderlyAdjustment || "", pediatricAdjustment: content.pediatricAdjustment || "", specialPopulationAdjustments: content.specialPopulationAdjustments || "", precautions: content.precautions || "", references: emptyArray(content.references), sourceReferences: emptyArray(content.sourceReferences), guidelineLinks: [], guidelineReferences: [], flashcardReferences: emptyArray(content.flashcardReferences), quizReferences: emptyArray(content.quizReferences), calculatorReferences: [], flowchartReferences: emptyArray(content.flowchartReferences), imageReferences: emptyArray(content.imageReferences), notes: content.notes || "", summary: content.summary || "", status: row.status, isPlaceholder: false, createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at, sourceVerified: row.source_verified, reviewedAt: row.reviewed_at, reviewedBy: row.reviewed_by, publishedBy: row.published_by, importMetadata: content.importMetadata, localizedContent: content.localizedContent, provenance: emptyArray(content.provenance),
  };
}

export function databaseDrugPreviewToDrug(row: DatabaseDrugPreview): Pick<Drug, "id" | "slug" | "genericName" | "titleVi" | "drugClass" | "specialties" | "status" | "publishedAt"> {
  return {
    id: row.id,
    slug: row.slug,
    genericName: row.generic_name,
    titleVi: row.title_vi || row.generic_name,
    drugClass: row.drug_class,
    specialties: emptyArray(row.specialties),
    status: row.status,
    publishedAt: row.published_at,
  };
}

export async function getCurrentDrugActorId(): Promise<string> { if (!supabase) throw new Error("Supabase chưa được cấu hình."); const { data, error } = await supabase.auth.getUser(); if (error || !data.user) throw new Error("Phiên đăng nhập không hợp lệ."); return data.user.id; }
export async function listAdminDrugs(query = ""): Promise<Drug[]> { return (await drugRepository.list({ query })).map(databaseDrugToDrug); }
export async function listPublishedDrugs(query = ""): Promise<Drug[]> { return (await drugRepository.list({ query, publishedOnly: true })).map(databaseDrugToDrug); }
export async function listPublishedDrugPreviews(): Promise<Array<Pick<Drug, "id" | "slug" | "genericName" | "titleVi" | "drugClass" | "specialties" | "status" | "publishedAt">>> { return (await drugRepository.listPublicPreviews()).map(databaseDrugPreviewToDrug); }
export async function getDrugById(id: string): Promise<Drug | null> { const row = await drugRepository.findById(id); return row ? databaseDrugToDrug(row) : null; }
export async function getPublishedDrugBySlug(slug: string): Promise<Drug | null> { const row = await drugRepository.findBySlug(slug, true); return row ? databaseDrugToDrug(row) : null; }

export async function saveDrugDraft(actorId: string, input: Partial<Drug>, existingId?: string): Promise<Drug> {
  const genericName = (input.genericName || "").trim(); const errors = validateDrugDraft({ genericName } as Drug); if (errors.length) throw new Error(errors.join(" "));
  const current = existingId ? await drugRepository.findById(existingId) : null;
  const baseSlug = normalizeDrugSlug(input.slug || genericName); if (!baseSlug) throw new Error("Slug không hợp lệ.");
  let slug = current?.slug || baseSlug; if (!current) { let suffix = 2; while (await drugRepository.findBySlug(slug)) slug = `${baseSlug}-${suffix++}`; }
  const payload = {
    slug,
    generic_name: genericName,
    title_vi: input.titleVi?.trim() || genericName,
    drug_class: input.drugClass?.trim() || "",
    specialties: input.specialties || [],
    source_verified: Boolean(input.sourceVerified),
    content: contentOf(input),
  };
  const row = current ? await drugRepository.update(current.id, payload) : await drugRepository.create({ ...payload, owner_id: actorId, status: "draft", reviewed_by: null, reviewed_at: null, published_by: null, published_at: null, archived_by: null, archived_at: null });
  return databaseDrugToDrug(row);
}

export async function transitionDrug(id: string, status: DrugStatus, actorId: string): Promise<Drug> {
  const current = await getDrugById(id); if (!current) throw new Error("Không tìm thấy thuốc.");
  const transitionErrors = validateDrugStatusTransition(current.status, status); if (transitionErrors.length) throw new Error(transitionErrors.join(" "));
  if (status === "published") { const errors = validateDrugPublish(current); if (errors.length) throw new Error(errors.join(" ")); }
  const row = await drugRepository.update(id, { status, published_by: status === "published" ? actorId : current.publishedBy, published_at: status === "published" ? new Date().toISOString() : current.publishedAt, archived_by: status === "archived" ? actorId : null, archived_at: status === "archived" ? new Date().toISOString() : null });
  return databaseDrugToDrug(row);
}
export async function archiveDrug(id: string, actorId: string) { return transitionDrug(id, "archived", actorId); }
export async function restoreDrugToDraft(id: string, actorId: string) { return transitionDrug(id, "draft", actorId); }
export async function republishDrug(id: string, actorId: string) { return transitionDrug(id, "published", actorId); }
export async function getDrugDeleteBlockers(id: string): Promise<string[]> {
  const count = await drugRepository.countRecommendationRelations(id);
  return count ? [`${count} liên kết Recommendation ↔ Thuốc đang tồn tại. Hãy gỡ liên kết trước khi xóa.`] : [];
}
export async function deleteDrugPermanently(id: string): Promise<void> {
  const current = await getDrugById(id); if (!current) return;
  if (current.status === "published") throw new Error("Thuốc đã xuất bản phải được lưu trữ trước khi xóa.");
  if (current.status !== "draft" && current.status !== "archived") throw new Error("Chỉ bản nháp hoặc thuốc đã lưu trữ mới được xóa vĩnh viễn.");
  const blockers = await getDrugDeleteBlockers(id); if (blockers.length) throw new Error(blockers.join(" "));
  await drugRepository.deletePermanently(id);
}
export async function deleteDrugDraft(id: string): Promise<void> { return deleteDrugPermanently(id); }
