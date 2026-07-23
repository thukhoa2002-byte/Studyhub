import type { Drug } from "../types/drug";

const emptyLinks: string[] = [];

function sampleDrug(id: string, titleVi: string, genericName: string, drugClass: string): Drug {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id,
    slug: id,
    genericName,
    titleVi,
    aliases: [],
    brandNames: [],
    drugClass,
    specialties: [],
    indications: "",
    contraindications: "",
    dosing: "",
    renalAdjustment: "",
    hepaticAdjustment: "",
    pregnancy: "",
    breastfeeding: "",
    adverseEffects: "",
    interactions: "",
    monitoring: "",
    mechanism: "",
    references: [],
    guidelineReferences: [...emptyLinks],
    flashcardReferences: [...emptyLinks],
    quizReferences: [...emptyLinks],
    calculatorReferences: [...emptyLinks],
    flowchartReferences: [...emptyLinks],
    imageReferences: [...emptyLinks],
    notes: "Dữ liệu mẫu để kiểm thử giao diện; chưa phải nội dung sử dụng lâm sàng.",
    summary: "Hồ sơ mẫu chưa có dữ liệu lâm sàng được rà soát.",
    status: "draft",
    isPlaceholder: true,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };
}

export const drugs: Drug[] = [
  sampleDrug("aspirin", "Aspirin", "Aspirin", "Thuốc chống kết tập tiểu cầu"),
  sampleDrug("ticagrelor", "Ticagrelor", "Ticagrelor", "Thuốc chống kết tập tiểu cầu"),
  sampleDrug("enoxaparin", "Enoxaparin", "Enoxaparin", "Heparin trọng lượng phân tử thấp"),
];
